// app.js
import "./config/firebase.js"; // ✅ ضع هذا في الأول!
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";

import { errorHandler, notFound } from "./middleware/errors.js";
import { AppError } from "./utils/AppError.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDirectory = path.resolve(currentDirectory, "../../client");
const templatesDirectory = path.resolve(currentDirectory, "../../templates");

export const app = express();

if (env.trustProxy) app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((req, res, next) => {
  req.requestId = req.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: [
        "'self'",
        "https://*.googleapis.com",
        "https://www.googleapis.com",
        "https://www.gstatic.com",
        "https://securetoken.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "https://firestore.googleapis.com",
        "https://firebase.googleapis.com",
        "https://*.firebaseio.com",
        "https://*.firebaseapp.com"
      ]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
    callback(new AppError(403, "ORIGIN_NOT_ALLOWED", "مصدر الطلب غير مسموح به."));
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
  maxAge: 600
}));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "تم إرسال طلبات كثيرة. حاولي بعد قليل." } }
}));
app.use(express.json({ limit: "150kb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

app.use("/api/v1", apiRouter);
app.use("/templates", express.static(templatesDirectory, { maxAge: env.NODE_ENV === "production" ? "1h" : 0 }));
app.use(express.static(clientDirectory, { extensions: ["html"], maxAge: env.NODE_ENV === "production" ? "1h" : 0 }));
app.get("/", (_req, res) => res.sendFile(path.join(clientDirectory, "index.html")));

app.use(notFound);
app.use(errorHandler);

