import ExcelJS from "exceljs";
import { normalizeText } from "../utils/text.js";
import { AppError } from "../utils/AppError.js";
import { studentRosterSchema } from "../validators/schemas.js";
import {
  createRosterEntry,
  findDuplicateStudentField,
  listRoster,
  studentDuplicateKeys,
  validateStudentGenderForClass
} from "./studentRosterService.js";
import { getClassOrThrow } from "./classService.js";

const aliases = {
  fullName: ["اسم الطالب", "الاسم", "الاسم الرباعي", "full_name", "fullname"],
  gender: ["الجنس", "gender"],
  guardianPhone: ["جوال ولي الأمر", "رقم ولي الأمر", "guardian_phone"],
  nationalId: ["رقم الهوية", "الهوية", "national_id"]
};

const genderMap = {
  بنين: "male",
  ذكر: "male",
  male: "male",
  بنات: "female",
  أنثى: "female",
  انثى: "female",
  female: "female"
};

function normalizedHeader(value) {
  return normalizeText(String(value ?? "")).toLowerCase().replace(/\s/g, "_");
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

export async function previewRosterWorkbook(user, buffer, classId, subject) {
  const academicClass = await getClassOrThrow(classId);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer, { ignoreNodes: ["dataValidations", "extLst"] });
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError(422, "EMPTY_WORKBOOK", "ملف Excel لا يحتوي على ورقة عمل.");
  if (sheet.rowCount > 501) throw new AppError(422, "TOO_MANY_ROWS", "الحد الأقصى هو 500 طالب في الملف الواحد.");
  const headers = readHeaders(sheet.getRow(1));
  if (!headers.fullName || !headers.gender) {
    throw new AppError(422, "MISSING_REQUIRED_COLUMNS", "يجب أن يحتوي الملف على عمودي اسم الطالب والجنس.");
  }

  const accepted = [];
  const rejected = [];
  const seen = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || !cellText(row, headers.fullName)) return;
    const rawGender = cellText(row, headers.gender).toLocaleLowerCase("ar");
    const candidate = {
      fullName: cellText(row, headers.fullName),
      classId,
      subject,
      gender: genderMap[rawGender] ?? rawGender,
      guardianPhone: cellText(row, headers.guardianPhone),
      nationalId: cellText(row, headers.nationalId)
    };
    const parsed = studentRosterSchema.safeParse(candidate);
    if (!parsed.success) {
      rejected.push({ row: rowNumber, fullName: candidate.fullName, reason: parsed.error.issues[0].message });
      return;
    }
    const duplicateField = findDuplicateStudentField(parsed.data, seen);
    if (duplicateField) {
      const duplicateLabels = {
        fullName: "الاسم الكامل",
        nationalId: "رقم الهوية",
        guardianPhone: "جوال ولي الأمر"
      };
      rejected.push({
        row: rowNumber,
        fullName: parsed.data.fullName,
        reason: `الطالب مكرر داخل الملف بواسطة ${duplicateLabels[duplicateField]}.`
      });
      return;
    }
    seen.push({ id: `row-${rowNumber}`, ...parsed.data });
    try {
      validateStudentGenderForClass(academicClass, parsed.data.gender);
      accepted.push({ row: rowNumber, ...parsed.data });
    } catch (error) {
      rejected.push({
        row: rowNumber,
        fullName: parsed.data.fullName,
        reason: error instanceof AppError ? error.message : "الجنس لا يتوافق مع الفصل."
      });
    }
  });
  if (!accepted.length && !rejected.length) {
    throw new AppError(422, "NO_ROWS", "لم يتم العثور على صفوف طلاب في الملف.");
  }
  const existing = await listRoster(user, { classId, subject, limit: 200 });
  const newRows = [];
  accepted.forEach((row) => {
    const duplicateField = findDuplicateStudentField(row, existing);
    if (duplicateField) {
      const duplicateLabels = {
        fullName: "الاسم الكامل",
        nationalId: "رقم الهوية",
        guardianPhone: "جوال ولي الأمر"
      };
      rejected.push({
        row: row.row,
        fullName: row.fullName,
        reason: `الطالب مضاف مسبقًا؛ تطابق ${duplicateLabels[duplicateField]}.`
      });
    } else {
      const keys = studentDuplicateKeys(row);
      newRows.push({
        ...row,
        nationalId: keys.nationalId,
        guardianPhone: keys.guardianPhone
      });
    }
  });
  return { accepted: newRows, rejected };
}

export async function commitRosterWorkbook(user, buffer, classId, subject) {
  const preview = await previewRosterWorkbook(user, buffer, classId, subject);
  const accepted = [];
  const rejected = [...preview.rejected];
  for (const row of preview.accepted) {
    try {
      const id = await createRosterEntry(user, row);
      accepted.push({ row: row.row, fullName: row.fullName, id });
    } catch (error) {
      rejected.push({
        row: row.row,
        fullName: row.fullName,
        reason: error instanceof AppError ? error.message : "تعذر حفظ الصف."
      });
    }
  }
  return { accepted, rejected };
}

export async function exportRosterWorkbook(user, classId, subject) {
  const rows = await listRoster(user, { classId, subject, status: "active", limit: 200 });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MyNas";
  const sheet = workbook.addWorksheet("قائمة الطلاب", { views: [{ rightToLeft: true }] });
  sheet.columns = [
    { header: "م", key: "serialNumber", width: 8 },
    { header: "اسم الطالب", key: "fullName", width: 38 },
    { header: "الجنس", key: "gender", width: 12 },
    { header: "المادة", key: "subject", width: 22 }
  ];
  rows.forEach((student, index) => sheet.addRow({
    serialNumber: index + 1,
    fullName: student.fullName,
    gender: student.gender === "male" ? "بنين" : "بنات",
    subject
  }));
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F6B55" } };
  sheet.getRow(1).font = { name: "Arial", color: { argb: "FFFFFFFF" } };
  sheet.eachRow((row) => { row.alignment = { horizontal: "right", vertical: "middle" }; });
  return workbook.xlsx.writeBuffer();
}
