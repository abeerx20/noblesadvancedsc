import crypto from "node:crypto";
import path from "node:path";
import { bucket, db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument } from "../utils/text.js";
import { writeAudit } from "../services/auditService.js";

function requireEmployee(req) {
    if (req.user.userType !== "employee") throw new AppError(403, "EMPLOYEE_ONLY", "رفع الفواتير متاح للموظفات فقط.");
}

export async function index(req, res) {
    requireEmployee(req);
    const snapshot = await db.collection("invoices").where("uploaderUid", "==", req.user.uid).get();
    const invoices = snapshot.docs
        .map(publicDocument)
        .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")));
    res.json({ success: true, data: invoices });
}

export async function create(req, res) {
    requireEmployee(req);
    if (!bucket) throw new AppError(503, "STORAGE_NOT_CONFIGURED", "تخزين الفواتير غير مفعّل في إعدادات الخادم.");
    if (!req.file) throw new AppError(422, "FILE_REQUIRED", "اختاري ملف الفاتورة للرفع.");

    const supplierName = String(req.body.supplierName ?? "").trim();
    const invoiceNumber = String(req.body.invoiceNumber ?? "").trim();
    const invoiceDate = String(req.body.invoiceDate ?? "").trim();
    const amount = String(req.body.amount ?? "").trim();
    if (!supplierName || !invoiceNumber || !invoiceDate) throw new AppError(422, "INVOICE_FIELDS_REQUIRED", "أكملي اسم المورد ورقم الفاتورة وتاريخها.");
    if (amount && (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) < 0)) throw new AppError(422, "INVALID_INVOICE_AMOUNT", "أدخلي مبلغًا صحيحًا.");

    const extension = path.extname(req.file.originalname).toLowerCase();
    const objectPath = `invoices/${req.user.uid}/${crypto.randomUUID()}${extension}`;
    await bucket.file(objectPath).save(req.file.buffer, {
        resumable: false,
        contentType: req.file.mimetype,
        metadata: { cacheControl: "private, max-age=0, no-store", metadata: { ownerUid: req.user.uid, originalName: req.file.originalname.slice(0, 160) } }
    });

    const invoice = {
        supplierName,
        invoiceNumber,
        invoiceDate,
        amount: amount || null,
        notes: String(req.body.notes ?? "").trim().slice(0, 500),
        filePath: objectPath,
        uploaderUid: req.user.uid,
        uploaderName: req.user.employee?.nameAr ?? req.user.email,
        status: "مرفوعة",
        createdAt: new Date()
    };
    const reference = await db.collection("invoices").add(invoice);
    await writeAudit({ req, action: "create", entityType: "invoice", entityId: reference.id, summary: { invoiceNumber, filePath: objectPath } });
    res.status(201).json({ success: true, data: { id: reference.id, ...invoice }, message: "تم رفع الفاتورة بنجاح." });
}