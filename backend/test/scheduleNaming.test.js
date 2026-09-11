const assert = require('node:assert/strict');
const test = require('node:test');
const { formatScheduleName, getScheduleGender, parseScheduleIdentity } = require('../utils/scheduleNaming');

test('mixed synchronized diving keeps its mixed project name regardless of the first entrant gender', () => {
  const eventName = '男女混合跳台双人';
  const gender = getScheduleGender({ eventName, participantGender: 'female' });
  assert.equal(gender, 'mixed');
  assert.equal(formatScheduleName({ ageGroup: 'U12组', eventName, gender }), 'U12组 男女混合跳台双人');
});

test('gender already contained in an event name is never repeated in its schedule title', () => {
  assert.equal(formatScheduleName({ ageGroup: 'U10组', eventName: '男子跳台', participantGender: 'male' }), 'U10组 男子跳台');
  assert.equal(formatScheduleName({ ageGroup: 'U10组', eventName: '女子跳台', participantGender: 'female' }), 'U10组 女子跳台');
});

test('gender is added only when a generic event must be separated by entrant gender', () => {
  assert.equal(formatScheduleName({ ageGroup: 'U10组', eventName: '规定动作', participantGender: 'male' }), 'U10组 男子 规定动作');
  assert.equal(formatScheduleName({ ageGroup: 'U10组', eventName: '规定动作', participantGender: 'female' }), 'U10组 女子 规定动作');
});

test('schedule identity parser accepts both corrected and legacy duplicated titles', () => {
  assert.deepEqual(parseScheduleIdentity('U12组 男女混合跳台双人'), { displayName: 'U12组 男女混合跳台双人', ages: ['12'], gender: 'mixed', event: '跳台双人' });
  assert.deepEqual(parseScheduleIdentity('U10组 男子 男子跳台'), { displayName: 'U10组 男子 男子跳台', ages: ['10'], gender: 'male', event: '跳台' });
  assert.deepEqual(parseScheduleIdentity('U10组 女子跳台'), { displayName: 'U10组 女子跳台', ages: ['10'], gender: 'female', event: '跳台' });
});
