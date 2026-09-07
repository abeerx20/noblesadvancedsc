import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument } from "../utils/text.js";

export async function createParent(data, actor) {
    const [emailDuplicate, nationalIdDuplicate] = await Promise.all([
        db.collection("parents").where("email", "==", data.email).limit(1).get(),
        db.collection("parents").where("nationalId", "==", data.nationalId).limit(1).get()
    ]);
    if (!emailDuplicate.empty) throw new AppError(409, "DUPLICATE_PARENT", "يوجد ولي أمر بهذا البريد مسبقًا.");
    if (!nationalIdDuplicate.empty) throw new AppError(409, "DUPLICATE_PARENT", "يوجد ولي أمر برقم الهوية مسبقًا.");

    const students = await Promise.all(data.studentIds.map((studentId) => db.collection("students").doc(studentId).get()));
    if (students.some((snapshot) => !snapshot.exists || snapshot.data().active === false)) {
        throw new AppError(422, "INVALID_PARENT_STUDENTS", "يوجد طالب غير موجود أو غير نشط.");
    }

    let createdUser;
    try {
        const phoneNumber = data.phone.startsWith("05") ? `+966${data.phone.slice(1)}` : `+${data.phone}`;
        createdUser = await auth.createUser({ email: data.email, password: data.password, displayName: data.nameAr, phoneNumber });
        await db.collection("parents").doc(createdUser.uid).set({
            nameAr: data.nameAr,
            nationalId: data.nationalId,
            email: data.email,
            phone: data.phone,
            studentIds: data.studentIds,
            status: data.status,
            authUid: createdUser.uid,
            createdBy: actor.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
    } catch (error) {
        if (createdUser) await auth.deleteUser(createdUser.uid).catch(() => { });
        if (error instanceof AppError) throw error;
        throw new AppError(422, "PARENT_CREATE_FAILED", error.message || "تعذر إنشاء حساب ولي الأمر.");
    }
    return createdUser.uid;
}

export async function listParents() {
    const snapshot = await db.collection("parents").limit(500).get();
    return snapshot.docs.map((doc) => {
        const parent = publicDocument(doc);
        return { id: parent.id, nameAr: parent.nameAr, email: parent.email, phone: parent.phone, studentIds: parent.studentIds ?? [], studentCount: Array.isArray(parent.studentIds) ? parent.studentIds.length : 0, status: parent.status };
    });
}