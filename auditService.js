import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";

export async function writeAudit({ req, action, entityType, entityId, summary = {} }) {
  try {
    await db.collection("auditLogs").add({
      actorUid: req.user?.uid ?? null,
      actorEmployeeId: req.user?.employee?.id ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      summary,
      requestId: req.requestId,
      ip: req.ip,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("AUDIT_WRITE_FAILED", { requestId: req.requestId, message: error.message });
  }
}

