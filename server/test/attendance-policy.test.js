import test from "node:test";
import assert from "node:assert/strict";
import { ATTENDANCE_PERIOD_NUMBER, attendanceWindowIsOpen, findAttendanceSchedule } from "../src/utils/attendancePolicy.js";

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