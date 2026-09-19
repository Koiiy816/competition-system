import test from 'node:test';
import assert from 'node:assert/strict';
import { rankDivingAwardEntries } from './divingAwards.js';

const result = (name, unit, score, options = {}) => ({
  participant: { name, schoolName: unit, ...options.participant },
  finalScore: score,
  details: { isAbsent: Boolean(options.absent) }
});

test('diving awards keep at most three individual athletes from one unit and retain continuous ranks', () => {
  const ranked = rankDivingAwardEntries([
    result('甲1', '甲单位', 100), result('甲2', '甲单位', 99), result('甲3', '甲单位', 98), result('甲4', '甲单位', 97),
    result('乙1', '乙单位', 96), result('丙1', '丙单位', 95), result('丁1', '丁单位', 94), result('戊1', '戊单位', 93), result('己1', '己单位', 92)
  ]);

  assert.deepEqual(ranked.slice(0, 8).map(({ entry }) => entry.participant.name), ['甲1', '甲2', '甲3', '乙1', '丙1', '丁1', '戊1', '己1']);
  assert.equal(ranked[8].entry.participant.name, '甲4');
  assert.equal(ranked[8].rank, 9);
  assert.equal(ranked[8].isAwarded, false);
});

test('diving pairs keep the two-pair unit award limit without skipping ranks', () => {
  const pair = (name, score) => result(name, '甲单位', score, { participant: { isVirtualTeam: true, teamMembers: [{ name: `${name}甲` }, { name: `${name}乙` }] } });
  const ranked = rankDivingAwardEntries([pair('甲队1', 100), pair('甲队2', 99), pair('甲队3', 98), result('乙1', '乙单位', 97), result('丙1', '丙单位', 96), result('丁1', '丁单位', 95), result('戊1', '戊单位', 94), result('己1', '己单位', 93), result('庚1', '庚单位', 92)]);

  assert.deepEqual(ranked.slice(0, 8).map(({ entry }) => entry.participant.name), ['甲队1', '甲队2', '乙1', '丙1', '丁1', '戊1', '己1', '庚1']);
  assert.equal(ranked[7].rank, 8);
  assert.equal(ranked[7].isAwarded, true);
  assert.equal(ranked[8].entry.participant.name, '甲队3');
  assert.equal(ranked[8].rank, 9);
  assert.equal(ranked[8].isAwarded, false);
});

test('when unit limits leave only seven awarded pairs, the next pair is rank eight but receives no award', () => {
  const pair = (name, unit, score) => result(name, unit, score, { participant: { isVirtualTeam: true, teamMembers: [{ name: `${name}甲` }, { name: `${name}乙` }] } });
  const ranked = rankDivingAwardEntries([
    pair('龙岗1', '龙岗', 100), pair('南山1', '南山', 99), pair('宝安1', '宝安', 98), pair('宝安2', '宝安', 97), pair('龙岗2', '龙岗', 96),
    pair('南山2', '南山', 95), pair('光明1', '光明', 94), pair('宝安3', '宝安', 93), pair('南山3', '南山', 92)
  ]);

  assert.deepEqual(ranked.map(({ rank }) => rank), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(ranked.map(({ isAwarded }) => isAwarded), [true, true, true, true, true, true, true, false, false]);
  assert.deepEqual(ranked.slice(7).map(({ entry }) => entry.participant.name), ['宝安3', '南山3']);
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

test('a unit-limit exclusion follows the awarded entries without leaving rank eight blank', () => {
  const ranked = rankDivingAwardEntries([
    result('甲1', '甲单位', 100), result('甲2', '甲单位', 99), result('甲3', '甲单位', 98), result('甲4', '甲单位', 97)
  ]);

  assert.deepEqual(ranked.map(({ rank }) => rank), [1, 2, 3, 4]);
  assert.deepEqual(ranked.map(({ isAwarded }) => isAwarded), [true, true, true, false]);
});

test('diving ties are broken by each action score in program order', () => {
  const tied = (name, dives) => ({
    participant: { name, schoolName: `${name}单位` },
    finalScore: 100,
    details: { dives }
  });
  const ranked = rankDivingAwardEntries([
    tied('乙', [{ score: 48, difficulty: 2.0 }, { score: 52, difficulty: 2.4 }]),
    tied('甲', [{ score: 50, difficulty: 2.0 }, { score: 50, difficulty: 2.4 }])
  ]);

  assert.deepEqual(ranked.map(({ entry }) => entry.participant.name), ['甲', '乙']);
  assert.deepEqual(ranked.map(({ rank }) => rank), [1, 2]);
});
