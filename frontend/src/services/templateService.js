import api from './api';

const templateService = {
  // 获取比赛的模板列表
  getTemplates: async (competitionId) => {
    const response = await api.get(`/competitions/${competitionId}/templates`);
    return response.data;
  },

  // 上传模板
  uploadTemplate: async (competitionId, formData) => {
    const response = await api.post(`/competitions/${competitionId}/templates`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 下载模板
  downloadTemplate: async (competitionId, templateId) => {
    const response = await api.get(`/competitions/${competitionId}/templates/${templateId}/download`, {
      responseType: 'blob',
    });
    return response;
  },

  // 删除模板
  deleteTemplate: async (competitionId, templateId) => {
    const response = await api.delete(`/competitions/${competitionId}/templates/${templateId}`);
    return response.data;
  },

  // 获取单个模板信息
  getTemplate: async (competitionId, templateId) => {
    const response = await api.get(`/competitions/${competitionId}/templates/${templateId}`);
    return response.data;
  },
};

export default templateService;