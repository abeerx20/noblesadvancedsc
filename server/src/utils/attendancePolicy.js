export const ATTENDANCE_PERIOD_NUMBER = 2;

export function findAttendanceSchedule(schedules, day, teacherUid) {
    const teacherUids = teacherUid instanceof Set
        ? teacherUid
        : new Set(teacherUid ? [teacherUid] : []);
    return schedules.find((schedule) => schedule.day === day
        && Number(schedule.periodNumber ?? schedule.period) === ATTENDANCE_PERIOD_NUMBER
        && schedule.active !== false
        && (!teacherUids.size || teacherUids.has(schedule.teacherUid) || teacherUids.has(schedule.teacherEmployeeId))) ?? null;
}

const DEFAULT_ATTENDANCE_START_MINUTE = (8 * 60) + 20;
const DEFAULT_ATTENDANCE_END_MINUTE = (9 * 60) + 10;
const KINDERGARTEN_ATTENDANCE_START_MINUTE = (8 * 60) + 50;
const KINDERGARTEN_ATTENDANCE_END_MINUTE = (9 * 60) + 40;
const riyadhClock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
});

export function attendanceWindowIsOpen(now = new Date(), stage) {
    if (process.env.ATTENDANCE_WINDOW_BYPASS === "true") return true;
    const parts = riyadhClock.formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    const currentMinute = (hour * 60) + minute;
    const startMinute = stage === "kindergarten"
        ? KINDERGARTEN_ATTENDANCE_START_MINUTE
        : DEFAULT_ATTENDANCE_START_MINUTE;
    const endMinute = stage === "kindergarten"
        ? KINDERGARTEN_ATTENDANCE_END_MINUTE
        : DEFAULT_ATTENDANCE_END_MINUTE;
    return currentMinute >= startMinute && currentMinute <= endMinute;
}