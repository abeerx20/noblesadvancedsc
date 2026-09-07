import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument } from "../utils/text.js";

export async function listNotifications(user, limit = 50) {
    const snapshot = await db.collection("notifications")
        .where("recipientUid", "==", user.uid)
        .limit(Math.min(limit, 100))
        .get();
    return snapshot.docs
        .map(publicDocument)
        .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

export async function markNotificationRead(user, notificationId) {
    const ref = db.collection("notifications").doc(notificationId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data().recipientUid !== user.uid) {
        throw new AppError(404, "NOTIFICATION_NOT_FOUND", "التنبيه غير موجود.");
    }
    if (!snapshot.data().read) {
        await ref.update({ read: true, readAt: FieldValue.serverTimestamp() });
    }
}

export async function notifyEmployee({ recipientUid, type, title, message, ...data }) {
    if (!recipientUid) return;
    await db.collection("notifications").add({
        recipientUid,
        type,
        title,
        message: message ?? "",
        ...data,
        read: false,
        createdAt: FieldValue.serverTimestamp()
    });
}
