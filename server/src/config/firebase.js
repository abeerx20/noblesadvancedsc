import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { env } from "./env.js";
function createCredential() {
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    });
  }
  return applicationDefault();
}
const firebaseApp = getApps()[0] ?? initializeApp({
  credential: createCredential(),
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET
});
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const bucket = env.FIREBASE_STORAGE_BUCKET ? getStorage(firebaseApp).bucket() : null;

db.settings({ ignoreUndefinedProperties: true });