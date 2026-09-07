import {
  createScheduleBlock,
  deleteScheduleBlock,
  listSchedule,
  updateScheduleBlock
} from "../services/scheduleService.js";
import { writeAudit } from "../services/auditService.js";

export async function index(req, res) {
  res.json({ success: true, data: await listSchedule(req.user, req.validated?.query ?? req.query) });
}

export async function create(req, res) {
  const id = await createScheduleBlock(req.user, req.body);
  await writeAudit({ req, action: "create", entityType: "schedule", entityId: id, summary: { day: req.body.day, teacherUid: req.body.teacherUid } });
  res.status(201).json({ success: true, data: { id }, message: "تمت إضافة سجل الجدول بنجاح." });
}

export async function update(req, res) {
  await updateScheduleBlock(req.user, req.params.id, req.body);

  await writeAudit({
    req,
    action: "update",
    entityType: "schedule",
    entityId: req.params.id,
    summary: {
      day: req.body.day,
      teacherUid: req.body.teacherUid
    }
  });

  res.json({
    success: true,
    message: "تم تعديل سجل الجدول بنجاح."
  });
}


export async function remove(req, res) {
  await deleteScheduleBlock(req.user, req.params.id);
  await writeAudit({ req, action: "soft_delete", entityType: "schedule", entityId: req.params.id });
  res.json({ success: true, message: "تم حذف سجل الجدول بنجاح." });
}
