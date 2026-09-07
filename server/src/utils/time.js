import { AppError } from "./AppError.js";

export function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours * 60) + minutes;
}

export function assertSchoolTime(startTime, endTime) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start < 450 || end > 870 || start >= end) {
    throw new AppError(422, "INVALID_SCHOOL_TIME", "يجب أن يكون الوقت بين 07:30 و14:30، وأن يسبق وقت البداية وقت النهاية.");
  }
}

export function overlaps(startA, endA, startB, endB) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(endA) > toMinutes(startB);
}

export function inclusiveDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const days = Math.floor((end - start) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1) {
    throw new AppError(422, "INVALID_DATE_RANGE", "يجب ألا يسبق تاريخ النهاية تاريخ البداية.");
  }
  return days;
}

export function weekdayKey(dateValue) {
  const index = new Date(`${dateValue}T12:00:00.000Z`).getUTCDay();
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][index];
}

