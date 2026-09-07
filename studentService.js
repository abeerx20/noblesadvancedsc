import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { getClassOrThrow } from "./classService.js";
import { AppError } from "../utils/AppError.js";
import { normalizeText, publicDocument } from "../utils/text.js";

async function teacherClassIds(uid) {
  const snapshot = await db.collection("teacherSchedule")
    .where("teacherUid", "==", uid)
    .limit(200)
    .get();
  return new Set(snapshot.docs
    .filter((doc) => doc.data().active !== false)
    .map((doc) => doc.data().classId)
    .filter(Boolean));
}

async function assertClassAccess(user, classId) {
  if (user.permissions.includes("manage_students") || user.permissions.includes("view_all_students")) return;
  const allowed = await teacherClassIds(user.uid);
  if (!allowed.has(classId)) {
    throw new AppError(403, "CLASS_ACCESS_DENIED", "لا يمكنك عرض طلاب هذا الفصل.");
  }
}

function validateStudentAgainstClass(student, academicClass) {
  const matches = student.stage === academicClass.stage
    && student.grade === academicClass.grade
    && student.gender === academicClass.gender;
  if (!matches) {
    throw new AppError(422, "CLASS_MISMATCH", "المرحلة أو الصف أو الجنس لا يتوافق مع الفصل المحدد.");
  }
}

export async function listStudents(user, filters) {
  let query = db.collection("students");
  if (filters.classId) {
    await assertClassAccess(user, filters.classId);
    query = query.where("classId", "==", filters.classId);
  }

  const snapshot = await query.limit(Math.min(filters.limit * 3, 500)).get();
  let records = snapshot.docs.map(publicDocument).filter((student) => student.active !== false);

  if (filters.approvedOnly) {
    if (!filters.classId) throw new AppError(422, "CLASS_REQUIRED", "يجب اختيار الفصل لعرض الطلاب المعتمدين.");
    const enrollmentSnapshot = await db.collection("studentEnrollments")
      .where("classId", "==", filters.classId)
      .limit(500)
      .get();
    const approvedStudentIds = new Set(enrollmentSnapshot.docs
      .map((document) => document.data())
      .filter((enrollment) => enrollment.active !== false && enrollment.status === "active")
      .map((enrollment) => enrollment.studentId));
    records = records.filter((student) => approvedStudentIds.has(student.id));
  }

  if (!user.permissions.includes("manage_students") && !user.permissions.includes("view_all_students")) {
    const allowed = await teacherClassIds(user.uid);
    records = records.filter((student) => allowed.has(student.classId));
  }

  for (const field of ["stage", "grade", "gender"]) {
    if (filters[field]) records = records.filter((student) => student[field] === filters[field]);
  }
  if (filters.search) {
    const search = normalizeText(filters.search).toLocaleLowerCase("ar");
    records = records.filter((student) => student.fullName?.toLocaleLowerCase("ar").includes(search));
  }

  return records
    .sort((a, b) =>
      (a.serialNumber ?? 9999) - (b.serialNumber ?? 9999)
      || String(a.fullName ?? a.name ?? "").localeCompare(String(b.fullName ?? b.name ?? ""), "ar")
    )
    .slice(0, filters.limit);
}

export async function createStudent(user, data) {
  const academicClass = await getClassOrThrow(data.classId);
  validateStudentAgainstClass(data, academicClass);

  if (data.nationalId) {
    const duplicateId = await db.collection("students").where("nationalId", "==", data.nationalId).limit(1).get();
    if (!duplicateId.empty) throw new AppError(409, "DUPLICATE_NATIONAL_ID", "رقم الهوية مسجل لطالب آخر.");
  }
  const sameClass = await db.collection("students").where("classId", "==", data.classId).limit(200).get();
  const duplicateName = sameClass.docs.some((doc) => normalizeText(doc.data().fullName) === data.fullName && doc.data().active !== false);
  if (duplicateName) throw new AppError(409, "DUPLICATE_STUDENT", "الطالب مسجل مسبقًا في الفصل نفسه.");

  const ref = await db.collection("students").add({
    ...data,
    createdBy: user.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

export async function updateStudent(user, studentId, data) {
  const ref = db.collection("students").doc(studentId);
  const current = await ref.get();
  if (!current.exists) throw new AppError(404, "STUDENT_NOT_FOUND", "الطالب غير موجود.");
  const academicClass = await getClassOrThrow(data.classId);
  validateStudentAgainstClass(data, academicClass);
  await ref.update({ ...data, updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteStudent(user, studentId) {
  const ref = db.collection("students").doc(studentId);
  const current = await ref.get();
  if (!current.exists) throw new AppError(404, "STUDENT_NOT_FOUND", "الطالب غير موجود.");
  await ref.update({ active: false, deletedBy: user.uid, deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}
