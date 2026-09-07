import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument } from "../utils/text.js";

export async function listClasses() {
  const snapshot = await db.collection("academicClasses").where("active", "==", true).limit(200).get();
  const classes = snapshot.docs.map(publicDocument).map((item) => ({
    ...item,
    name: item.name ?? [item.grade, item.section, item.gender].filter(Boolean).join(" – ")
  }));
  return classes.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "ar"));
}

export async function getClassOrThrow(classId) {
  const snapshot = await db.collection("academicClasses").doc(classId).get();
  if (!snapshot.exists || snapshot.data().active !== true) {
    throw new AppError(404, "CLASS_NOT_FOUND", "الفصل المحدد غير موجود أو غير نشط.");
  }
  return publicDocument(snapshot);
}

async function assertUniqueClass(data, excludedId = null) {
  const duplicate = await db.collection("academicClasses")
    .where("stage", "==", data.stage)
    .limit(200)
    .get();
  const duplicateExists = duplicate.docs.some((document) => {
    if (document.id === excludedId) return false;
    const academicClass = document.data();
    return academicClass.grade === data.grade
      && academicClass.section === data.section
      && academicClass.gender === data.gender
      && academicClass.active !== false;
  });
  if (duplicateExists) {
    throw new AppError(409, "DUPLICATE_CLASS", "يوجد فصل مطابق مسجل مسبقًا.");
  }
}

async function classUsage(classId) {
  const [students, enrollments, schedules] = await Promise.all([
    db.collection("students").where("classId", "==", classId).limit(500).get(),
    db.collection("studentEnrollments").where("classId", "==", classId).limit(500).get(),
    db.collection("teacherSchedule").where("classId", "==", classId).limit(500).get()
  ]);
  return {
    students: students.docs.some((document) => document.data().active !== false),
    enrollments: enrollments.docs.some((document) => document.data().active !== false),
    schedules: schedules.docs.some((document) => document.data().active !== false)
  };
}

async function clearClassUsage(classId, actorUid) {
  const [students, enrollments, schedules] = await Promise.all([
    db.collection("students").where("classId", "==", classId).limit(500).get(),
    db.collection("studentEnrollments").where("classId", "==", classId).limit(500).get(),
    db.collection("teacherSchedule").where("classId", "==", classId).limit(500).get()
  ]);

  const now = FieldValue.serverTimestamp();

  const updateBySnapshot = (document, payload, collectionName) => {
    const ref = document.ref ?? db.collection(collectionName).doc(document.id);
    return ref.update(payload);
  };

  await Promise.all([
    ...students.docs.map((document) => updateBySnapshot(document, {
      classId: null,
      updatedBy: actorUid,
      updatedAt: now
    }, "students")),
    ...enrollments.docs.map((document) => updateBySnapshot(document, {
      classId: null,
      active: false,
      status: "inactive",
      deletedBy: actorUid,
      deletedAt: now,
      updatedAt: now
    }, "studentEnrollments")),
    ...schedules.docs.map((document) => updateBySnapshot(document, {
      classId: null,
      active: false,
      deletedBy: actorUid,
      deletedAt: now,
      updatedAt: now
    }, "teacherSchedule"))
  ]);
}

const gradeLabels = {
  KG1: "KG1",
  KG2: "KG2",
  KG3: "KG3",
  Grade1: "Grade1",
  Grade2: "Grade2",
  Grade3: "Grade3"
};

function buildClassName(data) {
  const stageLabel = data.stage === "kindergarten" ? "رياض الأطفال" : "الابتدائي";
  const genderLabel = data.gender === "mixed" ? "مختلط" : data.gender === "male" ? "بنين" : "بنات";
  const section = String(data.section ?? "").trim() || "غير محدد";
  return `${stageLabel} - ${gradeLabels[data.grade] ?? data.grade} - ${section} - ${genderLabel}`;
}

export async function createClass(data, actorUid) {
  const payload = {
    ...data,
    name: (data.name ?? "").trim() || buildClassName(data),
    stage: data.stage,
    grade: data.grade,
    section: data.section,
    gender: data.gender,
    active: true
  };

  await assertUniqueClass(payload);
  const ref = await db.collection("academicClasses").add({
    ...payload,
    createdBy: actorUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

export async function updateClass(classId, data, actorUid) {
  const ref = db.collection("academicClasses").doc(classId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().active !== true) {
    throw new AppError(404, "CLASS_NOT_FOUND", "الفصل المحدد غير موجود أو غير نشط.");
  }

  const payload = {
    ...data,
    name: (data.name ?? "").trim() || buildClassName(data),
    active: true
  };

  await assertUniqueClass(payload, classId);
  const current = snapshot.data();
  const structureChanged = current.stage !== payload.stage
    || current.grade !== payload.grade
    || current.gender !== payload.gender;
  if (structureChanged) {
    const usage = await classUsage(classId);
    if (usage.students || usage.enrollments || usage.schedules) {
      throw new AppError(
        409,
        "CLASS_STRUCTURE_IN_USE",
        "لا يمكن تغيير مرحلة أو صف أو جنس فصل مرتبط بطلاب أو جداول. يمكنك تعديل الاسم والشعبة فقط."
      );
    }
  }

  await ref.update({
    ...payload,
    active: true,
    updatedBy: actorUid,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function deleteClass(classId, actorUid, { force = false } = {}) {
  const ref = db.collection("academicClasses").doc(classId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().active !== true) {
    throw new AppError(404, "CLASS_NOT_FOUND", "الفصل المحدد غير موجود أو غير نشط.");
  }

  const usage = await classUsage(classId);
  if (!force && (usage.students || usage.enrollments || usage.schedules)) {
    throw new AppError(
      409,
      "CLASS_IN_USE",
      "لا يمكن حذف الفصل لأنه مرتبط بطلاب أو جداول نشطة. أزيلي الارتباطات أولًا أو استخدم الحذف القسري."
    );
  }

  if (force) {
    await clearClassUsage(classId, actorUid);
  }

  await ref.update({
    active: false,
    deletedBy: actorUid,
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    forceDeleted: Boolean(force)
  });
}
