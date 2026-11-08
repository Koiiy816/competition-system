import assert from 'node:assert/strict';
import test from 'node:test';
import { findTrampolineDifficulties, trampolineDifficultyTable } from './trampolineDifficultyTable.js';

test('imports every row from the four-column trampoline difficulty table', () => {
  assert.equal(trampolineDifficultyTable.length, 97);
  assert.deepEqual(trampolineDifficultyTable.map(({ sourceColumn }) => sourceColumn).reduce((counts, column) => {
    counts[column] = (counts[column] || 0) + 1;
    return counts;
  }, {}), { 1: 32, 2: 21, 3: 18, 4: 26 });
});

test('looks up each applicable difficulty by action code and posture', () => {
  assert.deepEqual(findTrampolineDifficulties('11003', '< /').map(({ difficulty }) => difficulty), [2]);
  assert.deepEqual(findTrampolineDifficulties('50').map(({ difficulty }) => difficulty), [0.6, 0.7]);
  assert.deepEqual(findTrampolineDifficulties('30', '<').map(({ difficulty }) => difficulty), [0.3]);
  assert.deepEqual(findTrampolineDifficulties('50', '/').map(({ difficulty }) => difficulty), [0.7]);
  assert.equal(findTrampolineDifficulties('999').length, 0);
});
