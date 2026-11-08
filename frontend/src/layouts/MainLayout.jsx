import React, { useEffect, useState } from 'react';
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
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useAuth } from '../contexts/AuthContext';
import participantService from '../services/participantService';
import { isDivingCompetition } from '../utils/competitionType';

const isDivingRegistration = (participant) => isDivingCompetition(participant?.competition);

const BrandLogo = ({ mobile = false }) => (
  <Box
    component={RouterLink}
    to="/"
    aria-label="赛易通首页"
    sx={{
      width: mobile ? 42 : 76,
      height: mobile ? 40 : 64,
      mr: mobile ? 0 : 1,
      display: mobile ? { xs: 'flex', md: 'none' } : { xs: 'none', md: 'flex' },
      alignItems: 'center',
      flexShrink: 0,
    }}
  >
    <Box
      component="img"
      src="/assets/saiyitong-emblem.png"
      alt="赛易通"
      sx={{
        width: mobile ? 40 : 58,
        height: mobile ? 40 : 58,
        objectFit: 'contain',
      }}
    />
  </Box>
);

const MainLayout = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [hasDivingRegistration, setHasDivingRegistration] = useState(false);

  const isAdmin = Boolean(user?.roles?.includes('admin'));
  const hasDivingAccess = isAdmin || Boolean(user?.sportTypes?.includes('diving')) || hasDivingRegistration;
  const hasTrampolineAccess = isAdmin || Boolean(user?.sportTypes?.includes('trampoline'));

  useEffect(() => {
    let cancelled = false;

    // 管理员拥有完整入口；普通参赛单位则以本人是否已有跳水报名来决定。
    if (!isAuthenticated || isAdmin || !user?.roles?.includes('organization')) {
      setHasDivingRegistration(false);
      return () => { cancelled = true; };
    }

    participantService.getMyParticipations()
      .then((response) => {
        if (!cancelled) setHasDivingRegistration((response.data || []).some(isDivingRegistration));
      })
      .catch(() => {
        if (!cancelled) setHasDivingRegistration(false);
      });

    return () => { cancelled = true; };
  }, [isAdmin, isAuthenticated, user?.roles, user?.sportTypes]);

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
    if (!isAuthenticated) {
      return [{ title: '首页', path: '/' }];
    }

    const pages = [
      { title: '首页', path: '/' },
    ];

    const canViewScheduleResults = user?.roles && user.roles.some(role => ['organization', 'admin', 'referee', 'chief_referee', 'checkin_clerk'].includes(role));

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

      if (isAdmin || (user.roles.includes('organization') && hasDivingAccess)) {
        pages.push({ title: '补录跳水动作表', path: '/diving-action-plans' });
      }

      if (user.roles.some((role) => ['admin', 'chief_referee', 'referee'].includes(role)) || (user.roles.includes('organization') && hasTrampolineAccess)) {
        pages.push({ title: '补录蹦床动作表', path: '/trampoline-action-plans' });
      }

      if (user.roles.some((role) => ['admin', 'chief_referee', 'referee'].includes(role)) || (user.roles.includes('organization') && hasTrampolineAccess)) {
        pages.push({ title: '蹦床难度系数表', path: '/trampoline-difficulties' });
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
      <AppBar
        position="static"
        sx={{
          display: { print: 'none' },
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          color: 'primary.dark',
          borderBottom: '1px solid',
          borderColor: 'primary.light',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ position: 'relative' }}>
            {/* Logo for desktop */}
            <BrandLogo />
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
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                display: { xs: 'flex', md: 'none' },
                alignItems: 'center',
              }}
            >
              <BrandLogo mobile />
              <Typography noWrap sx={{ ml: 1, fontWeight: 700, color: 'inherit' }}>
                赛易通
              </Typography>
            </Box>
            {/* Desktop menu */}
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
              {pages.map((page) => (
                <Button
                  key={page.title}
                  onClick={() => handleMenuClick(page.path)}
                  sx={{ my: 2, color: 'inherit', display: 'block' }}
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
        {location.pathname.startsWith('/admin') && (
          <Box
            component="img"
            src="/assets/saiyitong-logo.png"
            alt=""
            aria-hidden="true"
            sx={{ position: 'fixed', right: 20, bottom: 20, width: 56, opacity: 0.14, pointerEvents: 'none', mixBlendMode: 'multiply', zIndex: 1 }}
          />
        )}
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
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 24, height: 22, overflow: 'hidden' }}>
              <Box component="img" src="/assets/saiyitong-logo.png" alt="赛易通" sx={{ width: 32, maxWidth: 'none', transform: 'translate(-4px, -2px)', mixBlendMode: 'multiply' }} />
            </Box>
            <Typography variant="body2" color="text.secondary" align="center">
            {'© '}
            {new Date().getFullYear()}
            {' 赛易通. 保留所有权利。'}
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default MainLayout;
