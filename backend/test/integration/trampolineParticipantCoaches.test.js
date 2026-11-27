const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createFixture } = require('../identityFixture');
const { buildTrampolineCompetition } = require('../../data/trampoline2026');

test('蹦床编辑完整教练名单：修改第二名、删除、清空、照片提交和累计名额均正确保存', async () => {
  const f = await createFixture();
  let photoFile;
  try {
    const competition = await require('../../models/Competition').create(buildTrampolineCompetition(f.users.admin.id));
    f.users.organization.sportTypes = ['trampoline']; await f.users.organization.save();
    const api = `/competitions/${competition.id}/participants`;
    const rows = Array.from({ length: 6 }, (_, i) => ({ name: `多教练选手${i}`, idCard: `EDIT-COACH-${i}`, birthDate: '2019-01-01', gender: 'male',
      schoolName: '多教练测试单位', type: 'individual', event: '大网U8组蹦床个人', grade: '大网U8组', ageGroup: '大网U8组' }));
    const leader = { name: '领队', phone: '100' };
    const created = await f.request(`${api}/trampoline-batch`, { method: 'POST', body: { participants: rows, staff: { leader } } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.data[0]._id;
    await f.Participant.updateOne({ _id: id }, { $set: { 'additionalInfo.notes': '保留备注', 'additionalInfo.other': { keep: true } } });
    const a = { name: '教练甲', phone: '123' }, b = { name: '教练乙', phone: '456' };
    const put = coaches => f.request(`${api}/${id}`, { role: 'admin', method: 'PUT', body: { coach: '旧字段不能覆盖完整名单', coachPhone: '999', trampolineCoaches: coaches } });
    const check = async (response, coaches) => {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const record = await f.Participant.findById(id);
      assert.deepEqual(record.additionalInfo.trampolineStaff.coaches, coaches);
      assert.equal(record.coach, coaches[0]?.name || '');
      assert.equal(record.coachPhone, coaches[0]?.phone || '');
      assert.deepEqual(record.additionalInfo.trampolineStaff.leader, leader);
      assert.equal(record.additionalInfo.notes, '保留备注');
      assert.deepEqual(record.additionalInfo.other, { keep: true });
      const fetched = await f.request(`${api}/${id}`, { role: 'admin' });
      assert.deepEqual(fetched.body.data.additionalInfo.trampolineStaff.coaches, coaches);
    };
    await check(await put([a, b]), [a, b]);
    const changed = { name: '第二名已修改', phone: '789' };
    await check(await put([a, changed]), [a, changed]);
    assert.equal((await put([a, b, { name: '超额教练', phone: '789' }])).status, 409);
    for (const invalid of [{}, [a, a], [{ name: '甲'.repeat(51) }], 'bad json']) assert.equal((await put(invalid)).status, 400);
    await check(await put([a]), [a]);
    await check(await put([b]), [b]);
    await check(await put([]), []);

    // 与上传照片一起提交时，完整名单作为JSON字符串传输。
    const body = new FormData();
    body.append('trampolineCoaches', JSON.stringify([a, changed]));
    body.append('photo', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'test.png');
    const response = await fetch(`${f.base}/api${api}/${id}`, { method: 'PUT', headers: { Authorization: `Bearer ${f.users.admin.getSignedJwtToken()}` }, body });
    const result = await response.json();
    photoFile = result.data?.photoFile;
    await check({ status: response.status, body: result }, [a, changed]);
    assert.ok(photoFile);

    // 没有完整名单字段的旧记录，也可升级为多教练，其他历史字段保留。
    const legacy = await f.Participant.create({ ...rows[0], name: '旧记录选手', idCard: 'OLD-COACH-RECORD', competition: competition.id,
      user: f.users.organization.id, coach: a.name, coachPhone: a.phone, additionalInfo: { notes: '旧资料保留' } });
    const upgraded = await f.request(`${api}/${legacy.id}`, { role: 'admin', method: 'PUT', body: { trampolineCoaches: [a] } });
    assert.equal(upgraded.status, 200, JSON.stringify(upgraded.body));
    assert.deepEqual(upgraded.body.data.additionalInfo.trampolineStaff.coaches, [a]);
    assert.equal(upgraded.body.data.additionalInfo.notes, '旧资料保留');
  } finally {
    if (photoFile) await fs.unlink(path.join(__dirname, '../../uploads/participant-photos', photoFile));
    await f.close();
  }
});

test('单位端编辑完整教练名单：第二名修改、删除和清空可保存，权限、版本与累计名额保持生效', async () => {
  const f = await createFixture();
  try {
    const competition = await require('../../models/Competition').create(buildTrampolineCompetition(f.users.admin.id));
    f.users.organization.sportTypes = ['trampoline']; await f.users.organization.save();
    const api = `/competitions/${competition.id}/participants`;
    const rows = Array.from({ length: 6 }, (_, i) => ({ name: `单位多教练选手${i}`, idCard: `ORG-COACH-${i}`, birthDate: '2019-01-01', gender: 'male',
      schoolName: '单位多教练测试学校', type: 'individual', event: '大网U8组蹦床个人', ageGroup: '大网U8组', grade: '大网U8组' }));
    const leader = { name: '单位领队', phone: '100' };
    const created = await f.request(`${api}/trampoline-batch`, { method: 'POST', body: { participants: rows, staff: { leader } } });
    assert.equal(created.status, 201);
    const id = created.body.data[0]._id, a = { name: '甲', phone: '123' }, b = { name: '乙', phone: '456' };
    await f.Participant.updateOne({ _id: id }, { $set: { 'additionalInfo.notes': '单位备注保留' } });
    const edit = async (coaches, extra = {}, role = 'organization') => {
      const current = await f.Participant.findById(id);
      return f.request(`${api}/${id}/registration-content`, { role, method: 'PUT', body: { event: current.event, ageGroup: current.ageGroup,
        eventDetail: '', updatedAt: current.updatedAt.toISOString(), coach: a.name, coachPhone: a.phone, trampolineCoaches: coaches, ...extra } });
    };
    assert.equal((await edit([a, b])).status, 403);
    await require('../../models/SystemSetting').create({ key: 'wushu_registration_edit_enabled', value: true });
    const check = async coaches => {
      const response = await edit(coaches);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const row = await f.Participant.findById(id);
      assert.deepEqual(row.additionalInfo.trampolineStaff.coaches, coaches);
      assert.equal(row.coach, coaches[0]?.name || '');
      assert.equal(row.coachPhone, coaches[0]?.phone || '');
      assert.deepEqual(row.additionalInfo.trampolineStaff.leader, leader);
      assert.equal(row.additionalInfo.notes, '单位备注保留');
      assert.equal(row.status, 'pending');
      const fetched = await f.request(`${api}/${id}`);
      assert.deepEqual(fetched.body.data.additionalInfo.trampolineStaff.coaches, coaches);
    };
    await check([a, b]);
    const changed = { name: '第二名改过', phone: '789' };
    await check([a, changed]);
    assert.equal((await edit([], {}, 'other')).status, 403);
    assert.equal((await edit([], { updatedAt: '2000-01-01T00:00:00.000Z' })).status, 409);
    const excess = await edit([a, b, { name: '超额第三名' }]);
    assert.equal(excess.status, 409);
    assert.match(excess.body.message, /最多可报2名教练.*累计3名教练/);
    for (const invalid of [{}, null, [a, a], [{ name: '甲'.repeat(51) }]]) assert.equal((await edit(invalid)).status, 400);
    assert.deepEqual((await f.Participant.findById(id)).additionalInfo.trampolineStaff.coaches, [a, changed]);
    await check([a]);
    await check([b]);
    await check([]);
  } finally { await f.close(); }
});
