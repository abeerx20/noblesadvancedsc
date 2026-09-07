import { acknowledgeOwnReport, listOwnAttendance, listOwnChildren, listOwnReports } from "../services/parentService.js";

export async function children(req, res) {
  res.json({ success: true, data: await listOwnChildren(req.user) });
}

export async function attendance(req, res) {
  res.json({ success: true, data: await listOwnAttendance(req.user) });
}

export async function reports(req, res) {
  const period = String(req.query.period ?? "");
  if (!["1", "2", "3"].includes(period)) return res.status(422).json({ success: false, error: { message: "الفترة الدراسية غير صحيحة." } });
  res.json({ success: true, data: await listOwnReports(req.user, Number(period)) });
}

export async function acknowledgeReport(req, res) {
  await acknowledgeOwnReport(req.user, req.params.id, req.body.comment);
  res.json({ success: true, message: "تم إرسال الإقرار والتعليق بنجاح." });
}

