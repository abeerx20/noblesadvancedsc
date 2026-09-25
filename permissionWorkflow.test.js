import test from "node:test";
import assert from "node:assert/strict";
import { resolvePermissionDecisionStage } from "./permissionWorkflow.js";

test("manager stage moves request to the HR queue", () => {
    const result = resolvePermissionDecisionStage({ status: "بانتظار المديرة" }, { employee: { role: "principal" }, permissions: [] }, "approved");

    assert.deepEqual(result, {
        nextStatus: "بانتظار الموارد البشرية",
        stage: "manager",
        isFinal: false,
        decision: "موافقة"
    });
});

test("HR stage finalizes the request", () => {
    const result = resolvePermissionDecisionStage({ status: "بانتظار الموارد البشرية" }, { employee: { role: "hr" }, permissions: [] }, "rejected");

    assert.deepEqual(result, {
        nextStatus: "مرفوض",
        stage: "hr",
        isFinal: true,
        decision: "رفض"
    });
});
