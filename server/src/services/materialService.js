// services/materialService.js
import { db } from '../config/firebase.js';

const materialsCollection = db.collection('materials');

export const materialService = {
    // ✅ جلب جميع المواد
    async getAll() {
        try {
            const snapshot = await materialsCollection.get();
            const materials = [];
            snapshot.forEach(doc => {
                materials.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return materials;
        } catch (error) {
            throw error;
        }
    },

    // ✅ جلب مادة واحدة
    async getById(id) {
        try {
            const doc = await materialsCollection.doc(id).get();
            if (!doc.exists) return null;
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            throw error;
        }
    },

    // ✅ إضافة مادة جديدة
    async create(data) {
        try {
            const docRef = await materialsCollection.add({
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return {
                id: docRef.id,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        } catch (error) {
            throw error;
        }
    },

    // ✅ تحديث مادة
    async update(id, data) {
        try {
            const docRef = materialsCollection.doc(id);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('المادة غير موجودة');
            }

            await docRef.update({
                ...data,
                updatedAt: new Date()
            });

            return {
                id,
                ...data,
                updatedAt: new Date()
            };
        } catch (error) {
            throw error;
        }
    },

    // ✅ حذف مادة
    async delete(id) {
        try {
            const docRef = materialsCollection.doc(id);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('المادة غير موجودة');
            }

            await docRef.delete();
            return { id };
        } catch (error) {
            throw error;
        }
    }
};