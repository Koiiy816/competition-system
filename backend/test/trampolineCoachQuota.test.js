const test = require('node:test');
const assert = require('node:assert/strict');
const { getTrampolineUnitQuota, normalizeTrampolineUnit } = require('../utils/trampolineCoachQuota');

const row = (id, coach = '教练甲', extra = {}) => ({ _id: id, idCard: id, schoolName: '单位',
  name: `运动员${id}`, gender: 'male', coach, coachPhone: coach ? '123' : '', ...extra });

test('按单位累计运动员和不同教练，拆批新增第二位教练在第6名运动员前拒绝', () => {
  for (const [count, limit] of [[1, 1], [5, 1], [6, 2], [10, 2], [11, 3]]) {
    assert.equal(getTrampolineUnitQuota([], Array.from({ length: count }, (_, i) => row(String(i)))).coachLimit, limit);
  }
  const existing = Array.from({ length: 4 }, (_, i) => row(String(i)));
  const five = getTrampolineUnitQuota(existing, [row('4', '教练乙')]);
  assert.equal(five.athleteCount, 5);
  assert.equal(five.coachCount, 2);
  assert.equal(five.coachLimit, 1);
  assert.match(five.error, /累计5名运动员.*最多.*1名教练.*2名/);
  const six = getTrampolineUnitQuota([...existing, row('4')], [row('5', '教练乙')]);
  assert.equal(six.athleteCount, 6);
  assert.equal(six.coachCount, 2);
  assert.equal(six.error, '');
});

test('重复项目、重复教练、空白、拒绝记录及虚拟队伍不会增加名额', () => {
  const existing = [row('1'), row('1', '教练甲', { event: '另一个项目' }),
    row('2', '', { status: 'rejected' }), row('3', '', { isVirtualTeam: true })];
  const quota = getTrampolineUnitQuota(existing, [row(' 1 ', '教 练甲', { coachPhone: '1 2 3' })]);
  assert.equal(quota.athleteCount, 1);
  assert.equal(quota.coachCount, 1);
  assert.equal(quota.error, '');
  assert.equal(normalizeTrampolineUnit(' 单 位 '), normalizeTrampolineUnit('单位'));
  const legacy = row('legacy', '教练甲', { idCard: '', birthDate: new Date('2019-01-01') });
  assert.equal(getTrampolineUnitQuota([legacy], [{ ...legacy, birthDate: '2019-01-01' }]).athleteCount, 1);
});

test('兼容多教练及旧字段，更新和删除先排除原记录再计算', () => {
  const existing = Array.from({ length: 6 }, (_, i) => row(String(i), i === 0 ? '教练甲' : i === 1 ? '教练乙' : ''));
  assert.match(getTrampolineUnitQuota(existing, [], ['5']).error, /累计5名运动员/);
  assert.equal(getTrampolineUnitQuota(existing, [], ['0']).error, '');
  const changed = row('0', '教练丙');
  assert.equal(getTrampolineUnitQuota(existing, [changed], ['0']).coachCount, 2);
  const mixed = getTrampolineUnitQuota([], [row('a', '教练甲', { additionalInfo: { trampolineStaff: { coaches: [
    { name: '教练甲', phone: '123' }, { name: '教练乙', phone: '456' }
  ] } } })]);
  assert.equal(mixed.coachCount, 2);
  assert.ok(mixed.error);
});
