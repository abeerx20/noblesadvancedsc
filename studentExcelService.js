import ExcelJS from "exceljs";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { getClassOrThrow, listClasses } from "./classService.js";
import { AppError } from "../utils/AppError.js";
import { normalizeText } from "../utils/text.js";
import { studentSchema } from "../validators/schemas.js";
import { listStudents } from "./studentService.js";

const headerAliases = {
  fullName: ["full_name", "fullname", "اسم الطالب", "الاسم الرباعي", "الاسم"],
  guardianPhone: ["guardian_phone", "guardianphone", "جوال ولي الأمر", "رقم ولي الأمر"],
  nationalId: ["national_id", "nationalid", "رقم الهوية", "الهوية"],
  serialNumber: ["serial_number", "serialnumber", "م", "التسلسل"],
  stage: ["stage", "المرحلة"],
  grade: ["grade", "الصف"],
  section: ["section", "الشعبة"],
  gender: ["gender", "الجنس"]
};

const stageMap = { "رياض الأطفال": "kindergarten", "الروضة": "kindergarten", kindergarten: "kindergarten", "الابتدائي": "primary", primary: "primary" };
const gradeMap = { "الروضة الأولى": "KG1", KG1: "KG1", "الروضة الثانية": "KG2", KG2: "KG2", "الروضة الثالثة": "KG3", KG3: "KG3", "الأول الابتدائي": "Grade1", Grade1: "Grade1", "الثاني الابتدائي": "Grade2", Grade2: "Grade2", "الثالث الابتدائي": "Grade3", Grade3: "Grade3" };
const genderMap = { مختلط: "mixed", mixed: "mixed", بنين: "male", male: "male", بنات: "female", female: "female" };

function normalizedHeader(value) {
  return normalizeText(String(value ?? "")).toLowerCase().replace(/\s/g, "_");
}

function buildHeaders(row) {
  const result = {};
  row.eachCell((cell, column) => {
    const normalized = normalizedHeader(cell.text);
    for (const [field, aliases] of Object.entries(headerAliases)) {
      if (aliases.some((alias) => normalizedHeader(alias) === normalized)) result[field] = column;
    }
  });
  return result;
}

function cellText(row, column) {
  return column ? normalizeText(row.getCell(column).text) : "";
}

async function readRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer, { ignoreNodes: ["dataValidations", "extLst"] });
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError(422, "EMPTY_WORKBOOK", "ملف Excel لا يحتوي على ورقة عمل.");
  if (sheet.rowCount > 501) throw new AppError(422, "TOO_MANY_ROWS", "الحد الأقصى للاستيراد هو 500 طالب في العملية الواحدة.");
  const headers = buildHeaders(sheet.getRow(1));
  if (!headers.fullName) throw new AppError(422, "MISSING_NAME_COLUMN", "يجب أن يحتوي الملف على عمود اسم الطالب.");
  return { sheet, headers };
}

function findClass(classes, row, headers) {
  const stage = stageMap[cellText(row, headers.stage)] ?? cellText(row, headers.stage);
  const grade = gradeMap[cellText(row, headers.grade)] ?? cellText(row, headers.grade);
  const gender = genderMap[cellText(row, headers.gender)] ?? cellText(row, headers.gender);
  const section = cellText(row, headers.section);
  return classes.find((item) => item.stage === stage && item.grade === grade && item.gender === gender && normalizeText(item.section) === section);
}

export async function importStudents(user, buffer, fixedClassId) {
  const { sheet, headers } = await readRows(buffer);
  const classes = fixedClassId ? [await getClassOrThrow(fixedClassId)] : await listClasses();
  if (!fixedClassId && (!headers.stage || !headers.grade || !headers.section || !headers.gender)) {
    throw new AppError(422, "MISSING_SCHOOL_COLUMNS", "الاستيراد الشامل يحتاج أعمدة المرحلة والصف والشعبة والجنس.");
  }

  const records = [];
  const errors = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || !cellText(row, headers.fullName)) return;
    const academicClass = fixedClassId ? classes[0] : findClass(classes, row, headers);
    if (!academicClass) {
      errors.push({ row: rowNumber, message: "لم يتم العثور على فصل مطابق للمرحلة والصف والشعبة والجنس." });
      return;
    }
    const candidate = {
      fullName: cellText(row, headers.fullName),
      stage: academicClass.stage,
      grade: academicClass.grade,
      classId: academicClass.id,
      gender: academicClass.gender,
      guardianPhone: cellText(row, headers.guardianPhone),
      nationalId: cellText(row, headers.nationalId),
      serialNumber: cellText(row, headers.serialNumber) ? Number(cellText(row, headers.serialNumber)) : undefined,
      active: true
    };
    const parsed = studentSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues[0].message });
      return;
    }
    records.push(parsed.data);
  });

  if (errors.length) throw new AppError(422, "IMPORT_VALIDATION_FAILED", "لم يتم الاستيراد لوجود أخطاء في الملف.", errors.slice(0, 30));
  if (!records.length) throw new AppError(422, "NO_STUDENTS", "لم يتم العثور على بيانات طلاب صالحة للاستيراد.");

  const existingSnapshot = await db.collection("students").where("active", "==", true).limit(2000).get();
  const existingKeys = new Set(existingSnapshot.docs.map((doc) => `${doc.data().classId}|${normalizeText(doc.data().fullName)}`));
  const batchKeys = new Set();
  for (const record of records) {
    const key = `${record.classId}|${record.fullName}`;
    if (existingKeys.has(key) || batchKeys.has(key)) throw new AppError(409, "DUPLICATE_IMPORT_STUDENT", `الطالب ${record.fullName} مسجل مسبقًا في الفصل نفسه.`);
    batchKeys.add(key);
  }

  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = db.batch();
    records.slice(offset, offset + 400).forEach((record) => {
      const ref = db.collection("students").doc();
      batch.create(ref, {
        ...record,
        createdBy: user.uid,
        importType: fixedClassId ? "class" : "school",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
  }
  return records.length;
}

export async function exportStudentsWorkbook(user, classId) {
  const academicClass = await getClassOrThrow(classId);
  const rows = await listStudents(user, { classId, limit: 200 });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MyNas";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("قائمة الطلاب", { views: [{ rightToLeft: true }] });
  sheet.columns = [
    { header: "م", key: "serialNumber", width: 9 },
    { header: "اسم الطالب", key: "fullName", width: 38 },
    { header: "الصف", key: "grade", width: 20 },
    { header: "الشعبة", key: "section", width: 14 },
    { header: "الجنس", key: "gender", width: 14 },
    { header: "رقم الهوية", key: "nationalId", width: 18 },
    { header: "جوال ولي الأمر", key: "guardianPhone", width: 18 }
  ];
  rows.forEach((student, index) => sheet.addRow({
    serialNumber: student.serialNumber ?? index + 1,
    fullName: student.fullName,
    grade: student.grade,
    section: academicClass.section,
    gender: student.gender,
    nationalId: student.nationalId ?? "",
    guardianPhone: student.guardianPhone ?? ""
  }));
  sheet.getRow(1).font = { name: "Arial", bold: false, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064236" } };
  sheet.eachRow((row) => { row.alignment = { horizontal: "right", vertical: "middle" }; });
  return workbook.xlsx.writeBuffer();
}

