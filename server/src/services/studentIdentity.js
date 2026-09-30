import { normalizeText } from "../utils/text.js";

function normalizedName(value) {
    return normalizeText(value ?? "")
        .normalize("NFKC")
        .replace(/[\u0640\u064B-\u065F\u0670]/g, "")
        .replace(/[إأآ]/g, "ا")
        .replace(/ى/g, "ي")
        .toLocaleLowerCase("ar");
}

function normalizedNationalId(value) {
    return String(value ?? "").replace(/\D/g, "");
}

export function matchesUnassignedStudent(candidate, existing) {
    if (!existing || existing.active === false || String(existing.classId ?? "").trim()) return false;
    if (normalizedName(candidate.fullName) !== normalizedName(existing.fullName)) return false;
    if (!candidate.stage || candidate.stage !== existing.stage) return false;
    if (!candidate.grade || candidate.grade !== existing.grade) return false;

    const candidateNationalId = normalizedNationalId(candidate.nationalId);
    const existingNationalId = normalizedNationalId(existing.nationalId);
    if (candidateNationalId && existingNationalId && candidateNationalId !== existingNationalId) return false;

    const candidateGender = candidate.gender;
    const existingGender = existing.gender;
    return !candidateGender || !existingGender || candidateGender === "mixed" || existingGender === "mixed" || candidateGender === existingGender;
}