import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";

export async function createStudentReport(data, actor) {
    const student = await db.collection("students").doc(data.studentId).get();
    if (!student.exists || student.data().active === false) throw new AppError(404, "STUDENT_NOT_FOUND", "الطالب غير موجود أو غير نشط.");
    const ref = db.collection("studentReports").doc();
    await ref.set({ ...data, createdBy: actor.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return ref.id;
}
