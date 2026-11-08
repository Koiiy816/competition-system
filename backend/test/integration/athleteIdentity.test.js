const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');

test('real MongoDB and HTTP: identity lifecycle, privacy, ownership, fees and legacy association', async () => {
  const f = await createFixture();
  try {
    const path = `/competitions/${f.competition.id}/participants`;
    const data = { name: '张伟', schoolName: '联调武术馆', gender: 'male', birthDate: '2000-01-02',
      idCard: 'TEST-PASSPORT-1234', type: 'individual', event: '拳术', ageGroup: 'A组', grade: 'A组', athleteRequestKey: 'person-one' };
    const post = body => f.request(path, { method: 'POST', body });
    const first = await post(data);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const number = first.body.data.athleteNumber;
    assert.match(number, /^AT-/);
    const second = await post({ ...data, event: '剑术', athleteRequestKey: 'new-page-request' });
    assert.equal(second.body.data.athleteNumber, number);
    const third = await post({ ...data, event: '双人拳', athleteNumber: number });
    assert.equal(third.status, 201);
    const namesake = await post({ ...data, athleteRequestKey: 'person-two', birthDate: '2002-02-03', idCard: 'TEST-PASSPORT-5678' });
    assert.equal(namesake.status, 201);
    assert.notEqual(namesake.body.data.athleteNumber, number);
    const masked = await f.request(`${path}/athlete-identities`);
    assert.equal(masked.body.data.length, 2);
    assert.equal(masked.body.data.find(x => x.number === number).maskedIdCard, '****1234');
    assert.equal(masked.body.data.find(x => x.number === number).gender, 'male');
    assert.ok(!JSON.stringify(masked.body).includes(data.idCard));
    assert.equal((await f.request(`${path}/athlete-identities`, { role: 'other' })).body.data.length, 0);
    assert.equal((await f.request(path, { method: 'POST', role: 'other', body: { ...data, athleteNumber: number } })).status, 201);
    assert.equal((await post({ ...data, athleteNumber: number, birthDate: '2002-02-03' })).status, 400);
    assert.equal((await post({ ...data, athleteNumber: number, schoolName: '其他单位' })).status, 201);

    const settings = key => `/settings/${key}`;
    const toggle = (key, value) => f.request(settings(key), { role: 'admin', method: 'PUT', body: { value } });
    assert.equal((await f.request(settings('wushu_fee_summary_enabled'), { method: 'PUT', body: { value: true } })).status, 403);
    for (const enabled of [true, false, true]) {
      assert.equal((await toggle('wushu_fee_summary_enabled', enabled)).status, 200);
      const groups = await f.request(`${path}?groupBy=school&limit=1`);
      assert.equal(Boolean(groups.body.feeSummaryEnabled), enabled);
      if (enabled) {
        assert.equal(groups.body.data[0].roster.length, 2);
        assert.equal(groups.body.data[0].roster.find(x => x.athleteNumber === number).fee, 400);
      }
    }
    await toggle('wushu_registration_edit_enabled', true);
    const edit = { athleteNumber: number, schoolName: '联调武术馆（规范名称）', event: '刀术', ageGroup: 'A组', groupTeam: '', eventDetail: '', updatedAt: third.body.data.updatedAt };
    const editPath = `${path}/${third.body.data._id}/registration-content`;
    const missing = { ...edit }; delete missing.athleteNumber;
    assert.equal((await f.request(editPath, { method: 'PUT', body: missing })).status, 409);
    assert.equal((await f.request(editPath, { method: 'PUT', body: { ...edit, athleteNumber: namesake.body.data.athleteNumber } })).status, 409);
    await require('../../models/Competition').updateOne({ _id: f.competition.id }, { $push: { ageGroups: { name: 'B组' } } });
    const groupChange = await f.request(editPath, { method: 'PUT', body: { ...edit, ageGroup: 'B组' } });
    assert.equal(groupChange.status, 400);
    assert.match(groupChange.body.message, /不能修改组别/);
    const unchanged = await f.Participant.findById(third.body.data._id);
    assert.equal(unchanged.ageGroup, 'A组');
    assert.equal(unchanged.event, '双人拳');
    const updated = await f.request(editPath, { method: 'PUT', body: edit });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.data.athleteNumber, number);
    assert.equal(updated.body.data.schoolName, '联调武术馆（规范名称）');
    assert.equal(updated.body.data.ageGroup, 'A组');
    assert.equal(updated.body.data.grade, 'A组');
    assert.equal((await f.request(editPath, { method: 'PUT', body: edit })).status, 409);
    assert.equal((await f.request(editPath, { role: 'other', method: 'PUT', body: { ...edit, updatedAt: updated.body.data.updatedAt } })).status, 403);
    await toggle('wushu_registration_edit_enabled', false);
    assert.equal((await f.request(editPath, { method: 'PUT', body: { ...edit, updatedAt: updated.body.data.updatedAt } })).status, 403);

    const legacy = await f.Participant.create({ ...data, competition: f.competition.id, user: f.users.organization.id });
    const legacyGroups = await f.request(`${path}?groupBy=school`);
    assert.equal(legacyGroups.body.data[0].roster.find(x => x.key === `unlinked:${legacy.id}`).fee, null);
    const linked = await f.request(`${path}/${legacy.id}`, { role: 'admin', method: 'PUT', body: { athleteNumber: number, updatedAt: legacy.updatedAt } });
    assert.equal(linked.status, 200, JSON.stringify(linked.body));
    assert.equal(linked.body.data.athleteNumber, number);
    assert.equal((await f.request(`${path}/${legacy.id}`, { role: 'admin', method: 'PUT', body: { athleteNumber: namesake.body.data.athleteNumber, updatedAt: linked.body.data.updatedAt } })).status, 400);

    const concurrent = await Promise.all(['拳术', '剑术'].map(event => post({ ...data, name: '并发人员', athleteRequestKey: 'concurrent', event })));
    assert.ok(concurrent.every(x => x.status === 201));
    assert.equal(concurrent[0].body.data.athleteNumber, concurrent[1].body.data.athleteNumber);
    assert.equal(await f.AthleteIdentity.countDocuments({ name: '并发人员' }), 1);
    const stored = await f.AthleteIdentity.findOne({ number }).lean();
    await assert.rejects(f.AthleteIdentity.create({ ...stored, _id: undefined, requestKey: 'collision' }), error => error.code === 11000);
    await f.mongoose.disconnect();
    await f.mongoose.connect(f.uri);
    assert.equal((await f.Participant.findById(first.body.data._id)).athleteNumber, number);
    assert.equal(await f.AthleteIdentity.countDocuments({ number }), 1);
  } finally { await f.close(); }
});
