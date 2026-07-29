import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Avatar,
  CircularProgress
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EventIcon from '@mui/icons-material/Event';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useAuth } from '../contexts/AuthContext';
import competitionService from '../services/competitionService';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userCompetitions, setUserCompetitions] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // 临时添加的 getRoleName 函数，用于处理角色显示
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const competitions = await competitionService.getUserCompetitions();
        setUserCompetitions(competitions);

        setUpcomingEvents([
          {
            id: 1,
            name: '小组赛 - 第3轮',
            competition: '2023年全国大学生足球联赛',
            date: '2023-09-25 14:00',
            location: '大学城体育场'
          },
          {
            id: 2,
            name: '马拉松起跑仪式',
            competition: '城市马拉松挑战赛',
            date: '2023-10-01 07:30',
            location: '市中心广场'
          }
        ]);

      } catch (error) {
        console.error('获取仪表盘数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        控制面板
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ width: 64, height: 64, mr: 2, bgcolor: 'primary.main' }}>
                {user?.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6">{user?.name}</Typography>
                <Chip 
                  label={getRoleName(user?.roles)} 
                  size="small" 
                  color="primary" 
                  variant="outlined" 
                />
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              邮箱
            </Typography>
            <Typography variant="body1" gutterBottom>
              {user?.email}
            </Typography>
            
            <Box sx={{ mt: 3 }}>
              <Button 
                variant="outlined" 
                startIcon={<PersonIcon />}
                onClick={() => navigate('/dashboard/profile')}
                fullWidth
              >
                编辑个人资料
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                我的比赛
              </Typography>
              <Button 
                variant="text" 
                onClick={() => navigate('/competitions')}
              >
                查看全部
              </Button>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            {userCompetitions.length > 0 ? (
              <Grid container spacing={2}>
                {userCompetitions.map((competition) => (
                  <Grid item xs={12} sm={6} key={competition.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {competition.name}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Chip 
                            label={competition.status} 
                            size="small" 
                            color={competition.status === '进行中' ? 'success' : 'primary'} 
                            variant="outlined" 
                          />
                          <Typography variant="body2" color="text.secondary">
                            {getRoleName(competition.roleInCompetition)}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {competition.date}
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button size="small" onClick={() => navigate(`/competitions/${competition.id}`)}>查看详情</Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <EmojiEventsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  您还没有参加任何比赛
                </Typography>
                <Button 
                  variant="contained" 
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/competitions')}
                >
                  浏览比赛
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              即将到来的事件
            </Typography>
            
            <Divider sx={{ mb: 2 }} />
            
            {upcomingEvents.length > 0 ? (
              <List>
                {upcomingEvents.map((event) => (
                  <ListItem key={event.id} divider>
                    <ListItemIcon>
                      <EventIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={event.name}
                      secondary={
                        <React.Fragment>
                          <Typography component="span" variant="body2" color="text.primary">
                            {event.competition}
                          </Typography>
                          <br />
                          {event.date} | {event.location}
                        </React.Fragment>
                      }
                    />
                    <Button size="small" variant="outlined">
                      添加到日历
                    </Button>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  没有即将到来的事件
                </Typography>              
              </Box>
            )}
          </Paper>
        </Grid>
        
        {user?.roles?.includes('admin') && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                管理员功能
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
                <ListItem button onClick={() => navigate('/admin/participants')}>
                  <ListItemIcon>
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText primary="管理参赛者" />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        )}
        
        {(user?.roles?.includes('admin') || user?.roles?.includes('chief_referee')) && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                组织者功能
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
                <ListItem button onClick={() => navigate('/admin/competitions/create')}>
                  <ListItemIcon>
                    <EmojiEventsIcon />
                  </ListItemIcon>
                  <ListItemText primary="创建新比赛" />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        )}
        
        {user?.roles?.includes('referee') && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                裁判功能
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
                <ListItem button>
                  <ListItemIcon>
                    <AssessmentIcon />
                  </ListItemIcon>
                  <ListItemText primary="录入比赛成绩" />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        )}

        {(user?.roles?.includes('admin') || user?.roles?.includes('chief_referee') || user?.roles?.includes('checkin_clerk')) && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                检录功能
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
                <ListItem button onClick={() => navigate('/checkin')}>
                  <ListItemIcon>
                    <AssessmentIcon />
                  </ListItemIcon>
                  <ListItemText primary="进入检录界面" secondary="按场次对参赛者进行检录和取消检录" />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        )}

        {(user?.roles?.includes('organization') || user?.roles?.includes('admin')) && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                参赛单位功能
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
                <ListItem button onClick={() => navigate('/my-registrations')}>
                  <ListItemIcon>
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText primary="我的报名列表" secondary="查看和管理本单位所有已报名的参赛人员和项目" />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default DashboardPage;
