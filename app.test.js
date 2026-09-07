import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

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

