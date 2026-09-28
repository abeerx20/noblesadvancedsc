import test from "node:test";
import assert from "node:assert/strict";
import { ATTENDANCE_PERIOD_NUMBER, attendanceWindowIsOpen, findAttendanceSchedule } from "../src/utils/attendancePolicy.js";
import { scheduleBelongsToUser, scheduleTeacherIds } from "../src/utils/scheduleIdentity.js";

test("attendance is assigned to the second period", () => {
    assert.equal(ATTENDANCE_PERIOD_NUMBER, 2);
});

test("uses the subject from the current teacher's second-period schedule", () => {
    const schedules = [
        { day: "sunday", periodNumber: 2, teacherUid: "other", subject: "عبير", active: true },
        { day: "sunday", periodNumber: "2", teacherUid: "teacher", subject: "رياضيات", active: true }
    ];

    assert.equal(findAttendanceSchedule(schedules, "sunday", "teacher")?.subject, "رياضيات");
});

test("matches legacy schedule assignments by linked employee document id", () => {
    const teacherIds = scheduleTeacherIds({ uid: "auth-uid", employee: { id: "employee-doc" } });
    const schedules = [
        { day: "monday", periodNumber: 2, teacherUid: "legacy-schedule-uid", teacherEmployeeId: "employee-doc", subject: "رياضيات", active: true }
    ];

    assert.equal(findAttendanceSchedule(schedules, "monday", teacherIds)?.subject, "رياضيات");
});

test("does not use an employee id linked to a different authentication uid", () => {
    const teacherIds = scheduleTeacherIds({
        uid: "current-auth-uid",
        employee: { id: "employee-doc", authUid: "different-auth-uid" }
    });

    assert.deepEqual([...teacherIds], ["current-auth-uid"]);
});

test("matches student-class access through the linked employee id", () => {
    const user = { uid: "auth-uid", employee: { id: "employee-doc", authUid: "auth-uid" } };
    assert.equal(scheduleBelongsToUser({ teacherUid: "legacy-uid", teacherEmployeeId: "employee-doc" }, user), true);
    assert.equal(scheduleBelongsToUser({ teacherUid: "legacy-uid", teacherEmployeeId: "other-employee" }, user), false);
});

test("does not return another teacher's subject when this teacher has no period-two class", () => {
    const schedules = [
        { day: "sunday", periodNumber: 2, teacherUid: "other", subject: "عبير", active: true }
    ];

    assert.equal(findAttendanceSchedule(schedules, "sunday", "teacher"), null);
});

test("ignores inactive schedules and treats older records without active as active", () => {
    const schedules = [
        { day: "sunday", periodNumber: 2, teacherUid: "teacher", subject: "علوم", active: false },
        { day: "monday", periodNumber: 2, teacherUid: "teacher", subject: "تاريخ" },
        { day: "sunday", periodNumber: 2, teacherUid: "teacher", subject: "لغة عربية" }
    ];

    assert.equal(findAttendanceSchedule(schedules, "sunday", "teacher")?.subject, "لغة عربية");
});

test("attendance opens from 08:20 through 09:10 Riyadh time", () => {
    assert.equal(attendanceWindowIsOpen(new Date("2026-09-27T05:19:00Z")), false);
    assert.equal(attendanceWindowIsOpen(new Date("2026-09-27T05:20:00Z")), true);
    assert.equal(attendanceWindowIsOpen(new Date("2026-09-27T06:10:00Z")), true);
    assert.equal(attendanceWindowIsOpen(new Date("2026-09-27T06:11:00Z")), false);
});