import test, { mock } from "node:test";
import assert from "node:assert/strict";

const { db } = await import("../src/config/firebase.js");
const { deleteClass } = await import("../src/services/classService.js");

function buildQuery(docs) {
    return {
        limit: () => ({
            get: async () => ({
                docs: docs.map((doc) => ({
                    id: doc.id,
                    data: () => doc.data,
                    ref: doc.ref,
                    exists: true
                }))
            })
        })
    };
}

test("حذف الفصل بالقوة يزيل ارتباط الطلاب والجداول به قبل إلغاء تنشيطه", async () => {
    const updates = [];
    const classDoc = { id: "class-1", data: { active: true } };

    const studentDoc = {
        id: "student-1",
        data: { active: true, classId: "class-1" },
        ref: {
            update: async (payload) => updates.push({ collection: "students", id: "student-1", payload })
        }
    };

    const enrollmentDoc = {
        id: "enroll-1",
        data: { active: true, classId: "class-1", status: "active" },
        ref: {
            update: async (payload) => updates.push({ collection: "studentEnrollments", id: "enroll-1", payload })
        }
    };

    const scheduleDoc = {
        id: "schedule-1",
        data: { active: true, classId: "class-1" },
        ref: {
            update: async (payload) => updates.push({ collection: "teacherSchedule", id: "schedule-1", payload })
        }
    };

    const collectionMap = new Map();
    collectionMap.set("academicClasses", {
        doc: (id) => ({
            get: async () => ({ exists: id === classDoc.id, data: () => classDoc.data }),
            update: async (payload) => updates.push({ collection: "academicClasses", id, payload })
        })
    });
    collectionMap.set("students", {
        where: () => buildQuery([studentDoc]),
        doc: (id) => ({
            update: async (payload) => updates.push({ collection: "students", id, payload })
        })
    });
    collectionMap.set("studentEnrollments", {
        where: () => buildQuery([enrollmentDoc]),
        doc: (id) => ({
            update: async (payload) => updates.push({ collection: "studentEnrollments", id, payload })
        })
    });
    collectionMap.set("teacherSchedule", {
        where: () => buildQuery([scheduleDoc]),
        doc: (id) => ({
            update: async (payload) => updates.push({ collection: "teacherSchedule", id, payload })
        })
    });

    const collectionMock = mock.method(db, "collection", (name) => {
        const collection = collectionMap.get(name);
        if (!collection) throw new Error(`غير متوقع: ${name}`);
        return collection;
    });

    try {
        await deleteClass("class-1", "admin-1", { force: true });
        assert.ok(updates.some((item) => item.collection === "students" && item.payload.classId === null));
        assert.ok(updates.some((item) => item.collection === "studentEnrollments" && item.payload.active === false));
        assert.ok(updates.some((item) => item.collection === "teacherSchedule" && item.payload.active === false));
        assert.ok(updates.some((item) => item.collection === "academicClasses" && item.payload.active === false));
    } finally {
        collectionMock.mock.restore();
    }
});
