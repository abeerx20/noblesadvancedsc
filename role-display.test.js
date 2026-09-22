import test from "node:test";
import assert from "node:assert/strict";
import { getRoleTitle } from "./role-display.js";

test("يظهر المسمى الوظيفي الصحيح حسب الدور", () => {
    assert.equal(getRoleTitle("admin"), "إدارية");
    assert.equal(getRoleTitle("teacher"), "معلمة");
    assert.equal(getRoleTitle("principal"), "مديرة");
});
