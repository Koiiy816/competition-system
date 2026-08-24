import api from './api';

/**
 * 检查当前用户是否有管理权限
 * @returns {boolean} - 是否有管理权限
 */
const hasManagementPermission = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  return user && user.roles && user.roles.some(role => ['admin', 'chief_referee', 'referee'].includes(role));
};

/**
 * 比赛结果相关服务
 * @namespace resultService
 */
const resultService = {
  /**
   * 获取比赛结果列表
   * @param {string} competitionId - 比赛ID
   * @param {Object} params - 查询参数
   * @returns {Promise} - 返回结果列表
   */
  getResults: async (competitionId, params = {}) => {
    try {
      // 根据用户权限选择不同的API路由
      const endpoint = hasManagementPermission() 
        ? `/competitions/${competitionId}/results`
        : `/competitions/${competitionId}/results/public`;
      
      const response = await api.get(endpoint, { params });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取比赛结果列表失败' };
    }
  },

  /**
   * 获取单个比赛结果详情
   * @param {string} competitionId - 比赛ID
   * @param {string} resultId - 结果ID
   * @returns {Promise} - 返回结果详情
   */
  getResult: async (competitionId, resultId) => {
    try {
      const response = await api.get(`/competitions/${competitionId}/results/${resultId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取比赛结果详情失败' };
    }
  },

  /**
   * 创建比赛结果
   * @param {string} competitionId - 比赛ID
   * @param {Object} resultData - 结果数据
   * @returns {Promise} - 返回创建结果
   */
  createResult: async (competitionId, resultData) => {
    try {
      const response = await api.post(`/competitions/${competitionId}/results`, resultData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '创建比赛结果失败' };
    }
  },

  /**
   * 更新比赛结果
   * @param {string} competitionId - 比赛ID
   * @param {string} resultId - 结果ID
   * @param {Object} resultData - 结果数据
   * @returns {Promise} - 返回更新结果
   */
  updateResult: async (competitionId, resultId, resultData) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/results/${resultId}`, resultData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新比赛结果失败' };
    }
  },

  /**
   * 提交或更新成绩（打分专用）
   * @param {string} competitionId - 比赛ID
   * @param {Object} scoreData - 成绩数据 { scheduleId, participantId, scores, deduction }
   * @returns {Promise} - 返回提交结果
   */
  submitScore: async (competitionId, scoreData) => {
    try {
      const response = await api.post(`/competitions/${competitionId}/results/submit`, scoreData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '提交成绩失败' };
    }
  },

  /**
   * 删除比赛结果
   * @param {string} competitionId - 比赛ID
   * @param {string} resultId - 结果ID
   * @returns {Promise} - 返回删除结果
   */
  deleteResult: async (competitionId, resultId) => {
    try {
      const response = await api.delete(`/competitions/${competitionId}/results/${resultId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '删除比赛结果失败' };
    }
  },

  /**
   * 批量导入比赛结果
   * @param {string} competitionId - 比赛ID
   * @param {File} file - 包含结果数据的CSV或Excel文件
   * @returns {Promise} - 返回导入结果
   */
  importResults: async (competitionId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/competitions/${competitionId}/results/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '导入比赛结果失败' };
    }
  },

  /**
   * 导出比赛结果
   * @param {string} competitionId - 比赛ID
   * @param {string} format - 导出格式（csv, excel）
   * @returns {Promise<Blob>} - 返回包含结果数据的Blob对象
   */

  submitDivingScore: async (competitionId, scoreData) => {
    try {
      const response = await api.post('/competitions/' + competitionId + '/results/submit-diving', scoreData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: 'Diving score submission failed' };
    }
  },

  exportResults: async (competitionId, format = 'csv') => {
    try {
      const response = await api.get(`/competitions/${competitionId}/results/export?format=${format}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      const err = await new Response(error.response.data).json();
      throw err || { message: `导出比赛结果失败` };
    }
  },

  /**
   * 获取成绩状态列表
   * @returns {Promise} - 返回状态列表
   */
  getResultStatuses: async () => {
    try {
      const response = await api.get('/result-statuses');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取成绩状态列表失败' };
    }
  },
};

export default resultService;