import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { 
  AppBar, 
  Box, 
  Toolbar, 
  Typography, 
  Button, 
  Container, 
  IconButton, 
  Menu, 
  MenuItem, 
  Avatar, 
  Divider,
  ListItemIcon,
  Tooltip
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useAuth } from '../contexts/AuthContext';

const MainLayout = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleMenuClick = (path) => {
    navigate(path);
    handleCloseNavMenu();
  };

  const handleLogout = () => {
    handleCloseUserMenu();
    logout();
  };

  // 导航菜单项 - 根据用户角色显示不同菜单
  const getPages = () => {
    const pages = [
      { title: '首页', path: '/' },
      { title: '比赛', path: '/competitions' },
    ];

    const canViewScheduleResults = !isAuthenticated || (user?.roles && user.roles.some(role => ['organization', 'admin', 'referee', 'chief_referee', 'checkin_clerk'].includes(role)));

    // 3. 赛程
    if (canViewScheduleResults) {
      pages.push({ title: '赛程', path: '/schedule' });
    }

    if (isAuthenticated && user?.roles) {
      // 4. 参赛者管理 (管理员)
      if (user.roles.includes('admin')) {
        pages.push({ title: '参赛者管理', path: '/admin/participants' });
      }

      if (user.roles.includes('admin') || user.roles.includes('chief_referee') || user.roles.includes('checkin_clerk')) {
        pages.push({ title: '检录', path: '/checkin' });
      }
      
      // 裁判专用入口 (主裁判、裁判)
      if (user.roles.includes('admin') || user.roles.includes('chief_referee') || user.roles.includes('referee')) {
        pages.push({ title: '裁判打分', path: '/competitions' }); // 临时入口，后续可改成单独的赛程列表
      }
    }

    // 5. 成绩 (管理员和观赛者可见)
    if (isAuthenticated && user?.roles && (user.roles.includes('admin') || user.roles.includes('spectator'))) {
      pages.push({ title: '成绩', path: '/results' });
    }

    if (isAuthenticated && user?.roles) {
      // 6. 我的报名 (参赛单位)
      if (user.roles.includes('organization') || user.roles.includes('admin')) {
        pages.push({ title: '我的报名', path: '/my-registrations' });
      }

      // 7. 创建比赛 (管理员)
      if (user.roles.includes('admin')) {
        pages.push({ title: '创建比赛', path: '/admin/competitions/create' });
      }

      // 7. 后台管理 (管理员)
      if (user.roles.includes('admin')) {
        pages.push({ title: '后台管理', path: '/admin' });
      }

      // 8. 控制面板
      pages.push({ title: '控制面板', path: '/dashboard' });
    }

    return pages;
  };

  const pages = getPages();

  // 获取用户名首字母作为头像
  const getAvatarText = () => {
    if (user && user.name) {
      return user.name.charAt(0).toUpperCase();
    }
    return '?';
  };

  // 获取用户角色的中文名称
  const getRoleName = (roles) => {
    if (!Array.isArray(roles) || roles.length === 0) {
      return '无角色';
    }

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

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh',
      '@media print': {
        display: 'block !important',
        minHeight: 'auto !important',
        height: 'auto !important'
      }
    }}>
      <AppBar position="static" sx={{ display: { print: 'none' } }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {/* Logo for desktop */}
            <SportsSoccerIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
            <Typography
              variant="h6"
              noWrap
              component={RouterLink}
              to="/"
              sx={{
                mr: 2,
                display: { xs: 'none', md: 'flex' },
                fontFamily: 'monospace',
                fontWeight: 700,
                letterSpacing: '.3rem',
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              赛易通
            </Typography>

            {/* Mobile menu */}
            <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
              <IconButton
                size="large"
                aria-label="menu"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleOpenNavMenu}
                color="inherit"
              >
                <MenuIcon />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorElNav}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
                open={Boolean(anchorElNav)}
                onClose={handleCloseNavMenu}
                sx={{
                  display: { xs: 'block', md: 'none' },
                }}
              >
                {pages.map((page) => (
                  <MenuItem key={page.title} onClick={() => handleMenuClick(page.path)}>
                    <Typography textAlign="center">{page.title}</Typography>
                  </MenuItem>
                ))}
              </Menu>
            </Box>

            {/* Logo for mobile */}
            <SportsSoccerIcon sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }} />
            <Typography
              variant="h5"
              noWrap
              component={RouterLink}
              to="/"
              sx={{
                mr: 2,
                display: { xs: 'flex', md: 'none' },
                flexGrow: 1,
                fontFamily: 'monospace',
                fontWeight: 700,
                letterSpacing: '.3rem',
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              赛易通
            </Typography>

            {/* Desktop menu */}
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
              {pages.map((page) => (
                <Button
                  key={page.title}
                  onClick={() => handleMenuClick(page.path)}
                  sx={{ my: 2, color: 'white', display: 'block' }}
                >
                  {page.title}
                </Button>
              ))}
            </Box>

            {/* User menu */}
            <Box sx={{ flexGrow: 0 }}>
              {isAuthenticated ? (
                <>
                  <Tooltip title="打开设置">
                    <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                      <Avatar alt={user?.name}>
                        {getAvatarText()}
                      </Avatar>
                    </IconButton>
                  </Tooltip>
                  <Menu
                    sx={{ mt: '45px' }}
                    id="menu-appbar"
                    anchorEl={anchorElUser}
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    open={Boolean(anchorElUser)}
                    onClose={handleCloseUserMenu}
                  >
                    <MenuItem disabled>
                      <Typography textAlign="center">
                        {user?.name} ({getRoleName(user?.roles)})
                      </Typography>
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={() => handleMenuClick('/dashboard')}>
                      <ListItemIcon>
                        <DashboardIcon fontSize="small" />
                      </ListItemIcon>
                      <Typography textAlign="center">控制面板</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => handleMenuClick('/dashboard/profile')}>
                      <ListItemIcon>
                        <PersonIcon fontSize="small" />
                      </ListItemIcon>
                      <Typography textAlign="center">个人资料</Typography>
                    </MenuItem>
                    
                    {/* 管理员菜单项 */}
                    {user?.roles?.includes('admin') && (
                      <>
                        <MenuItem onClick={() => handleMenuClick('/admin')}>
                          <ListItemIcon>
                            <AdminPanelSettingsIcon fontSize="small" />
                          </ListItemIcon>
                          <Typography textAlign="center">管理员面板</Typography>
                        </MenuItem>
                        <MenuItem onClick={() => handleMenuClick('/admin/competitions/create')}>
                          <ListItemIcon>
                            <EmojiEventsIcon fontSize="small" />
                          </ListItemIcon>
                          <Typography textAlign="center">创建比赛</Typography>
                        </MenuItem>
                      </>
                    )}
                    
                    <Divider />
                    <MenuItem onClick={handleLogout}>
                      <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                      </ListItemIcon>
                      <Typography textAlign="center">退出登录</Typography>
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <>
                  <Button color="inherit" onClick={() => navigate('/auth/login')}>登录</Button>
                  <Button color="inherit" onClick={() => navigate('/auth/register')}>注册</Button>
                </>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Main content */}
      <Box component="main" sx={{ 
        flexGrow: 1,
        '@media print': {
          display: 'block !important',
          height: 'auto !important'
        }
      }}>
        <Container 
          maxWidth={location.pathname.includes('/admin/participants') ? false : 'lg'} 
          sx={{ 
            mt: 4, 
            mb: 4,
            '@media print': {
              maxWidth: 'none !important',
              width: '100% !important',
              margin: '0 !important',
              padding: '0 !important'
            }
          }}
        >
          <Outlet />
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          backgroundColor: (theme) => theme.palette.grey[200],
          display: { print: 'none' }
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            {'© '}
            {new Date().getFullYear()}
            {' 赛易通. 保留所有权利。'}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default MainLayout;
