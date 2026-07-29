import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * 保护路由组件 - 用于限制未登录用户访问需要认证的页面
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 子组件
 * @param {string[]} [props.allowedRoles] - 允许访问的角色列表
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading, isInitialized } = useAuth();
  const location = useLocation();

  // 如果认证状态正在加载或未初始化，显示加载中
  if (loading || !isInitialized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>加载中...</p>
      </div>
    );
  }

  // 如果用户未登录，重定向到登录页面
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // 如果指定了允许的角色，检查用户是否有权限
  if (allowedRoles && !user.roles?.some(role => allowedRoles.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 用户已登录且有权限，渲染子组件
  return children;
};

export default ProtectedRoute;