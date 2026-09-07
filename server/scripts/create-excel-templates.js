import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates");

async function writeTemplate(filename, columns) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("الطلاب", { views: [{ rightToLeft: true }] });
  sheet.columns = columns.map(([header, key, width]) => ({ header, key, width }));
  sheet.getRow(1).font = { name: "Arial", bold: false, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064236" } };
  sheet.eachRow((row) => { row.alignment = { horizontal: "right", vertical: "middle" }; });
  await workbook.xlsx.writeFile(path.join(root, filename));
}

await writeTemplate("students-class-template.xlsx", [
  ["م", "serialNumber", 9], ["اسم الطالب", "fullName", 36], ["الجنس", "gender", 12]
]);

await writeTemplate("students-school-template.xlsx", [
  ["م", "serialNumber", 9], ["اسم الطالب", "fullName", 36], ["المرحلة", "stage", 18], ["الصف", "grade", 20], ["الشعبة", "section", 12], ["الجنس", "gender", 12]
]);

console.info("تم إنشاء قوالب Excel.");
