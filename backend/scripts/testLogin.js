const axios = require('axios');

async function testLogin() {
  const testUsers = [
    { email: 'admin@system.com', password: 'admin123456', name: '管理员' },
    { email: 'test@organizer.com', password: 'password123', name: '组织者' },
    { email: 'participant@test.com', password: 'password123', name: '参赛者' },
    { email: 'spectator@test.com', password: 'password123', name: '观众' }
  ];

  console.log('开始测试登录API...\n');

  for (const user of testUsers) {
    try {
      console.log(`测试 ${user.name} (${user.email}):`);
      
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email: user.email,
        password: user.password
      });

      console.log(`✅ 登录成功! Token: ${response.data.token.substring(0, 20)}...`);
      console.log(`   用户信息: ${response.data.user.name} - ${response.data.user.roles.join(', ')}\n`);
      
    } catch (error) {
      console.log(`❌ 登录失败!`);
      if (error.response) {
        console.log(`   状态码: ${error.response.status}`);
        console.log(`   错误信息: ${error.response.data.message || error.response.data}`);
      } else {
        console.log(`   网络错误: ${error.message}`);
      }
      console.log('');
    }
  }
}

testLogin();