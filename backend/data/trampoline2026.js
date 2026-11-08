const fs = require('fs');
const path = require('path');

const buildTrampolineCompetition = (organizer) => {
  const ageGroups = [];
  const events = [];
  const addGroup = (category, label, start, end, collective = false, splitGender = false) => {
    const group = `${category}${label}`;
    ageGroups.push({ name: group, birthDateStart: start, ...(end ? { birthDateEnd: end } : {}) });
    for (const gender of splitGender ? ['male', 'female'] : ['both']) {
      const name = `${category}${label}${collective ? '蹦床操' : `${gender === 'male' ? '男子' : gender === 'female' ? '女子' : ''}蹦床个人`}`;
      events.push({ name, displayName: name, category, subcategory: collective ? '蹦床操' : '蹦床个人', ageGroups: [group],
        genderRestriction: gender, isGroupEvent: collective, registrationDetail: { required: false } });
    }
  };
  addGroup('大网', 'U14组', '2012-01-01', '2015-12-31');
  addGroup('大网', 'U10组', '2016-01-01', '2017-12-31');
  addGroup('大网', 'U8组', '2018-01-01');
  for (const [label, start, end] of [
    ['U12组', '2014-01-01', '2016-12-31'], ['U9组', '2017-01-01', '2017-12-31'],
    ['U8组', '2018-01-01', '2018-12-31'], ['U7组', '2019-01-01', '2019-12-31'],
    ['U6组', '2020-01-01', '2020-12-31'], ['U5组', '2021-01-01', null]
  ]) addGroup('小网', label, start, end, false, true);
  addGroup('小网', '小学组', '2014-01-01', '2019-12-31', true);
  addGroup('小网', '幼儿组', '2019-01-01', null, true);

  return {
    name: '2026年深圳市青少年（儿童）蹦床公开赛', sportType: 'trampoline', type: '蹦床',
    description: '面向深圳市内各区体校、俱乐部、小学、幼儿园及个人。大网3项、小网14项，共17项；蹦床操按团体参赛。比赛不收取报名费用。',
    rules: fs.readFileSync(path.join(__dirname, 'trampoline2026-rules.md'), 'utf8'),
    startDate: '2026-12-06T00:00:00+08:00', endDate: '2026-12-06T23:59:59+08:00',
    // 规程未给出截止日；本地先开放至赛前一天，管理员可在赛事详情中调整。
    registrationDeadline: '2026-12-05T23:59:59+08:00',
    location: '深圳市体育运动学校', guidingUnits: ['广东省体操技巧协会'], hosts: ['深圳市体育运动学校'],
    organizer, status: 'registration', participantType: 'both', ageGroups, events, registrationFee: 0,
    participantRequirements: { requirePhoto: false, requireIdCard: true, requirePhone: false, requireCoach: false,
      requireSchool: true, requireInsurance: false, requireMedicalCertificate: false, requireParentConsent: false,
      requireRiskWaiver: false, requireStudentInfoDetails: false },
    registrationRules: { maxEventsPerParticipant: 17, schoolBasedRegistration: false, teamSizeLimits: { minSize: 0, maxSize: 0 } },
    scoringRules: { traditionalExclusion: false, teamScoring: { enabled: false } },
    awardRules: { enabled: false, mergeGroupsBelow: 0 },
    tags: ['蹦床', '大网', '小网', '团体蹦床操']
  };
};

module.exports = { buildTrampolineCompetition };
