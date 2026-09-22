import test from "node:test";
import assert from "node:assert/strict";
import { coverageRoutes } from "./server/src/routes/coverageRoutes.js";

test("coverage routes expose delete endpoint for managing saved coverage records", () => {
    const methods = new Set();

    for (const layer of coverageRoutes.stack) {
        if (!layer.route) continue;
        for (const method of Object.keys(layer.route.methods)) {
            methods.add(method.toUpperCase());
        }
    }

    assert.ok(methods.has("DELETE"), "should include DELETE for coverage records");
});
