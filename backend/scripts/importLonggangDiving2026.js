require('dotenv').config();
const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const Participant = require('../models/Participant');
const User = require('../models/User');
const registrations = require('./longgang-diving-2026-preview.json');

const DRY_RUN = process.argv.includes('--dry-run');
const COMPETITION_PATTERN = /2026.*深圳市青少年（儿童）锦标赛.*跳水|2026.*深圳市青少年.*跳水/;
const unit = '龙岗区';

const makePairKey = (athlete, project) => `${athlete.ageGroup}｜${project.event}｜${project.pairCode}`;

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/competition-system');
  const competitions = await Competition.find({ name: COMPETITION_PATTERN }).select('_id name events').lean();
  if (competitions.length !== 1) throw new Error(`目标跳水比赛应唯一，当前找到 ${competitions.length} 个：${competitions.map((item) => item.name).join('、')}`);
  const competition = competitions[0];
  const configuredEvents = new Set((competition.events || []).map((item) => item.name));
  const requestedEvents = [...new Set(registrations.flatMap((athlete) => athlete.projects.map((project) => project.event)))];
  const missingEvents = requestedEvents.filter((event) => !configuredEvents.has(event));
  if (missingEvents.length) throw new Error(`比赛尚未配置以下项目，未导入任何数据：${missingEvents.join('、')}`);

  const names = registrations.map((athlete) => athlete.name);
  const existing = await Participant.find({ competition: competition._id, schoolName: unit, name: { $in: names }, isVirtualTeam: { $ne: true } }).select('name event').lean();
  if (existing.length) throw new Error(`发现龙岗区已存在 ${existing.length} 条报名记录，为避免重复导入已停止：${[...new Set(existing.map((item) => item.name))].join('、')}`);

  const importUser = await User.findOne({ roles: 'admin' }).select('_id').lean();
  if (!importUser) throw new Error('未找到管理员账号，无法建立导入记录');

  const records = [];
  const pairEntries = new Map();
  for (const athlete of registrations) {
    for (const project of athlete.projects) {
      const record = { user: importUser._id, competition: competition._id, name: athlete.name, gender: athlete.gender, grade: athlete.ageGroup, ageGroup: athlete.ageGroup, event: project.event, schoolName: athlete.unit, teamLeader: athlete.leader, coach: athlete.coach, type: 'individual', insuranceConfirmed: true, status: 'pending', additionalInfo: { source: '龙岗区报名表导入' } };
      records.push(record);
      if (project.pairCode) {
        const key = makePairKey(athlete, project);
        const list = pairEntries.get(key) || [];
        list.push({ record, athlete }); pairEntries.set(key, list);
      }
    }
  }
  for (const [key, list] of pairEntries) {
    if (list.length !== 2) throw new Error(`双人配对异常：${key}`);
    const [first, second] = list;
    const mixed = first.record.event.includes('混合');
    if ((mixed && first.record.gender === second.record.gender) || (!mixed && first.record.gender !== second.record.gender)) throw new Error(`双人性别配对异常：${key}`);
    const pairId = `longgang-2026-${Buffer.from(key).toString('base64url')}`;
    list.forEach(({ record, athlete }, index) => { const other = list[index ? 0 : 1].athlete; record.additionalInfo.divingPair = { pairId, pairKey: key, pairCode: athlete.projects.find((project) => project.event === record.event)?.pairCode, event: record.event, ageGroup: record.ageGroup, unit, type: mixed ? 'mixed' : 'same-gender', partnerName: other.name }; });
  }

  console.log(`目标比赛：${competition.name}`);
  console.log(`将导入：${registrations.length} 名运动员、${records.length} 条报名、${pairEntries.size} 组双人配对`);
  if (DRY_RUN) return console.log('预览完成：未写入数据库。');
  await Participant.insertMany(records, { ordered: true });
  console.log('导入完成。');
}
main().catch((error) => { console.error('导入失败：', error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());