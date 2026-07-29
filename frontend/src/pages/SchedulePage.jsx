import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import {
  Event as EventIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  People as PeopleIcon,
  CalendarToday as CalendarIcon,
  Shuffle as ShuffleIcon,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import Collapse from '@mui/material/Collapse';
import scheduleService from '../services/scheduleService';
import competitionService from '../services/competitionService';
import { useAuth } from '../contexts/AuthContext';

// 标签面板组件
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`schedule-tabpanel-${index}`}
      aria-labelledby={`schedule-tab-${index}`}
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

const SchedulePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // 状态
  const [schedules, setSchedules] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  
  // 从 sessionStorage 初始化页码，实现返回时记住页码
  const [datePage, setDatePage] = useState(() => {
    const savedPage = sessionStorage.getItem('scheduleDatePage');
    return savedPage ? parseInt(savedPage, 10) : 1;
  });

  // 当页码改变时，保存到 sessionStorage
  useEffect(() => {
    sessionStorage.setItem('scheduleDatePage', datePage.toString());
  }, [datePage]);
  
  // 过滤和搜索状态
  const [filters, setFilters] = useState({
    search: '',
    competitionId: '',
    status: '',
    type: ''
  });
  
  // 显示过滤器
  const [showFilters, setShowFilters] = useState(false);
  
  // 赛程类型和状态
  const [scheduleTypes, setScheduleTypes] = useState([]);
  const [scheduleStatuses, setScheduleStatuses] = useState([]);
  
  // 获取赛程类型和状态
  useEffect(() => {
    const fetchScheduleOptions = async () => {
      try {
        const types = await scheduleService.getScheduleTypes();
        const statuses = await scheduleService.getScheduleStatuses();
        setScheduleTypes(types);
        setScheduleStatuses(statuses);
      } catch (error) {
        console.error('获取赛程选项失败:', error);
      }
    };
    
    fetchScheduleOptions();
  }, []);
  
  // 获取比赛列表
  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const response = await competitionService.getCompetitions({
          status: ['registration', 'ongoing'],
          limit: 100
        });
        setCompetitions(response.data);
      } catch (error) {
        console.error('获取比赛列表失败:', error);
      }
    };
    
    fetchCompetitions();
  }, []);
  
  const [expandedSchedules, setExpandedSchedules] = useState({});

  const handleToggleExpand = (scheduleId) => {
    setExpandedSchedules(prev => ({ ...prev, [scheduleId]: !prev[scheduleId] }));
  };

  // 获取赛程列表
  useEffect(() => {
    const fetchSchedules = async () => {
      setLoading(true);
      setError('');
      
      try {
        // 构建查询参数
        const params = {
          search: filters.search || undefined,
          status: filters.status || undefined,
          type: filters.type || undefined,
          populate: 'participants',
          limit: 1000 // 获取足够多的数据，避免分页截断
        };
        
        // 如果选择了日期，添加日期过滤
        if (selectedDate) {
          // 由于本地时区问题，为了确保选中的日期字符串正确，可以使用下面这种方式
          const offset = selectedDate.getTimezoneOffset() * 60000;
          const localDate = new Date(selectedDate.getTime() - offset);
          const dateStr = localDate.toISOString().split('T')[0];
          params.startDate = dateStr;
          params.endDate = dateStr;
          params.scheduleDate = dateStr;
        }
        
        // 如果选择了比赛，获取该比赛的赛程
        if (filters.competitionId) {
          const response = await scheduleService.getSchedules(filters.competitionId, params);
          setSchedules(response.data);
        } else {
          // 模拟获取所有比赛的赛程
          // 在实际应用中，可能需要一个专门的API来获取所有比赛的赛程
          const allSchedules = [];
          for (const competition of competitions) {
            try {
              const response = await scheduleService.getSchedules(competition._id, params);
              allSchedules.push(...response.data.map(schedule => ({
                ...schedule,
                competition
              })));
            } catch (error) {
              console.error(`获取比赛 ${competition._id} 的赛程失败:`, error);
            }
          }
          setSchedules(allSchedules);
        }
      } catch (error) {
        setError(error.message || '获取赛程列表失败');
        console.error('获取赛程列表失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (competitions.length > 0 || filters.competitionId) {
      fetchSchedules();
    }
  }, [filters, competitions, selectedDate]);
  
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
  
  // 处理日期变化
  const handleDateChange = (date) => {
    setSelectedDate(date);
  };
  
  // 处理搜索
  const handleSearch = (e) => {
    e.preventDefault();
    // 搜索已经通过状态变化触发了数据获取
  };
  
  // 处理重置过滤器
  const handleResetFilters = () => {
    setFilters({
      search: '',
      competitionId: '',
      status: '',
      type: ''
    });
    setSelectedDate(null);
    setDatePage(1);
  };
  
  // 获取赛程状态的中文名称和颜色
  const getStatusInfo = (status) => {
    const statusMap = {
      'scheduled': { name: '已安排', color: 'primary' },
      'ongoing': { name: '进行中', color: 'success' },
      'completed': { name: '已完成', color: 'secondary' },
      'cancelled': { name: '已取消', color: 'error' },
      'postponed': { name: '已延期', color: 'warning' }
    };
    
    return statusMap[status] || { name: status, color: 'default' };
  };
  
  // 获取赛程类型的中文名称
  const getTypeName = (typeId) => {
    const type = scheduleTypes.find(t => t.id === typeId);
    return type ? type.name : typeId;
  };
  
  // 按日期对赛程进行分组
  const groupSchedulesByDate = () => {
    const groups = {};
    
    schedules.forEach(schedule => {
      // 优先使用 scheduleDate，回退到 startTime
      const date = schedule.scheduleDate || (schedule.startTime ? new Date(schedule.startTime).toLocaleDateString() : '未定日期');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(schedule);
    });
    
    // 对每个日期组内的赛程排序
    Object.keys(groups).forEach(date => {
      groups[date].sort((a, b) => {
        const timeOrder = { '上午': 1, '下午': 2, '晚上': 3 };
        if (a.timeSlot && b.timeSlot && timeOrder[a.timeSlot] !== timeOrder[b.timeSlot]) {
            return timeOrder[a.timeSlot] - timeOrder[b.timeSlot];
        }
        if (a.court !== b.court) return (a.court || '') > (b.court || '') ? 1 : -1;
        return (a.order || 0) - (b.order || 0);
      });
    });
    
    return groups;
  };
  
  // 按比赛对赛程进行分组
  const groupSchedulesByCompetition = () => {
    const groups = {};
    
    schedules.forEach(schedule => {
      const competitionId = schedule.competition?._id || schedule.competition;
      const competitionName = schedule.competition?.name || '未知比赛';
      
      if (!groups[competitionId]) {
        groups[competitionId] = {
          name: competitionName,
          schedules: []
        };
      }
      groups[competitionId].schedules.push(schedule);
    });
    
    // 对每个比赛组内的赛程按开始时间排序
    Object.keys(groups).forEach(competitionId => {
      groups[competitionId].schedules.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    });
    
    return groups;
  };
  
  // 渲染按日期分组的赛程 (二维矩阵视图)
  const renderSchedulesByDate = () => {
    // 过滤出已经分配好二维属性的赛程
    const assigned = schedules.filter(s => s.scheduleDate && s.timeSlot && s.court).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // 如果没有使用新版二维排版的数据，回退到旧版列表显示（以防历史数据不兼容）
    if (assigned.length === 0 && schedules.length > 0) {
      return renderLegacyListByDate();
    }

    const dates = [...new Set(assigned.map(s => s.scheduleDate))].sort();
    const timeSlots = ['上午', '下午', '晚上'];
    const courts = [...new Set(assigned.map(s => s.court))].sort();
    
    if (dates.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            没有找到符合条件的赛程
          </Typography>
          {(filters.search || filters.competitionId || filters.status || filters.type) && (
            <Button onClick={handleResetFilters} sx={{ mt: 2 }}>
              清除过滤条件
            </Button>
          )}
        </Box>
      );
    }

    const totalPages = dates.length;
    const safePage = Math.max(1, Math.min(datePage, totalPages));
    const paginatedDates = dates.slice(safePage - 1, safePage);
    
    return (
      <Box>
        {paginatedDates.map(date => (
          <Box key={date} sx={{ mb: 5 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <CalendarIcon sx={{ mr: 1, color: 'primary.main' }} />
              {date}
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table sx={{ border: '1px solid #e0e0e0' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell width="10%" sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold' }}>时间段</TableCell>
                    {courts.map(court => (
                      <TableCell key={court} align="center" sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold' }}>{court}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {timeSlots.map(slot => {
                    const hasAnySchedule = courts.some(court => 
                      assigned.some(s => s.scheduleDate === date && s.timeSlot === slot && s.court === court)
                    );
                    if (!hasAnySchedule) return null;

                    return (
                      <TableRow key={slot}>
                        <TableCell sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold', bgcolor: '#fafafa' }}>{slot}</TableCell>
                        {courts.map(court => {
                          const cellSchedules = assigned.filter(s => s.scheduleDate === date && s.timeSlot === slot && s.court === court);
                          return (
                            <TableCell key={court} align="center" sx={{ borderRight: '1px solid #e0e0e0', verticalAlign: 'top', width: `${100 / courts.length}%` }}>
                              <Box sx={{ minHeight: '80px', height: '100%', p: 1 }}>
                                {cellSchedules.map(s => {
                                  const statusInfo = getStatusInfo(s.status);
                                  return (
                                    <Paper 
                                      key={s._id}
                                      elevation={1}
                                      onClick={() => navigate(`/competitions/${s.competition?._id || s.competition}`)}
                                      sx={{ 
                                        p: 1.5, 
                                        mb: 1.5, 
                                        bgcolor: s.status === 'completed' ? '#e8f5e9' : '#e3f2fd', 
                                        border: s.status === 'completed' ? '1px solid #81c784' : '1px solid #90caf9',
                                        cursor: 'pointer',
                                        transition: '0.2s',
                                        '&:hover': { bgcolor: s.status === 'completed' ? '#c8e6c9' : '#bbdefb', transform: 'translateY(-2px)', boxShadow: 3 }
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: s.status === 'completed' ? '#2e7d32' : '#1565c0', textAlign: 'left' }}>
                                          {s.name}
                                        </Typography>
                                        <Chip label={statusInfo.name} size="small" color={statusInfo.color} sx={{ height: '20px', fontSize: '0.7rem' }} />
                                      </Box>
                                      {s.exactTime && (
                                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', textAlign: 'left', mb: 0.5 }}>
                                          <TimeIcon sx={{ fontSize: '0.8rem', verticalAlign: 'middle', mr: 0.5 }} />
                                          {s.exactTime}
                                        </Typography>
                                      )}
                                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', textAlign: 'left' }}>
                                        {s.competition?.name || ''}
                                      </Typography>
                                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', textAlign: 'left', mt: 0.5 }}>
                                        {s.participants?.length || 0}人参赛
                                      </Typography>
                                    </Paper>
                                  )
                                })}
                              </Box>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
            <Pagination 
              count={totalPages} 
              page={safePage} 
              onChange={(e, v) => setDatePage(v)} 
              color="primary" 
              size="large"
            />
          </Box>
        )}
      </Box>
    );
  };

  // 旧版列表视图 (作为兼容降级)
  const renderLegacyListByDate = () => {
    const groups = groupSchedulesByDate();
    const dates = Object.keys(groups).sort((a, b) => new Date(a) - new Date(b));
    
    if (dates.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            没有找到符合条件的赛程
          </Typography>
          {(filters.search || filters.competitionId || filters.status || filters.type) && (
            <Button onClick={handleResetFilters} sx={{ mt: 2 }}>
              清除过滤条件
            </Button>
          )}
        </Box>
      );
    }
    
    const totalPages = dates.length;
    const safePage = Math.max(1, Math.min(datePage, totalPages));
    const paginatedDates = dates.slice(safePage - 1, safePage);
    
    return (
      <Box>
        {paginatedDates.map(date => (
          <Box key={date} sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <CalendarIcon sx={{ mr: 1 }} />
              {date}
            </Typography>
            
            <Paper>
              <List>
                {groups[date].map((schedule) => {
                  const statusInfo = getStatusInfo(schedule.status);
                  
                  return (
                    <React.Fragment key={schedule._id}>
                      <ListItem divider>
                        <ListItemIcon>
                          <EventIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography variant="subtitle1" sx={{ mr: 1 }}>
                                {schedule.name}
                              </Typography>
                              <Chip 
                                label={statusInfo.name} 
                                color={statusInfo.color} 
                                size="small" 
                              />
                            </Box>
                          }
                          secondary={
                            <React.Fragment>
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                <TimeIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                                <Typography variant="body2" color="text.secondary">
                                  {schedule.exactTime || `${new Date(schedule.startTime).toLocaleTimeString()} ~ ${new Date(schedule.endTime).toLocaleTimeString()}`}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                <LocationIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                                <Typography variant="body2" color="text.secondary">
                                  {schedule.location}
                                </Typography>
                              </Box>
                              
                              {schedule.competition && (
                                <Typography variant="body2" color="primary" sx={{ mt: 0.5 }}>
                                  {schedule.competition.name}
                                </Typography>
                              )}
                            </React.Fragment>
                          }
                        />
                        <IconButton onClick={() => handleToggleExpand(schedule._id)}>
                          {expandedSchedules[schedule._id] ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                        <Button 
                          size="small" 
                          variant="outlined"
                          onClick={() => navigate(`/competitions/${schedule.competition?._id || schedule.competition}`)}
                        >
                          查看详情
                        </Button>
                        {(user?.roles?.includes('admin') || user?.roles?.includes('chief_referee')) && (
                          <Tooltip title="随机排序参赛者">
                            <IconButton
                              size="small"
                              onClick={() => handleShuffleParticipants(schedule.competition?._id || schedule.competition, schedule._id)}
                              sx={{ ml: 1 }}
                            >
                              <ShuffleIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </ListItem>
                      <Collapse in={expandedSchedules[schedule._id]} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                          {schedule.participants && schedule.participants.length > 0 ? (
                            schedule.participants.map((participant, index) => (
                              <ListItem key={participant._id} sx={{ pl: 4 }}>
                                <ListItemText primary={`${index + 1}. ${participant.name || participant.teamName}`} secondary={`项目: ${participant.event}`} />
                              </ListItem>
                            ))
                          ) : (
                            <ListItem sx={{ pl: 4 }}>
                              <ListItemText primary="暂无参赛者" />
                            </ListItem>
                          )}
                        </List>
                      </Collapse>
                    </React.Fragment>
                  );
                })}
              </List>
            </Paper>
          </Box>
        ))}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
            <Pagination 
              count={totalPages} 
              page={safePage} 
              onChange={(e, v) => setDatePage(v)} 
              color="primary" 
              size="large"
            />
          </Box>
        )}
      </Box>
    );
  };
  
  const handleShuffleParticipants = async (competitionId, scheduleId) => {
    try {
      await scheduleService.shuffleParticipants(competitionId, scheduleId);
      // 重新获取赛程数据以刷新视图
      const fetchSchedules = async () => {
        setLoading(true);
        setError('');
        try {
          const params = {
            search: filters.search || undefined,
            status: filters.status || undefined,
            type: filters.type || undefined,
            populate: 'participants',
          };
          if (selectedDate) {
            const offset = selectedDate.getTimezoneOffset() * 60000;
            const localDate = new Date(selectedDate.getTime() - offset);
            const dateStr = localDate.toISOString().split('T')[0];
            params.startDate = dateStr;
            params.endDate = dateStr;
            params.scheduleDate = dateStr;
          }
          if (filters.competitionId) {
            const response = await scheduleService.getSchedules(filters.competitionId, params);
            setSchedules(response.data);
          } else {
            const allSchedules = [];
            for (const competition of competitions) {
              try {
                const response = await scheduleService.getSchedules(competition._id, params);
                allSchedules.push(...response.data.map(schedule => ({
                  ...schedule,
                  competition
                })));
              } catch (error) {
                console.error(`获取比赛 ${competition._id} 的赛程失败:`, error);
              }
            }
            setSchedules(allSchedules);
          }
        } catch (error) {
          setError(error.message || '获取赛程列表失败');
        } finally {
          setLoading(false);
        }
      };
      fetchSchedules();
    } catch (error) {
      setError(error.message || '随机排序参赛者失败');
    }
  };
  
  // 渲染按比赛分组的赛程
  const renderSchedulesByCompetition = () => {
    const groups = groupSchedulesByCompetition();
    const competitionIds = Object.keys(groups);
    
    if (competitionIds.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            没有找到符合条件的赛程
          </Typography>
          {(filters.search || filters.competitionId || filters.status || filters.type) && (
            <Button onClick={handleResetFilters} sx={{ mt: 2 }}>
              清除过滤条件
            </Button>
          )}
        </Box>
      );
    }
    
    return competitionIds.map(competitionId => (
      <Box key={competitionId} sx={{ mb: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {groups[competitionId].name}
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <List>
              {groups[competitionId].schedules.map((schedule) => {
                const statusInfo = getStatusInfo(schedule.status);
                const scheduleDate = new Date(schedule.startTime).toLocaleDateString();
                
                return (
                  <ListItem key={schedule._id} divider>
                    <ListItemIcon>
                      <EventIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="subtitle1" sx={{ mr: 1 }}>
                            {schedule.name}
                          </Typography>
                          <Chip 
                            label={statusInfo.name} 
                            color={statusInfo.color} 
                            size="small" 
                          />
                        </Box>
                      }
                      secondary={
                        <React.Fragment>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <CalendarIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {scheduleDate}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <TimeIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {schedule.exactTime || `${new Date(schedule.startTime).toLocaleTimeString()} ~ ${new Date(schedule.endTime).toLocaleTimeString()}`}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <LocationIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {schedule.location}
                            </Typography>
                          </Box>
                        </React.Fragment>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="outlined"
                onClick={() => navigate(`/competitions/${competitionId}`)}
              >
                查看比赛详情
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    ));
  };
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        赛程安排
      </Typography>
      
      {/* 搜索和过滤 */}
      <Box sx={{ mb: 4 }}>
        <form onSubmit={handleSearch}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="搜索赛程..."
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: filters.search && (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                        size="small"
                      >
                        ×
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="competition-label">选择比赛</InputLabel>
                <Select
                  labelId="competition-label"
                  id="competitionId"
                  name="competitionId"
                  value={filters.competitionId}
                  label="选择比赛"
                  onChange={handleFilterChange}
                >
                  <MenuItem value="">所有比赛</MenuItem>
                  {competitions.map(competition => (
                    <MenuItem key={competition._id} value={competition._id}>
                      {competition.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={6} md={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="选择日期"
                  value={selectedDate}
                  onChange={handleDateChange}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={6} md={2}>
              <Tooltip title="显示更多过滤选项">
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<FilterListIcon />}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  过滤
                </Button>
              </Tooltip>
            </Grid>
          </Grid>
        </form>
        
        {/* 过滤器 */}
        {showFilters && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              过滤选项
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="status-label">赛程状态</InputLabel>
                  <Select
                    labelId="status-label"
                    id="status"
                    name="status"
                    value={filters.status}
                    label="赛程状态"
                    onChange={handleFilterChange}
                  >
                    <MenuItem value="">所有状态</MenuItem>
                    {scheduleStatuses.map(status => (
                      <MenuItem key={status.id} value={status.id}>{status.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="type-label">赛程类型</InputLabel>
                  <Select
                    labelId="type-label"
                    id="type"
                    name="type"
                    value={filters.type}
                    label="赛程类型"
                    onChange={handleFilterChange}
                  >
                    <MenuItem value="">所有类型</MenuItem>
                    {scheduleTypes.map(type => (
                      <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" onClick={handleResetFilters}>
                重置过滤器
              </Button>
            </Box>
          </Box>
        )}
      </Box>
      
      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* 加载中 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* 视图切换标签 */}
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="按日期查看" />
              <Tab label="按比赛查看" />
            </Tabs>
          </Paper>
          
          {/* 赛程列表 */}
          <TabPanel value={tabValue} index={0}>
            {renderSchedulesByDate()}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            {renderSchedulesByCompetition()}
          </TabPanel>
        </>
      )}
    </Box>
  );
};

export default SchedulePage;