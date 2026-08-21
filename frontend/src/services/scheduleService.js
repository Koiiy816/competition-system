import api from './api';

/**
 * 检查当前用户是否有管理权限
 * @returns {boolean} - 是否有管理权限
 */
const hasManagementPermission = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  return user && user.roles && user.roles.some(role => ['admin', 'chief_referee', 'referee', 'checkin_clerk'].includes(role));
};

/**
 * 赛程相关服务，处理赛程的增删改查等
 * @namespace scheduleService
 */
const scheduleService = {
  /**
   * 获取赛程列表
   * @param {string} competitionId - 比赛ID
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.limit - 每页数量
   * @param {string} params.status - 赛程状态
   * @param {string} params.type - 赛程类型
   * @param {string} params.startDate - 开始日期
   * @param {string} params.endDate - 结束日期
   * @returns {Promise} - 返回赛程列表
   */
  getSchedules: async (competitionId, params = {}) => {
    try {
      // 根据用户权限选择不同的API路由
      const endpoint = hasManagementPermission() 
        ? `/competitions/${competitionId}/schedules`
        : `/competitions/${competitionId}/schedules/public`;
      
      const response = await api.get(endpoint, { params });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取赛程列表失败' };
    }
  },

  getGroupPreview: async (competitionId) => {
    try {
      const response = await api.get(`/competitions/${competitionId}/schedules/group-preview`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '读取项目分组预览失败' };
    }
  },

  previewExcelScheduleImport: async (competitionId, items, roster = []) => {
    const response = await api.post(`/competitions/${competitionId}/schedules/excel-preview`, { items, roster });
    return response.data;
  },

  importExcelSchedule: async (competitionId, items, assignments = {}, roster = []) => {
    const response = await api.post(`/competitions/${competitionId}/schedules/import-excel`, { items, assignments, roster });
    return response.data;
  },

  previewCollectiveRosterImport: async (competitionId, roster) => {
    try {
      const response = await api.post(`/competitions/${competitionId}/schedules/collective-roster-preview`, { roster });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '读取集体项目名单失败，请稍后重试' };
    }
  },

  importCollectiveRoster: async (competitionId, roster) => {
    try {
      const response = await api.post(`/competitions/${competitionId}/schedules/import-collective-roster`, { roster });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '导入集体项目名单失败，请稍后重试' };
    }
  },
  /**
   * 获取单个赛程详情
   * @param {string} competitionId - 比赛ID
   * @param {string} scheduleId - 赛程ID
   * @returns {Promise} - 返回赛程详情
   */
  getSchedule: async (competitionId, scheduleId) => {
    try {
      const response = await api.get(`/competitions/${competitionId}/schedules/${scheduleId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取赛程详情失败' };
    }
  },

  /**
   * 创建新赛程
   * @param {string} competitionId - 比赛ID
   * @param {Object} scheduleData - 赛程数据
   * @returns {Promise} - 返回创建结果
   */
  createSchedule: async (competitionId, scheduleData) => {
    try {
      const response = await api.post(`/competitions/${competitionId}/schedules`, scheduleData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '创建赛程失败' };
    }
  },

  /**
   * 更新赛程信息
   * @param {string} competitionId - 比赛ID
   * @param {string} scheduleId - 赛程ID
   * @param {Object} scheduleData - 赛程数据
   * @returns {Promise} - 返回更新结果
   */
  updateSchedule: async (competitionId, scheduleId, scheduleData) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/schedules/${scheduleId}`, scheduleData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新赛程失败' };
    }
  },

  /**
   * 删除赛程
   * @param {string} competitionId - 比赛ID
   * @param {string} scheduleId - 赛程ID
   * @returns {Promise} - 返回删除结果
   */
  deleteSchedule: async (competitionId, scheduleId) => {
    try {
      const response = await api.delete(`/competitions/${competitionId}/schedules/${scheduleId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '删除赛程失败' };
    }
  },

  /**
   * 自动生成赛程（出场顺序）
   * @param {string} competitionId - 比赛ID
   * @param {boolean} overwrite - 是否覆盖现有顺序
   * @returns {Promise} - 返回生成结果
   */
  generateStartList: async (competitionId, overwrite = true) => {
    try {
      const response = await api.post(`/competitions/${competitionId}/schedules/generate-start-list?overwrite=${overwrite}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '生成赛程失败' };
    }
  },

  /**
   * 更新赛程状态
   * @param {string} competitionId - 比赛ID
   * @param {string} scheduleId - 赛程ID
   * @param {string} status - 赛程状态
   * @returns {Promise} - 返回更新结果
   */
  updateScheduleStatus: async (competitionId, scheduleId, status) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/schedules/${scheduleId}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新赛程状态失败' };
    }
  },

  /**
   * 随机排序赛程中的参赛者
   * @param {string} competitionId - 比赛ID
   * @param {string} scheduleId - 赛程ID
   * @returns {Promise} - 返回更新后的赛程
   */
  shuffleParticipants: async (competitionId, scheduleId) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/schedules/${scheduleId}?shuffleParticipants=true`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '随机排序参赛者失败' };
    }
  },

  /**
   * 获取所有赛程类型
   * @returns {Promise} - 返回赛程类型列表
   */
  getScheduleTypes: async () => {
    // 在实际应用中，这可能是从API获取的
    return Promise.resolve([
      { id: 'preliminary', name: '预赛' },
      { id: 'quarterfinal', name: '1/4决赛' },
      { id: 'semifinal', name: '半决赛' },
      { id: 'final', name: '决赛' },
      { id: 'other', name: '其他' }
    ]);
  },

  /**
   * 获取所有赛程状态
   * @returns {Promise} - 返回赛程状态列表
   */
  getScheduleStatuses: async () => {
    // 在实际应用中，这可能是从API获取的
    return Promise.resolve([
      { id: 'scheduled', name: '已安排' },
      { id: 'ongoing', name: '进行中' },
      { id: 'completed', name: '已完成' },
      { id: 'cancelled', name: '已取消' },
      { id: 'postponed', name: '已延期' }
    ]);
  },

  // 批量更新赛程排序
  updateSchedulesOrder: async (competitionId, schedules) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/schedules/bulk/order`, { schedules });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新赛程排序失败' };
    }
  },

  // 清空比赛的所有赛程
  clearAllSchedules: async (competitionId) => {
    const response = await api.delete(`/competitions/${competitionId}/schedules`);
    return response.data;
  },

  syncNewParticipants: async (competitionId) => {
    try {
      const response = await api.post(`/competitions/${competitionId}/schedules/sync-new`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '同步新参赛者失败' };
    }
  },

  // 追加新参赛者到当前赛程
  appendNewParticipants: async (competitionId, scheduleId) => {
    const response = await api.post(`/competitions/${competitionId}/schedules/${scheduleId}/append-new`);
    return response.data;
  },

  getUnassignedParticipants: async (competitionId) => {
    const response = await api.get(`/competitions/${competitionId}/schedules/unassigned-participants`);
    return response.data;
  },
  getAvailableParticipants: async (competitionId, scheduleId) => {
    const response = await api.get(`/competitions/${competitionId}/schedules/${scheduleId}/available-participants`);
    return response.data;
  },

  addParticipantsToSchedule: async (competitionId, scheduleId, participantIds) => {
    const response = await api.post(`/competitions/${competitionId}/schedules/${scheduleId}/participants`, { participantIds });
    return response.data;
  },
  updateParticipantCheckInStatus: async (competitionId, participantId, status, scheduleId) => {
    try {
      const response = await api.put(`/competitions/${competitionId}/participants/${participantId}/check-in`, {
        status,
        scheduleId
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新检录状态失败' };
    }
  }
};

export default scheduleService;
