import api from './api';

/**
 * 身份验证服务，处理用户登录、注册、注销等
 * @namespace authService
 */
const authService = {
  /**
   * 用户登录
   * @param {Object} credentials - 登录凭证
   * @param {string} credentials.email - 用户邮箱
   * @param {string} credentials.password - 用户密码
   * @returns {Promise} - 返回登录结果
   */
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '登录失败，请检查网络连接' };
    }
  },

  /**
   * 用户注册
   * @param {Object} userData - 用户数据
   * @param {string} userData.name - 用户姓名
   * @param {string} userData.email - 用户邮箱
   * @param {string} userData.password - 用户密码
   * @param {string} userData.role - 用户角色
   * @returns {Promise} - 返回注册结果
   */
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '注册失败，请检查网络连接' };
    }
  },

  /**
   * 用户注销
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // 根据后端实现，可能需要调用API通知服务器
    // api.get('/auth/logout');
  },

  /**
   * 获取当前登录用户信息
   * @returns {Promise} - 返回用户信息
   */
  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '获取用户信息失败' };
    }
  },

  /**
   * 更新用户密码
   * @param {Object} passwordData - 密码数据
   * @param {string} passwordData.currentPassword - 当前密码
   * @param {string} passwordData.newPassword - 新密码
   * @returns {Promise} - 返回更新结果
   */
  updatePassword: async (passwordData) => {
    try {
      const response = await api.put('/auth/updatepassword', passwordData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '更新密码失败' };
    }
  },

  /**
   * 请求重置密码
   * @param {Object} emailData - 邮箱数据
   * @param {string} emailData.email - 用户邮箱
   * @returns {Promise} - 返回请求结果
   */
  forgotPassword: async (emailData) => {
    try {
      const response = await api.post('/auth/forgotpassword', emailData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '请求重置密码失败' };
    }
  },

  /**
   * 重置密码
   * @param {string} resetToken - 重置令牌
   * @param {Object} passwordData - 密码数据
   * @param {string} passwordData.password - 新密码
   * @returns {Promise} - 返回重置结果
   */
  resetPassword: async (resetToken, passwordData) => {
    try {
      const response = await api.put(`/auth/resetpassword/${resetToken}`, passwordData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : { message: '重置密码失败' };
    }
  },

  /**
   * 检查用户是否已认证
   * @returns {boolean} - 如果用户已认证则返回true，否则返回false
   */
  isAuthenticated: () => {
    const token = localStorage.getItem('token');
    return !!token;
  },

  /**
   * 从本地存储中获取用户信息
   * @returns {Object|null} - 返回用户信息或null
   */
  getStoredUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

export default authService;