export function resolvePermissionDecisionStage(record, user, decisionStatus) {
    const normalizedDecision = decisionStatus === "approved" ? "approved" : "rejected";
    const isManager = Boolean(user) && ["principal", "vice_principal", "admin", "system_admin"].includes(user.employee?.role) || Boolean(user) && user.permissions?.includes("manage_leave_requests");
    const isHr = Boolean(user) && (user.employee?.role === "hr" || user.permissions?.includes("manage_leave_hr_requests"));

    if ((record.status === "بانتظار المديرة" || record.status === "قيد المراجعة") && isManager) {
        return {
            nextStatus: "بانتظار الموارد البشرية",
            stage: "manager",
            isFinal: false,
            decision: normalizedDecision === "approved" ? "موافقة" : "رفض"
        };
    }

    if (record.status === "بانتظار الموارد البشرية" && isHr) {
        return {
            nextStatus: normalizedDecision === "approved" ? "معتمد" : "مرفوض",
            stage: "hr",
            isFinal: true,
            decision: normalizedDecision === "approved" ? "اعتماد" : "رفض"
        };
    }

    return {
        nextStatus: record.status,
        stage: null,
        isFinal: true,
        decision: normalizedDecision === "approved" ? "اعتماد" : "رفض"
    };
}
