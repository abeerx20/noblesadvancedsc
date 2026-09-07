import crypto from "node:crypto";
import path from "node:path";
import { bucket } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { writeAudit } from "../services/auditService.js";

export async function upload(req, res) {
  if (!bucket) throw new AppError(503, "STORAGE_NOT_CONFIGURED", "تخزين المرفقات غير مفعّل في إعدادات الخادم.");
  if (!req.file) throw new AppError(422, "FILE_REQUIRED", "اختاري ملفًا للرفع.");

  const extension = path.extname(req.file.originalname).toLowerCase();
  const objectPath = `uploads/${req.user.uid}/${crypto.randomUUID()}${extension}`;
  const file = bucket.file(objectPath);
  await file.save(req.file.buffer, {
    resumable: false,
    contentType: req.file.mimetype,
    metadata: {
      cacheControl: "private, max-age=0, no-store",
      metadata: { ownerUid: req.user.uid, originalName: req.file.originalname.slice(0, 160) }
    }
  });
  await writeAudit({ req, action: "upload", entityType: "file", entityId: objectPath, summary: { mimeType: req.file.mimetype, size: req.file.size } });
  res.status(201).json({ success: true, data: { attachmentUrl: objectPath }, message: "تم رفع المرفق بنجاح." });
}

export async function download(req, res) {
  if (!bucket) throw new AppError(503, "STORAGE_NOT_CONFIGURED", "تخزين المرفقات غير مفعّل في إعدادات الخادم.");
  const objectPath = String(req.query.path ?? "");
  const ownPrefix = `uploads/${req.user.uid}/`;
  const ownInvoicePrefix = `invoices/${req.user.uid}/`;
  const canManage = req.user.permissions.some((permission) => ["manage_leave_requests", "manage_training_requests", "manage_assets", "manage_loans"].includes(permission));
  if ((!objectPath.startsWith("uploads/") && !objectPath.startsWith("invoices/")) || (!objectPath.startsWith(ownPrefix) && !objectPath.startsWith(ownInvoicePrefix) && !canManage)) {
    throw new AppError(403, "FILE_ACCESS_DENIED", "لا يمكنك الوصول إلى هذا المرفق.");
  }
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) throw new AppError(404, "FILE_NOT_FOUND", "المرفق غير موجود.");
  const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 5 * 60 * 1000 });
  res.json({ success: true, data: { url, expiresInSeconds: 300 } });
}

