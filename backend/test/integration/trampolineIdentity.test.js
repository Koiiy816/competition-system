const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');
const { buildTrampolineCompetition } = require('../../data/trampoline2026');
const { getTrampolineRegistrationKey } = require('../../utils/trampolineIdentity');

const identityNumber = (birth, sequence = '001') => {
  const base = `990000${birth.replaceAll('-', '')}${sequence}`;
  const weights = [7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2];
  return base + ['1','0','X','9','8','7','6','5','4','3','2'][weights.reduce((sum, w, i) => sum + Number(base[i]) * w, 0) % 11];
};

test('真实HTTP与MongoDB：跨账号、跨批次、并发、导入与编辑防重，识别生日不可篡改', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    const config = buildTrampolineCompetition(f.users.admin.id);
    const event = '大网U8组蹦床个人';
    const secondEvent = '大网U8组附加测试项目';
    config.events.push({ ...config.events.find(item => item.name === event), name: secondEvent });
    const competition = await Competition.create(config);
    for (const role of ['organization', 'other']) {
      f.users[role].sportTypes = ['trampoline']; await f.users[role].save();
    }
    const path = `/competitions/${competition.id}/participants`;
    const base = { name: '选手甲', schoolName: '测试单位', idCard: identityNumber('2019-01-01'),
      gender: 'male', birthDate: '2019-01-01', type: 'individual', event, grade: '大网U8组', ageGroup: '大网U8组' };
    const staff = { leader: { name: '领队', phone: '100' }, coaches: [{ name: '教练', phone: '101' }] };
    const post = (body, role = 'organization') => f.request(path, { method: 'POST', role, body });
    const batch = participants => f.request(`${path}/trampoline-batch`, { method: 'POST', body: { participants, staff } });
    const check = participants => f.request(`${path}/trampoline-check`, { method: 'POST', body: { participants } });
    assert.equal((await check([base])).status, 200);
    assert.equal((await post({ ...base, birthDate: '2018-01-01' })).status, 400);
    const created = await post(base);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    for (const role of ['organization', 'other', 'admin']) {
      const result = await post({ ...base, name: ' 选手 甲 ', idCard: ` ${base.idCard.toLowerCase()} `, schoolName: '另一单位' }, role);
      assert.equal(result.status, 409, JSON.stringify(result.body));
      assert.match(result.body.message, /选手.*重复/);
    }
    assert.equal((await check([base])).status, 409);
    assert.equal((await batch([base])).status, 409);
    assert.equal((await post({ ...base, isVirtualTeam: true })).status, 409);
    assert.equal((await batch([{ ...base, isVirtualTeam: true }])).status, 409);
    const newAthlete = { ...base, name: '选手乙', idCard: identityNumber('2019-01-01', '003') };
    const before = await f.Participant.countDocuments({ competition: competition.id });
    assert.equal((await batch([newAthlete, newAthlete])).status, 409);
    assert.equal(await f.Participant.countDocuments({ competition: competition.id }), before);
    assert.equal((await batch([{ ...newAthlete, birthDate: '2018-01-01' }])).status, 400);
    const multiple = await batch([newAthlete, { ...newAthlete, event: secondEvent }]);
    assert.equal(multiple.status, 201, JSON.stringify(multiple.body));

    // 不含新防重键的历史记录仍须纳入检查。
    const legacy = { ...base, name: '历史选手', idCard: 'LEGACY-ID', user: f.users.other.id, competition: competition.id };
    await f.Participant.create(legacy);
    assert.equal((await post({ ...legacy, name: '历 史 选 手', idCard: ' legacy-id ', schoolName: '其他单位' })).status, 409);

    const racing = { ...base, name: '并发选手', idCard: 'RACE-ID' };
    const concurrent = await Promise.all([post(racing), post({ ...racing, isVirtualTeam: true })]);
    assert.deepEqual(concurrent.map(result => result.status).sort(), [201, 409]);
    assert.equal(await f.Participant.countDocuments({ competition: competition.id, idCard: racing.idCard }), 1);
    const key = getTrampolineRegistrationKey(competition.id, racing);
    await assert.rejects(f.Participant.create({ ...racing, user: f.users.organization.id, competition: competition.id, trampolineRegistrationKey: key }), error => error.code === 11000);
    const racingBatch = { ...racing, name: '并发整批选手', idCard: 'RACE-BATCH' };
    const batches = await Promise.all([batch([racingBatch]), batch([{ ...racingBatch, isVirtualTeam: true }])]);
    assert.deepEqual(batches.map(result => result.status).sort(), [201, 409]);
    assert.equal(await f.Participant.countDocuments({ competition: competition.id, idCard: racingBatch.idCard }), 1);

    const imported = await f.request(`${path}/import`, { role: 'admin', method: 'POST', body: { participants: [base, { ...base, name: '生日错误导入', birthDate: '2018-01-01' }] } });
    assert.equal(imported.status, 201);
    assert.equal(imported.body.data.imported, 0);
    assert.equal(imported.body.data.failed, 2);
    assert.match(imported.body.data.errorDetails[0].reason, /重复/);
    assert.match(imported.body.data.errorDetails[1].reason, /证件.*出生日期/);

    const editPath = `${path}/${created.body.data._id}`;
    assert.equal((await f.request(editPath, { role: 'admin', method: 'PUT', body: { birthDate: '2018-01-01' } })).status, 400);
    const otherId = identityNumber('2018-01-01');
    assert.equal((await f.request(editPath, { role: 'admin', method: 'PUT', body: { idCard: otherId, birthDate: '2018-01-01' } })).status, 200);
    assert.equal((await post(base)).status, 201); // 修改证件后释放原报名键。
    assert.equal((await f.request(`${path}/${multiple.body.data[0]._id}`, { role: 'admin', method: 'PUT', body: { event: secondEvent } })).status, 409);
    await require('../../models/SystemSetting').create({ key: 'wushu_registration_edit_enabled', value: true });
    const participant = await f.Participant.findById(multiple.body.data[0]._id);
    assert.equal((await f.request(`${path}/${participant.id}/registration-content`, { method: 'PUT', body: {
      event: secondEvent, ageGroup: participant.ageGroup, eventDetail: '', updatedAt: participant.updatedAt.toISOString()
    } })).status, 409);
    assert.equal((await post({ ...base, name: '护照选手', idCard: 'PASSPORT-001', birthDate: '2018-01-01' })).status, 201);
  } finally { await f.close(); }
});
