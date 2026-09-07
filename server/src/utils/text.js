export function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

export function normalizeEmail(value) {
  return normalizeText(value)?.toLowerCase();
}

export function safeDocumentId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);
}

export function publicDocument(snapshot) {
  if (!snapshot?.exists) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? null,
    submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() ?? data.submittedAt ?? null,
    employeeViewedAt: data.employeeViewedAt?.toDate?.()?.toISOString?.() ?? data.employeeViewedAt ?? null,
    managerViewedAt: data.managerViewedAt?.toDate?.()?.toISOString?.() ?? data.managerViewedAt ?? null
  };
}

