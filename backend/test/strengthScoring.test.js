const assert = require('node:assert/strict');
const test = require('node:test');
const { mergeStrengthEvents, normalizeStrengthEvents } = require('../utils/strengthScoring');

test('strength score submission preserves previously saved actions when a later action is entered', () => {
  const firstAction = normalizeStrengthEvents([{ actionName: '助木举腿5次', rawScore: 99, order: 1 }]);
  const secondAction = normalizeStrengthEvents([{ actionName: '立定跳远', rawScore: 1.22, order: 2 }]);

  assert.deepEqual(mergeStrengthEvents(firstAction, secondAction), [
    { actionCode: '', actionName: '助木举腿5次', rawScore: 99, order: 1, direction: 'asc' },
    { actionCode: '', actionName: '立定跳远', rawScore: 1.22, order: 2, direction: 'desc' }
  ]);
});

test('strength score submission updates an already saved action without duplicating it', () => {
  const saved = normalizeStrengthEvents([{ actionName: '提膝跳', rawScore: 4, order: 3 }]);
  const correction = normalizeStrengthEvents([{ actionName: '提膝跳', rawScore: 5, order: 3 }]);

  assert.deepEqual(mergeStrengthEvents(saved, correction), [
    { actionCode: '', actionName: '提膝跳', rawScore: 5, order: 3, direction: 'desc' }
  ]);
});
