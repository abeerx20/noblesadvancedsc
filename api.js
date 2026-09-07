import { APP_CONFIG } from "./app-config.js";
import { firebaseAuth, waitForUser } from "./firebase-client.js";

export async function apiFetch(path, options = {}) {
  const user = firebaseAuth.currentUser ?? await waitForUser();
  if (!user) {
    window.location.replace("login.html");
    throw new Error("AUTH_REQUIRED");
  }
  const headers = new Headers(options.headers ?? {});

  headers.set(
    "Authorization",
    `Bearer ${await user.getIdToken()}`
  );

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  let response;
  try {
    response = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, { ...options, headers });
  } catch {
    throw new Error("تعذر الاتصال بالخادم. تأكدي أن الباك إند يعمل على المنفذ 3000.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    if (response.status === 401) window.location.replace("login.html");
    const error = new Error(body?.error?.message ?? "تعذر إكمال العملية.");
    error.code = body?.error?.code;
    error.details = body?.error?.details;
    throw error;
  }
  return body;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, data) => apiFetch(path, { method: "POST", body: JSON.stringify(data) }),
  put: (path, data) => apiFetch(path, { method: "PUT", body: JSON.stringify(data) }),
  patch: (path, data) => apiFetch(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (path) => apiFetch(path, { method: "DELETE" })
};

export async function downloadFile(path, filename) {
  const user = firebaseAuth.currentUser ?? await waitForUser();
  if (!user) throw new Error("يجب تسجيل الدخول للمتابعة.");
  let response;
  try {
    response = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  } catch {
    throw new Error("تعذر الاتصال بالخادم.");
  }
  if (!response.ok) {
    const body = (response.headers.get("content-type") ?? "").includes("application/json") ? await response.json() : null;
    throw new Error(body?.error?.message ?? "تعذر تنزيل الملف.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
