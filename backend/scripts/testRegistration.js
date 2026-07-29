const axios = require("axios");

async function testRegistrationWithoutAuth() {
  try {
    console.log("测试未登录用户尝试报名...");
    
    // 不带任何认证信息尝试报名
    const response = await axios.post("http://localhost:5000/api/competitions/68ed0a57dc9caec8a48606c0/participants", {
      name: "测试用户",
      idCard: "123456789012345678",
      phone: "13800138000",
      type: "individual"
    });
    
    console.log("报名成功（这不应该发生）");
    console.log("状态码:", response.status);
    
  } catch (error) {
    console.log("报名失败（预期结果）");
    console.log("状态码:", error.response?.status);
    console.log("错误信息:", error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log("✅ 验证通过：未登录用户无法报名");
    } else {
      console.log("❌ 验证失败：未登录用户可以报名");
    }
  }
}

async function testRegistrationWithAuth() {
  try {
    console.log("\n测试已登录用户报名...");
    
    // 先登录获取token
    const loginResponse = await axios.post("http://localhost:5000/api/auth/login", {
      email: "participant@example.com",
      password: "123456"
    });
    
    const token = loginResponse.data.token;
    console.log("登录成功，获取token");
    
    // 使用token尝试报名
    const response = await axios.post("http://localhost:5000/api/competitions/68ed0a57dc9caec8a48606c0/participants", {
      name: "参赛者用户",
      idCard: "123456789012345678",
      phone: "13800138000",
      type: "individual"
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log("✅ 报名成功");
    console.log("状态码:", response.status);
    console.log("参赛者ID:", response.data.data._id);
    
  } catch (error) {
    console.log("❌ 报名失败");
    console.log("状态码:", error.response?.status);
    console.log("错误信息:", error.response?.data?.message || error.message);
  }
}

async function runTests() {
  await testRegistrationWithoutAuth();
  await testRegistrationWithAuth();
}

runTests();