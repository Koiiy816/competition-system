const test = require('node:test');
const assert = require('node:assert/strict');
const { parseChineseResidentIdentityNumber, getTrampolineRegistrationKey, findTrampolineDuplicate } = require('../utils/trampolineIdentity');
const { validateTrampolineRegistration } = require('../utils/trampolineRegistration');
const { buildTrampolineCompetition } = require('../data/trampoline2026');
const base = { name: '选手甲', gender: 'male', idCard: 'P-001', event: '大网U8组蹦床个人' };

test('同姓名、性别、证件号、项目在同赛事中唯一，忽略大小写与空格', () => {
  const same = { ...base, name: ' 选手 甲 ', idCard: ' p-001 ' };
  assert.equal(getTrampolineRegistrationKey('match', base), getTrampolineRegistrationKey('match', same));
  assert.notEqual(getTrampolineRegistrationKey('other', base), getTrampolineRegistrationKey('match', base));
  for (const extra of [{ name: '乙' }, { gender: 'female' }, { idCard: 'P-002' }, { event: '小网U7组男子蹦床个人' }]) {
    assert.notEqual(getTrampolineRegistrationKey('match', { ...base, ...extra }), getTrampolineRegistrationKey('match', base));
  }
  assert.match(findTrampolineDuplicate([base, same]), /选手.*重复/);
  assert.match(findTrampolineDuplicate([base], [same]), /选手.*重复/);
  assert.equal(findTrampolineDuplicate([base, { ...base, event: '另一项目' }]), '');
  assert.equal(findTrampolineDuplicate([base], [{ ...base, isVirtualTeam: true }]), '');
});

test('识别大陆及港澳台居住证生日，拒绝改生日，普通护照仍可手填', () => {
  const competition = buildTrampolineCompetition('507f1f77bcf86cd799439011');
  const prefix = '99000020190101001';
  const weights = [7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2];
  const codes = ['1','0','X','9','8','7','6','5','4','3','2'];
  const idCard = prefix + codes[weights.reduce((sum, weight, i) => sum + Number(prefix[i]) * weight, 0) % 11];
  const row = { ...base, idCard, birthDate: '2019-01-01', ageGroup: '大网U8组', type: 'individual', schoolName: '单位' };
  assert.equal(parseChineseResidentIdentityNumber(idCard).birthDate, '2019-01-01');
  assert.equal(validateTrampolineRegistration(competition, row), null);
  assert.match(validateTrampolineRegistration(competition, { ...row, birthDate: '2018-01-01' }), /证件.*出生日期/);
  assert.equal(validateTrampolineRegistration(competition, { ...row, idCard: 'PASSPORT-001', birthDate: '2018-01-01' }), null);
  assert.equal(parseChineseResidentIdentityNumber('810000200001010014').birthDate, '2000-01-01');
  assert.equal(parseChineseResidentIdentityNumber('810000200001010015'), null);
});
