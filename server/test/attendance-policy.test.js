import test from "node:test";
import assert from "node:assert/strict";
import { ATTENDANCE_PERIOD_NUMBER, attendanceWindowIsOpen } from "../src/utils/attendancePolicy.js";

test("attendance is assigned to the second period", () => {
    assert.equal(ATTENDANCE_PERIOD_NUMBER, 2);
});

test("attendance opens from 08:20 through 09:10 Riyadh time", () => {
    assert.equal(attendanceWindowIsOpen(new Date("2026-09-27T05:19:00Z")), false);
    assert.equal(attendanceWindowIsOpen(new Date("2026-09-27T05:20:00Z")), true);
    assert.equal(attendanceWindowIsOpen(new Date("2026-09-27T06:10:00Z")), true);
    assert.equal(attendanceWindowIsOpen(new Date("2026-09-27T06:11:00Z")), false);
});