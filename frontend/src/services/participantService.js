import api from './api';

/**
 * 检查当前用户是否有管理权限或是否为参赛单位
 * @returns {boolean} - 是否有访问受保护接口的权限
 */
const hasManagementPermission = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  return user && user.roles && user.roles.some(role => ['admin', 'chief_referee', 'referee', 'organization', 'checkin_clerk'].includes(role));
};

/**
 * 参赛者相关服务
 * @namespace participantService
 */
const participantService = {
  /**
   * 获取比赛的参赛者列表
   * @param {string} competitionId - 比赛ID
   * @param {Object} params - 查询参数
   * @returns {Promise} - 返回参赛者列表
   */
  getParticipants: async (competitionId, params = {}) => {
    try {
      // 根据用户权限选择不同的API路由
      const endpoint = hasManagementPermission() 
        ? `/competitions/${competitionId}/participants`
        : `/competitions/${competitionId}/participants/public`;
      
      const response = await api.get(endpoint, { params });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取参赛者列表失败' };
    }
  },

  /**
   * 获取单个参赛者详情
   * @param {string} competitionId - 比赛ID
   * @param {string} participantId - 参赛者ID
   * @returns {Promise} - 返回参赛者详情
   */
  getParticipant: async (competitionId, participantId) => {
    try {
      const response = await api.get(`/competitions/${competitionId}/participants/${participantId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取参赛者详情失败' };
    }
  },

  /**
   * 添加参赛者
   * @param {string} competitionId - 比赛ID
   * @param {Object} participantData - 参赛者数据
   * @returns {Promise} - 返回添加结果
   */
  addParticipant: async (competitionId, participantData) => {
    try {
      const requestOptions = participantData instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;
      const response = await api.post(`/competitions/${competitionId}/participants`, participantData, requestOptions);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '添加参赛者失败' };
    }
  },

  /**
   * 创建参赛者（报名）
   * @param {string} competitionId - 比赛ID
   * @param {Object} participantData - 参赛者数据
   * @returns {Promise} - 返回创建结果
   */
  createParticipant: async (competitionId, participantData) => {
    try {
      const response = await api.post(`/competitions/${competitionId}/register`, participantData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '报名失败' };
    }
  },

  /**
   * 更新参赛者信息
   * @param {string} competitionId - 比赛ID
   * @param {string} participantId - 参赛者ID
   * @param {Object} participantData - 参赛者数据
   * @returns {Promise} - 返回更新结果
   */
  updateParticipant: async (competitionId, participantId, participantData) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/participants/${participantId}`, participantData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新参赛者信息失败' };
    }
  },

  setDivingPair: async (competitionId, participantId, partnerId) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/participants/${participantId}/diving-pair`, { partnerId });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '设置双人跳水搭档失败' };
    }
  },

  /**
   * 审核通过参赛者
   * @param {string} competitionId - 比赛ID
   * @param {string} participantId - 参赛者ID
   * @returns {Promise} - 返回结果
   */
  approveParticipant: async (competitionId, participantId) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/participants/${participantId}/approve`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '审核参赛者失败' };
    }
  },

  /**
   * 批量通过参赛者 (一键通过)
   * @param {string} competitionId - 比赛ID
   * @returns {Promise} - 返回结果
   */
  bulkApproveParticipants: async (competitionId) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/participants/approve-all`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '一键通过参赛者失败' };
    }
  },

  /**
   * 拒绝参赛者
   * @param {string} competitionId - 比赛ID
   * @param {string} participantId - 参赛者ID
   * @returns {Promise} - 返回结果
   */
  rejectParticipant: async (competitionId, participantId) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/participants/${participantId}/reject`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '拒绝参赛者失败' };
    }
  },

  /**
   * 删除参赛者
   * @param {string} competitionId - 比赛ID
   * @param {string} participantId - 参赛者ID
   * @returns {Promise} - 返回删除结果
   */
  deleteParticipant: async (competitionId, participantId) => {
    try {
      const response = await api.delete(`/competitions/${competitionId}/participants/${participantId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '删除参赛者失败' };
    }
  },

  /**
   * 批量删除(清空)参赛者
   * @param {string} competitionId - 比赛ID
   * @returns {Promise} - 返回删除结果
   */
  bulkDeleteParticipants: async (competitionId) => {
    try {
      const response = await api.delete(`/competitions/${competitionId}/participants`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '清空参赛者失败' };
    }
  },

  /**
   * 下载参赛者报名表
   * @param {string} competitionId - 比赛ID
   * @param {string} participantId - 参赛者ID
   * @returns {Promise<Blob>} - 返回包含文件的Blob对象
   */
  downloadRegistrationForm: async (competitionId, participantId) => {
    try {
      const response = await api.get(
        `/competitions/${competitionId}/participants/${participantId}/download-form`,
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error) {
      // 尝试解析Blob中的错误信息
      if (error.response && error.response.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          throw json;
        } catch (e) {
          // 忽略解析错误
        }
      }
      throw error.response ? error.response.data : { message: '下载报名表失败' };
    }
  },

  /**
   * 批量导入参赛者
   * @param {string} competitionId - 比赛ID
   * @param {File} file - 包含参赛者数据的CSV或Excel文件
   * @returns {Promise} - 返回导入结果
   */
  getParticipantPhoto: async (competitionId, participantId) => {
    const response = await api.get(`/competitions/${competitionId}/participants/${participantId}/photo`, { responseType: 'blob' });
    return response.data;
  },

  exportParticipantsWithPhotos: async (competitionId) => {
    const response = await api.get(`/competitions/${competitionId}/participants/export-photos`, { responseType: 'blob' });
    return response.data;
  },

  importParticipants: async (competitionId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/competitions/${competitionId}/participants/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '导入参赛者失败' };
    }
  },

  /**
   * 导出参赛者数据
   * @param {string} competitionId - 比赛ID
   * @param {string} format - 导出格式 (csv/xlsx)
   * @returns {Promise} - 返回Blob对象
   */
  exportParticipants: async (competitionId, format = 'csv') => {
    try {
      const response = await api.get(`/competitions/${competitionId}/participants/export?format=${format}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      // 将Blob错误转换为可读的JSON
      const err = await new Response(error.response.data).json();
      throw err || { message: `导出参赛者失败` };
    }
  },

  /**
   * 按单位格式导出参赛者数据 (供 Excel 使用)
   * @param {string} competitionId - 比赛ID
   * @returns {Promise} - 返回JSON数据
   */
  exportParticipantsBySchool: async (competitionId) => {
    try {
      const response = await api.get(`/competitions/${competitionId}/participants/export-school`);
      // 确保返回 response.data 里面的 data，因为后端包装了 { success: true, data: exportData }
      return response.data?.data || response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '按单位导出参赛者失败' };
    }
  },

  /**
   * 获取当前用户的所有参赛记录
   * @returns {Promise} - 返回参赛记录列表
   */
  getMyParticipations: async () => {
    try {
      const response = await api.get('/competitions/all/participants/all/me');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取我的参赛记录失败' };
    }
  },

  saveDivingPlan: async (competitionId, participantId, plan) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/participants/${participantId}/diving-plan`, plan);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '保存跳水动作表失败' };
    }
  }
};

export default participantService;
