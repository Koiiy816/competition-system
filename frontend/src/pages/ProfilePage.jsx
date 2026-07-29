import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Avatar,
  Divider,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Save, Upload } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import userService from '../services/userService';
import authService from '../services/authService';

// 标签面板组件
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // 个人资料表单状态
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.profile?.phone || '',
    address: user?.profile?.address || '',
    organization: user?.profile?.organization || '',
    bio: user?.profile?.bio || ''
  });
  
  // 密码表单状态
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // 表单错误状态
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  
  // 密码可见性状态
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // 处理标签切换
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    // 切换标签时清除消息
    setSuccess('');
    setError('');
  };
  
  // 处理个人资料表单变更
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
    // 清除错误
    if (profileErrors[name]) {
      setProfileErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  // 处理密码表单变更
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    // 清除错误
    if (passwordErrors[name]) {
      setPasswordErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  // 验证个人资料表单
  const validateProfileForm = () => {
    const errors = {};
    if (!profileData.name) errors.name = '请输入姓名';
    if (!profileData.email) errors.email = '请输入邮箱';
    else if (!/\S+@\S+\.\S+/.test(profileData.email)) errors.email = '请输入有效的邮箱地址';
    
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // 验证密码表单
  const validatePasswordForm = () => {
    const errors = {};
    if (!passwordData.currentPassword) errors.currentPassword = '请输入当前密码';
    if (!passwordData.newPassword) errors.newPassword = '请输入新密码';
    else if (passwordData.newPassword.length < 6) errors.newPassword = '密码长度至少为6个字符';
    if (!passwordData.confirmPassword) errors.confirmPassword = '请确认新密码';
    else if (passwordData.newPassword !== passwordData.confirmPassword) errors.confirmPassword = '两次输入的密码不一致';
    
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // 提交个人资料表单
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!validateProfileForm()) return;
    
    setLoading(true);
    setSuccess('');
    setError('');
    
    try {
      const updatedProfile = {
        name: profileData.name,
        email: profileData.email,
        profile: {
          phone: profileData.phone,
          address: profileData.address,
          organization: profileData.organization,
          bio: profileData.bio
        }
      };
      
      const response = await userService.updateProfile(updatedProfile);
      updateUser(response.data);
      setSuccess('个人资料更新成功');
    } catch (error) {
      setError(error.message || '更新个人资料失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 提交密码表单
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    
    setLoading(true);
    setSuccess('');
    setError('');
    
    try {
      await authService.updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      // 清空密码表单
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setSuccess('密码更新成功');
    } catch (error) {
      setError(error.message || '更新密码失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 处理头像上传
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }
    
    // 检查文件大小（限制为2MB）
    if (file.size > 2 * 1024 * 1024) {
      setError('图片大小不能超过2MB');
      return;
    }
    
    setLoading(true);
    setSuccess('');
    setError('');
    
    // 在实际应用中，这里会调用API上传头像
    // 模拟上传成功
    setTimeout(() => {
      setSuccess('头像上传成功');
      setLoading(false);
    }, 1000);
  };
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        个人资料
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                mx: 'auto',
                mb: 2,
                bgcolor: 'primary.main',
                fontSize: '3rem'
              }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
            
            <Typography variant="h6" gutterBottom>
              {user?.name}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {user?.email}
            </Typography>
            
            <Button
              variant="outlined"
              component="label"
              startIcon={<Upload />}
              sx={{ mt: 2 }}
              disabled={loading}
            >
              上传头像
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </Button>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Paper sx={{ width: '100%' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="基本信息" />
              <Tab label="修改密码" />
            </Tabs>
            
            {/* 成功或错误消息 */}
            {success && (
              <Alert severity="success" sx={{ mx: 3, mt: 2 }}>
                {success}
              </Alert>
            )}
            
            {error && (
              <Alert severity="error" sx={{ mx: 3, mt: 2 }}>
                {error}
              </Alert>
            )}
            
            {/* 基本信息表单 */}
            <TabPanel value={tabValue} index={0}>
              <form onSubmit={handleProfileSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="姓名"
                      name="name"
                      value={profileData.name}
                      onChange={handleProfileChange}
                      error={!!profileErrors.name}
                      helperText={profileErrors.name}
                      disabled={loading}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="邮箱"
                      name="email"
                      type="email"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      error={!!profileErrors.email}
                      helperText={profileErrors.email}
                      disabled={loading}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="电话"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleProfileChange}
                      disabled={loading}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="组织/学校"
                      name="organization"
                      value={profileData.organization}
                      onChange={handleProfileChange}
                      disabled={loading}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="地址"
                      name="address"
                      value={profileData.address}
                      onChange={handleProfileChange}
                      disabled={loading}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="个人简介"
                      name="bio"
                      value={profileData.bio}
                      onChange={handleProfileChange}
                      multiline
                      rows={4}
                      disabled={loading}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<Save />}
                      disabled={loading}
                    >
                      {loading ? <CircularProgress size={24} /> : '保存更改'}
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </TabPanel>
            
            {/* 修改密码表单 */}
            <TabPanel value={tabValue} index={1}>
              <form onSubmit={handlePasswordSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="当前密码"
                      name="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      error={!!passwordErrors.currentPassword}
                      helperText={passwordErrors.currentPassword}
                      disabled={loading}
                      required
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              edge="end"
                              disabled={loading}
                            >
                              {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="新密码"
                      name="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      error={!!passwordErrors.newPassword}
                      helperText={passwordErrors.newPassword}
                      disabled={loading}
                      required
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              edge="end"
                              disabled={loading}
                            >
                              {showNewPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="确认新密码"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      error={!!passwordErrors.confirmPassword}
                      helperText={passwordErrors.confirmPassword}
                      disabled={loading}
                      required
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              edge="end"
                              disabled={loading}
                            >
                              {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      disabled={loading}
                    >
                      {loading ? <CircularProgress size={24} /> : '更新密码'}
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </TabPanel>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;