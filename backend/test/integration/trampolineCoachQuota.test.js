const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('../identityFixture');
const { buildTrampolineCompetition } = require('../../data/trampoline2026');
const { getTrampolineUnitQuota } = require('../../utils/trampolineCoachQuota');

async function setup() {
  const f = await createFixture();
  for (const role of ['organization', 'other']) { f.users[role].sportTypes = ['trampoline']; await f.users[role].save(); }
  const Competition = require('../../models/Competition');
  const competition = await Competition.create(buildTrampolineCompetition(f.users.admin.id));
  const path = `/competitions/${competition.id}/participants`;
  const row = (id, extra = {}) => ({ name: `选手${id}`, idCard: `QUOTA-${id}`, birthDate: '2019-01-01', gender: 'male',
    schoolName: '累计测试单位', type: 'individual', event: '大网U8组蹦床个人', ageGroup: '大网U8组', grade: '大网U8组', ...extra });
  const coach = (name, phone = '123') => ({ name, phone });
  const batch = (rows, coaches = [], role = 'organization') => f.request(`${path}/trampoline-batch`, { role, method: 'POST', body: { participants: rows, staff: { coaches } } });
  const preview = (rows, coaches = []) => f.request(`${path}/trampoline-coach-quota`, { method: 'POST', body: { participants: rows, staff: { coaches } } });
  return { ...f, competition, path, row, coach, batch, preview };
}

test('单位累计名额：拆成多批、不同账号、旧单人接口、重复项目和导入均不能超额', async () => {
  const f = await setup();
  try {
    const a = f.coach('教练甲'), b = f.coach('教练乙'), c = f.coach('教练丙');
    assert.equal((await f.batch([f.row('1')], [a])).status, 201);
    for (let i = 2; i <= 5; i++) {
      const result = await f.batch([f.row(String(i), { schoolName: ' 累 计 测 试 单 位 ' })], [f.coach(`新教练${i}`)], 'other');
      assert.equal(result.status, 409, JSON.stringify(result.body));
      assert.match(result.body.message, /累计2名运动员.*最多可报1名教练.*累计2名教练/);
    }
    assert.equal(await f.Participant.countDocuments({ competition: f.competition.id }), 1);
    for (let i = 2; i <= 5; i++) assert.equal((await f.batch([f.row(String(i))], [], 'other')).status, 201);
    const noExtraAthlete = await f.preview([f.row('1', { event: '小网U7组男子蹦床个人', ageGroup: '小网U7组', grade: '小网U7组' })], [b]);
    assert.equal(noExtraAthlete.body.data.athleteCount, 5);
    assert.equal(noExtraAthlete.body.data.coachCount, 2);
    assert.ok(noExtraAthlete.body.data.error);
    assert.equal((await f.batch([f.row('1', { event: '小网U7组男子蹦床个人', ageGroup: '小网U7组', grade: '小网U7组' })], [b])).status, 409);
    const preview = await f.preview([f.row('6')], [b]);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.data.existingAthleteCount, 5);
    assert.equal(preview.body.data.existingCoachCount, 1);
    assert.equal(preview.body.data.athleteCount, 6);
    assert.equal(preview.body.data.coachLimit, 2);
    assert.equal(preview.body.data.error, '');
    assert.equal((await f.batch([f.row('6')], [b], 'other')).status, 201);
    assert.equal((await f.batch([f.row('7')], [f.coach('教 练甲', '1 2 3')])).status, 201);
    const single = await f.request(f.path, { method: 'POST', body: { ...f.row('8'), coach: c.name, coachPhone: c.phone } });
    assert.equal(single.status, 409);
    const imported = await f.request(`${f.path}/import`, { role: 'admin', method: 'POST', body: { participants: [{ ...f.row('9'), coach: c.name, coachPhone: c.phone }] } });
    assert.equal(imported.status, 201);
    assert.equal(imported.body.data.imported, 0);
    assert.match(imported.body.data.errorDetails[0].reason, /累计/);
    const registrations = await f.Participant.find({ competition: f.competition.id }).lean();
    assert.equal(getTrampolineUnitQuota(registrations).athleteCount, 7);
    assert.equal(getTrampolineUnitQuota(registrations).coachCount, 2);
    assert.equal(await require('../../models/TrampolineRegistrationLock').countDocuments(), 0);
  } finally { await f.close(); }
});

test('单位累计名额：已有运动员可提供名额，单位、赛事分别计数，并发新教练不会同时通过', async () => {
  const f = await setup();
  try {
    const a = f.coach('教练甲'), b = f.coach('教练乙'), c = f.coach('教练丙');
    assert.equal((await f.batch(Array.from({ length: 5 }, (_, i) => f.row(String(i))), [a])).status, 201);
    const races = await Promise.all([f.batch([f.row('R1')], [b]), f.batch([f.row('R2')], [c], 'other')]);
    assert.deepEqual(races.map(result => result.status).sort(), [201, 409]);
    const existing = await f.Participant.find({ competition: f.competition.id }).lean();
    assert.equal(getTrampolineUnitQuota(existing).athleteCount, 6);
    assert.equal(getTrampolineUnitQuota(existing).coachCount, 2);
    assert.equal((await f.batch(Array.from({ length: 6 }, (_, i) => f.row(`UNIT-${i}`, { schoolName: '第二单位' })))).status, 201);
    const available = await f.batch([f.row('UNIT-6', { schoolName: '第二单位' })], [a, b]);
    assert.equal(available.status, 201, JSON.stringify(available.body)); // 当前仅1名，但单位已有6名。
    const otherCompetition = await require('../../models/Competition').create({ ...buildTrampolineCompetition(f.users.admin.id), name: '另一场名额测试赛事' });
    assert.equal((await f.request(`/competitions/${otherCompetition.id}/participants/trampoline-batch`, { method: 'POST', body: { participants: [f.row('OTHER-MATCH')], staff: { coaches: [c] } } })).status, 201);
    assert.equal(await require('../../models/TrampolineRegistrationLock').countDocuments(), 0);
  } finally { await f.close(); }
});

test('单位累计名额：编辑、跨单位移动和删除运动员不能留下超额教练，失败后可重试', async () => {
  const f = await setup();
  try {
    const a = f.coach('教练甲'), b = f.coach('教练乙'), c = f.coach('教练丙');
    const first = await f.batch([f.row('1')], [a]);
    for (let i = 2; i <= 5; i++) assert.equal((await f.batch([f.row(String(i))])).status, 201);
    const sixth = await f.batch([f.row('6')], [b]);
    assert.equal(sixth.status, 201);
    const plain = await f.Participant.findOne({ competition: f.competition.id, idCard: 'QUOTA-5' });
    const deletion = await f.request(`${f.path}/${plain.id}`, { method: 'DELETE' });
    assert.equal(deletion.status, 409);
    assert.ok(await f.Participant.findById(plain.id));
    const edit = await f.request(`${f.path}/${plain.id}`, { role: 'admin', method: 'PUT', body: { coach: c.name, coachPhone: c.phone } });
    assert.equal(edit.status, 409);
    await require('../../models/SystemSetting').create({ key: 'wushu_registration_edit_enabled', value: true });
    const contentEdit = await f.request(`${f.path}/${plain.id}/registration-content`, { method: 'PUT', body: {
      event: plain.event, ageGroup: plain.ageGroup, eventDetail: '', updatedAt: plain.updatedAt.toISOString(), coach: c.name, coachPhone: c.phone
    } });
    assert.equal(contentEdit.status, 409);
    assert.equal((await f.batch(Array.from({ length: 4 }, (_, i) => f.row(`TARGET-${i}`, { schoolName: '目标单位' })), [a])).status, 201);
    const move = await f.request(`${f.path}/${sixth.body.data[0]._id}`, { role: 'admin', method: 'PUT', body: { schoolName: '目标单位' } });
    assert.equal(move.status, 409);
    const replacement = await f.request(`${f.path}/${first.body.data[0]._id}`, { role: 'admin', method: 'PUT', body: { coach: b.name, coachPhone: b.phone } });
    assert.equal(replacement.status, 200, JSON.stringify(replacement.body));
    assert.deepEqual(replacement.body.data.additionalInfo.trampolineStaff.coaches, [b]);
    assert.equal((await f.request(`${f.path}/${plain.id}`, { method: 'DELETE' })).status, 200);
    const own = await f.Participant.find({ competition: f.competition.id, schoolName: '累计测试单位' }).lean();
    assert.equal(getTrampolineUnitQuota(own).athleteCount, 5);
    assert.equal(getTrampolineUnitQuota(own).coachCount, 1);
    assert.equal(await require('../../models/TrampolineRegistrationLock').countDocuments(), 0);
  } finally { await f.close(); }
});
