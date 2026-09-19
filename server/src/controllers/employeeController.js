import { createEmployee, deleteEmployee, getAccess, listEmployees, resetEmployeePassword, updateAccess } from "../services/employeeService.js";
import { commitEmployeeWorkbook, previewEmployeeWorkbook } from "../services/employeeExcelService.js";
import { writeAudit } from "../services/auditService.js";
import { AppError } from "../utils/AppError.js";

export async function index(req, res) {
  const query = req.validated?.query ?? req.query;
  res.json({ success: true, data: await listEmployees(Number(query.limit ?? 200)) });
}

export async function create(req, res) {
  const id = await createEmployee(req.body, req.user);
  await writeAudit({ req, action: "create", entityType: "employee", entityId: id });
  res.status(201).json({ success: true, data: { id }, message: "تم إنشاء ملف الموظفة بنجاح." });
}

function importFile(req) {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "اختاري ملف Excel.");
  return req.file.buffer;
}

export async function previewImport(req, res) {
  const result = await previewEmployeeWorkbook(importFile(req), req.user);
  const accepted = result.accepted.map(({ data: _data, ...row }) => row);
  res.json({ success: true, data: { ...result, accepted }, message: "تمت معاينة الملف، ولم تُحفظ أي حسابات بعد." });
}

export async function commitImport(req, res) {
  const result = await commitEmployeeWorkbook(importFile(req), req.user);
  await writeAudit({ req, action: "bulk_create", entityType: "employee", summary: { accepted: result.accepted.length, rejected: result.rejected.length } });
  res.status(201).json({ success: true, data: result, message: `تم إنشاء ${result.accepted.length} حساب موظفة، ورفض ${result.rejected.length} صف.` });
}

export async function access(req, res) {
  res.json({ success: true, data: await getAccess(req.params.id) });
}

export async function updatePermissions(req, res) {
  await updateAccess(req.user, req.params.id, req.body);
  await writeAudit({ req, action: "update_permissions", entityType: "accessControl", entityId: req.params.id, summary: { fields: Object.keys(req.body) } });
  res.json({ success: true, message: "تم تحديث الصلاحيات بنجاح." });
}

export async function resetPassword(req, res) {
  await resetEmployeePassword(req.user, req.params.id, req.body.password);
  await writeAudit({ req, action: "reset_password", entityType: "employee", entityId: req.params.id });
  res.json({ success: true, message: "تم تحديث كلمة المرور بنجاح." });
}

export async function remove(req, res) {
  await deleteEmployee(req.user, req.params.id);
  await writeAudit({ req, action: "delete", entityType: "employee", entityId: req.params.id });
  res.json({ success: true, message: "تم حذف الموظفة بنجاح." });
}
