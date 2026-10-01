import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { FIREBASE_CLIENT_CONFIG } from "./firebase-config.js";
import { APP_CONFIG } from "./app-config.js";

const missingConfig = Object.values(FIREBASE_CLIENT_CONFIG).some((value) => String(value).startsWith("REPLACE_WITH_"));
export const configurationReady = !missingConfig;

const firebaseApp = initializeApp(FIREBASE_CLIENT_CONFIG);
export const firebaseAuth = getAuth(firebaseApp);

export async function loginWithEmail(email, password) {
  if (!configurationReady) throw new Error("FIREBASE_CONFIG_REQUIRED");
  await setPersistence(firebaseAuth, browserSessionPersistence);
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

export async function loginWithNationalId(nationalId, password) {
  let response;
  try {
    response = await fetch(`${APP_CONFIG.apiBaseUrl}/auth/parent-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nationalId, password })
    });
  } catch {
    throw new Error("حدث خطأ. حاولي مرة أخرى لاحقًا.");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message ?? "تعذر تسجيل الدخول. تحققي من البيانات.");
    error.code = body?.error?.code;
    throw error;
  }

  if (!configurationReady) throw new Error("FIREBASE_CONFIG_REQUIRED");
  await setPersistence(firebaseAuth, browserSessionPersistence);
  return signInWithCustomToken(firebaseAuth, body.data.customToken);
}

export function waitForUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export function logout() {
  return signOut(firebaseAuth);
}

