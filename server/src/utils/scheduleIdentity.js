export function scheduleTeacherIds(user) {
    const userUid = user?.uid;
    const employee = user?.employee;
    const ids = [userUid];
    if (employee?.id && (!employee.authUid || employee.authUid === userUid)) {
        ids.push(employee.id);
        if (typeof employee.employeeUid === "string") ids.push(employee.employeeUid);
    }
    return new Set(ids.filter((id) => typeof id === "string" && id.length > 0));
}

export function scheduleBelongsToUser(schedule, user) {
    const ids = scheduleTeacherIds(user);
    return ids.has(schedule.teacherUid) || ids.has(schedule.teacherEmployeeId);
}