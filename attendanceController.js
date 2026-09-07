import { attendanceEligibility, listAttendance, saveAttendance, updateAttendance } from "../services/attendanceService.js";
import { writeAudit } from "../services/auditService.js";

export async function eligibility(req, res) {
  const query = req.validated?.query ?? req.query;
  res.json({ success: true, data: await attendanceEligibility(req.user, query.classId, query.date) });
}

export async function index(req, res) {
  res.json({ success: true, data: await listAttendance(req.validated?.query ?? req.query) });
}

export async function create(req, res) {
  const id = await saveAttendance(req.user, req.body);
  await writeAudit({ req, action: "create", entityType: "attendance", entityId: id, summary: { classId: req.body.classId, date: req.body.date } });
  res.status(201).json({ success: true, data: { id }, message: "تم حفظ الحضور والغياب بنجاح." });
}

export async function update(req, res) {
  await updateAttendance(req.user, req.params.id, req.body.entries);
  await writeAudit({ req, action: "update", entityType: "attendance", entityId: req.params.id });
  res.json({ success: true, message: "تم تحديث سجل الحضور والغياب بنجاح." });
}
