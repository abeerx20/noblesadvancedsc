import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { existsSync } from "node:fs";
import path from "node:path";
import { env } from "./env.js";

function createCredential() {
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
  }

  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (configuredPath) {
    const resolvedPath = path.resolve(configuredPath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Firebase service account file not found: ${resolvedPath}. Add the file or update GOOGLE_APPLICATION_CREDENTIALS.`);
    }
  }

  return applicationDefault();
}

let firebaseApp;
try {
  firebaseApp = getApps()[0] ?? initializeApp({
    credential: createCredential(),
    projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Firebase Admin initialization failed:", message);
  firebaseApp = getApps()[0] ?? initializeApp({
    projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET
  });
}

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const bucket = env.FIREBASE_STORAGE_BUCKET ? getStorage(firebaseApp).bucket() : null;

db.settings({ ignoreUndefinedProperties: true });