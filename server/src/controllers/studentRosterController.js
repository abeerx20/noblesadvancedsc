import { writeAudit } from "../services/auditService.js";
import {
  createRosterEntry,
  deleteRosterEntry,
  listRoster,
  listRosterOptions,
  setRosterStatus,
  updateRosterEntry
} from "../services/studentRosterService.js";
import {
  commitRosterWorkbook,
  exportRosterWorkbook,
  previewRosterWorkbook
} from "../services/studentRosterExcelService.js";
import { AppError } from "../utils/AppError.js";

export async function options(req, res) {
  res.json({ success: true, data: await listRosterOptions(req.user) });
}

export async function index(req, res) {
  res.json({ success: true, data: await listRoster(req.user, req.validated.query) });
}

export async function create(req, res) {
  const id = await createRosterEntry(req.user, req.body);
  await writeAudit({ req, action: "create_draft", entityType: "studentEnrollment", entityId: id });
  res.status(201).json({ success: true, data: { id }, message: "أُضيف الطالب إلى المسودات، ولن يظهر للمعلمة قبل الاعتماد." });
}

export async function update(req, res) {
  const id = await updateRosterEntry(req.user, req.params.id, req.body);
  await writeAudit({ req, action: "update_draft", entityType: "studentEnrollment", entityId: id });
  res.json({ success: true, data: { id }, message: "تم تحديث القيد وإعادته إلى المسودات للمراجعة." });
}

export async function updateStatus(req, res) {
  await setRosterStatus(req.user, req.params.id, req.body.status);
  await writeAudit({ req, action: `status_${req.body.status}`, entityType: "studentEnrollment", entityId: req.params.id });
  const messages = {
    active: "تم اعتماد الطالب، وأصبح ظاهرًا للمعلمة.",
    deferred: "تم تأجيل الطالب وإخفاؤه من قائمة المعلمة.",
    draft: "أُعيد الطالب إلى المسودات."
  };
  res.json({ success: true, message: messages[req.body.status] });
}

export async function remove(req, res) {
  await deleteRosterEntry(req.user, req.params.id);
  await writeAudit({ req, action: "remove_from_roster", entityType: "studentEnrollment", entityId: req.params.id });
  res.json({ success: true, message: "تم حذف الطالب من هذه المادة والشعبة فقط، وبقي ملفه الأساسي محفوظًا." });
}

function importData(req) {
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "اختاري ملف Excel.");
  const { classId, subject } = req.body;
  if (!classId || !subject) throw new AppError(422, "IMPORT_SCOPE_REQUIRED", "اختاري المادة والفصل قبل رفع الملف.");
  return { classId, subject };
}

export async function previewImport(req, res) {
  const { classId, subject } = importData(req);
  const result = await previewRosterWorkbook(req.user, req.file.buffer, classId, subject);
  res.json({ success: true, data: result, message: "تمت معاينة الملف ولم تُحفظ أي بيانات بعد." });
}

export async function commitImport(req, res) {
  const { classId, subject } = importData(req);
  const result = await commitRosterWorkbook(req.user, req.file.buffer, classId, subject);
  await writeAudit({
    req,
    action: "import_drafts",
    entityType: "studentEnrollment",
    summary: { classId, subject, accepted: result.accepted.length, rejected: result.rejected.length }
  });
  res.status(201).json({
    success: true,
    data: result,
    message: `حُفظ ${result.accepted.length} طالب في المسودات، ورُفض ${result.rejected.length} صف.`
  });
}

export async function exportRoster(req, res) {
  const { classId, subject } = req.validated.query;
  const buffer = await exportRosterWorkbook(req.user, classId, subject);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="student-roster.xlsx"`);
  res.send(Buffer.from(buffer));
}
