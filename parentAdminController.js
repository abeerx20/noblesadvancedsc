import { createParent, listParents } from "../services/parentAdminService.js";
import { writeAudit } from "../services/auditService.js";

export async function index(_req, res) {
    res.json({ success: true, data: await listParents() });
}

export async function create(req, res) {
    const id = await createParent(req.body, req.user);
    await writeAudit({ req, action: "create", entityType: "parent", entityId: id, summary: { studentCount: req.body.studentIds.length } });
    res.status(201).json({ success: true, data: { id }, message: "تم إنشاء حساب ولي الأمر وربط الأبناء بنجاح." });
}