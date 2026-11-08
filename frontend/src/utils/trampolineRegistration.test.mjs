import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getTrampolineEvents, getTrampolineEventGroup, getTrampolineScoringOptions, calculateTrampolineScore, getTrampolineJudgeIndex } from './trampolineRegistration.js';
import { isTrampolineCompetition, PARTICIPATION_SPORT_TYPES } from './competitionType.js';
const require = createRequire(import.meta.url);
const { buildTrampolineCompetition } = require('../../../backend/data/trampoline2026');
const competition = buildTrampolineCompetition('test');

test('蹦床按大小网分配维度，其他赛事保持原评分方式', () => {
  const large = getTrampolineScoringOptions(competition, { name: '大网U8组蹦床个人' });
  assert.equal(large.scoringType, 'large');
  assert.deepEqual(large.judgeLabels, ['E1\n技术','E2\n技术','E3\n技术','E4\n技术','D分\n难度','T分\n高度','H分\n位移']);
  const small = getTrampolineScoringOptions(competition, { name: '小网小学组蹦床操' });
  assert.equal(small.judgeLabels.length, 2);
  assert.equal(small.hideParticipantName, true);
  for (const sportType of ['wushu','diving']) assert.equal(getTrampolineScoringOptions({ sportType }, { name: '小网蹦床操' }).scoringType, null);
});

test('启用蹦床类型，并按生日同时显示三个类别的可报名项目', () => {
  assert.equal(isTrampolineCompetition(competition), true);
  assert.ok(!PARTICIPATION_SPORT_TYPES.find(t => t.value === 'trampoline').disabled);
  assert.deepEqual(getTrampolineEvents(competition, '2019-01-01', 'male').map(e => e.name), [
    '大网U8组蹦床个人', '小网U7组男子蹦床个人', '小网小学组蹦床操', '小网幼儿组蹦床操'
  ]);
});

test('男女个人项目分别筛选，团体允许男女队员，逐项匹配组别', () => {
  const events = getTrampolineEvents(competition, '2019-12-31', 'female');
  assert.equal(events.length, 4);
  assert.ok(events.some(e => e.name === '小网U7组女子蹦床个人'));
  assert.ok(events.every(e => !e.name.includes('男子')));
  assert.deepEqual(events.map(e => getTrampolineEventGroup(competition, e, '2019-12-31')),
    ['大网U8组', '小网U7组', '小网小学组', '小网幼儿组']);
});

test('年龄边界和缺失信息不能展示不适用项目', () => {
  assert.equal(getTrampolineEvents(competition, '2011-12-31', 'male').length, 0);
  assert.equal(getTrampolineEvents(competition, '', 'male').length, 0);
  assert.equal(getTrampolineEvents(competition, '2099-01-01', 'male').length, 0);
  assert.equal(getTrampolineEvents(competition, '2019-01-01', '').length, 0);
  assert.ok(!getTrampolineEvents(competition, '2020-01-01', 'male').some(e => e.name.includes('小学组')));
  assert.ok(getTrampolineEvents(competition, '2021-01-01', 'male').some(e => e.name.includes('U5')));
});

test('页面预览与后台计分及栏位识别一致', () => {
  const backend = require('../../../backend/utils/trampolineScoring');
  for (const [type, scores, deduction] of [['large',[9,8,7,6,5,4,3],0.5],['small',[0,8],1],['small',[null,8],0]]) {
    assert.equal(calculateTrampolineScore(scores,deduction,type),backend.calculateTrampolineScore(scores,deduction,type));
  }
  for (const name of ['E1','E4','D1','T1','H1','裁判7']) assert.equal(getTrampolineJudgeIndex({name},'large'),backend.getTrampolineJudgeIndex({name},'large'));
});
