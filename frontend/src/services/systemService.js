import api from './api';

const systemService = {
  getSettings: async () => {
    try {
      const response = await api.get('/settings');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取设置失败' };
    }
  },
  
  updateSetting: async (key, value) => {
    try {
      const response = await api.put(`/settings/${key}`, { value });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新设置失败' };
    }
  }
};

export default systemService;