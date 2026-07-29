const mongoose = require('mongoose');
const CompetitionTemplate = require('../models/CompetitionTemplate');
const Competition = require('../models/Competition');
const User = require('../models/User');
require('dotenv').config({ path: './config/.env' });

async function testTemplateUpload() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGO_URI);
    console.log('数据库连接成功');

    // 查找一个比赛
    const competition = await Competition.findOne();
    if (!competition) {
      console.log('没有找到比赛，请先创建比赛');
      return;
    }
    console.log('找到比赛:', competition.name);

    // 查找一个管理员用户
    const admin = await User.findOne({ roles: 'admin' });
    if (!admin) {
      console.log('没有找到管理员用户');
      return;
    }
    console.log('找到管理员:', admin.name);

    // 创建测试模板记录
    const template = await CompetitionTemplate.create({
      competition: competition._id,
      name: '武术比赛报名表模板',
      description: '武术比赛官方报名表模板，请下载填写后上传',
      fileName: 'test-template.pdf',
      filePath: 'uploads/templates/test-template.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      uploadedBy: admin._id
    });

    console.log('模板创建成功:', template);

    // 测试获取模板
    const templates = await CompetitionTemplate.find({
      competition: competition._id,
      isActive: true
    }).populate('uploadedBy', 'name');

    console.log('获取到的模板列表:', templates);

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

testTemplateUpload();