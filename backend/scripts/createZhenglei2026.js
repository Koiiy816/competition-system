const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const User = require('../models/User');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });

const name = '2026非遗在鹏城·第二届“正雷杯”陈氏太极拳传承交流大赛';
const groups = ['A1组', 'A2组', 'B组', 'C组', 'D组'];
const individual = (eventName, category, extra = {}) => ({
  name: eventName,
  category,
  ageGroups: groups,
  genderRestriction: 'both',
  ...extra
});
const detail = { required: true, label: '具体套路名称', placeholder: '请填写具体名称' };
const group = (eventName) => ({
  name: eventName,
  category: '集体项目',
  ageGroups: [],
  genderRestriction: 'both',
  isGroupEvent: true,
  minGroupSize: 6,
  maxGroupSize: 12
});

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/competition_system');
  const existing = await Competition.findOne({ name });
  if (existing) {
    console.log(JSON.stringify({ action: 'existing', id: existing.id, status: existing.status }));
    return;
  }
  const admin = await User.findOne({ roles: 'admin' });
  if (!admin) throw new Error('管理员账号不存在');
  const description = fs.readFileSync(path.join(__dirname, '..', '..', '非遗在鹏城·第二届“正雷杯”比赛规程.md'), 'utf8');
  const competition = await Competition.create({
    name,
    description,
    type: '武术',
    startDate: '2026-11-29T08:30:00+08:00',
    endDate: '2026-11-29T18:00:00+08:00',
    registrationDeadline: '2026-11-17T00:00:00+08:00',
    location: '深圳市光明区红花山体育中心',
    guidingUnits: ['广东省武术协会', '广东省陈氏太极文化促进会'],
    hosts: ['广州陈正雷太极会馆'],
    organizers: ['天一太极（深圳）文化发展有限公司', '陈家沟太极拳馆深圳分馆'],
    coOrganizers: ['深圳市武术协会陈正雷拳法专委会', '深圳市光明区红体投资有限公司', '广东省各级太极拳协会'],
    invitedUnits: ['深圳市国际交流合作基金会', '深圳市非物质文化遗产保护协会'],
    status: 'registration',
    maxParticipants: 500,
    participantType: 'both',
    ageGroups: [
      { name: 'A1组', description: '学生组，12岁及以下', birthDateStart: '2014-01-01' },
      { name: 'A2组', description: '学生组，13～18岁', birthDateStart: '2008-01-01', birthDateEnd: '2013-12-31' },
      { name: 'B组', description: '青年组，19～39岁', birthDateStart: '1987-01-01', birthDateEnd: '2007-12-31' },
      { name: 'C组', description: '中年组，40～59岁', birthDateStart: '1967-01-01', birthDateEnd: '1986-12-31' },
      { name: 'D组', description: '乐龄组', birthDateEnd: '1966-12-31' }
    ],
    events: [
      individual('陈氏太极拳老架一路', '个人项目·传统陈氏太极拳'),
      individual('陈氏太极拳老架二路', '个人项目·传统陈氏太极拳'),
      individual('陈氏太极拳新架一路', '个人项目·传统陈氏太极拳'),
      individual('陈氏太极拳新架二路', '个人项目·传统陈氏太极拳'),
      individual('陈氏太极拳精要十八式', '个人项目·传统陈氏太极拳'),
      individual('陈氏太极拳自编套路', '个人项目·传统陈氏太极拳', { registrationDetail: detail }),
      individual('陈氏太极单刀23式', '个人项目·太极短器械'),
      individual('陈氏太极单剑49式', '个人项目·太极短器械'),
      individual('陈式太极扇18式', '个人项目·太极短器械'),
      individual('陈式太极扇34式', '个人项目·太极短器械'),
      individual('陈氏太极枪', '个人项目·太极长器械'),
      individual('陈氏春秋大刀', '个人项目·太极长器械'),
      individual('陈式太极拳竞赛套路56式', '个人项目·规定套路'),
      { ...group('陈氏太极拳精要十八式（集体）'), displayName: '陈氏太极拳精要十八式' },
      { ...group('陈式太极扇十八式（集体）'), displayName: '陈式太极扇十八式' },
      { ...group('陈式太极剑十八式（集体）'), displayName: '陈式太极剑十八式' }
    ],
    participantRequirements: {
      requireIdCard: true,
      requirePhone: true,
      requireSchool: true,
      requireInsurance: true,
      requireRiskWaiver: true,
      requireStudentInfoDetails: false,
      requireParentConsent: false
    },
    registrationRules: {
      maxEventsPerParticipant: 0,
      schoolBasedRegistration: false,
      teamSizeLimits: { minSize: 6, maxSize: 12 }
    },
    organizer: admin._id
  });
  console.log(JSON.stringify({ action: 'created', id: competition.id, status: competition.status, events: competition.events.length }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
