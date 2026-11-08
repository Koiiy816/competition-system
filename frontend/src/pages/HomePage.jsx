import React from 'react';
import { Box, Button, ButtonBase, Chip, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PoolIcon from '@mui/icons-material/Pool';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PARTICIPATION_SPORT_TYPES } from '../utils/competitionType';

const workspaces = [
  { key: 'trampoline', title: '蹦床赛事工作区', eyebrow: 'TRAMPOLINE', description: '按出生日期选择大网、小网个人项目，按单位组队报名蹦床操。', features: ['大网与小网项目', '蹦床操团体报名', '报名阶段无需动作代码'], color: '#047857', background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', icon: <EmojiEventsIcon sx={{ fontSize: 34 }} /> },
  { key: 'wushu', title: '武术赛事工作区', eyebrow: 'WUSHU', description: '管理武术项目、报名、检录、赛程编排、裁判评分与成绩发布。', features: ['武术项目配置', '常规赛程与打分', '成绩与奖项管理'], color: '#b45309', background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', icon: <EmojiEventsIcon sx={{ fontSize: 34 }} /> },
  { key: 'diving', title: '跳水赛事工作区', eyebrow: 'DIVING', description: '管理跳水报名、双人配对、动作表补录、分轮打分和跳水成绩。', features: ['动作表与双人配对', '五裁判分轮打分', '跳水排名与奖项'], color: '#0369a1', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', icon: <PoolIcon sx={{ fontSize: 34 }} /> }
];

function WorkspaceCard({ workspace, onOpen }) {
  return <ButtonBase onClick={onOpen} aria-label={`进入${workspace.title}`} sx={{ borderRadius: 4, width: '100%', display: 'block', textAlign: 'left' }}>
    <Paper elevation={0} sx={{ width: '100%', minHeight: 280, p: { xs: 3, sm: 4 }, borderRadius: 4, background: workspace.background, border: '1px solid', borderColor: `${workspace.color}33`, transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 16px 30px rgba(15, 23, 42, .14)' } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box><Typography variant="overline" sx={{ letterSpacing: 2, color: workspace.color, fontWeight: 800 }}>{workspace.eyebrow}</Typography><Typography variant="h4" sx={{ mt: .5, fontWeight: 800, color: '#0f172a' }}>{workspace.title}</Typography></Box>
        <Box sx={{ color: workspace.color, p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,.68)' }}>{workspace.icon}</Box>
      </Stack>
      <Typography sx={{ color: '#334155', lineHeight: 1.8, mt: 2 }}>{workspace.description}</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2.5 }}>{workspace.features.map((feature) => <Chip key={feature} label={feature} size="small" sx={{ bgcolor: 'rgba(255,255,255,.7)', color: workspace.color, fontWeight: 700 }} />)}</Stack>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: .5, color: workspace.color, fontWeight: 800, mt: 3 }}>进入工作区 <ArrowForwardIcon fontSize="small" /></Box>
    </Paper>
  </ButtonBase>;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // 访客还没有选择或获授赛事类型，不展示任何具体赛事工作区，
  // 以免把后台管理能力和不属于该单位的赛事暴露在注册前页面。
  if (!isAuthenticated) {
    return <Container maxWidth="md" sx={{ py: { xs: 5, md: 9 } }}>
      <Paper elevation={0} sx={{ overflow: 'hidden', borderRadius: 5, bgcolor: '#0f2d57', color: '#fff', textAlign: 'center' }}>
        <Box sx={{ px: { xs: 3, sm: 6 }, py: { xs: 5, sm: 7 }, background: 'radial-gradient(circle at 82% 12%, rgba(56,189,248,.32), transparent 30%), linear-gradient(135deg, #082f5f 0%, #164e8b 100%)' }}>
          <Box component="img" src="/assets/saiyitong-emblem.png" alt="赛易通" sx={{ width: 104, height: 104, objectFit: 'contain', mb: 2 }} />
          <Chip label="赛易通赛事服务平台" sx={{ color: '#e0f2fe', bgcolor: 'rgba(255,255,255,.12)', fontWeight: 700 }} />
          <Typography component="h1" sx={{ fontSize: { xs: '2rem', sm: '2.8rem' }, fontWeight: 900, lineHeight: 1.2, mt: 2 }}>让赛事报名与管理更简单</Typography>
          <Typography sx={{ fontSize: { xs: '1rem', sm: '1.15rem' }, color: '#dbeafe', mt: 2, lineHeight: 1.8, mx: 'auto', maxWidth: 620 }}>
            登录后，系统会根据参赛单位已开通的赛事类型，展示对应的赛事、报名和服务。
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" spacing={1.5} sx={{ mt: 4 }}>
            <Button variant="contained" size="large" onClick={() => navigate('/auth/login')} sx={{ bgcolor: '#fff', color: '#0f3b73', fontWeight: 800, '&:hover': { bgcolor: '#e0f2fe' } }}>登录</Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/auth/register')} sx={{ borderColor: 'rgba(255,255,255,.65)', color: '#fff', fontWeight: 700 }}>注册参赛单位</Button>
          </Stack>
        </Box>
      </Paper>
      <Paper variant="outlined" sx={{ mt: 3, p: 3, borderRadius: 3, textAlign: 'center' }}>
        <Typography fontWeight={800}>已有参赛单位账号？</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>请登录后查看本单位可参与的赛事与相关服务。</Typography>
      </Paper>
    </Container>;
  }

  const isAdmin = user?.roles?.includes('admin');
  const isOrganizationPortal = user?.roles?.includes('organization') && !isAdmin;
  const selectedSportTypes = user?.sportTypes || [];
  const visibleWorkspaces = isOrganizationPortal && selectedSportTypes.length > 0
    ? workspaces.filter((workspace) => selectedSportTypes.includes(workspace.key))
    : workspaces;
  const selectedLabels = selectedSportTypes
    .map((type) => PARTICIPATION_SPORT_TYPES.find((sport) => sport.value === type)?.label?.replace('（筹备中）', ''))
    .filter(Boolean);

  return <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
    <Paper elevation={0} sx={{ overflow: 'hidden', borderRadius: 5, bgcolor: '#0f2d57', color: '#fff', mb: 5 }}>
      <Box sx={{ p: { xs: 3, sm: 5, md: 6 }, background: 'radial-gradient(circle at 85% 15%, rgba(56,189,248,.32), transparent 32%), linear-gradient(135deg, #082f5f 0%, #164e8b 100%)' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Chip label={isOrganizationPortal ? '参赛单位服务台' : '赛事管理工作台'} sx={{ color: '#e0f2fe', bgcolor: 'rgba(255,255,255,.12)', fontWeight: 700 }} />
            <Typography component="h1" sx={{ fontSize: { xs: '2rem', sm: '2.8rem' }, fontWeight: 900, lineHeight: 1.2, mt: 2 }}>
              {isOrganizationPortal ? '查看适合本单位的赛事服务' : '先选赛事类型，再进入正确的工作区'}
            </Typography>
            <Typography sx={{ fontSize: { xs: '1rem', sm: '1.15rem' }, color: '#dbeafe', mt: 2, lineHeight: 1.8, maxWidth: 650 }}>
              {isOrganizationPortal
                ? (selectedLabels.length ? `本单位已开通：${selectedLabels.join('、')}。仅展示对应类型的赛事、报名与服务。` : '管理员尚未设置本单位的赛事类型，当前可先浏览公开赛事。')
                : '武术和跳水拥有独立流程与规则。这里不会再把不同类型的报名、动作表和计分功能混在一起。'}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3.5 }}>
              <Button variant="contained" size="large" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/competitions')} sx={{ bgcolor: '#fff', color: '#0f3b73', fontWeight: 800, '&:hover': { bgcolor: '#e0f2fe' } }}>查看全部赛事</Button>
              {isAdmin && <Button variant="outlined" size="large" startIcon={<AddCircleOutlineIcon />} onClick={() => navigate('/admin/competitions/create')} sx={{ borderColor: 'rgba(255,255,255,.65)', color: '#fff', fontWeight: 700 }}>创建赛事</Button>}
            </Stack>
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: { xs: 'none', md: 'block' } }}><Box component="img" src="/assets/saiyitong-logo.png" alt="赛易通 Logo" sx={{ display: 'block', width: '100%', maxWidth: 245, mx: 'auto', borderRadius: 4, mixBlendMode: 'screen' }} /></Grid>
        </Grid>
      </Box>
    </Paper>
    <Box sx={{ mb: 2 }}><Typography variant="h4" component="h2" fontWeight={900}>{isOrganizationPortal ? '我的赛事服务' : '选择赛事工作区'}</Typography><Typography color="text.secondary" sx={{ mt: .75 }}>{isOrganizationPortal ? '只显示本单位可参与的赛事类型。' : '每个入口只展示该赛事类型适用的管理功能。'}</Typography></Box>
    <Grid container spacing={3}>{visibleWorkspaces.map((workspace) => <Grid item xs={12} md={visibleWorkspaces.length === 1 ? 12 : 6} key={workspace.key}><WorkspaceCard workspace={workspace} onOpen={() => navigate(`/competitions?sportType=${workspace.key}`)} /></Grid>)}</Grid>
    <Paper variant="outlined" sx={{ mt: 4, p: { xs: 2.5, sm: 3 }, borderRadius: 3, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
      <Box><Typography fontWeight={800}>还没有对应类型的赛事？</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{isAdmin ? '创建赛事时先确定类型，系统会自动启用对应工作流程。' : '可先进入赛事大厅浏览已发布的武术或跳水赛事。'}</Typography></Box>
      <Button variant="contained" onClick={() => navigate(isAdmin ? '/admin/competitions/create' : '/competitions')}>{isAdmin ? '创建赛事' : '浏览赛事'}</Button>
    </Paper>
  </Container>;
}
