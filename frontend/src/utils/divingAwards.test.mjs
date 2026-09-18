import test from 'node:test';
import assert from 'node:assert/strict';
import { isUnitLimitedAwardResult, rankDivingAwardEntries } from './divingAwards.js';

const result = (name, unit, score, options = {}) => ({
  participant: { name, schoolName: unit, ...options.participant },
  finalScore: score,
  details: { isAbsent: Boolean(options.absent) }
});

test('diving awards keep at most three individual athletes from one unit in the top eight', () => {
  const ranked = rankDivingAwardEntries([
    result('甲1', '甲单位', 100), result('甲2', '甲单位', 99), result('甲3', '甲单位', 98), result('甲4', '甲单位', 97),
    result('乙1', '乙单位', 96), result('丙1', '丙单位', 95), result('丁1', '丁单位', 94), result('戊1', '戊单位', 93), result('己1', '己单位', 92)
  ]);

  assert.deepEqual(ranked.slice(0, 8).map(({ entry }) => entry.participant.name), ['甲1', '甲2', '甲3', '乙1', '丙1', '丁1', '戊1', '己1']);
  assert.equal(ranked[8].entry.participant.name, '甲4');
  assert.equal(ranked[8].rank, 9);
});

test('diving awards keep at most two pairs from one unit in the top eight', () => {
  const pair = (name, score) => result(name, '甲单位', score, { participant: { isVirtualTeam: true, teamMembers: [{ name: `${name}甲` }, { name: `${name}乙` }] } });
  const ranked = rankDivingAwardEntries([pair('甲队1', 100), pair('甲队2', 99), pair('甲队3', 98), result('乙1', '乙单位', 97), result('丙1', '丙单位', 96), result('丁1', '丁单位', 95), result('戊1', '戊单位', 94), result('己1', '己单位', 93), result('庚1', '庚单位', 92)]);

  assert.deepEqual(ranked.slice(0, 8).map(({ entry }) => entry.participant.name), ['甲队1', '甲队2', '乙1', '丙1', '丁1', '戊1', '己1', '庚1']);
  assert.equal(ranked[8].entry.participant.name, '甲队3');
});

test('test athletes do not occupy diving award places', () => {
  const ranked = rankDivingAwardEntries([
    result('测试选手', '甲单位', 100, { participant: { isTest: true } }),
    result('正式选手', '乙单位', 99)
  ]);

  assert.equal(ranked[0].entry.participant.name, '正式选手');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].isAwarded, false);
});

test('an entry excluded by the unit limit starts outside the top eight even when places remain', () => {
  const ranked = rankDivingAwardEntries([
    result('甲1', '甲单位', 100), result('甲2', '甲单位', 99), result('甲3', '甲单位', 98), result('甲4', '甲单位', 97)
  ]);

  assert.deepEqual(ranked.map(({ rank }) => rank), [1, 2, 3, 9]);
});

test('strength events use the same unit-limited award rule', () => {
  assert.equal(isUnitLimitedAwardResult({ schedule: { name: '素质力量' } }), true);
  const ranked = rankDivingAwardEntries([
    result('甲1', '甲单位', 100), result('甲2', '甲单位', 99), result('甲3', '甲单位', 98), result('甲4', '甲单位', 97)
  ]);
  assert.deepEqual(ranked.map(({ rank }) => rank), [1, 2, 3, 9]);
});
