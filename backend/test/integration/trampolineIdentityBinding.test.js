const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');
const { buildTrampolineCompetition } = require('../../data/trampoline2026');
const { getTrampolineDocumentKey } = require('../../utils/trampolineIdentity');

test('蹦床证件绑定：加入名单即绑定，跨账号赛事、并发、删除、编辑和导入均不能换身份', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    const Identity = require('../../models/TrampolineIdentity');
    for (const role of ['organization', 'other']) {
      f.users[role].sportTypes = ['trampoline', 'wushu']; await f.users[role].save();
    }
    const first = await Competition.create(buildTrampolineCompetition(f.users.admin.id));
    const second = await Competition.create({ ...buildTrampolineCompetition(f.users.admin.id), name: '第二场蹦床测试赛事' });
    const path = competition => `/competitions/${competition.id}/participants`;
    const base = { name: '首次登记选手', idCard: 'BIND-001', gender: 'male', birthDate: '2019-01-01',
      schoolName: '测试单位', type: 'individual', event: '大网U8组蹦床个人', ageGroup: '大网U8组', grade: '大网U8组' };
    const post = (row, competition = first, role = 'organization') => f.request(path(competition), { role, method: 'POST', body: row });
    const check = (rows, competition = first, role = 'organization') => f.request(`${path(competition)}/trampoline-check`, { role, method: 'POST', body: { participants: rows } });
    const batch = rows => f.request(`${path(first)}/trampoline-batch`, { method: 'POST', body: { participants: rows } });
    assert.equal((await check([base])).status, 200);
    assert.equal(await f.Participant.countDocuments({ competition: first.id }), 0);
    const binding = await Identity.findById(getTrampolineDocumentKey(base.idCard));
    assert.equal(binding.name, base.name);
    assert.equal(binding.gender, 'male');
    assert.equal(binding.birthDate, '2019-01-01');
    for (const [field, value, label] of [['name', '冒用姓名', '姓名'], ['gender', 'female', '性别'], ['birthDate', '2018-01-01', '出生日期']]) {
      const changed = { ...base, [field]: value, idCard: ' b i n d - 0 0 1 ' };
      for (const result of [await check([changed]), await post(changed), await batch([changed]),
        await check([changed], second, 'other'), await post(changed, second, 'other')]) {
        assert.equal(result.status, 409, JSON.stringify(result.body));
        assert.match(result.body.message, new RegExp(label));
      }
    }
    const created = await post(base);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const anotherEvent = { ...base, event: '小网U7组男子蹦床个人', ageGroup: '小网U7组', grade: '小网U7组' };
    assert.equal((await post(anotherEvent)).status, 201);
    const cross = await post({ ...base, schoolName: '另一单位' }, second, 'other');
    assert.equal(cross.status, 201);
    const snapshot = await Identity.findById(binding._id).lean();
    const edited = await f.request(`${path(first)}/${created.body.data._id}`, { role: 'admin', method: 'PUT', body: { name: '改名冒用' } });
    assert.equal(edited.status, 409);
    const imported = await f.request(`${path(second)}/import`, { role: 'admin', method: 'POST', body: { participants: [{ ...base, name: '导入冒用' }] } });
    assert.equal(imported.status, 201);
    assert.equal(imported.body.data.imported, 0);
    assert.match(imported.body.data.errorDetails[0].reason, /姓名/);
    assert.deepEqual(await Identity.findById(binding._id).lean(), snapshot);

    const mixed = await batch([{ ...base, idCard: 'FRESH-BATCH' }, { ...base, name: '批次冒用' }]);
    assert.equal(mixed.status, 409);
    assert.equal(await Identity.exists({ _id: getTrampolineDocumentKey('FRESH-BATCH') }), null);
    const internal = await batch([{ ...base, idCard: 'INTERNAL' }, { ...anotherEvent, idCard: 'INTERNAL', name: '批内冒用' }]);
    assert.equal(internal.status, 409);
    assert.equal(await Identity.exists({ _id: getTrampolineDocumentKey('INTERNAL') }), null);

    for (const [idCard, send] of [['CONCURRENT', row => post(row)], ['CONCURRENT-BATCH', row => batch([row])], ['CONCURRENT-CHECK', row => check([row])]]) {
      const results = await Promise.all([send({ ...base, idCard, name: '并发甲' }), send({ ...base, idCard, name: '并发乙' })]);
      assert.deepEqual(results.map(result => result.status).sort(), idCard === 'CONCURRENT-CHECK' ? [200, 409] : [201, 409]);
      assert.equal(await Identity.countDocuments({ _id: getTrampolineDocumentKey(idCard) }), 1);
      assert.equal(await f.Participant.countDocuments({ idCard }), idCard === 'CONCURRENT-CHECK' ? 0 : 1);
    }
    await f.Participant.deleteMany({ idCard: base.idCard });
    assert.equal((await post({ ...base, name: '删除后冒用' })).status, 409);
    assert.equal((await check([base])).status, 200);

    // 只有蹦床入口建立绑定；其他赛事中相同证件的资料不会被拿来锁定蹦床身份。
    const identityCount = await Identity.countDocuments();
    const wushu = await f.request(path(f.competition), { method: 'POST', body: { ...base, name: '武术选手', event: '拳术', ageGroup: 'A', grade: 'A' } });
    assert.equal(wushu.status, 201, JSON.stringify(wushu.body));
    assert.equal(await Identity.countDocuments(), identityCount);
  } finally { await f.close(); }
});

test('蹦床历史记录：跨赛事检查，冲突不自动绑定，缺失生日可补齐且不改写历史记录', async () => {
  const f = await createFixture();
  try {
    const Competition = require('../../models/Competition');
    const Identity = require('../../models/TrampolineIdentity');
    f.users.organization.sportTypes = ['trampoline']; await f.users.organization.save();
    const first = await Competition.create(buildTrampolineCompetition(f.users.admin.id));
    const second = await Competition.create({ ...buildTrampolineCompetition(f.users.admin.id), name: '历史记录关联测试赛事' });
    await Competition.collection.updateOne({ _id: first._id }, { $unset: { sportType: '' }, $set: { type: 'TRAMPOLINE' } });
    const base = { name: '历史登记选手', idCard: 'P(001)+.*', gender: 'male', birthDate: '2019-01-01', schoolName: '测试单位',
      type: 'individual', event: '大网U8组蹦床个人', grade: '大网U8组', ageGroup: '大网U8组' };
    const legacy = await f.Participant.create({ ...base, idCard: ' p ( 0 0 1 ) + . * ', competition: first.id, user: f.users.organization.id, birthDate: undefined });
    const check = rows => f.request(`/competitions/${second.id}/participants/trampoline-check`, { method: 'POST', body: { participants: rows } });
    const rejected = await check([{ ...base, name: '借用证件' }]);
    assert.equal(rejected.status, 409, JSON.stringify(rejected.body));
    assert.match(rejected.body.message, /姓名/);
    assert.equal(await Identity.countDocuments(), 0);
    assert.equal((await check([base])).status, 200);
    assert.equal((await f.Participant.findById(legacy.id)).birthDate, undefined);
    const conflicting = { ...base, idCard: 'CONFLICTING-HISTORY', competition: first.id, user: f.users.organization.id };
    await f.Participant.create([conflicting, { ...conflicting, competition: second.id, name: '历史其他姓名' }]);
    assert.equal((await check([{ ...base, idCard: conflicting.idCard }])).status, 409);
    assert.equal(await Identity.exists({ _id: getTrampolineDocumentKey(conflicting.idCard) }), null);
  } finally { await f.close(); }
});
