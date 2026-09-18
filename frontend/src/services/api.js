import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

const mutationMethods = new Set(['post', 'put', 'patch', 'delete']);
const nonPersistentPostPaths = [
  '/schedules/excel-preview',
  '/schedules/collective-roster-preview'
];
const highFrequencyMutationPaths = [
  '/results/submit',
  '/results/submit-diving',
  '/results/submit-strength',
  '/check-in'
];
const alreadyConfirmedMutationPaths = [
  '/schedules/import-excel',
  '/schedules/import-collective-roster',
  '/schedules/generate-start-list',
  '/results/reset-diving-publication',
  '/results/reset-schedule-results'
];

const needsMutationConfirmation = (config) => {
  const method = String(config.method || 'get').toLowerCase();
  const url = String(config.url || '').split('?')[0];
  if (!mutationMethods.has(method) || config.skipMutationConfirmation) return false;
  if (url.startsWith('/auth/') || url.startsWith('/users/profile/')) return false;
  if (nonPersistentPostPaths.some(path => url.endsWith(path))) return false;
  if (highFrequencyMutationPaths.some(path => url.endsWith(path))) return false;
  if (alreadyConfirmedMutationPaths.some(path => url.endsWith(path))) return false;
  if (method === 'delete' && /\/schedules(?:\/[^/]+)?$/.test(url)) return false;
  if (method === 'put' && /\/schedules\/[^/]+\/status$/.test(url)) return false;
  // 普通成绩保存同样属于裁判高频录入，不打断逐人逐轮的工作流。
  if (method === 'post' && /\/competitions\/[^/]+\/results$/.test(url)) return false;
  return true;
};

const mutationConfirmationText = (method) => (
  method === 'delete' ? '确定删除该数据吗？此操作可能无法恢复。' : '确定保存并执行本次操作吗？'
);

// 请求拦截器 - 添加token到请求头
api.interceptors.request.use(
  config => {
    if (needsMutationConfirmation(config) && !window.confirm(mutationConfirmationText(String(config.method || '').toLowerCase()))) {
      return Promise.reject(new axios.CanceledError('已取消操作'));
    }
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
