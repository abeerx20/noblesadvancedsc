import ExcelJS from "exceljs";
import { normalizeText } from "../utils/text.js";
import { AppError } from "../utils/AppError.js";
import { parentSchema } from "../validators/schemas.js";
import { createParent } from "./parentAdminService.js";
import { db } from "../config/firebase.js";

const aliases = {
    nameAr: ["اسم ولي الأمر", "اسم ولي الامر", "ولي الأمر", "name", "name_ar"],
    nationalId: ["رقم هوية ولي الأمر", "هوية ولي الأمر", "رقم الهوية", "national_id"],
    email: ["البريد الإلكتروني", "البريد الالكتروني", "email"],
    phone: ["رقم الجوال", "الجوال", "الهاتف", "phone"],
    password: ["كلمة المرور", "كلمه المرور", "password"],
    studentNationalIds: ["أرقام هويات الأبناء", "ارقام هويات الابناء", "هويات الأبناء", "student_national_ids"]
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

function splitIdentifiers(value) {
    return [...new Set(String(value ?? "").split(/[،,;\n]+/).map((item) => item.trim()).filter(Boolean))];
}

async function loadStudents(identifiers) {
    const snapshots = await Promise.all(identifiers.map((identifier) => (
        /^\d{10}$/.test(identifier)
            ? db.collection("students").where("nationalId", "==", identifier).limit(2).get()
            : db.collection("students").doc(identifier).get().then((snapshot) => ({ docs: snapshot.exists ? [snapshot] : [] }))
    )));
    const students = [];
    const missing = [];
    identifiers.forEach((identifier, index) => {
        const docs = snapshots[index].docs;
        if (docs.length !== 1 || docs[0].data().active === false) missing.push(identifier);
        else students.push(docs[0]);
    });
    return { students, missing };
}

async function parseWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer, { ignoreNodes: ["dataValidations", "extLst"] });
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new AppError(422, "EMPTY_WORKBOOK", "ملف Excel لا يحتوي على ورقة عمل.");
    if (sheet.rowCount > 501) throw new AppError(422, "TOO_MANY_ROWS", "الحد الأقصى هو 500 ولي أمر في الملف الواحد.");
    const headers = readHeaders(sheet.getRow(1));
    const required = ["nameAr", "nationalId", "email", "phone", "password", "studentNationalIds"];
    if (required.some((field) => !headers[field])) {
        throw new AppError(422, "MISSING_REQUIRED_COLUMNS", "يجب أن يحتوي الملف على أعمدة: اسم ولي الأمر، رقم الهوية، البريد الإلكتروني، رقم الجوال، كلمة المرور، أرقام هويات الأبناء.");
    }
    const rows = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1 || !cellText(row, headers.nameAr)) return;
        rows.push({
            row: rowNumber,
            nameAr: cellText(row, headers.nameAr),
            nationalId: cellText(row, headers.nationalId),
            email: cellText(row, headers.email),
            phone: cellText(row, headers.phone),
            password: cellText(row, headers.password),
            studentIdentifiers: splitIdentifiers(cellText(row, headers.studentNationalIds))
        });
    });
    if (!rows.length) throw new AppError(422, "NO_ROWS", "لم يتم العثور على صفوف أولياء أمور في الملف.");
    return rows;
}

async function buildPreview(buffer) {
    const rows = await parseWorkbook(buffer);
    const existingParents = (await db.collection("parents").limit(1000).get()).docs.map((doc) => doc.data());
    const accepted = [];
    const rejected = [];
    const seenEmails = new Set();
    const seenNationalIds = new Set();

    for (const row of rows) {
        const email = row.email.toLowerCase();
        const duplicateInFile = seenEmails.has(email) || seenNationalIds.has(row.nationalId);
        const duplicateInDatabase = existingParents.some((parent) => parent.email === email || parent.nationalId === row.nationalId);
        if (duplicateInFile || duplicateInDatabase) {
            rejected.push({ row: row.row, nameAr: row.nameAr, reason: "البريد الإلكتروني أو رقم الهوية مكرر." });
            continue;
        }
        const { students, missing } = await loadStudents(row.studentIdentifiers);
        if (missing.length) {
            rejected.push({ row: row.row, nameAr: row.nameAr, reason: `لم يتم العثور على أبناء بهذه المعرفات: ${missing.join("، ")}.` });
            continue;
        }
        const parsed = parentSchema.safeParse({
            nameAr: row.nameAr,
            nationalId: row.nationalId,
            email,
            password: row.password,
            phone: row.phone,
            studentIds: students.map((student) => student.id),
            status: "active"
        });
        if (!parsed.success) {
            rejected.push({ row: row.row, nameAr: row.nameAr, reason: parsed.error.issues[0].message });
            continue;
        }
        seenEmails.add(email);
        seenNationalIds.add(row.nationalId);
        accepted.push({ row: row.row, nameAr: row.nameAr, email, phone: row.phone, studentCount: students.length, data: parsed.data });
    }
    return { accepted, rejected };
}

export async function previewParentWorkbook(buffer) {
    return buildPreview(buffer);
}

export async function commitParentWorkbook(buffer, actor) {
    const preview = await buildPreview(buffer);
    const accepted = [];
    const rejected = [...preview.rejected];
    for (const row of preview.accepted) {
        try {
            const id = await createParent(row.data, actor);
            accepted.push({ row: row.row, nameAr: row.nameAr, email: row.email, id });
        } catch (error) {
            rejected.push({ row: row.row, nameAr: row.nameAr, reason: error instanceof AppError ? error.message : "تعذر إنشاء الحساب." });
        }
    }
    return { accepted, rejected };
}
