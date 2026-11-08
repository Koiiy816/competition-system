const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');

test('automatic identity matching reuses exact document/name/gender across requests and concurrent pages', async () => {
  const f = await createFixture();
  try {
    const url = `/competitions/${f.competition.id}/participants`;
    const data = { name: '自动匹配', schoolName: '联调武术馆', gender: 'male', birthDate: '2000-01-02',
      idCard: 'Passport.123+(A)', type: 'individual', event: '拳术', ageGroup: 'A组', grade: 'A组' };
    const post = (body, role = 'organization') => f.request(url, { method: 'POST', body, role });
    const first = await post(data);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const number = first.body.data.athleteNumber;
    const second = await post({ ...data, name: ' 自动匹配 ', idCard: ' passport.123+(a) ', event: '剑术', athleteRequestKey: 'new-page' });
    assert.equal(second.status, 201, JSON.stringify(second.body));
    assert.equal(second.body.data.athleteNumber, number);
    assert.notEqual(second.body.data._id, first.body.data._id);
    const conflict = await post({ ...data, birthDate: '2001-01-01' });
    assert.equal(conflict.status, 201);
    assert.notEqual(conflict.body.data.athleteNumber, number);
    assert.equal(await f.AthleteIdentity.countDocuments({ name: '自动匹配' }), 2);
    for (const changed of [{ name: '同证件另一姓名' }, { idCard: 'different-document' }]) {
      const result = await post({ ...data, ...changed });
      assert.equal(result.status, 201, JSON.stringify(result.body));
      assert.notEqual(result.body.data.athleteNumber, number);
    }
    const other = await post(data, 'other');
    assert.equal(other.status, 201);
    assert.equal(other.body.data.athleteNumber, number);
    for (const changed of [{ gender: 'female' }, { schoolName: '其他单位' }]) {
      assert.equal((await post({ ...data, ...changed })).body.data.athleteNumber, number);
    }
    const concurrent = await Promise.all(Array.from({ length: 6 }, (_, i) => post({ ...data,
      name: '跨页面并发', idCard: 'concurrent-doc', athleteRequestKey: `page-${i}` })));
    assert.ok(concurrent.every(row => row.status === 201), JSON.stringify(concurrent));
    assert.equal(new Set(concurrent.map(row => row.body.data.athleteNumber)).size, 1);
    assert.equal(await f.AthleteIdentity.countDocuments({ name: '跨页面并发' }), 1);
    // 兼容迁移/管理员创建的旧请求键，不要求重新分配编号。
    const legacy = await f.AthleteIdentity.create({ competition: f.competition._id, user: f.users.organization._id,
      schoolName: data.schoolName, name: '历史编号', gender: 'male', birthDate: data.birthDate, idCard: 'legacy-doc', requestKey: 'legacy-migration-key' });
    const reused = await post({ ...data, name: '历史编号', idCard: 'LEGACY-DOC' });
    assert.equal(reused.status, 201);
    assert.equal(reused.body.data.athleteNumber, legacy.number);
    await f.AthleteIdentity.create({ competition: f.competition._id, user: f.users.organization._id,
      schoolName: data.schoolName, name: '历史编号', gender: 'male', birthDate: data.birthDate, idCard: 'legacy-doc', requestKey: 'old-duplicate-key' });
    const ambiguous = await post({ ...data, name: '历史编号', idCard: 'legacy-doc' });
    assert.equal(ambiguous.status, 201);
    assert.equal(ambiguous.body.data.athleteNumber, legacy.number);
    assert.equal(await f.AthleteIdentity.countDocuments({ name: '历史编号' }), 2);
    assert.equal((await post({ ...data, idCard: '' })).status, 400);
  } finally { await f.close(); }
});
