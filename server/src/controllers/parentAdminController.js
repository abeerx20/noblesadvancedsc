import { createParent, listParents } from "../services/parentAdminService.js";
import { commitParentWorkbook, previewParentWorkbook } from "../services/parentAdminExcelService.js";
import { writeAudit } from "../services/auditService.js";
import { AppError } from "../utils/AppError.js";

export async function index(_req, res) {
    res.json({ success: true, data: await listParents() });
}

export async function create(req, res) {
    const id = await createParent(req.body, req.user);
    await writeAudit({ req, action: "create", entityType: "parent", entityId: id, summary: { studentCount: req.body.studentIds.length } });
    res.status(201).json({ success: true, data: { id }, message: "تم إنشاء حساب ولي الأمر وربط الأبناء بنجاح." });
}

function importFile(req) {
    if (!req.file) throw new AppError(422, "FILE_REQUIRED", "اختاري ملف Excel.");
    return req.file.buffer;
}

export async function previewImport(req, res) {
    const result = await previewParentWorkbook(importFile(req));
    const accepted = result.accepted.map(({ data: _data, ...row }) => row);
    res.json({ success: true, data: { ...result, accepted }, message: "تمت معاينة الملف، ولم تُحفظ أي حسابات بعد." });
}

export async function commitImport(req, res) {
    const result = await commitParentWorkbook(importFile(req), req.user);
    await writeAudit({ req, action: "bulk_create", entityType: "parent", summary: { accepted: result.accepted.length, rejected: result.rejected.length } });
    res.status(201).json({ success: true, data: result, message: `تم إنشاء ${result.accepted.length} حساب ولي أمر، ورفض ${result.rejected.length} صف.` });
}