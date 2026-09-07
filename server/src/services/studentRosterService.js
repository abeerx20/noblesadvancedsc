import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { getClassOrThrow } from "./classService.js";
import { AppError } from "../utils/AppError.js";
import { normalizeText, publicDocument } from "../utils/text.js";

const rosterCollection = db.collection("studentEnrollments");
const studentCollection = db.collection("students");

function normalizeStudentName(value) {
  return normalizeText(value)
    .normalize("NFKC")
    .replace(/[\u0640\u064B-\u065F\u0670]/g, "")
    .toLocaleLowerCase("ar");
}

function normalizeStudentPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("9665") ? `0${digits.slice(3)}` : digits;
}

export function studentDuplicateKeys(student) {
  return {
    fullName: normalizeStudentName(student.fullName ?? ""),
    nationalId: String(student.nationalId ?? "").replace(/\D/g, ""),
    guardianPhone: normalizeStudentPhone(student.guardianPhone)
  };
}

export function findDuplicateStudentField(candidate, existingStudents, excludedStudentId = null) {
  const candidateKeys = studentDuplicateKeys(candidate);
  for (const student of existingStudents) {
    if (student.id === excludedStudentId || student.active === false) continue;
    const keys = studentDuplicateKeys(student);
    if (candidateKeys.nationalId && keys.nationalId === candidateKeys.nationalId) return "nationalId";
    if (candidateKeys.guardianPhone && keys.guardianPhone === candidateKeys.guardianPhone) return "guardianPhone";
    if (candidateKeys.fullName && keys.fullName === candidateKeys.fullName) return "fullName";
  }
  return null;
}

function duplicateError(field) {
  if (field === "nationalId") {
    return new AppError(409, "DUPLICATE_NATIONAL_ID", "رقم الهوية مرتبط بملف طالب آخر.");
  }
  if (field === "guardianPhone") {
    return new AppError(409, "DUPLICATE_GUARDIAN_PHONE", "رقم جوال ولي الأمر مستخدم في ملف طالب آخر.");
  }
  return new AppError(409, "DUPLICATE_STUDENT_NAME", "يوجد طالب بالاسم نفسه في هذه الشعبة.");
}

function subjectKey(subject) {
  return normalizeText(subject).toLocaleLowerCase("ar");
}

function enrollmentId(studentId, classId, subject) {
  return crypto.createHash("sha256")
    .update(`${studentId}|${classId}|${subjectKey(subject)}`)
    .digest("hex")
    .slice(0, 48);
}

function isManager(user) {
  return user.permissions.includes("manage_students");
}

async function teacherAssignments(uid) {
  const snapshot = await db.collection("teacherSchedule")
    .where("teacherUid", "==", uid)
    .limit(500)
    .get();
  return snapshot.docs
    .map(publicDocument)
    .filter((item) => item.active !== false && item.classId && item.subject);
}

async function assertAssignmentAccess(user, classId, subject) {
  if (isManager(user) || user.permissions.includes("view_all_students")) return;
  const key = subjectKey(subject);
  const allowed = (await teacherAssignments(user.uid))
    .some((item) => item.classId === classId && subjectKey(item.subject) === key);
  if (!allowed) {
    throw new AppError(403, "ROSTER_ACCESS_DENIED", "لا يمكنك عرض قائمة هذه المادة والشعبة.");
  }
}

export function validateStudentGenderForClass(academicClass, studentGender) {
  if (academicClass.stage === "primary" && academicClass.gender !== studentGender) {
    throw new AppError(
      422,
      "PRIMARY_GENDER_MISMATCH",
      academicClass.gender === "male"
        ? "لا يمكن إضافة طالبة إلى فصل بنين في المرحلة الابتدائية."
        : "لا يمكن إضافة طالب إلى فصل بنات في المرحلة الابتدائية."
    );
  }
  if (academicClass.stage === "kindergarten" && !["male", "female"].includes(studentGender)) {
    throw new AppError(422, "STUDENT_GENDER_REQUIRED", "حددي جنس الطفل صراحةً حتى في الفصول المختلطة.");
  }
}

async function findOrCreateStudent(user, data, academicClass) {
  let existing = null;
  const keys = studentDuplicateKeys(data);
  if (keys.nationalId) {
    const byNationalId = await studentCollection.where("nationalId", "==", keys.nationalId).limit(2).get();
    existing = byNationalId.docs[0] ?? null;
  }
  if (!existing) {
    const sameClass = await studentCollection.where("classId", "==", data.classId).limit(500).get();
    existing = sameClass.docs.find((document) => {
      const student = document.data();
      return student.active !== false
        && student.gender === data.gender
        && studentDuplicateKeys(student).fullName === keys.fullName;
    }) ?? null;
  }
  if (existing) {
    const stored = existing.data();
    if (keys.nationalId && studentDuplicateKeys(stored).fullName !== keys.fullName) {
      throw new AppError(409, "NATIONAL_ID_NAME_MISMATCH", "رقم الهوية مرتبط بملف طالب آخر.");
    }
    if (stored.gender && stored.gender !== "mixed" && stored.gender !== data.gender) {
      throw new AppError(409, "STUDENT_GENDER_CONFLICT", "جنس الطالب لا يتطابق مع ملفه الأساسي.");
    }
  }

  if (keys.guardianPhone) {
    const phoneVariants = [...new Set([
      data.guardianPhone,
      keys.guardianPhone,
      keys.guardianPhone.startsWith("05") ? `966${keys.guardianPhone.slice(1)}` : ""
    ].filter(Boolean))];
    const phoneSnapshots = await Promise.all(phoneVariants.map((phone) =>
      studentCollection.where("guardianPhone", "==", phone).limit(2).get()
    ));
    const phoneStudents = phoneSnapshots.flatMap((snapshot) =>
      snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
    );
    const phoneDuplicate = findDuplicateStudentField(
      { ...data, fullName: "", nationalId: "" },
      phoneStudents,
      existing?.id ?? null
    );
    if (phoneDuplicate === "guardianPhone") throw duplicateError(phoneDuplicate);
  }

  const profile = {
    fullName: normalizeText(data.fullName),
    stage: academicClass.stage,
    grade: academicClass.grade,
    classId: academicClass.id,
    gender: data.gender,
    guardianPhone: keys.guardianPhone,
    nationalId: keys.nationalId,
    active: true,
    updatedBy: user.uid,
    updatedAt: FieldValue.serverTimestamp()
  };

  if (existing) {
    await existing.ref.set(profile, { merge: true });
    return existing.id;
  }

  const ref = studentCollection.doc();
  await ref.create({
    ...profile,
    createdBy: user.uid,
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

export async function listRosterOptions(user) {
  let rows;
  if (isManager(user) || user.permissions.includes("view_all_students")) {
    const [scheduleSnapshot, enrollmentSnapshot] = await Promise.all([
      db.collection("teacherSchedule").limit(1000).get(),
      rosterCollection.where("active", "==", true).limit(1000).get()
    ]);
    rows = [
      ...scheduleSnapshot.docs.map(publicDocument),
      ...enrollmentSnapshot.docs.map(publicDocument)
    ];
  } else {
    rows = await teacherAssignments(user.uid);
  }
  const unique = new Map();
  rows
    .filter((item) => item.active !== false && item.classId && item.subject)
    .forEach((item) => {
      const key = `${item.classId}|${subjectKey(item.subject)}`;
      if (!unique.has(key)) unique.set(key, { classId: item.classId, subject: normalizeText(item.subject) });
    });
  return [...unique.values()].sort((a, b) =>
    a.subject.localeCompare(b.subject, "ar") || a.classId.localeCompare(b.classId, "ar")
  );
}

export async function listRoster(user, filters) {
  await assertAssignmentAccess(user, filters.classId, filters.subject);
  const snapshot = await rosterCollection.where("classId", "==", filters.classId).limit(500).get();
  const key = subjectKey(filters.subject);
  let enrollments = snapshot.docs
    .map(publicDocument)
    .filter((item) => item.active !== false && item.subjectKey === key);

  if (isManager(user) || user.permissions.includes("view_all_students")) {
    if (filters.status) enrollments = enrollments.filter((item) => item.status === filters.status);
  } else {
    enrollments = enrollments.filter((item) => item.status === "active");
  }

  enrollments = enrollments.slice(0, filters.limit);
  if (!enrollments.length) return [];

  const studentSnapshots = await db.getAll(
    ...enrollments.map((item) => studentCollection.doc(item.studentId))
  );
  const students = new Map(studentSnapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => [snapshot.id, publicDocument(snapshot)]));

  return enrollments
    .map((enrollment) => {
      const student = students.get(enrollment.studentId);
      return student ? { ...student, enrollmentId: enrollment.id, subject: enrollment.subject, status: enrollment.status } : null;
    })
    .filter(Boolean)
    .sort((a, b) =>
      String(a.fullName).localeCompare(String(b.fullName), "ar", { sensitivity: "base" })
    );
}

export async function createRosterEntry(user, data) {
  const academicClass = await getClassOrThrow(data.classId);
  validateStudentGenderForClass(academicClass, data.gender);
  const studentId = await findOrCreateStudent(user, data, academicClass);
  const id = enrollmentId(studentId, data.classId, data.subject);
  const ref = rosterCollection.doc(id);

  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    if (current.exists && current.data().active !== false) {
      throw new AppError(409, "DUPLICATE_ROSTER_ENTRY", "الطالب مضاف مسبقًا إلى المادة والشعبة نفسيهما.");
    }
    transaction.set(ref, {
      studentId,
      classId: data.classId,
      subject: normalizeText(data.subject),
      subjectKey: subjectKey(data.subject),
      status: "draft",
      active: true,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  return id;
}

export async function updateRosterEntry(user, enrollmentIdValue, data) {
  const currentRef = rosterCollection.doc(enrollmentIdValue);
  const currentSnapshot = await currentRef.get();
  if (!currentSnapshot.exists || currentSnapshot.data().active === false) {
    throw new AppError(404, "ROSTER_ENTRY_NOT_FOUND", "قيد الطالب في القائمة غير موجود.");
  }

  const academicClass = await getClassOrThrow(data.classId);
  validateStudentGenderForClass(academicClass, data.gender);
  const studentId = currentSnapshot.data().studentId;
  const keys = studentDuplicateKeys(data);
  const uniquenessQueries = [];
  if (keys.nationalId) {
    uniquenessQueries.push(studentCollection.where("nationalId", "==", keys.nationalId).limit(2).get());
  }
  if (keys.guardianPhone) {
    const phoneVariants = [...new Set([
      data.guardianPhone,
      keys.guardianPhone,
      keys.guardianPhone.startsWith("05") ? `966${keys.guardianPhone.slice(1)}` : ""
    ].filter(Boolean))];
    uniquenessQueries.push(...phoneVariants.map((phone) =>
      studentCollection.where("guardianPhone", "==", phone).limit(2).get()
    ));
  }
  const uniquenessSnapshots = await Promise.all(uniquenessQueries);
  const uniquenessStudents = uniquenessSnapshots.flatMap((snapshot) =>
    snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
  );
  const duplicateField = findDuplicateStudentField(
    { ...data, fullName: "" },
    uniquenessStudents,
    studentId
  );
  if (duplicateField === "nationalId" || duplicateField === "guardianPhone") {
    throw duplicateError(duplicateField);
  }
  await studentCollection.doc(studentId).set({
    fullName: normalizeText(data.fullName),
    stage: academicClass.stage,
    grade: academicClass.grade,
    classId: data.classId,
    gender: data.gender,
    guardianPhone: keys.guardianPhone,
    nationalId: keys.nationalId,
    updatedBy: user.uid,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const targetId = enrollmentId(studentId, data.classId, data.subject);
  const targetRef = rosterCollection.doc(targetId);
  await db.runTransaction(async (transaction) => {
    if (targetId !== enrollmentIdValue) {
      const duplicate = await transaction.get(targetRef);
      if (duplicate.exists && duplicate.data().active !== false) {
        throw new AppError(409, "DUPLICATE_ROSTER_ENTRY", "الطالب مضاف مسبقًا إلى المادة والشعبة نفسيهما.");
      }
      transaction.update(currentRef, {
        active: false,
        movedBy: user.uid,
        movedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    transaction.set(targetRef, {
      studentId,
      classId: data.classId,
      subject: normalizeText(data.subject),
      subjectKey: subjectKey(data.subject),
      status: "draft",
      active: true,
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
      ...(targetId !== enrollmentIdValue ? {
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp()
      } : {})
    }, { merge: true });
  });
  return targetId;
}

export async function setRosterStatus(user, enrollmentIdValue, status) {
  const ref = rosterCollection.doc(enrollmentIdValue);
  const current = await ref.get();
  if (!current.exists || current.data().active === false) {
    throw new AppError(404, "ROSTER_ENTRY_NOT_FOUND", "قيد الطالب في القائمة غير موجود.");
  }
  await ref.update({
    status,
    approvedBy: status === "active" ? user.uid : FieldValue.delete(),
    approvedAt: status === "active" ? FieldValue.serverTimestamp() : FieldValue.delete(),
    updatedBy: user.uid,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function deleteRosterEntry(user, enrollmentIdValue) {
  const ref = rosterCollection.doc(enrollmentIdValue);
  const current = await ref.get();
  if (!current.exists || current.data().active === false) {
    throw new AppError(404, "ROSTER_ENTRY_NOT_FOUND", "قيد الطالب في القائمة غير موجود.");
  }
  await ref.update({
    active: false,
    deletedBy: user.uid,
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
}
