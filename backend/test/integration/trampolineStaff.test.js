const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');
const { buildTrampolineCompetition } = require('../../data/trampoline2026');

test('蹦床整批报名：名额、全员绑定、资料验证及权限，失败不留下半批名单', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    f.users.organization.sportTypes = ['trampoline'];
    await f.users.organization.save();
    const competition = await Competition.create(buildTrampolineCompetition(f.users.admin.id));
    const path = `/competitions/${competition.id}/participants/trampoline-batch`;
    const staff = count => ({ leader: { name: '领队', phone: '13800138000' },
      coaches: Array.from({ length: count }, (_, i) => ({ name: `教练${i + 1}`, phone: `1380013800${i}` })) });
    const rows = (count, prefix = 'ATHLETE') => Array.from({ length: count }, (_, i) => ({ name: `运动员${i + 1}`,
      schoolName: '测试单位', idCard: `${prefix}-${i}`, gender: 'male', birthDate: '2019-01-01',
      type: 'individual', event: '大网U8组蹦床个人', grade: '大网U8组', ageGroup: '大网U8组' }));
    const submit = (participants, contacts, role = 'organization') => f.request(path,
      { method: 'POST', role, body: { participants, staff: contacts, athleteCount: 999 } });
    for (const [count, limit] of [[1, 1], [5, 1], [6, 2], [10, 2], [11, 3]]) {
      const before = await f.Participant.countDocuments({ competition: competition.id });
      const participants = rows(count, `LIMIT-${count}`).map(row => ({ ...row, schoolName: `人数边界单位${count}` }));
      const rejected = await submit(participants, staff(limit + 1));
      assert.equal(rejected.status, 409, JSON.stringify(rejected.body));
      assert.match(rejected.body.message, new RegExp(`最多可报${limit}名`));
      assert.equal(await f.Participant.countDocuments({ competition: competition.id }), before);
      const result = await submit(participants, staff(limit));
      assert.equal(result.status, 201, JSON.stringify(result.body));
      assert.equal(result.body.data.length, count);
      const records = await f.Participant.find({ _id: { $in: result.body.data.map(row => row._id) } });
      for (const record of records) {
        assert.deepEqual(record.additionalInfo.trampolineStaff, staff(limit));
        assert.equal(record.teamLeader, '领队');
        assert.equal(record.coach, '教练1');
        assert.equal(String(record.user), f.users.organization.id);
      }
    }
    const optionalCases = [undefined, {}, { leader: {}, coaches: [] },
      { leader: { name: ' ', phone: '' }, coaches: [{ name: '', phone: '' }, {}] },
      { leader: { name: '只填姓名' }, coaches: [{ name: '教练姓名' }] },
      { coaches: [{ phone: '123' }] }];
    for (let index = 0; index < optionalCases.length; index++) {
      const result = await submit(rows(1, `OPTIONAL-${index}`), optionalCases[index]);
      assert.equal(result.status, 201, JSON.stringify(result.body));
      const record = await f.Participant.findById(result.body.data[0]._id);
      const expected = index < 4 ? { leader: { name: '', phone: '' }, coaches: [] }
        : index === 4 ? { leader: { name: '只填姓名', phone: '' }, coaches: [{ name: '教练姓名', phone: '' }] }
        : { leader: { name: '', phone: '' }, coaches: [{ name: '', phone: '123' }] };
      assert.deepEqual(record.additionalInfo.trampolineStaff, expected);
      assert.equal(record.teamLeader, expected.leader.name);
      assert.equal(record.coach, expected.coaches[0]?.name || '');
    }
    const multiEvent = [...rows(5), { ...rows(1)[0], idCard: ' athlete-0 ', event: '小网U7组男子蹦床个人', grade: '小网U7组', ageGroup: '小网U7组' }];
    assert.equal((await submit(multiEvent, staff(2))).status, 409);
    assert.equal((await submit(multiEvent, staff(1))).status, 201);
    const before = await f.Participant.countDocuments({ competition: competition.id });
    const invalidAthlete = await submit([...rows(5), { ...rows(1)[0], name: '资料错误选手', birthDate: '2099-01-01' }], staff(1));
    assert.equal(invalidAthlete.status, 400);
    assert.match(invalidAthlete.body.message, /第6条报名（资料错误选手）.*出生日期/);
    for (const participants of [[], [...rows(5), { ...rows(1)[0], birthDate: '2099-01-01' }],
      [{ ...rows(1)[0], idCard: '' }], [{ ...rows(1)[0], name: '' }],
      [rows(1)[0], { ...rows(1)[0], schoolName: '另一单位' }]]) {
      assert.equal((await submit(participants, staff(1))).status, 400);
    }
    assert.equal((await submit(rows(1), { coaches: 'invalid' })).status, 400);
    assert.equal((await submit(rows(1), staff(1), 'other')).status, 403);
    assert.equal((await submit(rows(1), staff(1), 'admin')).status, 403);
    assert.equal((await f.request(`/competitions/${f.competition.id}/participants/trampoline-batch`, {
      method: 'POST', body: { participants: rows(1), staff: staff(1) } })).status, 403);
    assert.equal(await f.Participant.countDocuments({ competition: competition.id }), before);

    // 模拟第二条记录保存失败，第一条也必须清理，避免重试时留下半批报名。
    const originalSave = f.Participant.prototype.save;
    let calls = 0;
    f.Participant.prototype.save = function (...args) {
      if (++calls === 2) return Promise.reject(new Error('模拟数据库写入失败'));
      return originalSave.apply(this, args);
    };
    try { assert.equal((await submit(rows(2, 'ROLLBACK'), staff(1))).status, 500); }
    finally { f.Participant.prototype.save = originalSave; }
    assert.equal(await f.Participant.countDocuments({ competition: competition.id }), before);

    // 浏览器实际使用multipart提交；照片与材料须关联到返回的运动员记录。
    const payload = new FormData();
    payload.append('participants', JSON.stringify([{ ...rows(1, 'PHOTO')[0], photoIndex: 0 }]));
    payload.append('staff', JSON.stringify(staff(1)));
    payload.append('photo', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'test.png');
    const auth = { Authorization: `Bearer ${f.users.organization.getSignedJwtToken()}` };
    const response = await fetch(`${f.base}/api${path}`, { method: 'POST', headers: auth, body: payload });
    const result = await response.json();
    assert.equal(response.status, 201, JSON.stringify(result));
    assert.ok(result.data[0].photoFile);
    const materials = new FormData();
    materials.append('participantId', result.data[0]._id);
    materials.append('type', 'insurance');
    materials.append('files', new Blob(['test insurance'], { type: 'application/pdf' }), 'insurance.pdf');
    const uploaded = await fetch(`${f.base}/api/competitions/${competition.id}/participants/registration-documents`,
      { method: 'PUT', headers: auth, body: materials });
    const attachment = (await uploaded.json()).data.attachments[0];
    assert.equal(uploaded.status, 200);
    assert.equal(String(attachment.participant), result.data[0]._id);
    const fs = require('node:fs/promises');
    const nodePath = require('node:path');
    await fs.unlink(nodePath.join(__dirname, '../../uploads/participant-photos', result.data[0].photoFile));
    await fs.unlink(nodePath.join(__dirname, '../../uploads/registration-documents', attachment.filename));
    await Competition.updateOne({ _id: competition.id }, { registrationDeadline: new Date('2020-01-01') });
    assert.equal((await submit(rows(1), staff(1))).status, 400);
    await Competition.updateOne({ _id: competition.id }, { registrationDeadline: new Date('2099-01-01'), status: 'ongoing' });
    assert.equal((await submit(rows(1), staff(1))).status, 400);
  } finally { await f.close(); }
});
