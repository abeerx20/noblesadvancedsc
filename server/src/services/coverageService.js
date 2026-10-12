import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument } from "../utils/text.js";
import { notifyEmployee } from "./notificationService.js";

const schoolDays = ["sunday", "monday", "tuesday", "wednesday", "thursday"];
const dayAliases = {
    الأحد: "sunday",
    الاثنين: "monday",
    الثلاثاء: "tuesday",
    الأربعاء: "wednesday",
    الخميس: "thursday"
};

function normalizeDay(value) {
    return dayAliases[String(value ?? "").trim()] ?? String(value ?? "").trim().toLowerCase();
}

function normalizeName(value) {
    return String(value ?? "").replace(/\s+/g, "").trim();
}

function dateRange(from, to) {
    const dates = [];
    const parseDate = (value) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").replaceAll("/", "-"));
        if (!match) return null;
        const result = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
        return result.getUTCFullYear() === Number(match[1]) && result.getUTCMonth() === Number(match[2]) - 1 && result.getUTCDate() === Number(match[3]) ? result : null;
    };
    const current = parseDate(from);
    const end = parseDate(to);
    if (!current || !end) return dates;
    while (current <= end) {
        dates.push({ value: [current.getUTCFullYear(), String(current.getUTCMonth() + 1).padStart(2, "0"), String(current.getUTCDate()).padStart(2, "0")].join("-"), day: schoolDays[current.getUTCDay() - 0] });
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates.filter((item) => item.day);
}

function dayName(dateValue) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue ?? "").replaceAll("/", "-"));
    if (!parts) return "";
    const date = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12));
    if (Number.isNaN(date.getTime())) return "";
    const dayIndex = date.getUTCDay();
    return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][dayIndex];
}

function assignmentKey(absenceReportId, scheduleId) {
    return `${absenceReportId}_${scheduleId}`;
}

export function buildCoverageAssignmentId({ absenceReportId, scheduleId, date, absentTeacherUid }) {
    const safeAbsenceId = String(absenceReportId ?? "").trim();
    const safeScheduleId = String(scheduleId ?? "").trim();
    const safeDate = String(date ?? "").trim();
    const safeAbsentTeacher = String(absentTeacherUid ?? "").trim();
    if (safeAbsenceId && safeScheduleId) return `${safeAbsenceId}_${safeScheduleId}`;
    return `manual_${safeAbsentTeacher || "teacher"}_${safeDate || "date"}_${safeScheduleId || "schedule"}`.replace(/[^a-zA-Z0-9_\-]/g, "_");
}

function timeToMinutes(value) {
    if (value == null || value === "") return null;
    const [hours, minutes] = String(value).split(":").map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
}

function timeRangesOverlap(startA, endA, startB, endB) {
    const startAValue = timeToMinutes(startA);
    const endAValue = timeToMinutes(endA);
    const startBValue = timeToMinutes(startB);
    const endBValue = timeToMinutes(endB);
    if (startAValue == null || endAValue == null || startBValue == null || endBValue == null) return false;
    return startAValue < endBValue && startBValue < endAValue;
}

async function validateCoverageAssignment({ substituteUid, date, startTime, endTime, scheduleId, excludeId, absentTeacherUid }) {
    if (!substituteUid || !date || !startTime || !endTime) return;
    const normalizedSubstituteUid = getComparableEmployeeUid({ authUid: substituteUid, id: substituteUid }) || String(substituteUid).trim();
    const snapshot = await db.collection("teacherCoverage")
        .where("date", "==", date)
        .limit(500)
        .get();
    const conflict = snapshot.docs
        .map((doc) => publicDocument(doc))
        .filter((item) => item.id !== excludeId)
        .find((item) => {
            if (item.status === "ملغى" || item.deletedAt) return false;
            const sameTeacher = [item.substituteUid, item.substituteEmployeeId].some((value) => String(value ?? "").trim() === normalizedSubstituteUid || String(value ?? "").trim() === String(substituteUid).trim());
            if (!sameTeacher) return false;
            return timeRangesOverlap(startTime, endTime, item.startTime, item.endTime);
        });
    if (conflict) {
        throw new AppError(409, "COVERAGE_CONFLICT", "تعارض في الوقت: هذه المعلمة لديها حصة أو انتظار مسجّل في نفس الوقت.");
    }
    const scheduleSnapshot = await db.collection("teacherSchedule")
        .where("day", "==", dayName(date))
        .limit(500)
        .get();
    const scheduleConflict = scheduleSnapshot.docs
        .map((doc) => publicDocument(doc))
        .find((item) => {
            const itemTeacherUid = getComparableEmployeeUid({ authUid: item.teacherUid, id: item.teacherUid }) || String(item.teacherUid ?? "").trim();
            if (itemTeacherUid !== normalizedSubstituteUid && itemTeacherUid !== String(substituteUid).trim()) return false;
            if (item.id === scheduleId) return false;
            return timeRangesOverlap(startTime, endTime, item.startTime, item.endTime);
        });
    if (scheduleConflict) {
        throw new AppError(409, "COVERAGE_CONFLICT", "تعارض في وقت حصة المعلمة البديلة مع جدولها الدراسي.");
    }
    if (absentTeacherUid && absentTeacherUid === substituteUid) {
        throw new AppError(409, "COVERAGE_SELF_CONFLICT", "لا يمكن إسناد الحصة لنفس المعلمة الغائبة.");
    }
}

export function getComparableEmployeeUid(employee) {
    if (!employee || typeof employee !== "object") return "";
    const candidates = [employee.authUid, employee.id, employee.employeeUid].filter((value) => typeof value === "string" && value.trim());
    return String(candidates[0] ?? "").trim();
}

export function employeeMatchesUid(employee, candidateUid) {
    if (!employee || !candidateUid) return false;
    const normalized = String(candidateUid).trim();
    if (!normalized) return false;
    return [employee.authUid, employee.id, employee.employeeUid].some((value) => String(value ?? "").trim() === normalized);
}

function buildEmployeeAliasMap(employees) {
    const map = new Map();
    employees.forEach((employee) => {
        [employee.authUid, employee.id, employee.employeeUid].filter((value) => typeof value === "string" && value.trim()).forEach((value) => {
            map.set(String(value).trim(), employee);
        });
    });
    return map;
}

export async function listCoverage(from, to) {
    const [employeeSnapshot, scheduleSnapshot, assignmentSnapshot] = await Promise.all([
        db.collection("employees").limit(500).get(),
        db.collection("teacherSchedule").limit(500).get(),
        db.collection("teacherCoverage").where("date", ">=", from).where("date", "<=", to).limit(500).get()
    ]);
    const employees = employeeSnapshot.docs.map(publicDocument).filter((item) => item.status !== "inactive");
    const schedulesById = new Map(scheduleSnapshot.docs.map((doc) => [doc.id, publicDocument(doc)]));
    const employeeByUid = buildEmployeeAliasMap(employees);

    const rows = assignmentSnapshot.docs
        .map((doc) => publicDocument(doc))
        .filter((item) => item.status !== "ملغى" && !item.deletedAt)
        .map((assignment) => {
            const schedule = schedulesById.get(assignment.scheduleId) ?? {};
            const absentTeacher = assignment.absentTeacherUid
                ? employeeByUid.get(assignment.absentTeacherUid)
                : null;
            const substitute = assignment.substituteUid
                ? employeeByUid.get(assignment.substituteUid)
                : null;
            const absentTeacherUid = assignment.absentTeacherUid ?? getComparableEmployeeUid(absentTeacher) ?? "";
            const substituteUid = assignment.substituteUid ?? "";
            return {
                id: assignment.id,
                date: assignment.date,
                day: assignment.day ?? dayName(assignment.date),
                absenceReportId: assignment.absenceReportId ?? null,
                scheduleId: assignment.scheduleId ?? schedule.id ?? null,
                blockType: assignment.blockType ?? schedule.blockType ?? "",
                periodNumber: assignment.periodNumber ?? schedule.periodNumber ?? null,
                periodName: assignment.periodName ?? schedule.periodName ?? "",
                subject: assignment.subject ?? schedule.subject ?? "",
                classId: assignment.classId ?? schedule.classId ?? "",
                location: assignment.location ?? schedule.location ?? "",
                startTime: assignment.startTime ?? schedule.startTime ?? "",
                endTime: assignment.endTime ?? schedule.endTime ?? "",
                absentTeacherUid,
                absentTeacherName: assignment.absentTeacherName ?? absentTeacher?.nameAr ?? "—",
                assigned: true,
                substituteUid,
                substituteName: assignment.substituteName ?? substitute?.nameAr ?? "",
                status: assignment.status ?? "مكلف",
                notes: assignment.notes ?? "",
                recordedBy: assignment.recordedBy ?? assignment.createdBy ?? "",
                recordedAt: assignment.recordedAt ?? assignment.createdAt ?? null
            };
        });

    return {
        rows: rows.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
        substitutes: employees
            .filter((employee) => employee.authUid ?? employee.id)
            .map((employee) => ({ uid: employee.authUid ?? employee.id, nameAr: employee.nameAr }))
            .sort((a, b) => String(a.nameAr).localeCompare(String(b.nameAr), "ar"))
    };
}

export async function assignCoverage(user, data) {
    const scheduleSnapshot = await db.collection("teacherSchedule").doc(data.scheduleId).get();
    if (!scheduleSnapshot.exists) {
        throw new AppError(404, "SCHEDULE_NOT_FOUND", "الحصة أو المناوبة غير مرتبطة بالمعلمة الغائبة.");
    }

    const schedule = publicDocument(scheduleSnapshot);
    const absentTeacherUid = getComparableEmployeeUid({ authUid: schedule.teacherUid, id: schedule.teacherUid }) || String(schedule.teacherUid ?? "").trim();
    const absenceReportId = data.absenceReportId ? String(data.absenceReportId).trim() : "";

    if (absenceReportId) {
        const absenceSnapshot = await db.collection("absenceReports").doc(absenceReportId).get();
        if (!absenceSnapshot.exists || absenceSnapshot.data()?.status === "مرفوض") {
            throw new AppError(404, "ABSENCE_NOT_FOUND", "تقرير غياب المعلمة غير موجود أو تم رفضه.");
        }
    }

    let substituteSnapshot = await db.collection("employees").doc(data.substituteUid).get();
    if (!substituteSnapshot.exists) {
        const authMatches = await db.collection("employees").where("authUid", "==", data.substituteUid).limit(1).get();
        if (!authMatches.empty) substituteSnapshot = authMatches.docs[0];
    }
    if (!substituteSnapshot.exists || substituteSnapshot.data()?.status === "inactive") {
        throw new AppError(404, "SUBSTITUTE_NOT_FOUND", "المعلمة البديلة غير موجودة أو غير نشطة.");
    }
    const substitute = publicDocument(substituteSnapshot);
    const id = buildCoverageAssignmentId({ absenceReportId, scheduleId: data.scheduleId, date: data.date, absentTeacherUid });
    await validateCoverageAssignment({
        substituteUid: data.substituteUid,
        date: data.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        scheduleId: data.scheduleId,
        excludeId: id,
        absentTeacherUid
    });

    const docRef = db.collection("teacherCoverage").doc(id);
    const existing = await docRef.get();
    const coveragePayload = {
        date: data.date,
        day: dayName(data.date),
        absenceReportId: absenceReportId || null,
        scheduleId: data.scheduleId,
        absentTeacherUid,
        absentTeacherName: schedule.teacherName ?? substitute.nameAr,
        blockType: schedule.blockType,
        periodNumber: schedule.periodNumber ?? null,
        periodName: schedule.periodName ?? "",
        subject: schedule.subject ?? "",
        classId: schedule.classId ?? "",
        location: schedule.location ?? "",
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        substituteUid: data.substituteUid,
        substituteName: substitute.nameAr,
        substituteEmployeeId: substitute.id,
        status: data.status ?? "مكلف",
        notes: data.notes ?? "",
        acknowledgedAt: null,
        assignedBy: user.uid,
        recordedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: existing.exists ? existing.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        deletedAt: null,
        deletedBy: null,
        isDeleted: false
    };
    if (existing.exists) {
        await docRef.update(coveragePayload);
    } else {
        await docRef.set(coveragePayload, { merge: true });
    }
    await notifyEmployee({
        recipientUid: data.substituteUid,
        type: "teacher_coverage",
        title: "حصة انتظار جديدة",
        message: `أُضيفت حصة ${schedule.subject ?? schedule.periodName ?? "انتظار"} إلى جدول الانتظار يوم ${data.date}.`,
        coverageId: id,
        date: data.date
    });
    return id;
}

export async function listMyCoverage(user, from, to) {
    const snapshot = await db.collection("teacherCoverage")
        .where("date", ">=", from)
        .where("date", "<=", to)
        .limit(200)
        .get();
    const eligibleUids = new Set([user.uid, user?.employee?.authUid, user?.employee?.id].filter(Boolean));
    return snapshot.docs
        .map(publicDocument)
        .filter((item) => eligibleUids.has(item.substituteUid) || eligibleUids.has(item.substituteUid ?? ""))
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
}

export async function acknowledgeCoverage(user, id) {
    const ref = db.collection("teacherCoverage").doc(id);
    const snapshot = await ref.get();
    const acceptedIds = [user.uid, user?.employee?.authUid, user?.employee?.id].filter(Boolean);
    if (!snapshot.exists || !acceptedIds.includes(snapshot.data()?.substituteUid)) {
        throw new AppError(404, "COVERAGE_NOT_FOUND", "تكليف الانتظار غير موجود.");
    }
    await ref.update({ acknowledgedAt: FieldValue.serverTimestamp(), status: "مؤكد", updatedAt: FieldValue.serverTimestamp() });
    const managers = await db.collection("employees").limit(200).get();
    await Promise.all(managers.docs
        .map(publicDocument)
        .filter((employee) => ["principal", "vice_principal", "admin", "system_admin"].includes(employee.role))
        .map((employee) => notifyEmployee({
            recipientUid: employee.authUid ?? employee.id,
            type: "teacher_coverage_acknowledged",
            title: "الاطلاع على حصة الانتظار",
            message: `${snapshot.data().substituteName ?? "المعلمة البديلة"} اطلعت على حصة الانتظار.`,
            coverageId: id
        })));
}

export async function createCoverageAbsence(user, data) {
    const employeeDocId = data.employeeUid;
    let employeeSnapshot = await db.collection("employees").doc(employeeDocId).get();
    if (!employeeSnapshot.exists) {
        const authSnapshot = await db.collection("employees").where("authUid", "==", employeeDocId).limit(1).get();
        employeeSnapshot = authSnapshot.empty ? null : authSnapshot.docs[0];
    }
    if (!employeeSnapshot || employeeSnapshot.data()?.status === "inactive") {
        throw new AppError(404, "EMPLOYEE_NOT_FOUND", "المعلمة المحددة غير موجودة أو غير نشطة.");
    }
    const employee = publicDocument(employeeSnapshot);
    const employeeUidForRecord = employee.authUid ?? employee.id;
    const ref = await db.collection("absenceReports").add({
        employeeUid: employeeUidForRecord,
        employeeName: employee.nameAr,
        employeeNumber: employee.employeeNumber ?? "—",
        absenceType: data.absenceType,
        date: data.date,
        reason: data.reason,
        status: "قيد المراجعة",
        submittedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: user.uid
    });
    return ref.id;
}

export async function updateCoverage(user, id, data) {
    const ref = db.collection("teacherCoverage").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new AppError(404, "COVERAGE_NOT_FOUND", "تكليف الانتظار غير موجود.");

    const existing = publicDocument(snapshot);
    const nextSubstituteUid = data.substituteUid ? String(data.substituteUid).trim() : existing.substituteUid;
    if (nextSubstituteUid) {
        let substituteSnapshot = await db.collection("employees").doc(nextSubstituteUid).get();
        if (!substituteSnapshot.exists) {
            const authMatches = await db.collection("employees").where("authUid", "==", nextSubstituteUid).limit(1).get();
            if (!authMatches.empty) substituteSnapshot = authMatches.docs[0];
        }
        if (!substituteSnapshot.exists) throw new AppError(404, "SUBSTITUTE_NOT_FOUND", "المعلمة البديلة غير موجودة.");
        const substitute = publicDocument(substituteSnapshot);
        const scheduleSnapshot = await db.collection("teacherSchedule").doc(existing.scheduleId).get();
        if (scheduleSnapshot.exists) {
            const schedule = publicDocument(scheduleSnapshot);
            await validateCoverageAssignment({
                substituteUid: nextSubstituteUid,
                date: existing.date,
                startTime: existing.startTime ?? schedule.startTime,
                endTime: existing.endTime ?? schedule.endTime,
                scheduleId: existing.scheduleId,
                excludeId: id,
                absentTeacherUid: existing.absentTeacherUid
            });
        }
        data.substituteName = substitute.nameAr;
        data.substituteEmployeeId = substitute.id;
    }

    const changes = {
        ...data,
        updatedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        status: data.status ?? existing.status ?? "مكلف"
    };
    await ref.update(changes);
}

export async function deleteCoverage(user, id) {
    const ref = db.collection("teacherCoverage").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new AppError(404, "COVERAGE_NOT_FOUND", "تكليف الانتظار غير موجود.");
    await ref.update({
        status: "ملغى",
        isDeleted: true,
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp()
    });
    return { id, deletedBy: user.uid, softDeleted: true };
}
