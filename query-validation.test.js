import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { validate } from "../src/middleware/validate.js";
import { limitQuerySchema } from "../src/validators/schemas.js";

test("يتحقق من query في Express 5 دون محاولة استبدال الخاصية للقراءة فقط", async () => {
  const app = express();
  app.get("/query", validate(limitQuerySchema, "query"), (req, res) => {
    res.json({ limit: req.validated.query.limit });
  });

  const response = await request(app).get("/query?limit=25").expect(200);
  assert.equal(response.body.limit, 25);
});
