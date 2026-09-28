import test from "node:test";
import assert from "node:assert/strict";
import { academicWeekNumber } from "../../client/assets/js/academic-calendar.js";

test("aligns attendance week numbers with the 2026 school calendar", () => {
    assert.equal(academicWeekNumber("2026-08-30"), 1);
    assert.equal(academicWeekNumber("2026-09-05"), 1);
    assert.equal(academicWeekNumber("2026-09-06"), 2);
    assert.equal(academicWeekNumber("2026-09-27"), 5);
});

test("falls back to week one for a missing or invalid date", () => {
    assert.equal(academicWeekNumber(""), 1);
    assert.equal(academicWeekNumber("not-a-date"), 1);
});