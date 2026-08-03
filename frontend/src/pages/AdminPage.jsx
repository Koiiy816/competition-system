import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardHeader,
  Avatar,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  AdminPanelSettings as AdminIcon,
  EmojiEvents as OrganizerIcon,
  Gavel as RefereeIcon,
  Visibility as SpectatorIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import userService from '../services/userService';
import systemService from '../services/systemService';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

// 标签面板组件
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
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

const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // 状态
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [refereeLoginEnabled, setRefereeLoginEnabled] = useState(true);
  
  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    roles: [],
    password: ''
  });
  
  // 过滤和搜索状态
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: ''
  });
  
  // 检查用户是否是管理员或主裁
  const isAdmin = user?.roles?.includes('admin');
  const isChiefReferee = user?.roles?.includes('chief_referee');
  
  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers();
      setUsers(response.data || []);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      setError('获取用户列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await systemService.getSettings();
      const refereeSetting = response.data?.find(s => s.key === 'referee_login_enabled');
      if (refereeSetting !== undefined) {
        setRefereeLoginEnabled(refereeSetting.value);
      }
    } catch (err) {
      console.error('获取设置失败:', err);
    }
  };

  useEffect(() => {
    if (!isAdmin && !isChiefReferee) {
      setLoading(false);
      return;
    }
    
    fetchUsers();
    if (isAdmin) {
      fetchSettings();
    }
  }, [isAdmin, isChiefReferee]);

  const handleToggleRefereeLogin = async (event) => {
    const newValue = event.target.checked;
    setRefereeLoginEnabled(newValue);
    try {
      await systemService.updateSetting('referee_login_enabled', newValue);
      setSuccessMessage(`裁判登录权限已${newValue ? '开启' : '关闭'}`);
    } catch (err) {
      setRefereeLoginEnabled(!newValue); // 恢复原状
      setError('更新设置失败，请稍后重试');
    }
  };
  
  // 处理标签切换
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // 处理过滤器变化
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 过滤用户
  const filteredUsers = users.filter(user => {
    const matchesSearch = !filters.search || 
      user.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      user.email.toLowerCase().includes(filters.search.toLowerCase());
    
    const matchesRole = !filters.role || 
      (user.roles && user.roles.includes(filters.role));
    
    return matchesSearch && matchesRole;
  });
  
  // 按角色分组用户
  const getUsersByRole = (role) => {
    return filteredUsers.filter(user => user.roles && user.roles.includes(role));
  };
  
  // 获取用户主要角色
  const getUserPrimaryRole = (roles) => {
    if (!Array.isArray(roles) || roles.length === 0) return '无角色';
    
    const rolePriority = ['admin', 'chief_referee', 'referee', 'checkin_clerk', 'organization', 'spectator'];
    const roleMap = {
      'admin': '管理员',
      'chief_referee': '比赛主裁判',
      'referee': '比赛裁判',
      'checkin_clerk': '检录员',
      'organization': '参赛单位',
      'spectator': '观赛者(大屏)'
    };
    
    for (const role of rolePriority) {
      if (roles.includes(role)) {
        return roleMap[role];
      }
    }
    
    return '无角色';
  };
  
  // 获取角色图标
  const getRoleIcon = (role) => {
    const roleIcons = {
      'admin': <AdminIcon />,
      'chief_referee': <RefereeIcon />,
      'referee': <RefereeIcon />,
      'checkin_clerk': <PersonIcon />,
      'organization': <SchoolIcon />,
      'spectator': <SpectatorIcon />
    };
    
    return roleIcons[role] || <PersonIcon />;
  };

  // 获取角色标签颜色
  const getRoleColor = (role) => {
    const colorMap = {
      'admin': 'error',
      'chief_referee': 'secondary',
      'referee': 'warning',
      'checkin_clerk': 'success',
      'organization': 'info',
      'spectator': 'success'
    };
    
    return colorMap[role] || 'default';
  };
  
  // 确认创建用户
  const confirmCreateUser = async () => {
    // 验证
    if (!editFormData.name || !editFormData.email || !editFormData.password) {
      setError('姓名、邮箱和密码为必填项');
      return;
    }
    
    if (editFormData.password.length < 6) {
      setError('密码长度至少需要6个字符');
      return;
    }

    try {
      setActionLoading(true);
      // 调用认证服务的注册接口来创建新用户 (将前端字段映射到后端期望的 username 和 role)
      const submitData = {
        username: editFormData.name,
        name: editFormData.name, // 同时传name以兼容
        email: editFormData.email,
        password: editFormData.password,
        role: editFormData.roles[0] || 'organization',
        roles: editFormData.roles
      };
      const response = await userService.createUser(submitData);
      
      // 更新列表，注意从 response.data 中提取数据对象
      setUsers([response.data.data || response.data, ...users]);
      setSuccessMessage('新用户创建成功');
      handleCloseDialog();
    } catch (error) {
      console.error('创建用户失败:', error);
      setError(error.message || '创建用户失败，可能该邮箱已被注册');
    } finally {
      setActionLoading(false);
    }
  };
  
  // 处理编辑用户
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditFormData({
      name: user.name || '',
      email: user.email || '',
      roles: user.roles || [],
      phone: user.profile?.phone || '',
      password: '' // 密码字段初始化为空
    });
    setDialogAction('edit');
    setDialogOpen(true);
  };
  
  // 确认编辑用户
  const confirmEditUser = async () => {
    if (!selectedUser) return;
    
    // 如果没有输入密码，则不发送密码字段
    const updateData = { ...editFormData, username: editFormData.name }; // 兼容后端需要 username 的情况
    if (!updateData.password || updateData.password.trim() === '') {
      delete updateData.password;
    } else if (updateData.password.length < 6) {
      setError('密码长度至少需要6个字符');
      return;
    }
    
    try {
      setActionLoading(true);
      const response = await userService.updateUser(selectedUser._id, updateData);
      const updatedUserData = response.data?.data || response.data || updateData;
      setUsers(users.map(u => u._id === selectedUser._id ? { ...u, ...updatedUserData } : u));
      setSuccessMessage(updateData.password ? '用户信息及密码更新成功' : '用户信息更新成功');
      handleCloseDialog();
    } catch (error) {
      console.error('更新用户失败:', error);
      setError(error.message || '更新用户信息失败，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };
  
  // 处理创建用户
  const handleCreateUser = () => {
    setSelectedUser(null);
    setEditFormData({
      name: '',
      email: '',
      roles: ['organization'], // 默认角色
      password: ''
    });
    setDialogAction('create');
    setDialogOpen(true);
  };

  // 处理删除用户
  const handleDeleteUser = (user) => {
    setSelectedUser(user);
    setDialogAction('delete');
    setDialogOpen(true);
  };
  
  // 确认删除用户
  const confirmDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      setActionLoading(true);
      await userService.deleteUser(selectedUser._id);
      setUsers(users.filter(u => u._id !== selectedUser._id));
      setSuccessMessage('用户删除成功');
      setDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('删除用户失败:', error);
      setError('删除用户失败，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };
  
  // 关闭对话框
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedUser(null);
    setDialogAction(null);
    setEditFormData({ name: '', email: '', roles: [], password: '' });
  };
  
  // 渲染用户表格
  const renderUserTable = (userList, title) => (
    <Paper sx={{ mb: 3 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">{title} ({userList.length})</Typography>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>用户</TableCell>
              <TableCell>邮箱</TableCell>
              <TableCell>角色</TableCell>
              <TableCell>注册时间</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {userList.map((user) => (
              <TableRow key={user._id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                      {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2">{user.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {user.roles && user.roles.map((role) => (
                      <Chip
                        key={role}
                        label={getUserPrimaryRole([role])}
                        color={getRoleColor(role)}
                        size="small"
                        icon={getRoleIcon(role)}
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="编辑用户">
                    <IconButton
                      size="small"
                      onClick={() => handleEditUser(user)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除用户">
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteUser(user)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {userList.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary">
                    暂无用户
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
  
  if (!isAdmin && !isChiefReferee) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">您没有权限访问此页面</Alert>
      </Box>
    );
  }
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          用户管理
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateUser}
        >
          创建用户
        </Button>
      </Box>
      
      {/* 成功消息 */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}
      
      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {/* 搜索和过滤 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="搜索用户..."
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>角色筛选</InputLabel>
              <Select
                name="role"
                value={filters.role}
                onChange={handleFilterChange}
                label="角色筛选"
              >
                <MenuItem value="">全部角色</MenuItem>
                <MenuItem value="admin">管理员</MenuItem>
                <MenuItem value="chief_referee">比赛主裁判</MenuItem>
                <MenuItem value="referee">比赛裁判</MenuItem>
                <MenuItem value="checkin_clerk">检录员</MenuItem>
                <MenuItem value="organization">参赛单位</MenuItem>
                <MenuItem value="spectator">观赛者(大屏)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
      
      {/* 视图切换标签 */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="所有用户" />
          <Tab label="按角色分组" />
          <Tab label="系统安全设置" />
        </Tabs>
      </Paper>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* 所有用户标签 */}
          <TabPanel value={tabValue} index={0}>
            {renderUserTable(filteredUsers, '所有用户')}
          </TabPanel>
          
          {/* 按角色分组标签 */}
          <TabPanel value={tabValue} index={1}>
            {renderUserTable(getUsersByRole('admin'), '管理员')}
            {renderUserTable(getUsersByRole('chief_referee'), '比赛主裁判')}
            {renderUserTable(getUsersByRole('referee'), '比赛裁判')}
            {renderUserTable(getUsersByRole('checkin_clerk'), '检录员')}
            {renderUserTable(getUsersByRole('organization'), '参赛单位')}
            {renderUserTable(getUsersByRole('spectator'), '观赛者(大屏)')}
          </TabPanel>

          {/* 系统安全设置标签 */}
          <TabPanel value={tabValue} index={2}>
            <Card sx={{ maxWidth: 600 }}>
              <CardHeader title="系统安全与访问控制" subheader="管理整个系统级别的角色登录和访问权限" />
              <Divider />
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">允许裁判登录</Typography>
                      <Typography variant="body2" color="text.secondary">
                        开启后，比赛裁判和主裁判才能登录系统。比赛结束后，可以将其关闭以防止裁判偷偷查看或修改成绩。
                      </Typography>
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={refereeLoginEnabled}
                          onChange={handleToggleRefereeLogin}
                          color="primary"
                        />
                      }
                      label={refereeLoginEnabled ? "已开启" : "已关闭"}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </TabPanel>
        </>
      )}
      
      {/* 删除确认对话框 */}
      <Dialog
        open={dialogOpen && dialogAction === 'delete'}
        onClose={handleCloseDialog}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          确认删除用户
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            您确定要删除用户 "{selectedUser?.name}" 吗？此操作不可撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={actionLoading}>
            取消
          </Button>
          <Button 
            onClick={confirmDeleteUser} 
            color="error" 
            variant="contained"
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={20} /> : '删除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 创建/编辑用户对话框 */}
      <Dialog
        open={dialogOpen && (dialogAction === 'edit' || dialogAction === 'create')}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{dialogAction === 'create' ? '创建新用户' : '编辑用户'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="姓名"
              fullWidth
              required
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            />
            <TextField
              label="邮箱"
              fullWidth
              required
              type="email"
              value={editFormData.email}
              disabled={dialogAction === 'edit'} // 创建时可填，编辑时禁用
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              helperText={dialogAction === 'edit' ? "邮箱地址作为登录账号，不可修改。" : "此邮箱将作为用户的登录账号"}
            />
            <TextField
              label={'\u8054\u7cfb\u7535\u8bdd'}
              fullWidth
              value={editFormData.phone || ''}
              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              helperText={'\u53c2\u8d5b\u5355\u4f4d\u6ce8\u518c\u65f6\u586b\u5199\u7684\u8054\u7cfb\u7535\u8bdd'}
            />
            <TextField
              label={dialogAction === 'create' ? "登录密码" : "重置密码 (选填)"}
              type="password"
              fullWidth
              required={dialogAction === 'create'}
              value={editFormData.password}
              onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
              placeholder={dialogAction === 'create' ? "请输入初始密码" : "留空则不修改密码"}
              helperText={dialogAction === 'create' ? "设置用户的初始登录密码（至少6位）" : "如果用户忘记密码，可以在此为他们设置新密码（至少6位）。"}
            />
            <FormControl fullWidth>
              <InputLabel>角色分配 (可多选)</InputLabel>
              <Select
                multiple
                value={editFormData.roles}
                onChange={(e) => setEditFormData({ ...editFormData, roles: e.target.value })}
                label="角色分配 (可多选)"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={getUserPrimaryRole([value])} size="small" color={getRoleColor(value)} />
                    ))}
                  </Box>
                )}
              >
                <MenuItem value="admin">管理员</MenuItem>
                <MenuItem value="chief_referee">比赛主裁判</MenuItem>
                <MenuItem value="referee">比赛裁判</MenuItem>
                <MenuItem value="checkin_clerk">检录员</MenuItem>
                <MenuItem value="organization">参赛单位</MenuItem>
                <MenuItem value="spectator">观赛者(大屏)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={actionLoading}>
            取消
          </Button>
          <Button 
            onClick={dialogAction === 'create' ? confirmCreateUser : confirmEditUser} 
            color="primary" 
            variant="contained"
            disabled={actionLoading || !editFormData.name || !editFormData.email || (dialogAction === 'create' && !editFormData.password)}
          >
            {actionLoading ? <CircularProgress size={20} /> : (dialogAction === 'create' ? '创建' : '保存')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPage;
