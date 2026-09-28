const ACADEMIC_YEAR_START_MONTH = 7;
const ACADEMIC_YEAR_START_DAY = 30;

export function academicWeekNumber(dateValue) {
    if (!dateValue) return 1;
    const date = new Date(`${dateValue}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return 1;

    const currentYearStart = new Date(Date.UTC(
        date.getUTCFullYear(),
        ACADEMIC_YEAR_START_MONTH,
        ACADEMIC_YEAR_START_DAY
    ));
    const academicStart = date >= currentYearStart
        ? currentYearStart
        : new Date(Date.UTC(date.getUTCFullYear() - 1, ACADEMIC_YEAR_START_MONTH, ACADEMIC_YEAR_START_DAY));
    const diffDays = Math.floor((date - academicStart) / 86_400_000);
    return Math.floor(diffDays / 7) + 1;
}