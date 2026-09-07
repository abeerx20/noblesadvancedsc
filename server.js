// server.js
import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  console.info(`🚀 MyNas server is running on http://localhost:${env.PORT}`);
});

function shutdown(signal) {
  console.info(`${signal} received. Closing server safely.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));    