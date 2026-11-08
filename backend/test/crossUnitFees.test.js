const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWushuFeeGroups } = require('../utils/wushuFees');
const { identityKey } = require('../utils/athleteIdentityKey');
const { planReconciliation } = require('../utils/reconcileAthleteIdentities');

const row = (id, schoolName, event, extra = {}) => ({ _id: id, athleteNumber: 'AT-person', competition: 'match',
  user: 'account', name: '魏渝宸', birthDate: '2000-01-02', idCard: 'DOC-1', gender: 'female',
  schoolName, event, status: 'approved', registrationDate: `2026-01-0${id}`, ...extra });

test('one personal base fee spans two units and repeated project names are not counted twice', () => {
  const groups = buildWushuFeeGroups([row('1', '养生队', '春秋大刀'), row('2', '分馆', '单刀23式'), row('3', '另一单位', '春秋大刀')]);
  const people = groups.flatMap(group => group.roster);
  assert.equal(people.reduce((sum, person) => sum + person.fee, 0), 300);
  assert.ok(people.every(person => person.totalFee === 300 && person.eventCount === 2));
  assert.equal(people.filter(person => person.isFeeBillingUnit).length, 1);
  assert.equal(people.find(person => person.isFeeBillingUnit).billingSchoolName, '养生队');
});

test('three and four personal projects spanning accounts and units cost 400 and 500 total', () => {
  const rows = [row('1', '甲', '拳'), row('2', '乙', '剑', { user: 'other' }), row('3', '丙', '双人拳')];
  for (const [entries, fee] of [[rows, 400], [[...rows, row('4', '乙', '刀')], 500]]) {
    const people = buildWushuFeeGroups(entries).flatMap(group => group.roster);
    assert.equal(people.reduce((sum, person) => sum + person.fee, 0), fee);
    assert.ok(people.every(person => person.totalFee === fee));
  }
});

test('unit filters and ownership do not truncate full personal fees or disclose other account projects', () => {
  const rows = [row('1', '甲', '拳'), row('2', '乙', '剑'), row('3', '丙', '双人拳')];
  const groups = buildWushuFeeGroups([rows[1]], { search: '乙' }, rows);
  assert.equal(groups.length, 1);
  const person = groups[0].roster[0];
  assert.equal(person.totalFee, 400);
  assert.equal(person.fee, 0);
  assert.equal(person.registrations.length, 1);
  assert.equal(person.registrations[0].schoolName, '乙');
});

test('rejection and deletion choose a valid unit and recalculate the unique personal fee', () => {
  const rows = [row('1', '甲', '拳', { status: 'rejected' }), row('2', '乙', '剑'), row('3', '丙', '刀')];
  const people = buildWushuFeeGroups(rows).flatMap(group => group.roster);
  assert.equal(people.find(person => person.isFeeBillingUnit).billingSchoolName, '乙');
  assert.equal(people.reduce((sum, person) => sum + person.fee, 0), 300);
  assert.equal(buildWushuFeeGroups(rows.slice(0, 1))[0].roster[0].totalFee, 0);
});

test('only name, birthday and document form identity; different units/accounts/genders do not split it', () => {
  const a = row('1', '甲', '拳');
  assert.equal(identityKey(a), identityKey({ ...a, schoolName: '乙', user: 'other', gender: 'male' }));
  for (const changed of [{ name: '另一个人' }, { birthDate: '2001-01-02' }, { idCard: 'DOC-2' }]) assert.notEqual(identityKey(a), identityKey({ ...a, ...changed }));
  assert.equal(identityKey({ ...a, birthDate: '' }), null);
});

test('historical reconciliation unifies complete identities across units and preserves incomplete/conflicting records', () => {
  const a = { ...row('1', '甲', '拳'), number: 'AT-one' };
  const b = { ...row('2', '乙', '剑', { user: 'other' }), number: 'AT-two' };
  const rows = [{ ...a, athleteNumber: a.number }, { ...b, athleteNumber: b.number }];
  const plan = planReconciliation([a, b], rows);
  assert.equal(plan.plans.length, 1);
  assert.equal(plan.plans[0].sources.length, 1);
  assert.equal(planReconciliation([a, { ...b, birthDate: undefined }], rows).unresolved.length, 1);
  assert.equal(planReconciliation([a, b], [rows[0], { ...rows[1], idCard: 'conflict' }]).plans.length, 0);
});
