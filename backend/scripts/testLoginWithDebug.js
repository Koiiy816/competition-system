const axios = require('axios');

async function testLoginWithDebug() {
  const testUsers = [
    { email: 'admin@system.com', password: 'admin123456', name: '管理员' },
    { email: 'test@organizer.com', password: 'password123', name: '组织者' },
    { email: 'participant@test.com', password: 'password123', name: '参赛者' },
    { email: 'spectator@test.com', password: 'password123', name: '观众' }
  ];

  console.log('开始测试登录API（带调试信息）...\n');

  for (const testUser of testUsers) {
    console.log(`测试 ${testUser.name} (${testUser.email}):`);
    
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email: testUser.email,
        password: testUser.password
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: function (status) {
          return status < 500; // 不抛出4xx错误
        }
      });

      console.log(`   请求数据: ${JSON.stringify({ email: testUser.email, password: testUser.password })}`);
      console.log(`   响应状态码: ${response.status}`);
      console.log(`   响应头: ${JSON.stringify(response.headers)}`);
      console.log(`   响应数据: ${JSON.stringify(response.data)}`);

      if (response.status === 200) {
        console.log('✅ 登录成功!');
        console.log(`   Token: ${response.data.token ? response.data.token.substring(0, 20) + '...' : '无'}`);
        console.log(`   用户信息: ${JSON.stringify(response.data.user)}`);
      } else {
        console.log('❌ 登录失败!');
        console.log(`   错误信息: ${response.data.message || '未知错误'}`);
      }
      
    } catch (error) {
      console.log('❌ 请求错误!');
      console.log(`   错误: ${error.message}`);
      if (error.response) {
        console.log(`   响应状态码: ${error.response.status}`);
        console.log(`   响应数据: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    console.log('');
  }
}

testLoginWithDebug();