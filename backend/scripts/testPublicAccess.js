const axios = require("axios");

async function testPublicAccess() {
  try {
    console.log("测试未登录用户访问比赛列表...");
    
    // 不带任何认证信息访问比赛列表
    const response = await axios.get("http://localhost:5000/api/competitions");
    
    console.log("成功访问比赛列表");
    console.log("状态码:", response.status);
    console.log("比赛数量:", response.data.count);
    console.log("比赛列表:", response.data.data.map(comp => ({
      id: comp._id,
      name: comp.name,
      status: comp.status
    })));
    
  } catch (error) {
    console.log("访问失败");
    console.log("状态码:", error.response?.status);
    console.log("错误信息:", error.response?.data?.message || error.message);
  }
}

testPublicAccess();