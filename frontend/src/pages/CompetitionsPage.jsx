import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import AddIcon from '@mui/icons-material/Add';
import competitionService from '../services/competitionService';
import { useAuth } from '../contexts/AuthContext';

const CompetitionsPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.roles?.includes('admin');
  
  // 状态
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [competitionTypes, setCompetitionTypes] = useState([]);
  
  // 过滤和搜索状态
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    type: '',
    sort: 'newest'
  });
  
  // 显示过滤器
  const [showFilters, setShowFilters] = useState(false);
  
  // 获取比赛类型列表
  useEffect(() => {
    const fetchCompetitionTypes = async () => {
      try {
        const types = await competitionService.getCompetitionTypes();
        setCompetitionTypes(types);
      } catch (error) {
        console.error('获取比赛类型失败:', error);
      }
    };
    
    fetchCompetitionTypes();
  }, []);
  
  // 获取比赛列表
  useEffect(() => {
    const fetchCompetitions = async () => {
      setLoading(true);
      setError('');
      
      try {
        // 构建查询参数
        const params = {
          page,
          limit: 9,
          search: filters.search || undefined,
          status: filters.status || undefined,
          type: filters.type || undefined
        };
        
        // 非管理员只能看到未结束的比赛
        if (!isAdmin) {
          if (filters.status === 'completed') {
            setCompetitions([]);
            setTotalPages(1);
            setLoading(false);
            return;
          }
          if (!filters.status) {
            params.exclude_status = 'completed';
          }
        } else {
          // 管理员如果没有选择过滤状态，默认看所有的，不需要加 exclude_status
          delete params.exclude_status;
        }
        
        // 添加排序参数
        if (filters.sort === 'newest') {
          params.sort = '-createdAt';
        } else if (filters.sort === 'oldest') {
          params.sort = 'createdAt';
        } else if (filters.sort === 'nameAsc') {
          params.sort = 'name';
        } else if (filters.sort === 'nameDesc') {
          params.sort = '-name';
        }
        
        const response = await competitionService.getCompetitions(params);
        setCompetitions(response.data);
        setTotalPages(Math.ceil(response.total / 9));
      } catch (error) {
        console.error('获取比赛列表失败 - 详细错误:', error);
        setError(error.message || error.toString() || '获取比赛列表失败');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompetitions();
  }, [page, filters, isAdmin]);
  
  // 处理页码变化
  const handlePageChange = (event, value) => {
    setPage(value);
    window.scrollTo(0, 0);
  };
  
  // 处理过滤器变化
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPage(1); // 重置页码
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
      status: '',
      type: '',
      sort: 'newest'
    });
    setPage(1);
  };
  
  // 获取比赛状态的中文名称和颜色
  const getStatusInfo = (status) => {
    const statusMap = {
      'draft': { name: '草稿', color: 'default' },
      'registration': { name: '报名中', color: 'primary' },
      'ongoing': { name: '进行中', color: 'success' },
      'completed': { name: '已结束', color: 'secondary' },
      'cancelled': { name: '已取消', color: 'error' }
    };
    
    return statusMap[status] || { name: status, color: 'default' };
  };
  
  // 获取比赛类型的中文名称
  const getTypeName = (typeId) => {
    const type = competitionTypes.find(t => t.id === typeId);
    return type ? type.name : typeId;
  };
  
  // 检查用户是否可以创建比赛
  const canCreateCompetition = isAuthenticated && user?.roles?.includes('admin');
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          比赛列表
        </Typography>
        
        {canCreateCompetition && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/competitions/create')}
          >
            创建比赛
          </Button>
        )}
      </Box>
      
      {/* 搜索和过滤 */}
      <Box sx={{ mb: 4 }}>
        <form onSubmit={handleSearch}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="搜索比赛..."
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
            
            <Grid item xs={6} md={2}>
              <Tooltip title="显示过滤选项">
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
            
            <Grid item xs={6} md={4}>
              <FormControl fullWidth>
                <InputLabel id="sort-label">排序方式</InputLabel>
                <Select
                  labelId="sort-label"
                  id="sort"
                  name="sort"
                  value={filters.sort}
                  label="排序方式"
                  onChange={handleFilterChange}
                  startAdornment={
                    <InputAdornment position="start">
                      <SortIcon />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="newest">最新发布</MenuItem>
                  <MenuItem value="oldest">最早发布</MenuItem>
                  <MenuItem value="nameAsc">名称 (A-Z)</MenuItem>
                  <MenuItem value="nameDesc">名称 (Z-A)</MenuItem>
                </Select>
              </FormControl>
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
                  <InputLabel id="status-label">比赛状态</InputLabel>
                  <Select
                    labelId="status-label"
                    id="status"
                    name="status"
                    value={filters.status}
                    label="比赛状态"
                    onChange={handleFilterChange}
                  >
                    <MenuItem value="">全部状态</MenuItem>
                    <MenuItem value="registration">报名中</MenuItem>
                    <MenuItem value="ongoing">进行中</MenuItem>
                    <MenuItem value="completed">已结束</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="type-label">比赛类型</InputLabel>
                  <Select
                    labelId="type-label"
                    id="type"
                    name="type"
                    value={filters.type}
                    label="比赛类型"
                    onChange={handleFilterChange}
                  >
                    <MenuItem value="">全部类型</MenuItem>
                    {competitionTypes.map(type => (
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
          {/* 比赛列表 */}
          {competitions.length > 0 ? (
            <Grid container spacing={3}>
              {competitions.map((competition) => {
                const statusInfo = getStatusInfo(competition.status);
                
                return (
                  <Grid item key={competition._id} xs={12} sm={6} md={4}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardMedia
                        component="img"
                        height="200"
                        image={competition.coverImage ? 
                          `/uploads/competitions/${competition.coverImage}` : 
                          `/assets/placeholder-cover.svg`
                        }
                        alt={competition.name}
                      />
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography gutterBottom variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                            {competition.name}
                          </Typography>
                          <Chip 
                            label={statusInfo.name} 
                            color={statusInfo.color} 
                            size="small" 
                            sx={{ ml: 1 }}
                          />
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {competition.description.length > 100 ? 
                            `${competition.description.substring(0, 100)}...` : 
                            competition.description
                          }
                        </Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                          <Chip 
                            label={getTypeName(competition.type)} 
                            variant="outlined" 
                            size="small" 
                          />
                          <Typography variant="body2" color="text.secondary">
                            {competition.startDate ? new Date(new Date(competition.startDate).getTime() - (new Date(competition.startDate).getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '待定'} ~ {competition.endDate ? new Date(new Date(competition.endDate).getTime() - (new Date(competition.endDate).getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '待定'}
                          </Typography>
                        </Box>
                      </CardContent>
                      
                      <Divider />
                      
                      <CardActions>
                        <Button size="small" onClick={() => navigate(`/competitions/${competition._id}`)}>查看详情</Button>
                        {isAdmin && (
                          <Button 
                            size="small" 
                            color="primary"
                            onClick={() => navigate(`/admin/participants?competitionId=${competition._id}`)}
                          >
                            查看报名情况
                          </Button>
                        )}
                        {competition.status === 'registration' && isAuthenticated && !isAdmin && (
                          <Button 
                            size="small" 
                            color="primary" 
                            variant="contained" 
                            sx={{ ml: 'auto' }}
                            onClick={() => navigate(`/competitions/${competition._id}/register`)}
                          >
                            立即报名
                          </Button>
                        )}
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Typography variant="h6" color="text.secondary">
                没有找到符合条件的比赛
              </Typography>
              {Object.values(filters).some(v => v) && (
                <Button onClick={handleResetFilters} sx={{ mt: 2 }}>
                  清除过滤条件
                </Button>
              )}
            </Box>
          )}
          
          {/* 分页 */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={handlePageChange} 
                color="primary" 
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default CompetitionsPage;