import ExcelJS from "exceljs";
import { normalizeText } from "../utils/text.js";
import { AppError } from "../utils/AppError.js";
import { employeeSchema } from "../validators/schemas.js";
import { createEmployee } from "./employeeService.js";
import { db } from "../config/firebase.js";

const aliases = {
    nameAr: ["اسم الموظفة", "الاسم العربي", "name_ar"],
    nameEn: ["الاسم الإنجليزي", "الاسم الانجليزي", "name_en"],
    nationalId: ["رقم الهوية", "الهوية", "national_id"],
    email: ["البريد الإلكتروني", "البريد الالكتروني", "email"],
    password: ["كلمة المرور", "كلمه المرور", "password"],
    phone: ["رقم الجوال", "الجوال", "phone"],
    employeeNumber: ["الرقم الوظيفي", "رقم الموظفة", "employee_number"],
    role: ["الدور", "المسمى الوظيفي", "role"]
};

const roleMap = {
    "معلمة": "teacher", "مديرة المدرسة": "principal", "وكيلة": "vice_principal", "الموارد البشرية": "hr",
    "تقنية المعلومات": "it_teacher", "إدارية": "admin", "القبول والتسجيل": "registrar", "المحاسبة": "accountant",
    "طبيبة": "doctor", "مسؤولة النظام": "system_admin", "مسؤولة الجداول": "schedule_admin", "الإدارة العليا": "upper_management"
};

function normalizedHeader(value) {
    return normalizeText(String(value ?? "")).toLowerCase().replace(/[\s_-]+/g, "_");
}

function readHeaders(row) {
    const headers = {};
    row.eachCell((cell, column) => {
        const name = normalizedHeader(cell.text);
        for (const [field, names] of Object.entries(aliases)) {
            if (names.some((candidate) => normalizedHeader(candidate) === name)) headers[field] = column;
        }
    });
    return headers;
}

function cellText(row, column) {
    return column ? normalizeText(row.getCell(column).text) : "";
}

async function parseWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer, { ignoreNodes: ["dataValidations", "extLst"] });
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new AppError(422, "EMPTY_WORKBOOK", "ملف Excel لا يحتوي على ورقة عمل.");
    if (sheet.rowCount > 501) throw new AppError(422, "TOO_MANY_ROWS", "الحد الأقصى هو 500 موظفة في الملف الواحد.");
    const headers = readHeaders(sheet.getRow(1));
    const required = ["nameAr", "nationalId", "email", "password", "phone", "employeeNumber", "role"];
    if (required.some((field) => !headers[field])) {
        throw new AppError(422, "MISSING_REQUIRED_COLUMNS", "يجب أن يحتوي الملف على أعمدة: اسم الموظفة، رقم الهوية، البريد الإلكتروني، كلمة المرور، رقم الجوال، الرقم الوظيفي، الدور.");
    }
    const rows = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1 || !cellText(row, headers.nameAr)) return;
        const nameAr = cellText(row, headers.nameAr);
        rows.push({
            row: rowNumber,
            nameAr,
            nameEn: cellText(row, headers.nameEn) || nameAr,
            nationalId: cellText(row, headers.nationalId),
            email: cellText(row, headers.email).toLowerCase(),
            password: cellText(row, headers.password),
            phone: cellText(row, headers.phone),
            employeeNumber: cellText(row, headers.employeeNumber),
            role: roleMap[cellText(row, headers.role)] ?? cellText(row, headers.role)
        });
    });
    if (!rows.length) throw new AppError(422, "NO_ROWS", "لم يتم العثور على صفوف موظفات في الملف.");
    return rows;
}

function accountData(row) {
    return {
        ...row,
        department: "غير محدد",
        hireDate: new Date().toISOString().slice(0, 10),
        employmentType: "full_time",
        employmentStatus: "active",
        qualification: "غير محدد",
        specialization: "غير محدد",
        status: "active"
    };
}

export async function previewEmployeeWorkbook(buffer, actor) {
    const rows = await parseWorkbook(buffer);
    const existing = (await db.collection("employees").limit(1000).get()).docs.map((doc) => doc.data());
    const accepted = [];
    const rejected = [];
    const seen = new Set();
    for (const row of rows) {
        const data = accountData(row);
        const duplicateInFile = [row.email, row.nationalId, row.employeeNumber].some((value) => seen.has(value));
        const duplicateInDatabase = existing.some((employee) => employee.email === row.email || employee.nationalId === row.nationalId || employee.employeeNumber === row.employeeNumber);
        if (duplicateInFile || duplicateInDatabase) {
            rejected.push({ row: row.row, nameAr: row.nameAr, reason: "البريد أو رقم الهوية أو الرقم الوظيفي مكرر." });
            continue;
        }
        const parsed = employeeSchema.safeParse(data);
        if (!parsed.success) {
            rejected.push({ row: row.row, nameAr: row.nameAr, reason: parsed.error.issues[0].message });
            continue;
        }
        if (!actor || (actor.employee?.role !== "system_admin" && ["principal", "vice_principal", "admin", "schedule_admin", "upper_management"].includes(parsed.data.role))) {
            rejected.push({ row: row.row, nameAr: row.nameAr, reason: "لا تملك صلاحية إنشاء هذا الدور." });
            continue;
        }
        seen.add(row.email); seen.add(row.nationalId); seen.add(row.employeeNumber);
        accepted.push({ row: row.row, nameAr: row.nameAr, email: row.email, employeeNumber: row.employeeNumber, role: parsed.data.role, data: parsed.data });
    }
    return { accepted, rejected };
}

export async function commitEmployeeWorkbook(buffer, actor) {
    const preview = await previewEmployeeWorkbook(buffer, actor);
    const accepted = [];
    const rejected = [...preview.rejected];
    for (const row of preview.accepted) {
        try {
            const id = await createEmployee(row.data, actor);
            accepted.push({ row: row.row, nameAr: row.nameAr, email: row.email, id });
        } catch (error) {
            rejected.push({ row: row.row, nameAr: row.nameAr, reason: error instanceof AppError ? error.message : "تعذر إنشاء الحساب." });
        }
    }
    return { accepted, rejected };
}
