import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument } from "../utils/text.js";
import { assertSchoolTime, overlaps } from "../utils/time.js";
import { getClassOrThrow } from "./classService.js";
import { getEmployeeByUid } from "./employeeService.js";

function deterministicColor(uid) {
  const palette = ["#0f6b55", "#2f6f8f", "#8a5a44", "#6d5a8d", "#94711f", "#2e7775", "#7a5467", "#3f6b42"];
  const total = [...uid].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[total % palette.length];
}

export async function listSchedule(user, filters) {
  const scheduleManagementRoles = new Set([
    "principal",
    "vice_principal",
    "admin",
    "system_admin",
    "schedule_admin",
    "upper_management"
  ]);
  const canViewAll = scheduleManagementRoles.has(user.employee?.role)
    && (user.permissions.includes("view_all_schedules") || user.permissions.includes("manage_schedules"));
  const requestedAll = filters.scope === "all";
  if (requestedAll && !canViewAll) {
    throw new AppError(403, "FORBIDDEN", "لا توجد لديك صلاحية لعرض جداول المعلمات.");
  }
  const snapshot = await db.collection("teacherSchedule").limit(500).get();
  let rows = snapshot.docs.map(publicDocument).filter((row) => row.active !== false);
  if (!requestedAll) rows = rows.filter((row) => row.teacherUid === user.uid);
  else if (filters.teacherUid) rows = rows.filter((row) => row.teacherUid === filters.teacherUid);
  if (filters.classId) rows = rows.filter((row) => row.classId === filters.classId);
  if (filters.day) rows = rows.filter((row) => row.day === filters.day);
  return rows.sort((a, b) =>
    String(a.day ?? "").localeCompare(String(b.day ?? ""))
    || String(a.startTime ?? "").localeCompare(String(b.startTime ?? ""))
  );
}

export async function createScheduleBlock(user, data) {
  assertSchoolTime(data.startTime, data.endTime);
  if (data.classId) await getClassOrThrow(data.classId);
  const teacher = await getEmployeeByUid(data.teacherUid);

  const sameDay = await db.collection("teacherSchedule").where("day", "==", data.day).limit(300).get();
  const conflict = sameDay.docs.map(publicDocument).filter((record) => record.active !== false).find((record) => {
    const sameTeacher = record.teacherUid === data.teacherUid;
    const sameClass = data.classId && record.classId === data.classId;
    if (!record.startTime || !record.endTime) return false;
    return (sameTeacher || sameClass) && overlaps(data.startTime, data.endTime, record.startTime, record.endTime);
  });
  if (conflict) {
    throw new AppError(409, "SCHEDULE_CONFLICT", "يوجد تعارض حقيقي في وقت المعلمة أو الفصل.", { conflictingRecordId: conflict.id });
  }

  const ref = await db.collection("teacherSchedule").add({
    ...data,
    active: true,
    teacherName: teacher.nameAr,
    teacherEmployeeId: teacher.id,
    teacherColor: deterministicColor(data.teacherUid),
    createdBy: user.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}


export async function updateScheduleBlock(user, id, data) {
  const ref = db.collection("teacherSchedule").doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists || snapshot.data()?.active === false) {
    throw new AppError(
      404,
      "SCHEDULE_NOT_FOUND",
      "سجل الجدول غير موجود."
    );
  }

  assertSchoolTime(data.startTime, data.endTime);

  if (data.classId) {
    await getClassOrThrow(data.classId);
  }

  const teacher = await getEmployeeByUid(data.teacherUid);

  const sameDay = await db
    .collection("teacherSchedule")
    .where("day", "==", data.day)
    .limit(300)
    .get();

  const conflict = sameDay.docs
    .map(publicDocument)
    .filter((record) => {
      return record.id !== id && record.active !== false;
    })
    .find((record) => {
      const sameTeacher = record.teacherUid === data.teacherUid;
      const sameClass =
        data.classId && record.classId === data.classId;

      if (!record.startTime || !record.endTime) {
        return false;
      }

      return (
        (sameTeacher || sameClass) &&
        overlaps(
          data.startTime,
          data.endTime,
          record.startTime,
          record.endTime
        )
      );
    });

  if (conflict) {
    throw new AppError(
      409,
      "SCHEDULE_CONFLICT",
      "يوجد تعارض حقيقي في وقت المعلمة أو الفصل.",
      { conflictingRecordId: conflict.id }
    );
  }

  await ref.update({
    ...data,
    teacherName: teacher.nameAr,
    teacherEmployeeId: teacher.id,
    teacherColor: deterministicColor(data.teacherUid),
    updatedBy: user.uid,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function deleteScheduleBlock(user, id) {
  const ref = db.collection("teacherSchedule").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError(404, "SCHEDULE_NOT_FOUND", "سجل الجدول غير موجود.");
  await ref.update({ active: false, deletedBy: user.uid, deletedAt: FieldValue.serverTimestamp() });
}
