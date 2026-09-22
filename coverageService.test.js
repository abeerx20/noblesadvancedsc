import test from "node:test";
import assert from "node:assert/strict";

import { employeeMatchesUid, getComparableEmployeeUid } from "./server/src/services/coverageService.js";

test("normalizes employee IDs across authUid and Firestore document ids", () => {
    assert.equal(getComparableEmployeeUid({ id: "emp_doc_123", authUid: "uid_abc" }), "uid_abc");
    assert.equal(getComparableEmployeeUid({ id: "emp_doc_123" }), "emp_doc_123");
    assert.equal(employeeMatchesUid({ id: "emp_doc_123", authUid: "uid_abc" }, "emp_doc_123"), true);
    assert.equal(employeeMatchesUid({ id: "emp_doc_123", authUid: "uid_abc" }, "uid_abc"), true);
    assert.equal(employeeMatchesUid({ id: "emp_doc_123", authUid: "uid_abc" }, "uid_xyz"), false);
});
