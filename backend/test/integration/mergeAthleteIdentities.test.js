const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');

test('real MongoDB: administrator previews and merges duplicate numbers, preserving projects and retiring old requests', async () => {
  const f = await createFixture();
  const Merge = require('../../models/AthleteIdentityMerge');
  try {
    await Merge.init();
    const person = { competition: f.competition.id, user: f.users.organization.id, name: '于军(Yu Jun)',
      schoolName: '测试太极馆', gender: 'male', birthDate: '1967-11-11', idCard: '19671111' };
    const target = await f.AthleteIdentity.create({ ...person, requestKey: 'keep' });
    const source = await f.AthleteIdentity.create({ ...person, requestKey: 'duplicate' });
    const registrations = [];
    for (const [event, number] of [['拳术', source.number], ['剑术', target.number], ['双人拳', target.number]]) {
      registrations.push(await f.Participant.create({ ...person, event, athleteNumber: number, type: 'individual', status: 'approved', ageGroup: 'A组', remark: '原始备注' }));
    }
    const endpoint = `/competitions/${f.competition.id}/participants/athlete-identities`;
    const body = { sourceNumber: source.number, targetNumber: target.number };
    const preview = await f.request(`${endpoint}/merge-preview`, { role: 'admin', method: 'POST', body });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.data.movingCount, 1);
    assert.equal(preview.body.data.fee, 400);
    assert.equal(preview.body.data.participantCount, 1);
    assert.ok(!JSON.stringify(preview.body).includes('"idCard"'));
    assert.equal((await f.request(`${endpoint}/merge`, { method: 'POST', body })).status, 403);
    assert.equal((await f.request(`${endpoint}/merge`, { role: 'admin', method: 'POST', body: { ...body, version: 'stale' } })).status, 409);
    const other = await f.AthleteIdentity.create({ ...person, name: '另一个人', requestKey: 'other-person' });
    assert.equal((await f.request(`${endpoint}/merge-preview`, { role: 'admin', method: 'POST', body: { ...body, targetNumber: other.number } })).status, 409);
    const merged = await f.request(`${endpoint}/merge`, { role: 'admin', method: 'POST', body: { ...body, version: preview.body.data.version } });
    assert.equal(merged.status, 200, JSON.stringify(merged.body));
    assert.equal(merged.body.data.fee, 400);
    assert.equal(merged.body.data.registrations.length, 3);
    assert.equal(await f.Participant.countDocuments({ athleteNumber: source.number }), 0);
    assert.equal(await f.Participant.countDocuments({ athleteNumber: target.number }), 3);
    const hidden = await f.request(endpoint);
    assert.ok(!hidden.body.data.some(row => row.number === source.number));
    for (const before of registrations) {
      const after = await f.Participant.findById(before._id);
      for (const field of ['event', 'registrationNumber', 'status', 'remark', 'user', 'competition']) assert.equal(String(after[field]), String(before[field]));
    }
    const audit = await Merge.findById(merged.body.data.operationId);
    assert.equal(audit.status, 'completed');
    assert.equal(audit.before.registrations.length, 3);
    const again = await f.request(`${endpoint}/merge`, { role: 'admin', method: 'POST', body: { ...body, version: preview.body.data.version } });
    assert.equal(again.status, 200);
    assert.equal(await Merge.countDocuments({ sourceNumber: source.number }), 1);
    const late = await f.Participant.create({ ...person, event: '刀术', type: 'individual', athleteNumber: source.number });
    assert.equal(late.athleteNumber, target.number);
    const { resolveAthleteNumber } = require('../../utils/athleteIdentity');
    assert.equal(await resolveAthleteNumber({ ...person, athleteNumber: source.number }, f.users.organization), target.number);
  } finally { await f.close(); }
});

test('real MongoDB: interrupted standalone merge retains audit and resumes without duplicating records', async () => {
  const f = await createFixture();
  const Merge = require('../../models/AthleteIdentityMerge');
  const { planMerge, mergeIdentities } = require('../../utils/mergeAthleteIdentities');
  const original = f.Participant.updateMany;
  try {
    await Merge.init();
    const person = { competition: f.competition.id, user: f.users.organization.id, name: '测试人员', schoolName: '测试单位', gender: 'male' };
    const target = await f.AthleteIdentity.create({ ...person, requestKey: 'keep' });
    const source = await f.AthleteIdentity.create({ ...person, requestKey: 'old' });
    await f.Participant.create({ ...person, athleteNumber: source.number, type: 'individual', event: '拳术' });
    const input = { competitionId: f.competition.id, sourceNumber: source.number, targetNumber: target.number, operator: f.users.admin.id };
    input.version = (await planMerge(input.competitionId, input.sourceNumber, input.targetNumber)).version;
    f.Participant.updateMany = async () => { throw new Error('simulated write failure'); };
    await assert.rejects(mergeIdentities(input), /simulated write failure/);
    assert.equal((await f.AthleteIdentity.findById(source.id)).mergedInto, target.number);
    assert.equal(await Merge.countDocuments({ status: 'pending' }), 1);
    f.Participant.updateMany = original;
    const result = await mergeIdentities(input);
    assert.equal(result.movingCount, 0);
    assert.equal(await Merge.countDocuments({ status: 'pending' }), 0);
    assert.equal(await Merge.countDocuments({ status: 'completed' }), 1);
    assert.equal(await f.Participant.countDocuments({ athleteNumber: target.number }), 1);
  } finally { f.Participant.updateMany = original; await f.close(); }
});

for (const documentPolicy of ['source', 'preserve']) test(`real MongoDB: conflicting document fields require confirmation and follow ${documentPolicy} policy`, async () => {
  const f = await createFixture();
  const Merge = require('../../models/AthleteIdentityMerge');
  try {
    await Merge.init();
    const person = { competition: f.competition.id, user: f.users.organization.id, name: '于军(Yu Jun)',
      schoolName: '测试单位', gender: 'male', birthDate: '1967-11-11' };
    const source = await f.AthleteIdentity.create({ ...person, idCard: '19671111', requestKey: 'old' });
    const target = await f.AthleteIdentity.create({ ...person, idCard: '196711111', requestKey: 'keep' });
    const row = await f.Participant.create({ ...person, athleteNumber: source.number, idCard: '19671111', type: 'individual', event: '拳术' });
    const other = await f.Participant.create({ ...person, athleteNumber: target.number, idCard: '196711111', type: 'individual', event: '剑术' });
    const { planMerge, mergeIdentities } = require('../../utils/mergeAthleteIdentities');
    const input = { competitionId: f.competition.id, sourceNumber: source.number, targetNumber: target.number, operator: f.users.admin.id, documentPolicy };
    const preview = await planMerge(input.competitionId, input.sourceNumber, input.targetNumber);
    assert.equal(preview.preview.documentDifferences.length, 2);
    assert.equal(preview.preview.targetDocumentLength, 9);
    input.version = preview.version;
    await assert.rejects(mergeIdentities(input), error => error.statusCode === 400);
    assert.equal(await Merge.countDocuments(), 0);
    const result = await mergeIdentities({ ...input, confirmDocumentDifference: true });
    assert.equal(result.fee, 300);
    const saved = await f.Participant.findById(row.id);
    assert.equal(saved.athleteNumber, target.number);
    assert.equal(saved.idCard, '19671111');
    assert.equal((await f.Participant.findById(other.id)).idCard, documentPolicy === 'source' ? '19671111' : '196711111');
    assert.equal((await f.AthleteIdentity.findById(target.id).select('+idCard')).idCard, documentPolicy === 'source' ? '19671111' : '196711111');
    const audit = await Merge.findById(result.operationId);
    assert.equal(audit.before.target.idCard, '196711111');
    const { resolveAthleteNumber } = require('../../utils/athleteIdentity');
    assert.equal(await resolveAthleteNumber(saved.toObject(), f.users.organization, { allowRegistrationSnapshot: true }), target.number);
    await assert.rejects(resolveAthleteNumber({ ...saved.toObject(), name: '另一个人' }, f.users.organization, { allowRegistrationSnapshot: true }));
  } finally { await f.close(); }
});
