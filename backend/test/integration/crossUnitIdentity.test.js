const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const path = require('node:path');

test('real database: administrator can clear a collective team number without changing identity or unit', async () => {
  const f = await createFixture();
  try {
    f.competition.events.push({ name: '集体拳术', category: '武术', isGroupEvent: true });
    await f.competition.save();
    const person = { name: '选填编号测试', gender: 'female', birthDate: '2000-01-02', idCard: 'OPTIONAL-TEAM',
      competition: f.competition.id, user: f.users.organization.id, schoolName: '测试单位' };
    const identity = await f.AthleteIdentity.create({ ...person, requestKey: 'optional-team' });
    const row = await f.Participant.create({ ...person, athleteNumber: identity.number, event: '集体拳术',
      type: 'individual', ageGroup: 'A组', grade: 'A组', status: 'approved', groupTeam: '旧队号' });
    const result = await f.request(`/competitions/${f.competition.id}/participants/${row.id}`, { role: 'admin', method: 'PUT',
      body: { groupTeam: '', athleteNumber: identity.number, updatedAt: row.updatedAt } });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const saved = await f.Participant.findById(row.id);
    assert.equal(saved.groupTeam, '');
    assert.equal(saved.athleteNumber, identity.number);
    assert.equal(saved.schoolName, person.schoolName);
    assert.equal(saved.status, 'approved');
    assert.equal(String(saved.user), f.users.organization.id);
  } finally { await f.close(); }
});

test('real database: cross-account/unit registrations share identity and one fee, while edit ownership remains separate', async () => {
  const f = await createFixture();
  try {
    const endpoint = `/competitions/${f.competition.id}/participants`;
    const person = { name: '跨单位选手', birthDate: '2000-01-02', idCard: 'CROSS-DOC', gender: 'female',
      type: 'individual', ageGroup: 'A组', grade: 'A组' };
    const post = (event, schoolName, role = 'organization', extra = {}) => f.request(endpoint, { method: 'POST', role, body: { ...person, event, schoolName, ...extra } });
    const first = await post('拳术', '甲单位');
    const second = await post('剑术', '乙单位', 'other');
    const third = await post('双人拳', '丙单位');
    for (const result of [first, second, third]) assert.equal(result.status, 201, JSON.stringify(result.body));
    const number = first.body.data.athleteNumber;
    assert.equal(second.body.data.athleteNumber, number);
    assert.equal(third.body.data.athleteNumber, number);
    assert.equal(first.body.data.user, f.users.organization.id);
    assert.equal(second.body.data.user, f.users.other.id);
    assert.equal(await f.AthleteIdentity.countDocuments({ name: person.name }), 1);
    await f.request('/settings/wushu_fee_summary_enabled', { role: 'admin', method: 'PUT', body: { value: true } });
    await f.request('/settings/wushu_registration_edit_enabled', { role: 'admin', method: 'PUT', body: { value: true } });
    const grouped = await f.request(`${endpoint}?groupBy=school`, { role: 'admin' });
    assert.equal(grouped.body.uniqueParticipantTotal, 1);
    const people = grouped.body.data.flatMap(group => group.roster);
    assert.equal(people.reduce((sum, item) => sum + item.fee, 0), 400);
    assert.ok(people.every(item => item.totalFee === 400 && item.eventCount === 3));
    const own = await f.request(`${endpoint}?groupBy=school&myRegistrations=true`, { role: 'other' });
    assert.equal(own.body.data.length, 1);
    assert.equal(own.body.data[0].schoolName, '乙单位');
    assert.equal(own.body.data[0].roster[0].registrations.length, 1);
    assert.equal(own.body.data[0].roster[0].totalFee, 400);
    const list = await f.request(`${endpoint}/athlete-identities?schoolName=乙单位`, { role: 'other' });
    assert.equal(list.body.data[0].number, number);
    assert.ok(!JSON.stringify(list.body).includes(person.idCard));
    const move = await f.request(`${endpoint}/${third.body.data._id}`, { role: 'admin', method: 'PUT',
      body: { schoolName: '新代表单位', athleteNumber: number, updatedAt: third.body.data.updatedAt } });
    assert.equal(move.status, 200, JSON.stringify(move.body));
    assert.equal(move.body.data.schoolName, '新代表单位');
    assert.equal(move.body.data.athleteNumber, number);
    assert.equal(move.body.data.user, f.users.organization.id);
    const allIdentities = await f.request(`${endpoint}/athlete-identities`, { role: 'admin' });
    assert.equal(allIdentities.body.data.find(item => item.number === number)?.number, number);
    assert.equal(await f.AthleteIdentity.countDocuments({ name: person.name }), 1);
    const movedFees = await f.request(`${endpoint}?groupBy=school`, { role: 'admin' });
    assert.equal(movedFees.body.uniqueParticipantTotal, 1);
    assert.equal(movedFees.body.data.flatMap(group => group.roster).reduce((sum, item) => sum + item.fee, 0), 400);
    const change = { athleteNumber: number, event: '刀术', ageGroup: 'A组', groupTeam: '', eventDetail: '', updatedAt: first.body.data.updatedAt };
    assert.equal((await f.request(`${endpoint}/${first.body.data._id}/registration-content`, { role: 'other', method: 'PUT', body: change })).status, 403);
    const ownChange = await f.request(`${endpoint}/${second.body.data._id}/registration-content`, { role: 'other', method: 'PUT', body: { ...change, updatedAt: second.body.data.updatedAt } });
    assert.equal(ownChange.status, 200, JSON.stringify(ownChange.body));
    assert.equal(ownChange.body.data.user, f.users.other.id);
    const changedBirth = await post('拳术', '甲单位', 'organization', { birthDate: '2001-01-02' });
    assert.equal(changedBirth.status, 201);
    assert.notEqual(changedBirth.body.data.athleteNumber, number);
    const concurrent = await Promise.all(Array.from({ length: 6 }, (_, i) => post('拳术', `并发单位${i}`, i % 2 ? 'other' : 'organization', { name: '并发同一人', athleteRequestKey: `separate-${i}` })));
    assert.ok(concurrent.every(item => item.status === 201), JSON.stringify(concurrent));
    assert.equal(new Set(concurrent.map(item => item.body.data.athleteNumber)).size, 1);
    assert.equal(await f.AthleteIdentity.countDocuments({ name: '并发同一人' }), 1);
  } finally { await f.close(); }
});

test('real database: historical cross-unit/account reconciliation is audited, preserves original ownership and is repeatable', async () => {
  const f = await createFixture();
  try {
    await require('../../models/AthleteIdentityMerge').init();
    const person = { competition: f.competition.id, name: '历史跨单位人', birthDate: '2000-01-02', idCard: 'HISTORICAL-CROSS', gender: 'female' };
    const a = await f.AthleteIdentity.create({ ...person, user: f.users.organization.id, schoolName: '甲', requestKey: 'old-a' });
    const b = await f.AthleteIdentity.create({ ...person, user: f.users.other.id, schoolName: '乙', requestKey: 'old-b' });
    const rows = [await f.Participant.create({ ...person, user: f.users.organization.id, schoolName: '甲', athleteNumber: a.number, event: '拳术', type: 'individual', status: 'approved' }),
      await f.Participant.create({ ...person, user: f.users.other.id, schoolName: '乙', athleteNumber: b.number, event: '剑术', type: 'individual', status: 'approved' })];
    const before = await f.Participant.find().sort({ _id: 1 }).lean();
    const script = path.resolve(__dirname, '../../scripts/reconcileAthleteIdentities.js');
    const report = path.resolve(__dirname, `../../../.tmp/${f.dbName}-cross-unit-report.json`);
    const run = args => execFile(process.execPath, [script, ...args], { env: { ...process.env, MONGO_URI: f.uri } });
    const preview = await run([]);
    assert.match(preview.stdout, /"duplicatePeople":1/);
    assert.equal((await f.Participant.findById(rows[1].id)).athleteNumber, b.number);
    const result = await run(['--apply', `--operator=${f.users.admin.id}`, `--report=${report}`]);
    assert.match(result.stdout, /"completed":true/);
    const after = await f.Participant.find().sort({ _id: 1 }).lean();
    assert.equal(new Set(after.map(row => row.athleteNumber)).size, 1);
    const strip = ({ athleteNumber, updatedAt, ...rest }) => rest;
    assert.deepEqual(after.map(strip), before.map(strip));
    assert.equal((await require('../../models/AthleteIdentityMerge').findOne()).before.registrations.length, 2);
    assert.match((await run([])).stdout, /"duplicatePeople":0/);
    const number = after[0].athleteNumber;
    assert.equal(await f.AthleteIdentity.countDocuments({ number, identityKey: { $type: 'string' } }), 1);
  } finally { await f.close(); }
});
