import { auth, db } from "../config/firebase.js";
import { FIREBASE_CLIENT_CONFIG } from "../../../client/assets/js/firebase-config.js";
import { AppError } from "../utils/AppError.js";

const credentialsError = () => new AppError(401, "INVALID_PARENT_CREDENTIALS", "رقم الهوية أو كلمة المرور غير صحيحة.");

function activeStatus(value) {
    return value === "active" || value === "نشط" || value === true;
}

export async function createParentLoginToken({ nationalId, password }) {
    const matches = await db.collection("parents").where("nationalId", "==", nationalId).limit(2).get();
    if (matches.size !== 1) throw credentialsError();

    const parentSnapshot = matches.docs[0];
    const parent = parentSnapshot.data();
    const uid = parent.authUid ?? parentSnapshot.id;
    if (!parent.email || !uid) throw credentialsError();

    let response;
    try {
        response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_CLIENT_CONFIG.apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: parent.email, password, returnSecureToken: true })
        });
    } catch {
        throw new AppError(503, "FIREBASE_AUTH_UNAVAILABLE", "تعذر الاتصال بخدمة تسجيل الدخول.");
    }

    const authResult = await response.json().catch(() => null);
    if (!response.ok || !authResult?.idToken) throw credentialsError();

    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(authResult.idToken);
    } catch {
        throw credentialsError();
    }
    if (decodedToken.uid !== uid) throw credentialsError();
    if (!activeStatus(parent.status)) {
        throw new AppError(403, "ACCOUNT_INACTIVE", "هذا الحساب غير نشط. يرجى التواصل مع المدرسة.");
    }

    return auth.createCustomToken(uid);
}