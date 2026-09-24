import test from "node:test";
import assert from "node:assert/strict";
import { getRoleTitle } from "./role-display.js";

test("يظهر المسمى الوظيفي الصحيح حسب الدور", () => {
    assert.equal(getRoleTitle("admin"), "إدارية");
    assert.equal(getRoleTitle("teacher"), "معلمة");
    assert.equal(getRoleTitle("principal"), "مديرة");
    assert.equal(getRoleTitle("Teacher"), "معلمة");
    assert.equal(getRoleTitle("  system-admin  "), "مسؤولة النظام");
    assert.equal(getRoleTitle("resource user"), "الموارد البشرية والمالية");
    assert.equal(getRoleTitle("vice_principal"), "وكيلة");
});
