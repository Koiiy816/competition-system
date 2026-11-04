const test = require('node:test');
const assert = require('node:assert/strict');
const { planLegacyNumbers } = require('../utils/legacyAthleteNumbers');
const row = (id, fields = {}) => ({ _id: id, competition: 'c', user: 'u', name: '同名', schoolName: '单位', gender: 'male', idCard: 'DOC1', ...fields });
test('complete matching document and personal details share one number across events', () => {
  assert.equal(planLegacyNumbers([row('1'), row('2', { event: '器械' })], []).length, 1);
});
test('same name without document remains separate', () => {
  assert.equal(planLegacyNumbers([row('1', { idCard: '' }), row('2', { idCard: '' })], []).length, 2);
});
for (const fields of [{ name: '另一人' }, { user: 'other' }, { competition: 'other' }, { schoolName: 'other' }, { gender: 'female' }, { birthDate: '2000-01-01' }]) {
  test('shared document with different identity details is not merged: ' + JSON.stringify(fields), () => {
    assert.equal(planLegacyNumbers([row('1'), row('2', fields)], []).length, 2);
  });
}
test('only a unique exact existing identity can be reused', () => {
  const identity = row('i', { number: 'AT-existing' });
  assert.equal(planLegacyNumbers([row('1')], [identity])[0].existing.number, 'AT-existing');
  assert.equal(planLegacyNumbers([row('1')], [identity, { ...identity, number: 'AT-other' }])[0].existing, null);
});
test('numbered records and virtual teams are not changed; reruns retain deterministic keys', () => {
  assert.equal(planLegacyNumbers([row('1', { athleteNumber: 'AT-1' }), row('2', { isVirtualTeam: true })], []).length, 0);
  assert.equal(planLegacyNumbers([row('1')], [])[0].key, planLegacyNumbers([row('1')], [])[0].key);
});
test('incomplete records stop the plan before writes', () => {
  assert.throws(() => planLegacyNumbers([row('1', { schoolName: '' })], []), /缺少/);
});
