import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { publicDocument } from "../utils/text.js";

const defaults = {
    academicYear: "1447",
    semester: "الفصل الدراسي الثاني",
    hijriYear: "1447",
    updatedAt: null
};

export async function getSiteSettings() {
    const snapshot = await db.collection("siteSettings").doc("general").get();
    return { ...defaults, ...(snapshot.exists ? publicDocument(snapshot) : {}) };
}

export async function updateSiteSettings(user, data) {
    await db.collection("siteSettings").doc("general").set({
        academicYear: data.academicYear,
        semester: data.semester,
        hijriYear: data.hijriYear,
        updatedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return getSiteSettings();
}
