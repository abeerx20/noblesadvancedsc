import { createEmployee, getAccess, listEmployees, updateAccess } from "../services/employeeService.js";
import { writeAudit } from "../services/auditService.js";

export async function index(req, res) {
  const query = req.validated?.query ?? req.query;
  res.json({ success: true, data: await listEmployees(Number(query.limit ?? 200)) });
}

export async function create(req, res) {
  const id = await createEmployee(req.body, req.user);
  await writeAudit({ req, action: "create", entityType: "employee", entityId: id });
  res.status(201).json({ success: true, data: { id }, message: "تم إنشاء ملف الموظفة بنجاح." });
}

export async function access(req, res) {
  res.json({ success: true, data: await getAccess(req.params.id) });
}

export async function updatePermissions(req, res) {
  await updateAccess(req.user, req.params.id, req.body);
  await writeAudit({ req, action: "update_permissions", entityType: "accessControl", entityId: req.params.id, summary: { fields: Object.keys(req.body) } });
  res.json({ success: true, message: "تم تحديث الصلاحيات بنجاح." });
}
