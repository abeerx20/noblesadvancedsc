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
        return { id: parent.id, nameAr: parent.nameAr, nationalId: parent.nationalId, email: parent.email, phone: parent.phone, studentIds: parent.studentIds ?? [], studentCount: Array.isArray(parent.studentIds) ? parent.studentIds.length : 0, status: parent.status };
    });
}

export async function updateParent(parentId, data, actor) {
    const parentRef = db.collection("parents").doc(parentId);
    const parentSnapshot = await parentRef.get();
    if (!parentSnapshot.exists) throw new AppError(404, "PARENT_NOT_FOUND", "ولي الأمر غير موجود.");

    const current = parentSnapshot.data();
    const [emailMatches, nationalIdMatches] = await Promise.all([
        db.collection("parents").where("email", "==", data.email).limit(2).get(),
        db.collection("parents").where("nationalId", "==", data.nationalId).limit(2).get()
    ]);
    if (emailMatches.docs.some((doc) => doc.id !== parentId)) {
        throw new AppError(409, "DUPLICATE_PARENT_EMAIL", "البريد الإلكتروني مستخدم لحساب ولي أمر آخر.");
    }
    if (nationalIdMatches.docs.some((doc) => doc.id !== parentId)) {
        throw new AppError(409, "DUPLICATE_PARENT_NATIONAL_ID", "رقم الهوية مستخدم لحساب ولي أمر آخر.");
    }

    const authUid = current.authUid ?? parentId;
    const authUser = await auth.getUser(authUid);
    const phoneNumber = data.phone.startsWith("05") ? `+966${data.phone.slice(1)}` : `+${data.phone}`;
    await auth.updateUser(authUid, { displayName: data.nameAr, email: data.email, phoneNumber });

    try {
        await parentRef.update({
            nameAr: data.nameAr,
            nationalId: data.nationalId,
            email: data.email,
            phone: data.phone,
            updatedBy: actor.uid,
            updatedAt: FieldValue.serverTimestamp()
        });
    } catch (error) {
        await auth.updateUser(authUid, {
            displayName: authUser.displayName,
            email: authUser.email,
            phoneNumber: authUser.phoneNumber
        }).catch(() => { });
        throw error;
    }
}

export async function deleteParent(parentId) {
    const parentRef = db.collection("parents").doc(parentId);
    const parentSnapshot = await parentRef.get();
    if (!parentSnapshot.exists) throw new AppError(404, "PARENT_NOT_FOUND", "ولي الأمر غير موجود.");

    const parent = parentSnapshot.data();
    const authUid = parent.authUid ?? parentId;
    const studentCount = Array.isArray(parent.studentIds) ? parent.studentIds.length : 0;
    try {
        await auth.deleteUser(authUid);
    } catch (error) {
        if (error.code !== "auth/user-not-found") {
            throw new AppError(503, "PARENT_ACCOUNT_DELETE_FAILED", "تعذر حذف حساب الدخول. لم تُحذف بيانات ولي الأمر.");
        }
    }

    await parentRef.delete();
    return studentCount;
}