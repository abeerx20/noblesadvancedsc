import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { FIREBASE_CLIENT_CONFIG } from "./firebase-config.js";

const missingConfig = Object.values(FIREBASE_CLIENT_CONFIG).some((value) => String(value).startsWith("REPLACE_WITH_"));
export const configurationReady = !missingConfig;

const firebaseApp = initializeApp(FIREBASE_CLIENT_CONFIG);
export const firebaseAuth = getAuth(firebaseApp);

export async function loginWithEmail(email, password) {
  if (!configurationReady) throw new Error("FIREBASE_CONFIG_REQUIRED");
  await setPersistence(firebaseAuth, browserSessionPersistence);
  return signInWithEmailAndPassword(firebaseAuth, email, password);
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

