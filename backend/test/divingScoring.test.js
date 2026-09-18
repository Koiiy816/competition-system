const assert = require('node:assert/strict');
const test = require('node:test');
const { calculateDivingDiveScore } = require('../utils/divingScoring');

test('synchronized diving removes the highest and lowest judge scores like individual diving', () => {
  assert.equal(calculateDivingDiveScore([6, 7, 8, 9, 10], 2.5), 60);
});

test('a diving round is invalid until all five judges submit scores', () => {
  assert.equal(calculateDivingDiveScore([6, 7, 8, 9], 2.5), 0);
});

test('a round deduction is subtracted from the diving score without going below zero', () => {
  assert.equal(calculateDivingDiveScore([6, 7, 8, 9, 10], 2.5, 2), 58);
  assert.equal(calculateDivingDiveScore([6, 7, 8, 9, 10], 2.5, 100), 0);
});
