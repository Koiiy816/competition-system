import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const initAuth = async () => {
    try {
      // 检查是否有token，如果没有则直接跳过API调用
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      // 先从localStorage恢复用户信息，避免页面刷新时显示"无角色"
      const storedUser = authService.getStoredUser();
      if (storedUser) {
        // 兼容处理：如果localStorage中存储的是包含data的包装对象（之前bug导致），提取其中的user数据
        if (storedUser.success && storedUser.data) {
          setUser(storedUser.data);
        } else {
          setUser(storedUser);
        }
        // 如果有存储的用户信息，先设置为已初始化，避免重定向
        setIsInitialized(true);
      }

      // 然后从服务器获取最新的用户信息来验证token
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          // 更新localStorage中的用户信息
          localStorage.setItem('user', JSON.stringify(currentUser));
        }
      } catch (apiError) {
        // 如果API调用失败（比如token过期），但我们有存储的用户信息
        // 只有在确实是认证错误时才清除用户状态
        if (apiError.response?.status === 401) {
          console.log('Token已过期，清除用户状态');
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        } else {
          // 对于网络错误等其他错误，保持已存储的用户状态
          console.log('网络错误，保持当前用户状态:', apiError.message);
          // 如果没有存储的用户信息，则设置为null
          if (!storedUser) {
            setUser(null);
          }
        }
      }
    } catch (error) {
      // 处理其他意外错误
      console.error('初始化认证时发生错误:', error);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (credentials) => {
    const response = await authService.login(credentials);
    setUser(response.user);
    return response;
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      // Ensure we access the user object properly based on the response structure
      if (response && response.user) {
        setUser(response.user);
      } else if (response && response.data && response.data.user) {
        setUser(response.data.user);
      } else {
        // Fallback or handle cases where user might be directly in response
        setUser(response);
      }
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isInitialized,
      login, 
      register, 
      logout, 
      updateUser, 
      isAuthenticated: isInitialized && !!user && !!localStorage.getItem('token')
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
};

export default AuthContext;