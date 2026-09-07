import { createStudent, deleteStudent, listStudents, updateStudent } from "../services/studentService.js";
import { writeAudit } from "../services/auditService.js";
import { exportStudentsWorkbook, importStudents } from "../services/studentExcelService.js";
import { AppError } from "../utils/AppError.js";

export async function index(req, res) {
  res.json({ success: true, data: await listStudents(req.user, req.validated?.query ?? req.query) });
}

export async function create(req, res) {
  const id = await createStudent(req.user, req.body);
  await writeAudit({ req, action: "create", entityType: "student", entityId: id, summary: { classId: req.body.classId } });
  res.status(201).json({ success: true, data: { id }, message: "تمت إضافة الطالب بنجاح." });
}

export async function update(req, res) {
  await updateStudent(req.user, req.params.id, req.body);
  await writeAudit({ req, action: "update", entityType: "student", entityId: req.params.id });
  res.json({ success: true, message: "تم تحديث بيانات الطالب بنجاح." });
}

export async function remove(req, res) {
  await deleteStudent(req.user, req.params.id);
  await writeAudit({ req, action: "soft_delete", entityType: "student", entityId: req.params.id });
  res.json({ success: true, message: "تم حذف الطالب بنجاح." });
}

export async function importClass(req, res) {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "اختاري ملف Excel.");
  if (!/^[\p{L}\p{N}_-]{1,180}$/u.test(req.body.classId ?? "")) throw new AppError(422, "CLASS_REQUIRED", "اختاري الفصل المراد استيراده.");
  const count = await importStudents(req.user, req.file.buffer, req.body.classId);
  await writeAudit({ req, action: "import", entityType: "students", summary: { classId: req.body.classId, count } });
  res.status(201).json({ success: true, data: { count }, message: `تم استيراد ${count} طالب بنجاح.` });
}

export async function importSchool(req, res) {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "اختاري ملف Excel.");
  const count = await importStudents(req.user, req.file.buffer);
  await writeAudit({ req, action: "school_import", entityType: "students", summary: { count } });
  res.status(201).json({ success: true, data: { count }, message: `تم استيراد ${count} طالب بنجاح دون دمج فصول البنين والبنات.` });
}

export async function exportClass(req, res) {
  const query = req.validated?.query ?? req.query;
  const buffer = await exportStudentsWorkbook(req.user, query.classId);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="students-${query.classId}.xlsx"`);
  res.send(Buffer.from(buffer));
}
