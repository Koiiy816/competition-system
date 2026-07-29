const axios = require('axios');

async function loginAndTest() {
  try {
    // 先登录获取新的token
    console.log('正在登录超级管理员账户...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@system.com',
      password: 'admin123456'
    });
    
    console.log('登录成功!');
    const token = loginResponse.data.token;
    console.log('获取到token:', token.substring(0, 50) + '...');
    console.log('用户角色:', loginResponse.data.user.roles);
    
    // 使用新token测试participants API
    console.log('\n正在测试participants接口...');
    const participantsResponse = await axios.get('http://localhost:5000/api/competitions/68eb9ed4d4f147b9f7ae1d63/participants', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Participants API测试成功!');
    console.log('状态码:', participantsResponse.status);
    console.log('参赛者数量:', participantsResponse.data.length);
    
    // 测试schedules API
    console.log('\n正在测试schedules接口...');
    const schedulesResponse = await axios.get('http://localhost:5000/api/competitions/68eb9ed4d4f147b9f7ae1d63/schedules', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Schedules API测试成功!');
    console.log('状态码:', schedulesResponse.status);
    console.log('赛程数量:', schedulesResponse.data.length);
    
    console.log('\n✅ 所有API测试通过！权限问题已解决！');
    
  } catch (error) {
    console.log('❌ 测试失败:');
    console.log('状态码:', error.response?.status);
    console.log('错误信息:', error.response?.data?.message || error.message);
    if (error.response?.data?.stack) {
      console.log('错误堆栈:', error.response.data.stack);
    }
  }
}

loginAndTest();