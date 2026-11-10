import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrampolineSchoolPdf, toTrampolineSchoolSections } from './trampolineRegistrationPdf.js';

const competition = { name: '蹦床测试赛事', sportType: 'trampoline' };
const row = { name: '选手甲', ageGroup: '大网U8组', event: '大网U8组蹦床个人', gender: 'male',
  idCard: '001234567890123456', teamLeader: '领队甲', leaderPhone: '13800000001',
  coach: '教练甲', coachPhone: '13800000002', additionalInfo: { notes: '团体子项：蹦床、单跳' } };

test('同一显示组别汇集大小网各项目，逐项目保留报名，表格仅有指定六列', () => {
  const [section, other] = toTrampolineSchoolSections({ schoolName: '参赛单位完整名称', participants: [row,
    { ...row, event: '小网U8组男子蹦床个人', ageGroup: '小网U8组' },
    { ...row, name: '选手乙', ageGroup: '小网U7组' },
    { ...row, name: '虚拟队', isVirtualTeam: true }
  ] }, competition);
  assert.equal(section.ageGroup, 'U8组');
  assert.equal(section.schoolName, '参赛单位完整名称');
  assert.equal(section.rows.length, 2);
  assert.deepEqual(section.rows.map(cells => cells[1]).sort(), ['大网个人', '小网男子个人'].sort());
  assert.deepEqual(section.rows.map(cells => cells[0]), ['1', '2']);
  for (const cells of section.rows) {
    assert.equal(cells.length, 6);
    assert.deepEqual(cells.slice(2), ['选手甲', '男', '001234567890123456', '团体子项：蹦床、单跳']);
  }
  assert.equal(other.ageGroup, 'U7组');
  assert.equal(other.rows.length, 1);
});

test('领队教练从整个单位汇集并去重，缺失字段不生成 undefined', () => {
  const sections = toTrampolineSchoolSections({ schoolName: '单位', participants: [row,
    { ...row, ageGroup: '小网小学组', teamLeader: '领队乙', leaderPhone: '13800000003' },
    { ...row, ageGroup: '小网幼儿组' }
  ] }, competition);
  for (const section of sections) {
    assert.equal(section.leader, '领队甲（13800000001）、领队乙（13800000003）');
    assert.equal(section.coach, '教练甲（13800000002）');
  }
  const [missing] = toTrampolineSchoolSections({ participants: [{ name: '测试选手', remark: '原备注' }] }, competition);
  assert.equal(missing.ageGroup, '未填写组别');
  assert.equal(missing.leader, '未填写');
  assert.equal(missing.rows[0][5], '原备注');
  assert.ok(!JSON.stringify(missing).includes('undefined'));
});

test('空组别不生成空白 PDF', async () => {
  assert.deepEqual(toTrampolineSchoolSections({}, competition), []);
  await assert.rejects(createTrampolineSchoolPdf(undefined, competition), /没有可导出/);
  await assert.rejects(createTrampolineSchoolPdf({ rows: [] }, competition), /没有可导出/);
});

test('整批绑定的多名教练完整导出，各项目记录去重且兼容旧报名', () => {
  const staff = { leader: { name: '领队', phone: '100' }, coaches: [
    { name: '教练一', phone: '101' }, { name: '教练二', phone: '102' }
  ] };
  const [section] = toTrampolineSchoolSections({ participants: [
    { ...row, additionalInfo: { trampolineStaff: staff } },
    { ...row, additionalInfo: { trampolineStaff: staff } }
  ] }, competition);
  assert.equal(section.leader, '领队（100）');
  assert.equal(section.coach, '教练一（101）、教练二（102）');
});

test('未填写可选教练和领队时，导出显示未填写', () => {
  const [section] = toTrampolineSchoolSections({ participants: [{ ...row, teamLeader: '', leaderPhone: '', coach: '', coachPhone: '',
    additionalInfo: { trampolineStaff: { leader: { name: '', phone: '' }, coaches: [] } } }] }, competition);
  assert.equal(section.leader, '未填写');
  assert.equal(section.coach, '未填写');
});
