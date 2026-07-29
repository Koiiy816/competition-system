import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器 - 添加token到请求头
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 检查是否是公开API请求
      const requestUrl = error.config?.url || '';
      const requestMethod = error.config?.method?.toLowerCase();

      const publicGetEndpoints = [
        '/competitions',
        '/schedule',
        '/results',
        '/participants/public',
        '/schedules/public',
        '/results/public'
      ];

      // Check if it's a public GET request.
      // A request is considered public if it's a GET request to an endpoint that starts with one of the public paths.
      const isPublicAPI = requestMethod === 'get' && publicGetEndpoints.some(endpoint => requestUrl.startsWith(endpoint));
      
      // 检查是否是获取当前用户信息的请求
      const isGetCurrentUser = requestUrl.includes('/auth/me');
      
      // 检查是否是登录请求
      const isLoginRequest = requestUrl.includes('/auth/login');
      
      // 只有非公开API且非获取当前用户信息且非登录请求的401错误才执行清除和重定向
      // 对于 /auth/me 的401错误，让AuthContext来处理，避免在页面刷新时立即退出登录
      // 对于 /auth/login 的401错误，是密码错误，不需要重定向
      if (!isPublicAPI && !isGetCurrentUser && !isLoginRequest) {
        // 清除本地存储的认证信息
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // 重定向到登录页面
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;