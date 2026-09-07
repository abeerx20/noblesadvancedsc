import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
export async function listPartnerships(){ const s=await db.collection("communityPartnerships").orderBy("createdAt","desc").limit(200).get(); return s.docs.map(d=>({id:d.id,...d.data()})); }
export async function createPartnership(user,data){ const r=await db.collection("communityPartnerships").add({...data,createdBy:user.uid,createdAt:FieldValue.serverTimestamp()}); return r.id; }
export async function updatePartnership(id,data){ await db.collection("communityPartnerships").doc(id).update({...data,updatedAt:FieldValue.serverTimestamp()}); }
export async function deletePartnership(id){ await db.collection("communityPartnerships").doc(id).delete(); }
