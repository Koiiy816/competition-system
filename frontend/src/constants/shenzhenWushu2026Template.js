const personalEvents = [
  // Personal compulsory routines
  ...['第一套', '第三套'].flatMap(set => [
    '长拳', '剑术', '刀术', '枪术', '棍术'
  ].map(name => ({ name: `${set}国际竞赛套路${name}`, category: '个人规定项目', subcategory: '长拳类' }))),
  ...['第一套', '第三套'].flatMap(set => [
    '南拳', '南刀', '南棍'
  ].map(name => ({ name: `${set}国际竞赛套路${name}`, category: '个人规定项目', subcategory: '南拳类' }))),
  ...[
    '24式太极拳', '42式太极拳', '32式太极剑', '42式太极剑',
    '第三套国际竞赛套路太极拳', '第三套国际竞赛套路太极剑',
    '陈式太极拳竞赛套路', '杨式太极拳竞赛套路', '吴式太极拳竞赛套路',
    '武式太极拳竞赛套路', '孙式太极拳竞赛套路', '和式太极拳竞赛套路'
  ].map(name => ({ name, category: '个人规定项目', subcategory: '太极拳类' })),
  ...[
    '五步拳（正反面各一套）', '少年规定拳', '初级南拳',
    '初级刀术', '初级枪术', '初级棍术', '初级剑术'
  ].map(name => ({ name, category: '个人规定项目', subcategory: '初级规定类' })),

  // Personal traditional routines
  ...['陈式太极拳', '杨式太极拳', '吴式太极拳', '武式太极拳', '孙式太极拳', '其他传统太极拳（报名时填写具体套路名称）']
    .map(name => ({ name, category: '个人传统项目', subcategory: '拳术 - 太极拳类', isTraditional: true })),
  ...['咏春拳', '五祖拳', '洪拳', '蔡李佛', '地术拳', '鹤拳', '其他南拳（报名时填写具体套路名称）']
    .map(name => ({ name, category: '个人传统项目', subcategory: '拳术 - 南拳类', isTraditional: true })),
  ...['初级一路长拳', '初级二路长拳', '初级三路长拳', '形意拳', '八卦掌', '八极拳', '通臂拳', '劈挂拳', '翻子拳', '地躺拳', '象形拳', '查拳', '华拳', '炮拳', '红拳', '花拳', '少林拳', '武当拳', '武当太乙拳', '峨眉拳', '永春白鹤拳', '其他传统拳术（报名时填写具体套路名称）']
    .map(name => ({ name, category: '个人传统项目', subcategory: '拳术 - 其他拳术类', isTraditional: true })),
  ...['刀', '枪', '剑', '棍', '太极扇', '南刀', '南棍', '朴（大）刀', '鞭杆', '杖', '棒', '拐', '铲', '叉', '其他单器械（报名时填写具体套路名称）']
    .map(name => ({ name, category: '个人传统项目', subcategory: '器械 - 单器械', isTraditional: true })),
  ...['双刀', '双剑（含长穗双剑）', '双鞭（含刀加鞭）', '双钩', '双匕首', '双钺', '其他双器械（报名时填写具体套路名称）']
    .map(name => ({ name, category: '个人传统项目', subcategory: '器械 - 双器械', isTraditional: true })),
  ...['九节鞭', '双节棍', '三节棍', '流星锤', '绳镖', '其他软器械（报名时填写具体套路名称）']
    .map(name => ({ name, category: '个人传统项目', subcategory: '器械 - 软器械', isTraditional: true }))
];

export const shenzhenWushu2026AgeGroups = [
  { name: 'U6', description: '5-6周岁（2020年1月1日-2021年12月31日出生）' },
  { name: 'U8', description: '7-8周岁（2018年1月1日-2019年12月31日出生）' },
  { name: 'U10', description: '9-10周岁（2016年1月1日-2017年12月31日出生）' },
  { name: 'U12', description: '11-12周岁（2014年1月1日-2015年12月31日出生）' },
  { name: 'U14', description: '13-14周岁（2012年1月1日-2013年12月31日出生）' },
  { name: 'U16', description: '15-16周岁（2010年1月1日-2011年12月31日出生）' },
  { name: 'U18', description: '17-18周岁（2008年1月1日-2009年12月31日出生）' }
];

export const createShenzhenWushu2026Events = () => {
  const ageGroups = shenzhenWushu2026AgeGroups.map(group => group.name);
  const personal = personalEvents.map((event, index) => ({
    ...event,
    id: `sz-2026-personal-${index}`,
    ageGroups,
    genderRestriction: 'both',
    isGroupEvent: false,
    maxParticipants: 0
  }));

  const noAgeOrGender = (id, name, category, options = {}) => ({
    id: `sz-2026-${id}`,
    name,
    category,
    ageGroups: [],
    genderRestriction: 'both',
    maxParticipants: 0,
    ...options
  });

  return [
    ...personal,
    noAgeOrGender('pair-taiji', '混双太极拳', '双人项目'),
    noAgeOrGender('sparring-unarmed', '徒手对练', '对练项目'),
    noAgeOrGender('sparring-weapon', '器械对练（含徒手与器械对练）', '对练项目'),
    noAgeOrGender('group-fist', '集体拳术', '集体项目', { isGroupEvent: true, minGroupSize: 3, maxGroupSize: 15 }),
    noAgeOrGender('group-weapon', '集体器械（含徒手与器械）', '集体项目', { isGroupEvent: true, minGroupSize: 3, maxGroupSize: 15, maxEquipmentParticipants: 12 }),
    noAgeOrGender('group-exercise', '武术操', '集体项目', { isGroupEvent: true, minGroupSize: 3, maxGroupSize: 15 })
  ];
};

export const SHENZHEN_WUSHU_2026_TEMPLATE_NAME = '“奔跑吧·少年”第四届全国青少年武术俱乐部公开赛（广东深圳站）';
