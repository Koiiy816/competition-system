const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// 测试账户
const testAccounts = [
  { email: 'admin@system.com', password: 'admin123456', role: 'admin' },
  { email: 'test@organizer.com', password: 'password123', role: 'organizer' },
  { email: 'participant@test.com', password: 'password123', role: 'participant' },
  { email: 'spectator@test.com', password: 'password123', role: 'spectator' }
];

// 登录并获取token
const login = async (email, password) => {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password
    });
    return response.data.token;
  } catch (error) {
    console.error(`登录失败 (${email}):`, error.response?.data?.message || error.message);
    return null;
  }
};

// 测试API访问
const testAPI = async (token, url, role) => {
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(`✅ ${role} 成功访问 ${url} - 状态码: ${response.status}`);
    return true;
  } catch (error) {
    console.log(`❌ ${role} 访问 ${url} 失败 - 状态码: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    return false;
  }
};

const runTests = async () => {
  console.log('🚀 开始测试新的权限系统...\n');

  // 假设有一个比赛ID用于测试
  const competitionId = '507f1f77bcf86cd799439011'; // 示例ID

  for (const account of testAccounts) {
    console.log(`\n📋 测试 ${account.role} 角色 (${account.email}):`);
    
    const token = await login(account.email, account.password);
    if (!token) {
      console.log(`❌ ${account.role} 登录失败，跳过测试`);
      continue;
    }

    console.log(`✅ ${account.role} 登录成功`);

    // 测试公开路由（所有角色都应该能访问）
    await testAPI(token, `${BASE_URL}/competitions`, account.role);
    
    // 测试只读路由（participant 和 spectator 应该能访问）
    if (['participant', 'spectator', 'organizer', 'referee', 'admin'].includes(account.role)) {
      await testAPI(token, `${BASE_URL}/competitions/${competitionId}/participants/public`, account.role);
      await testAPI(token, `${BASE_URL}/competitions/${competitionId}/schedules/public`, account.role);
      await testAPI(token, `${BASE_URL}/competitions/${competitionId}/results/public`, account.role);
    }

    // 测试管理路由（只有 organizer 和 admin 应该能访问）
    if (['organizer', 'admin'].includes(account.role)) {
      await testAPI(token, `${BASE_URL}/competitions/${competitionId}/participants`, account.role);
    } else {
      // 这些角色不应该能访问管理路由
      await testAPI(token, `${BASE_URL}/competitions/${competitionId}/participants`, account.role);
    }
  }

  console.log('\n🎉 权限测试完成！');
};

runTests().catch(console.error);