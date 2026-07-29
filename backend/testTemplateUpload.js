const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';
const COMPETITION_ID = '68ed0a57dc9caec8a48606c0';

// 测试用户登录信息
const testUser = {
  email: 'test@organizer.com',
  password: 'password123'
};

async function testTemplateUpload() {
  try {
    console.log('开始测试模板上传功能...\n');

    // 1. 登录获取 token
    console.log('1. 登录获取 token...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, testUser);
    const token = loginResponse.data.token;
    console.log('登录成功，获取到 token');

    // 2. 创建测试文件
    const testFilePath = path.join(__dirname, 'test-template.txt');
    if (!fs.existsSync(testFilePath)) {
      fs.writeFileSync(testFilePath, '这是一个测试模板文件\n比赛报名表模板\n请填写相关信息');
      console.log('创建测试文件:', testFilePath);
    }

    // 3. 上传模板
    console.log('\n2. 上传模板...');
    const formData = new FormData();
    formData.append('template', fs.createReadStream(testFilePath));
    formData.append('name', '测试模板');
    formData.append('description', '这是一个测试用的模板文件');

    const uploadResponse = await axios.post(
      `${BASE_URL}/competitions/${COMPETITION_ID}/templates`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('模板上传成功:', uploadResponse.data);
    const templateId = uploadResponse.data.data._id;

    // 4. 获取模板列表
    console.log('\n3. 获取模板列表...');
    const listResponse = await axios.get(
      `${BASE_URL}/competitions/${COMPETITION_ID}/templates`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('模板列表:', listResponse.data);

    // 5. 下载模板
    console.log('\n4. 下载模板...');
    const downloadResponse = await axios.get(
      `${BASE_URL}/competitions/${COMPETITION_ID}/templates/${templateId}/download`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'stream'
      }
    );

    const downloadPath = path.join(__dirname, 'downloaded-template.txt');
    const writer = fs.createWriteStream(downloadPath);
    downloadResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log('模板下载成功:', downloadPath);

    // 6. 验证下载的文件内容
    const downloadedContent = fs.readFileSync(downloadPath, 'utf8');
    console.log('下载的文件内容:', downloadedContent);

    // 7. 删除模板
    console.log('\n5. 删除模板...');
    const deleteResponse = await axios.delete(
      `${BASE_URL}/competitions/${COMPETITION_ID}/templates/${templateId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('模板删除成功:', deleteResponse.data);

    // 8. 清理测试文件
    if (fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
      console.log('清理下载的测试文件');
    }

    console.log('\n✅ 模板上传下载功能测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

testTemplateUpload();