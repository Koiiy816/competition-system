const mongoose = require('mongoose');
const Competition = require('../models/Competition');
require('dotenv').config({ path: './config/.env' });

// 武术比赛详细项目数据
const wushuCompetitionDetails = {
  // 高中组项目
  highSchoolEvents: {
    拳术类: [
      '自选长拳',
      '自选南拳', 
      '自选太极拳',
      '咏春拳（非咏春拳12式）'
    ],
    短器械: [
      '自选刀术',
      '自选剑术',
      '自选南刀',
      '自选太极剑'
    ],
    长器械: [
      '自选棍术',
      '自选枪术',
      '自选南棍'
    ],
    集体项目: [
      '咏春拳12式（12人）'
    ]
  },
  
  // 初中组项目
  middleSchoolEvents: {
    拳术类: [
      '第三套国际武术竞赛长拳',
      '第三套国际武术竞赛南拳',
      '第三套国际武术竞赛太极拳',
      '咏春拳（非咏春拳12式）'
    ],
    短器械: [
      '第三套国际武术竞赛刀术',
      '第三套国际武术竞赛剑术',
      '第三套国际武术竞赛南刀',
      '第三套国际武术竞赛太极剑'
    ],
    长器械: [
      '第三套国际武术竞赛棍术',
      '第三套国际武术竞赛枪术',
      '第三套国际武术竞赛南棍'
    ],
    集体项目: [
      '咏春拳12式（12人）'
    ]
  },
  
  // 小学甲组项目
  primaryAEvents: {
    拳术类: [
      '第三套国际武术竞赛长拳',
      '第三套国际武术竞赛南拳',
      '第三套国际武术竞赛太极拳',
      '自选长拳',
      '传统拳术',
      '咏春拳（非咏春拳12式）'
    ],
    短器械: [
      '第三套国际武术竞赛刀术',
      '第三套国际武术竞赛剑术',
      '第三套国际武术竞赛南刀',
      '第三套国际武术竞赛太极剑'
    ],
    长器械: [
      '第三套国际武术竞赛棍术',
      '第三套国际武术竞赛枪术',
      '第三套国际武术竞赛南棍'
    ],
    传统器械: [
      '传统器械项目'
    ],
    集体项目: [
      '咏春拳12式（12人）'
    ]
  },
  
  // 小学乙组项目
  primaryBEvents: {
    拳术类: [
      '传统拳术',
      '少年规定拳',
      '自选长拳',
      '初级南拳',
      '42式太极拳',
      '咏春拳（非咏春拳12式）'
    ],
    短器械: [
      '初级刀术',
      '初级剑术',
      '自选南刀',
      '42式太极剑'
    ],
    长器械: [
      '初级棍术',
      '初级枪术',
      '自选南棍'
    ],
    传统器械: [
      '传统器械项目'
    ],
    集体项目: [
      '咏春拳12式（12人）'
    ]
  }
};

// 参赛规定
const participationRules = {
  报名规定: {
    基本要求: '必须以学校为单位报名参赛',
    人员配置: '每单位限报领队1人，教练员2人，运动员每个组别男、女各6人',
    项目限制: {
      初中高中组: '可报拳术及短器械、长器械不同种类的三个项目',
      小学组: '各单项限报男子、女子各2人，每名运动员可报拳术及短器械、长器械、传统项目中不同种类的两个项目'
    },
    集体项目: {
      要求: '面向全市所有中小学校，深圳市武术传统项目学校及各区武术传统项目学校必须参加',
      形式: '分线上（预赛）和线下（决赛）两个阶段进行',
      人数要求: '每组参赛学生人数达200人以上'
    }
  },
  
  竞赛办法: {
    规则依据: '国家体育总局武术运动管理中心审定的最新《武术套路竞赛规程》',
    评分标准: '执行2019版《国际武术套路竞赛规则》，采用无难度评判方式',
    身份验证: '每场比赛运动员上场前必须提交第二代身份证和运动员证原件',
    配乐规定: '长拳、太极拳、太极剑、集体项目可以配乐（音乐不得有说唱内容）',
    时间要求: '传统拳术、传统器械及咏春拳演练时间为1-2分钟'
  },
  
  奖励办法: {
    个人奖项: '各单项按成绩录取前八名，按9、7、6、5、4、3、2、1计分',
    集体奖项: '集体项目线上线下分别录取前八名，并分别纳入团体总分',
    团体奖项: '按成绩分别录取高中组、初中组、小学甲组、小学乙组团体总分前八名',
    特殊奖项: '优秀教练员、优秀裁判员、优秀组织奖'
  }
};

async function addWushuCompetitionDetails() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB 连接成功');

    // 查找刚创建的武术比赛
    const competition = await Competition.findOne({ 
      name: '2025年深圳市中小学生武术比赛' 
    });

    if (!competition) {
      console.log('未找到武术比赛，请先创建比赛基本信息');
      process.exit(1);
    }

    // 更新比赛详细信息
    const updatedDescription = `
由深圳市教育局、深圳市文化广电旅游体育局主办，宝安区教育科学研究院承办的中小学生武术比赛。

【主办单位】深圳市教育局、深圳市文化广电旅游体育局
【承办单位】宝安区教育科学研究院
【参赛单位】深圳市各中小学校

【比赛项目详情】
高中组：${Object.entries(wushuCompetitionDetails.highSchoolEvents).map(([category, events]) => 
  `${category}(${events.join('、')})`).join('；')}

初中组：${Object.entries(wushuCompetitionDetails.middleSchoolEvents).map(([category, events]) => 
  `${category}(${events.join('、')})`).join('；')}

小学甲组：${Object.entries(wushuCompetitionDetails.primaryAEvents).map(([category, events]) => 
  `${category}(${events.join('、')})`).join('；')}

小学乙组：${Object.entries(wushuCompetitionDetails.primaryBEvents).map(([category, events]) => 
  `${category}(${events.join('、')})`).join('；')}

注：传统拳术、传统器械不计入团体总分。
    `;

    const updatedRules = `
【竞赛规则】
${participationRules.竞赛办法.规则依据}，${participationRules.竞赛办法.评分标准}。

【参赛条件】
${participationRules.报名规定.基本要求}，${participationRules.报名规定.人员配置}。
初中、高中组：${participationRules.报名规定.项目限制.初中高中组}
小学组：${participationRules.报名规定.项目限制.小学组}

【集体项目特殊规定】
${participationRules.报名规定.集体项目.要求}，${participationRules.报名规定.集体项目.形式}。

【竞赛办法】
- ${participationRules.竞赛办法.身份验证}
- ${participationRules.竞赛办法.配乐规定}
- ${participationRules.竞赛办法.时间要求}

【奖励办法】
- ${participationRules.奖励办法.个人奖项}
- ${participationRules.奖励办法.集体奖项}
- ${participationRules.奖励办法.团体奖项}
- ${participationRules.奖励办法.特殊奖项}
    `;

    competition.description = updatedDescription.trim();
    competition.rules = updatedRules.trim();

    await competition.save();
    
    console.log('武术比赛详细信息添加成功！');
    console.log('比赛名称:', competition.name);
    console.log('比赛ID:', competition._id);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('添加比赛详细信息失败:', error.message);
    process.exit(1);
  }
}

addWushuCompetitionDetails();