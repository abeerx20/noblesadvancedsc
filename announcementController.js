import { createAnnouncement, deleteAnnouncement, listAnnouncements } from "../services/announcementService.js";
import { writeAudit } from "../services/auditService.js";

export async function index(_req, res) {
  res.json({ success: true, data: await listAnnouncements() });
}

export async function create(req, res) {
  const id = await createAnnouncement(req.user, req.body);
  await writeAudit({ req, action: "create", entityType: "announcement", entityId: id });
  res.status(201).json({ success: true, data: { id }, message: "تم نشر الإعلان بنجاح." });
}

export async function remove(req, res) {
  await deleteAnnouncement(req.params.id);
  await writeAudit({ req, action: "soft_delete", entityType: "announcement", entityId: req.params.id });
  res.json({ success: true, message: "تم حذف الإعلان." });
}

