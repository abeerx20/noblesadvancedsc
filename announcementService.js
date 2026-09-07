import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { publicDocument } from "../utils/text.js";
import { AppError } from "../utils/AppError.js";

export async function listAnnouncements() {
  const snapshot = await db.collection("announcements").where("active", "==", true).limit(30).get();
  const today = new Date().toISOString().slice(0, 10);
  return snapshot.docs.map(publicDocument).filter((item) => !item.expiresAt || item.expiresAt >= today);
}

export async function createAnnouncement(user, data) {
  const ref = await db.collection("announcements").add({
    ...data,
    createdBy: user.uid,
    createdByName: user.employee.nameAr,
    createdAt: FieldValue.serverTimestamp()
  });
  const employees = await db.collection("employees").limit(500).get();
  const batch = db.batch();
  employees.docs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((employee) => employee.status === "active" && (employee.authUid ?? employee.id))
    .forEach((employee) => batch.set(db.collection("notifications").doc(), {
      recipientUid: employee.authUid ?? employee.id,
      type: "announcement",
      title: "إعلان جديد",
      message: data.title,
      announcementId: ref.id,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    }));
  await batch.commit();
  return ref.id;
}

export async function deleteAnnouncement(id) {
  const ref = db.collection("announcements").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().active === false) {
    throw new AppError(404, "ANNOUNCEMENT_NOT_FOUND", "الإعلان غير موجود.");
  }
  await ref.update({ active: false, deletedAt: FieldValue.serverTimestamp() });
  const notices = await db.collection("notifications").where("announcementId", "==", id).limit(500).get();
  if (!notices.empty) {
    const batch = db.batch();
    notices.docs.forEach((notice) => batch.delete(notice.ref));
    await batch.commit();
  }
}

