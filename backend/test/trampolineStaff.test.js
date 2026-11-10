const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTrampolineStaff } = require('../utils/trampolineRegistration');
const staff = count => ({ leader: { name: '领队', phone: '13800138000' },
  coaches: Array.from({ length: count }, (_, i) => ({ name: `教练${i}`, phone: `1380013800${i}` })) });
const athletes = count => Array.from({ length: count }, (_, i) => ({ idCard: `ID-${i}` }));

test('教练限额按5人一档向上取整，人数按证件去重而非项目条数', () => {
  for (const [count, limit] of [[1, 1], [5, 1], [6, 2], [10, 2], [11, 3]]) {
    assert.equal(normalizeTrampolineStaff(staff(limit), athletes(count)).coaches.length, limit);
    assert.throws(() => normalizeTrampolineStaff(staff(limit + 1), athletes(count)), /最多可报/);
  }
  assert.throws(() => normalizeTrampolineStaff(staff(2), [...athletes(5), { idCard: ' id-0 ' }]), /最多可报1名/);
});

test('领队和教练均可留空，姓名和电话分别选填，空白教练不占名额', () => {
  for (const value of [undefined, null, {}, { leader: {}, coaches: [] },
    { leader: { name: ' ', phone: ' ' }, coaches: [{ name: '', phone: '' }, {}] }]) {
    assert.deepEqual(normalizeTrampolineStaff(value, athletes(1)), { leader: { name: '', phone: '' }, coaches: [] });
  }
  assert.deepEqual(normalizeTrampolineStaff({ leader: { name: '领队' }, coaches: [{ name: '教练' }, {}] }, athletes(1)), {
    leader: { name: '领队', phone: '' }, coaches: [{ name: '教练', phone: '' }]
  });
  assert.deepEqual(normalizeTrampolineStaff({ coaches: [{ phone: '123' }] }, athletes(1)).coaches, [{ name: '', phone: '123' }]);
});

test('拒绝空名单、缺失证件、重复教练、非字符串资料及过长姓名', () => {
  assert.throws(() => normalizeTrampolineStaff(staff(1), []));
  assert.throws(() => normalizeTrampolineStaff(staff(1), [{}]), /证件/);
  for (const value of [{ ...staff(1), coaches: 'invalid' }, { leader: { name: 123 } },
    { ...staff(1), coaches: [staff(1).coaches[0], staff(1).coaches[0]] },
    { ...staff(1), leader: { name: '甲'.repeat(51), phone: '123' } }]) {
    assert.throws(() => normalizeTrampolineStaff(value, athletes(6)));
  }
  const value = normalizeTrampolineStaff({ leader: { name: ' 领队 ', phone: ' 123 ' },
    coaches: [{ name: ' 教练 ', phone: ' 456 ' }] }, athletes(1));
  assert.deepEqual(value, { leader: { name: '领队', phone: '123' }, coaches: [{ name: '教练', phone: '456' }] });
});
