import { acknowledgeCoverage, assignCoverage, createCoverageAbsence, listCoverage, listMyCoverage, updateCoverage } from "../services/coverageService.js";
import { writeAudit } from "../services/auditService.js";

export async function index(req, res) {
    const query = req.validated?.query ?? req.query;
    res.json({ success: true, data: await listCoverage(query.from, query.to) });
}

export async function mine(req, res) {
    const query = req.validated?.query ?? req.query;
    res.json({ success: true, data: await listMyCoverage(req.user, query.from, query.to) });
}

export async function assign(req, res) {
    const id = await assignCoverage(req.user, req.body);
    await writeAudit({ req, action: "assign", entityType: "teacherCoverage", entityId: id, summary: { date: req.body.date, substituteUid: req.body.substituteUid } });
    res.status(201).json({ success: true, data: { id }, message: "تم حفظ تكليف الانتظار." });
}

export async function createAbsence(req, res) {
    const id = await createCoverageAbsence(req.user, req.body);
    await writeAudit({ req, action: "create", entityType: "absenceReport", entityId: id, summary: { employeeUid: req.body.employeeUid, date: req.body.date } });
    res.status(201).json({ success: true, data: { id }, message: "تم تسجيل غياب المعلمة وإنشاء عناصر جدول الانتظار." });
}

export async function update(req, res) {
    await updateCoverage(req.user, req.params.id, req.body);
    await writeAudit({ req, action: "update", entityType: "teacherCoverage", entityId: req.params.id, summary: req.body });
    res.json({ success: true, message: "تم تعديل تكليف الانتظار." });
}

export async function acknowledge(req, res) {
    await acknowledgeCoverage(req.user, req.params.id);
    res.json({ success: true, message: "تم تسجيل اطلاعك على تكليف الانتظار." });
}
