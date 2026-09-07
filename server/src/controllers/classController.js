import { createClass, deleteClass, listClasses, updateClass } from "../services/classService.js";
import { writeAudit } from "../services/auditService.js";

export async function index(_req, res) {
  res.json({ success: true, data: await listClasses() });
}

export async function create(req, res) {
  const id = await createClass(req.body, req.user.uid);
  await writeAudit({ req, action: "create", entityType: "academicClass", entityId: id });
  res.status(201).json({ success: true, data: { id }, message: "تم إنشاء الفصل بنجاح." });
}

export async function update(req, res) {
  await updateClass(req.params.id, req.body, req.user.uid);
  await writeAudit({ req, action: "update", entityType: "academicClass", entityId: req.params.id });
  res.json({ success: true, message: "تم تحديث الفصل بنجاح." });
}

export async function remove(req, res) {
  const force = req.query.force === "true" || req.query.force === true;
  await deleteClass(req.params.id, req.user.uid, { force });
  await writeAudit({ req, action: force ? "force_delete" : "soft_delete", entityType: "academicClass", entityId: req.params.id });
  res.json({ success: true, message: force ? "تم حذف الفصل بالقوة بنجاح." : "تم حذف الفصل بنجاح." });
}
