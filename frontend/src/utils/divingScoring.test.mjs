import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDivingDiveScore } from './divingScoring.js';

test('synchronized diving preview removes the highest and lowest judge scores', () => {
  assert.equal(calculateDivingDiveScore([6, 7, 8, 9, 10], 2.5), 60);
});

test('synchronized diving preview waits for all five judge scores', () => {
  assert.equal(calculateDivingDiveScore([6, 7, 8, 9], 2.5), 0);
});
