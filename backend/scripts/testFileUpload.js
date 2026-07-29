const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testFileUpload() {
  try {
    console.log('开始测试文件上传功能...');

    // 1. 首先登录获取token
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'participant@example.com',
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      console.log('登录失败，尝试创建测试用户...');
      
      // 创建测试用户
      const registerResponse = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: '测试参赛者',
          email: 'participant@example.com',
          password: 'password123',
          roles: ['participant']
        })
      });

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json();
        console.error('创建用户失败:', errorData);
        return;
      }

      console.log('测试用户创建成功');
      
      // 重新登录
      const retryLoginResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'participant@example.com',
          password: 'password123'
        })
      });

      if (!retryLoginResponse.ok) {
        console.error('重新登录失败');
        return;
      }

      const loginData = await retryLoginResponse.json();
      console.log('登录成功');
      
      // 2. 测试获取模板
      console.log('测试获取模板...');
      const templatesResponse = await fetch('http://localhost:5000/api/competitions/68ed0a57dc9caec8a48606c0/templates');
      
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json();
        console.log('获取模板成功:', templatesData);
      } else {
        console.error('获取模板失败:', templatesResponse.status);
      }

      // 3. 测试文件上传
      console.log('测试文件上传...');
      
      // 创建测试文件
      const testFilePath = path.join(__dirname, 'test-registration.pdf');
      const testContent = '%PDF-1.4\n测试报名表内容';
      fs.writeFileSync(testFilePath, testContent);

      const formData = new FormData();
      formData.append('schoolName', '测试学校');
      formData.append('grade', 'primary_1');
      formData.append('event', '长拳');
      formData.append('gender', 'male');
      formData.append('idCard', '440301199001011234');
      formData.append('phone', '13800138000');
      formData.append('type', 'individual');
      formData.append('insuranceConfirmed', 'true');
      formData.append('registrationForm', fs.createReadStream(testFilePath));

      const uploadResponse = await fetch('http://localhost:5000/api/competitions/68ed0a57dc9caec8a48606c0/participants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        },
        body: formData
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        console.log('文件上传成功:', uploadData);
      } else {
        const errorData = await uploadResponse.json();
        console.error('文件上传失败:', uploadResponse.status, errorData);
      }

      // 清理测试文件
      fs.unlinkSync(testFilePath);
      
    } else {
      const loginData = await loginResponse.json();
      console.log('登录成功');
      
      // 2. 测试获取模板
      console.log('测试获取模板...');
      const templatesResponse = await fetch('http://localhost:5000/api/competitions/68ed0a57dc9caec8a48606c0/templates');
      
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json();
        console.log('获取模板成功:', templatesData);
      } else {
        console.error('获取模板失败:', templatesResponse.status);
      }

      // 3. 测试文件上传
      console.log('测试文件上传...');
      
      // 创建测试文件
      const testFilePath = path.join(__dirname, 'test-registration.pdf');
      const testContent = '%PDF-1.4\n测试报名表内容';
      fs.writeFileSync(testFilePath, testContent);

      const formData = new FormData();
      formData.append('schoolName', '测试学校');
      formData.append('grade', 'primary_1');
      formData.append('event', '长拳');
      formData.append('gender', 'male');
      formData.append('idCard', '440301199001011234');
      formData.append('phone', '13800138000');
      formData.append('type', 'individual');
      formData.append('insuranceConfirmed', 'true');
      formData.append('registrationForm', fs.createReadStream(testFilePath));

      const uploadResponse = await fetch('http://localhost:5000/api/competitions/68ed0a57dc9caec8a48606c0/participants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        },
        body: formData
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        console.log('文件上传成功:', uploadData);
      } else {
        const errorData = await uploadResponse.json();
        console.error('文件上传失败:', uploadResponse.status, errorData);
      }

      // 清理测试文件
      fs.unlinkSync(testFilePath);
    }

  } catch (error) {
    console.error('测试失败:', error);
  }
}

testFileUpload();