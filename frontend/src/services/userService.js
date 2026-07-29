import api from './api';

/**
 * 用户相关服务，处理用户信息的增删改查
 * @namespace userService
 */
const userService = {
  /**
   * 获取用户列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.limit - 每页数量
   * @returns {Promise} - 返回用户列表
   */
  getUsers: async (params = {}) => {
    try {
      const response = await api.get('/users', { params });
      return response.data.data ? response.data : { data: response.data }; // 兼容不同格式
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取用户列表失败' };
    }
  },

  /**
   * 获取单个用户信息
   * @param {string} userId - 用户ID
   * @returns {Promise} - 返回用户信息
   */
  getUser: async (userId) => {
    try {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取用户信息失败' };
    }
  },

  /**
   * 创建新用户
   * @param {Object} userData - 用户数据
   * @returns {Promise} - 返回创建结果
   */
  createUser: async (userData) => {
    try {
      const response = await api.post('/users', userData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '创建用户失败' };
    }
  },

  /**
   * 更新用户信息
   * @param {string} userId - 用户ID
   * @param {Object} userData - 用户数据
   * @returns {Promise} - 返回更新结果
   */
  updateUser: async (userId, userData) => {
    try {
      const response = await api.put(`/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新用户信息失败' };
    }
  },

  /**
   * 删除用户
   * @param {string} userId - 用户ID
   * @returns {Promise} - 返回删除结果
   */
  deleteUser: async (userId) => {
    try {
      const response = await api.delete(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '删除用户失败' };
    }
  },

  /**
   * 更新当前用户的个人资料
   * @param {Object} profileData - 个人资料数据
   * @returns {Promise} - 返回更新结果
   */
  updateProfile: async (profileData) => {
    try {
      const response = await api.put('/users/profile/update', profileData);
      // 更新本地存储的用户信息
      const user = JSON.parse(localStorage.getItem('user'));
      if (user) {
        const updatedUser = { ...user, ...profileData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新个人资料失败' };
    }
  },

  /**
   * 上传用户头像
   * @param {File} imageFile - 图片文件
   * @returns {Promise} - 返回上传结果
   */
  uploadAvatar: async (imageFile) => {
    try {
      const formData = new FormData();
      formData.append('avatar', imageFile);

      const response = await api.post('/users/profile/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      // 更新本地存储的用户头像信息
      const user = JSON.parse(localStorage.getItem('user'));
      if (user && response.data.data) {
        user.profile = { ...user.profile, avatar: response.data.data };
        localStorage.setItem('user', JSON.stringify(user));
      }
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '上传头像失败' };
    }
  },

  /**
   * 检查当前用户是否有指定角色权限
   * @param {string[]} roles - 允许的角色列表
   * @returns {boolean} - 是否有权限
   */
  hasPermission: (roles) => {
    const user = JSON.parse(localStorage.getItem('user'));
    return user && user.roles && user.roles.some(role => roles.includes(role));
  }
};

export default userService;