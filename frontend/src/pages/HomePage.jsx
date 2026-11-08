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

const rolePriority = ['admin', 'chief_referee', 'referee', 'checkin_clerk', 'organization', 'spectator'];
const roleHomeContent = {
  admin: {
    badge: '赛事管理工作台',
    title: '统一管理赛事与现场工作',
    description: '从赛事工作区进入专项流程，同时可随时处理参赛者、检录、裁判打分、成绩与后台管理。',
    primaryAction: { label: '查看全部赛事', path: '/competitions' },
    secondaryAction: { label: '创建比赛', path: '/admin/competitions/create' },
    sectionTitle: '选择赛事工作区',
    sectionDescription: '工作区用于进入对应项目的专项流程；上方导航仍保留全部管理员功能。'
  },
  organization: {
    badge: '参赛单位服务台',
    title: '查看适合本单位的赛事服务',
    description: '系统会根据本单位已开通的赛事类型，展示对应的赛事、报名和服务。',
    primaryAction: { label: '查看全部赛事', path: '/competitions' },
    sectionTitle: '我的赛事服务',
    sectionDescription: '只显示本单位可参与的赛事类型。'
  },
  chief_referee: {
    badge: '比赛主裁判工作台',
    title: '统筹赛程、检录与裁判工作',
    description: '在同一入口处理赛程安排、检录进度、裁判打分和动作表相关工作。',
    primaryAction: { label: '查看赛程', path: '/schedule' },
    secondaryAction: { label: '进入裁判打分', path: '/competitions' },
    sectionTitle: '常用执裁功能',
    sectionDescription: '仅展示主裁判当前可使用的工作入口。'
  },
  referee: {
    badge: '比赛裁判工作台',
    title: '查看赛程并完成裁判打分',
    description: '按赛事安排进入对应场次，完成裁判打分并查询蹦床专项动作资料。',
    primaryAction: { label: '进入裁判打分', path: '/competitions' },
    secondaryAction: { label: '查看赛程', path: '/schedule' },
    sectionTitle: '常用裁判功能',
    sectionDescription: '仅展示裁判当前可使用的工作入口。'
  },
  checkin_clerk: {
    badge: '检录工作台',
    title: '快速核验选手到场状态',
    description: '先查看赛事赛程，再进入检录页面完成到场、缺席等状态确认。',
    primaryAction: { label: '进入检录', path: '/checkin' },
    secondaryAction: { label: '查看赛程', path: '/schedule' },
    sectionTitle: '常用检录功能',
    sectionDescription: '仅展示检录员当前可使用的工作入口。'
  },
  spectator: {
    badge: '赛事观赛中心',
    title: '查看赛事成绩与现场展示',
    description: '浏览已发布的比赛成绩，并按赛事打开对应的大屏展示页面。',
    primaryAction: { label: '查看成绩', path: '/results' },
    sectionTitle: '观赛入口',
    sectionDescription: '仅展示观赛者当前可使用的内容。'
  }
};

const roleQuickLinks = {
  chief_referee: [
    { title: '赛事赛程', description: '查看赛程安排与比赛场次。', path: '/schedule', color: '#245fa6' },
    { title: '检录管理', description: '确认选手到场、缺席等检录状态。', path: '/checkin', color: '#0f766e' },
    { title: '裁判打分', description: '进入赛事场次并完成评分。', path: '/competitions', color: '#7c3aed' },
    { title: '动作资料', description: '补录或查询跳水、蹦床专项动作资料。', path: '/diving-action-plans', color: '#0369a1' }
  ],
  referee: [
    { title: '裁判打分', description: '进入赛事场次并完成评分。', path: '/competitions', color: '#7c3aed' },
    { title: '赛事赛程', description: '查看当前比赛的场次安排。', path: '/schedule', color: '#245fa6' },
    { title: '蹦床动作表', description: '补录或查询蹦床专项动作资料。', path: '/trampoline-action-plans', color: '#047857' }
  ],
  checkin_clerk: [
    { title: '检录管理', description: '核验到场选手并更新检录状态。', path: '/checkin', color: '#0f766e' },
    { title: '赛事赛程', description: '查看场次、时间和参赛安排。', path: '/schedule', color: '#245fa6' }
  ],
  spectator: [
    { title: '赛事成绩', description: '查看已发布的比赛成绩与排名。', path: '/results', color: '#7c3aed' }
  ]
};

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

function QuickAccessCard({ item, onOpen }) {
  return <ButtonBase onClick={onOpen} aria-label={`进入${item.title}`} sx={{ borderRadius: 3, width: '100%', display: 'block', textAlign: 'left' }}>
    <Paper elevation={0} sx={{ width: '100%', minHeight: 170, p: 3, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #d8e1ec', transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 14px 28px rgba(15, 23, 42, .12)' } }}>
      <Typography variant="overline" sx={{ letterSpacing: 1.6, color: item.color, fontWeight: 800 }}>QUICK ACCESS</Typography>
      <Typography variant="h5" sx={{ mt: .5, fontWeight: 800, color: '#102a43' }}>{item.title}</Typography>
      <Typography sx={{ color: '#526475', lineHeight: 1.7, mt: 1 }}>{item.description}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: .5, color: item.color, fontWeight: 800, mt: 2 }}>进入功能 <ArrowForwardIcon fontSize="small" /></Box>
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
      <Paper elevation={0} sx={{ overflow: 'hidden', borderRadius: 5, bgcolor: '#f8fafc', color: '#102a43', textAlign: 'center', border: '1px solid #d8e1ec', boxShadow: '0 18px 40px rgba(15, 23, 42, .10)' }}>
        <Box sx={{ px: { xs: 3, sm: 6 }, py: { xs: 5, sm: 7 }, background: 'radial-gradient(circle at 84% 12%, rgba(14, 116, 144, .10), transparent 27%), radial-gradient(circle at 14% 88%, rgba(245, 158, 11, .10), transparent 28%), #f8fafc' }}>
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={1.25} sx={{ minHeight: 74 }}>
            <Box component="img" src="/assets/saiyitong-emblem.png" alt="赛易通" sx={{ display: 'block', width: 74, height: 74, objectFit: 'contain', flex: '0 0 auto' }} />
            <Chip label="赛易通赛事服务平台" sx={{ color: '#34516f', bgcolor: '#e8eef5', border: '1px solid #cbd7e5', fontWeight: 800, height: 32 }} />
          </Stack>
          <Typography component="h1" sx={{ fontSize: { xs: '2rem', sm: '2.8rem' }, fontWeight: 900, lineHeight: 1.2, mt: 2.5 }}>让赛事报名与管理更简单</Typography>
          <Typography sx={{ fontSize: { xs: '1rem', sm: '1.15rem' }, color: '#526475', mt: 2, lineHeight: 1.8, mx: 'auto', maxWidth: 620 }}>
            登录后，系统会根据参赛单位已开通的赛事类型，展示对应的赛事、报名和服务。
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" spacing={1.5} sx={{ mt: 4 }}>
            <Button variant="contained" size="large" onClick={() => navigate('/auth/login')} sx={{ bgcolor: '#245fa6', fontWeight: 800, '&:hover': { bgcolor: '#174b86' } }}>登录</Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/auth/register')} sx={{ borderColor: '#7d9bbb', color: '#245fa6', fontWeight: 700, '&:hover': { borderColor: '#245fa6', bgcolor: '#edf4fb' } }}>注册参赛单位</Button>
          </Stack>
        </Box>
      </Paper>
      <Paper variant="outlined" sx={{ mt: 3, p: 3, borderRadius: 3, textAlign: 'center' }}>
        <Typography fontWeight={800}>已有参赛单位账号？</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>请登录后查看本单位可参与的赛事与相关服务。</Typography>
      </Paper>
    </Container>;
  }

  const primaryRole = rolePriority.find((role) => user?.roles?.includes(role)) || 'spectator';
  const isAdmin = primaryRole === 'admin';
  const isOrganizationPortal = primaryRole === 'organization';
  const roleContent = roleHomeContent[primaryRole];
  const selectedSportTypes = user?.sportTypes || [];
  const visibleWorkspaces = isOrganizationPortal && selectedSportTypes.length > 0
    ? workspaces.filter((workspace) => selectedSportTypes.includes(workspace.key))
    : workspaces;
  const selectedLabels = selectedSportTypes
    .map((type) => PARTICIPATION_SPORT_TYPES.find((sport) => sport.value === type)?.label?.replace('（筹备中）', ''))
    .filter(Boolean);

  const usesWorkspaceCards = isAdmin || isOrganizationPortal;
  const quickLinks = roleQuickLinks[primaryRole] || [];
  const description = isOrganizationPortal && selectedLabels.length
    ? `本单位已开通：${selectedLabels.join('、')}。${roleContent.description}`
    : roleContent.description;

  return <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
    <Paper elevation={0} sx={{ overflow: 'hidden', borderRadius: 5, bgcolor: '#f8fafc', color: '#102a43', textAlign: 'center', border: '1px solid #d8e1ec', boxShadow: '0 18px 40px rgba(15, 23, 42, .10)', mb: 5 }}>
      <Box sx={{ px: { xs: 3, sm: 6 }, py: { xs: 5, sm: 6 }, background: 'radial-gradient(circle at 84% 12%, rgba(14, 116, 144, .10), transparent 27%), radial-gradient(circle at 14% 88%, rgba(245, 158, 11, .10), transparent 28%), #f8fafc' }}>
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={1.25} sx={{ minHeight: 74 }}>
          <Box component="img" src="/assets/saiyitong-emblem.png" alt="赛易通" sx={{ display: 'block', width: 74, height: 74, objectFit: 'contain', flex: '0 0 auto' }} />
          <Chip label={roleContent.badge} sx={{ color: '#34516f', bgcolor: '#e8eef5', border: '1px solid #cbd7e5', fontWeight: 800, height: 32 }} />
        </Stack>
        <Typography component="h1" sx={{ fontSize: { xs: '2rem', sm: '2.8rem' }, fontWeight: 900, lineHeight: 1.2, mt: 2.5 }}>{roleContent.title}</Typography>
        <Typography sx={{ fontSize: { xs: '1rem', sm: '1.15rem' }, color: '#526475', mt: 2, lineHeight: 1.8, mx: 'auto', maxWidth: 720 }}>{description}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" spacing={1.5} sx={{ mt: 4 }}>
          <Button variant="contained" size="large" endIcon={<ArrowForwardIcon />} onClick={() => navigate(roleContent.primaryAction.path)} sx={{ bgcolor: '#245fa6', fontWeight: 800, '&:hover': { bgcolor: '#174b86' } }}>{roleContent.primaryAction.label}</Button>
          {roleContent.secondaryAction && <Button variant="outlined" size="large" startIcon={isAdmin ? <AddCircleOutlineIcon /> : undefined} onClick={() => navigate(roleContent.secondaryAction.path)} sx={{ borderColor: '#7d9bbb', color: '#245fa6', fontWeight: 700, '&:hover': { borderColor: '#245fa6', bgcolor: '#edf4fb' } }}>{roleContent.secondaryAction.label}</Button>}
        </Stack>
      </Box>
    </Paper>
    <Box sx={{ mb: 2 }}><Typography variant="h4" component="h2" fontWeight={900}>{roleContent.sectionTitle}</Typography><Typography color="text.secondary" sx={{ mt: .75 }}>{roleContent.sectionDescription}</Typography></Box>
    {usesWorkspaceCards ? <Grid container spacing={3}>{visibleWorkspaces.map((workspace) => <Grid item xs={12} md={visibleWorkspaces.length === 1 ? 12 : 6} key={workspace.key}><WorkspaceCard workspace={workspace} onOpen={() => navigate(`/competitions?sportType=${workspace.key}&workspace=${workspace.key}`)} /></Grid>)}</Grid> : <Grid container spacing={3}>{quickLinks.map((item) => <Grid item xs={12} sm={6} key={item.title}><QuickAccessCard item={item} onOpen={() => navigate(item.path)} /></Grid>)}</Grid>}
    {usesWorkspaceCards && <Paper variant="outlined" sx={{ mt: 4, p: { xs: 2.5, sm: 3 }, borderRadius: 3, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
      <Box><Typography fontWeight={800}>还没有对应类型的赛事？</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{isAdmin ? '创建赛事时先确定类型，系统会自动启用对应工作流程。' : '可先进入赛事大厅浏览已发布的赛事。'}</Typography></Box>
      <Button variant="contained" onClick={() => navigate(isAdmin ? '/admin/competitions/create' : '/competitions')}>{isAdmin ? '创建赛事' : '浏览赛事'}</Button>
    </Paper>}
  </Container>;
}
