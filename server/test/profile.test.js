import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeProfile } from '../src/routes/profileRoutes.js';

test('serializeProfile includes the parent national id for parent accounts', () => {
    const profile = serializeProfile({
        uid: 'p-1',
        email: 'parent@example.com',
        userType: 'parent',
        parent: {
            id: 'parent-1',
            nameAr: 'عبدالله محمد',
            nationalId: '1234567890',
            studentIds: ['s-1', 's-2']
        },
        employee: { id: 'parent-1', nameAr: 'عبدالله محمد', role: 'parent', status: 'active' },
        permissions: ['view_own_children']
    });

    assert.equal(profile.parent.nameAr, 'عبدالله محمد');
    assert.equal(profile.parent.nationalId, '1234567890');
    assert.deepEqual(profile.parent.studentIds, ['s-1', 's-2']);
});
