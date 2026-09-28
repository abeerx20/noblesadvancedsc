export const ATTENDANCE_PERIOD_NUMBER = 2;

export function findAttendanceSchedule(schedules, day, teacherUid) {
    const teacherUids = teacherUid instanceof Set
        ? teacherUid
        : new Set(teacherUid ? [teacherUid] : []);
    return schedules.find((schedule) => schedule.day === day
        && Number(schedule.periodNumber) === ATTENDANCE_PERIOD_NUMBER
        && schedule.active !== false
        && (!teacherUids.size || teacherUids.has(schedule.teacherUid))) ?? null;
}

const ATTENDANCE_START_MINUTE = (8 * 60) + 20;
const ATTENDANCE_END_MINUTE = (9 * 60) + 10;
const riyadhClock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
});

export function attendanceWindowIsOpen(now = new Date()) {
    const parts = riyadhClock.formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    const currentMinute = (hour * 60) + minute;
    return currentMinute >= ATTENDANCE_START_MINUTE && currentMinute <= ATTENDANCE_END_MINUTE;
}