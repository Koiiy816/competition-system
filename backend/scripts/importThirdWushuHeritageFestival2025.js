const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const User = require('../models/User');
require('dotenv').config({ path: './config/.env' });

const competitionName = '2025年第三届武术传承发展交流文化节暨【武盟杯】粤港澳全民武术公开赛';

const ageGroups = [
  { name: '幼儿组', description: '4-6岁：2019年1月1日至2021年12月31日出生' },
  { name: '少年乙组', description: '7-10岁：2015年1月1日至2018年12月31日出生' },
  { name: '少年甲组', description: '11-13岁：2012年1月1日至2014年12月31日出生' },
  { name: '青年乙组', description: '14-17岁：2008年1月1日至2011年12月31日出生' },
  { name: '青年甲组', description: '18-40岁：1985年1月1日至2007年12月31日出生' },
  { name: '成年组', description: '41-69岁：1956年1月1日至1984年12月31日出生' }
];

const allAgeGroups = ageGroups.map(group => group.name);
const traditionalDetail = {
  required: true,
  label: '具体套路名称',
  placeholder: '例如：陈式太极拳老架一路、蔡李佛拳、少林棍等',
  maxLength: 100
};

const event = (category, subcategory, item, options = {}) => ({
  name: `${category}｜${subcategory}｜${item}`,
  displayName: `${category} · ${subcategory} · ${item}`,
  category,
  subcategory,
  ageGroups: options.ageGroups || allAgeGroups,
  genderRestriction: 'both',
  isTraditional: Boolean(options.registrationDetail?.required),
  registrationDetail: options.registrationDetail || { required: false },
  isGroupEvent: Boolean(options.isGroupEvent),
  groupSize: options.groupSize,
  minGroupSize: options.minGroupSize,
  maxGroupSize: options.maxGroupSize,
  countInTeamScore: true
});

const events = [
  ...['24式太极拳', '42式太极拳', '32式太极剑', '42式太极剑'].map(item => event('武术套路', '太极类｜规定套路', item)),
  ...['各式太极拳', '太极器械'].map(item => event('武术套路', '太极类｜传统套路', item, { registrationDetail: traditionalDetail })),
  ...['自选太极拳', '自选太极剑'].map(item => event('武术套路', '太极类｜自选套路', item)),

  ...['规定南拳', '规定南刀', '规定南棍'].map(item => event('武术套路', '南拳类｜规定套路', item)),
  ...['初级南拳', '初级南刀', '初级南棍'].map(item => event('武术套路', '南拳类｜初级套路', item)),
  ...['各类传统南拳', '南派短器械', '南派长器械', '南派软器械', '南派双器械'].map(item => event('武术套路', '南拳类｜传统套路', item, { registrationDetail: traditionalDetail })),
  ...['自选南拳', '自选南刀', '自选南棍'].map(item => event('武术套路', '南拳类｜自选套路', item)),

  ...['规定长拳', '规定刀术', '规定剑术', '规定棍术', '规定枪术', '少年规定拳'].map(item => event('武术套路', '长拳类｜规定套路', item)),
  ...['五步拳', '初级一路', '初级二路', '初级三路', '初级刀', '初级剑', '初级枪', '初级棍'].map(item => event('武术套路', '长拳类｜初级套路', item)),
  ...['各类传统北派拳', '北派短器械', '北派长器械', '北派软器械', '北派双器械'].map(item => event('武术套路', '长拳类｜传统套路', item, { registrationDetail: traditionalDetail })),
  ...['自选长拳', '自选刀术', '自选剑术', '自选棍术', '自选枪术'].map(item => event('武术套路', '长拳类｜自选套路', item)),

  ...['徒手对练', '器械对练（含徒手与器械对练）', '太极推手对练'].map(item => event('武术套路', '对练项目', item, {
    isGroupEvent: true,
    groupSize: 2,
    minGroupSize: 2,
    maxGroupSize: 2,
    registrationDetail: {
      required: true,
      label: '对练组合／套路说明',
      placeholder: '请填写对练组合及具体套路名称',
      maxLength: 100
    }
  })),

  ...['易筋经', '五禽戏', '八段锦', '太极养生杖', '导引养生功十二法', '马王堆导引术', '大舞']
    .map(item => event('健身气功', '缩短版普及功法（不设组别）', item))
];

async function importCompetition() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/competition-system');
  try {
    const existing = await Competition.findOne({ name: competitionName });
    if (existing) {
      console.log(`比赛已存在，未覆盖任何资料：${existing._id}`);
      return;
    }

    const organizer = await User.findOne({ roles: { $in: ['admin'] } });
    if (!organizer) throw new Error('找不到管理员账号，无法指定比赛创建人。');

    const competition = await Competition.create({
      name: competitionName,
      description: '武术套路、对练及健身气功公开赛。传统套路和对练项目会在报名时要求填写项目详情，避免以自由备注替代编排资料。',
      type: '武术套路／健身气功',
      rules: '比赛日期：2025年9月20日；地点：深圳市福田体育公园体育馆。每项报名费280元；参赛者不限报项。自选长拳、自选太极拳及自选太极剑可配乐；未配乐或配乐含说唱，裁判长扣0.10分。领队须按规程另行提交报名汇总表、学籍／医疗证明、保险、责任声明及承诺书。',
      startDate: new Date('2025-09-20T09:00:00+08:00'),
      endDate: new Date('2025-09-20T18:00:00+08:00'),
      registrationDeadline: new Date('2025-09-05T23:59:59+08:00'),
      location: '深圳市福田体育公园体育馆',
      status: 'draft',
      organizer: organizer._id,
      participantType: 'both',
      maxParticipants: 0,
      ageGroups,
      events,
      participantRequirements: {
        requirePhoto: false,
        requireIdCard: true,
        requirePhone: true,
        requireCoach: true,
        requireSchool: true,
        requireInsurance: true,
        requireMedicalCertificate: false,
        requireParentConsent: true,
        requireRiskWaiver: true,
        requireStudentInfoDetails: true
      },
      registrationRules: {
        maxEventsPerParticipant: 99,
        schoolBasedRegistration: true,
        teamSizeLimits: { minSize: 2, maxSize: 2 }
      },
      registrationFee: 280,
      tags: ['武术', '套路', '对练', '健身气功', '粤港澳']
    });

    console.log(`比赛导入完成：${competition._id}`);
    console.log(`已建立 ${events.length} 个可报名项目；比赛目前为草稿，避免因规程日期已过而意外开放报名。`);
  } finally {
    await mongoose.disconnect();
  }
}

importCompetition().catch(error => {
  console.error('导入失败：', error.message);
  process.exit(1);
});
