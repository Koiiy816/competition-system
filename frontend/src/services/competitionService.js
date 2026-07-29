import api from './api';

/**
 * 比赛相关服务
 * @namespace competitionService
 */
const competitionService = {
  /**
   * 获取比赛列表
   * @param {Object} params - 查询参数
   * @returns {Promise} - 返回比赛列表
   */
  getCompetitions: async (params = {}) => {
    try {
      const response = await api.get('/competitions', { params });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取比赛列表失败' };
    }
  },

  /**
   * 获取单个比赛详情
   * @param {string} id - 比赛ID
   * @returns {Promise} - 返回比赛详情
   */
  getCompetition: async (id) => {
    try {
      const response = await api.get(`/competitions/${id}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取比赛详情失败' };
    }
  },

  /**
   * 创建新比赛
   * @param {Object|FormData} competitionData - 比赛数据
   * @returns {Promise} - 返回创建结果
   */
  createCompetition: async (competitionData) => {
    try {
      const isFormData = competitionData instanceof FormData;
      const headers = isFormData ? { 'Content-Type': undefined } : { 'Content-Type': 'application/json' };
      
      const response = await api.post('/competitions', competitionData, {
        headers
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '创建比赛失败' };
    }
  },

  /**
   * 更新比赛信息
   * @param {string} id - 比赛ID
   * @param {Object|FormData} competitionData - 比赛数据
   * @returns {Promise} - 返回更新结果
   */
  updateCompetition: async (id, competitionData) => {
    try {
      const isFormData = competitionData instanceof FormData;
      const headers = isFormData ? { 'Content-Type': undefined } : { 'Content-Type': 'application/json' };

      const response = await api.put(`/competitions/${id}`, competitionData, {
        headers
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新比赛失败' };
    }
  },

  /**
   * 删除比赛
   * @param {string} id - 比赛ID
   * @returns {Promise} - 返回删除结果
   */
  deleteCompetition: async (id) => {
    try {
      const response = await api.delete(`/competitions/${id}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '删除比赛失败' };
    }
  },

  /**
   * 获取比赛状态列表
   * @returns {Promise<Array<{id: string, name: string}>>} - 返回比赛状态列表
   */
  getCompetitionStatuses: async () => {
    // 在实际应用中，这可能是从API获取的
    return Promise.resolve([
      { id: 'upcoming', name: '即将开始' },
      { id: 'ongoing', name: '进行中' },
      { id: 'completed', name: '已结束' },
      { id: 'cancelled', name: '已取消' },
    ]);
  },

  /**
   * 获取比赛类型列表
   * @returns {Promise<Array<{id: string, name: string}>>} - 返回比赛类型列表
   */
  getCompetitionTypes: async () => {
    // 在实际应用中，这可能是从API获取的
    return Promise.resolve([
      { id: 'martial_arts', name: '武术比赛' },
      { id: 'sports', name: '体育竞技' },
      { id: 'academic', name: '学术竞赛' },
      { id: 'cultural', name: '文化比赛' },
      { id: 'other', name: '其他' },
    ]);
  },

  /**
   * 获取当前用户参与的比赛列表
   * @returns {Promise} - 返回比赛列表
   */
  getUserCompetitions: async () => {
    try {
      const response = await api.get('/competitions/my-competitions');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取用户比赛列表失败' };
    }
  },
};

export default competitionService;