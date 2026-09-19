import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { employeeRoutes } from "../src/routes/employeeRoutes.js";
import { resolveEmployeeDocument } from "../src/services/employeeService.js";

process.env.NODE_ENV = "test";
process.env.FIREBASE_PROJECT_ID = "test-project";
process.env.ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:5500";

const { app } = await import("../src/app.js");

test("مسار فحص الصحة يعمل دون مصادقة", async () => {
  const response = await request(app).get("/api/v1/health").expect(200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "ok");
  assert.equal(response.headers["x-powered-by"], undefined);
});

test("المسارات المحمية ترفض الطلب بلا رمز دخول", async () => {
  const response = await request(app).get("/api/v1/me").expect(401);
  assert.equal(response.body.error.code, "AUTH_REQUIRED");
});

test("CORS يرفض مصدرًا غير موثوق", async () => {
  const response = await request(app).get("/api/v1/health").set("Origin", "https://untrusted.example").expect(403);
  assert.equal(response.body.error.code, "ORIGIN_NOT_ALLOWED");
});

test("مسار حذف موظفة موجود في التوجيه", () => {
  const routes = employeeRoutes.stack.filter((layer) => layer.route).map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods)
  }));
  assert(routes.some((route) => route.path === "/:id" && route.methods.includes("delete")));
});

test("مسار إعادة تعيين كلمة مرور الموظفة موجود في التوجيه", () => {
  const routes = employeeRoutes.stack.filter((layer) => layer.route).map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods)
  }));
  assert(routes.some((route) => route.path === "/:id/password" && route.methods.includes("patch")));
});

test("يفرز سجل الموظفة عبر authUid أو email أو employeeNumber عند حذفها", async () => {
  const docByUid = { exists: false };
  const byAuthUid = { empty: false, docs: [{ id: "emp-3", data: () => ({ authUid: "abc123", email: "a@school.com" }) }] };
  const byEmail = { empty: true, docs: [] };
  const byNumber = { empty: true, docs: [] };
  const calls = [];

  const fakeDb = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          calls.push([name, "doc", id]);
          if (id === "emp-3") return { exists: true, id: "emp-3", data: () => ({ authUid: "abc123" }) };
          return docByUid;
        }
      }),
      where: (field, op, value) => ({
        limit: (count) => {
          calls.push([name, "where", field, op, value, "limit", count]);
          if (field === "authUid") return { get: async () => byAuthUid };
          if (field === "email") return { get: async () => byEmail };
          if (field === "employeeNumber") return { get: async () => byNumber };
          return { get: async () => ({ empty: true, docs: [] }) };
        }
      })
    })
  };

  const resolved = await resolveEmployeeDocument("abc123", fakeDb);
  assert.ok(resolved);
  assert.equal(resolved.id, "emp-3");
});

