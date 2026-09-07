import test from "node:test";
import assert from "node:assert/strict";
import { inclusiveDays, overlaps } from "../src/utils/time.js";

test("يسمح بتلاصق حصتين دون اعتباره تعارضًا", () => {
  assert.equal(overlaps("08:00", "08:50", "08:50", "09:40"), false);
});

test("يكتشف التعارض الحقيقي", () => {
  assert.equal(overlaps("08:00", "09:00", "08:50", "09:40"), true);
});

test("يحسب مدة الإجازة شاملة يومي البداية والنهاية", () => {
  assert.equal(inclusiveDays("2026-07-01", "2026-07-03"), 3);
});

test("يرفض نهاية تسبق البداية", () => {
  assert.throws(() => inclusiveDays("2026-07-03", "2026-07-01"));
});

