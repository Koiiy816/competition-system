import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert, Container, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Pagination
} from '@mui/material';
import scheduleService from '../services/scheduleService';
import competitionService from '../services/competitionService';
import { getScheduleDisplayName } from '../utils/trampolineRegistration';
import { compareCourts } from '../utils/courtSort';

const CompetitionScorePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [competition, setCompetition] = useState(null);
  const [error, setError] = useState('');
  
  const selectedCourt = searchParams.get('court') || '';

  // 从 sessionStorage 初始化页码，实现返回时记住页码
  const [datePage, setDatePage] = useState(() => {
    const savedPage = sessionStorage.getItem(`scoreDatePage_${id}_${selectedCourt || 'all'}`);
    return savedPage ? parseInt(savedPage, 10) : 1;
  });

  // 当页码改变时，保存到 sessionStorage
  useEffect(() => {
    sessionStorage.setItem(`scoreDatePage_${id}_${selectedCourt || 'all'}`, datePage.toString());
  }, [datePage, id, selectedCourt]);

  // 切换场地后从该场地的第一页开始显示，避免上一场地页码越界。
  useEffect(() => {
    const savedPage = sessionStorage.getItem(`scoreDatePage_${id}_${selectedCourt || 'all'}`);
    setDatePage(savedPage ? parseInt(savedPage, 10) : 1);
  }, [id, selectedCourt]);

  useEffect(() => {
    fetchSchedules();
  }, [id]);

  const fetchSchedules = async () => {
    try {
      // Get all schedules (large limit)
      const [res, context] = await Promise.all([
        scheduleService.getSchedules(id, { limit: 1000 }),
        competitionService.getScoreContext(id)
      ]);
      setCompetition(context.data);
      const data = res.data || [];
      setSchedules(data);
    } catch (err) {
      setError('加载赛程失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  if (error) return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;

  // 注意这里需要按 order 排序以保证显示正确
  const assigned = schedules.filter(s => s.scheduleDate && s.timeSlot && s.court).sort((a, b) => (a.order || 0) - (b.order || 0));
  const courts = [...new Set(assigned.map(s => s.court))].sort(compareCourts);
  const hasMultipleCourts = courts.length > 1;
  const activeCourt = hasMultipleCourts ? (courts.includes(selectedCourt) ? selectedCourt : '') : courts[0];
  const visibleSchedules = activeCourt ? assigned.filter(s => s.court === activeCourt) : [];
  const dates = [...new Set(visibleSchedules.map(s => s.scheduleDate))].sort();
  const timeSlots = ['上午', '下午', '晚上'];

  const totalPages = dates.length;
  const safePage = Math.max(1, Math.min(datePage, totalPages));
  const paginatedDates = dates.slice(safePage - 1, safePage);

  const chooseCourt = (court) => {
    setSearchParams({ court });
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">比赛打分 - 场次选择</Typography>
        <Button variant="contained" color="warning" onClick={() => navigate('/competitions/' + id + '/check-in?makeup=1')}>补打管理</Button>
      </Box>

      {assigned.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary">
            暂无已排程的比赛日程。
          </Typography>
        </Paper>
      ) : hasMultipleCourts && !activeCourt ? (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            请先选择本次负责的场地，进入后只会显示该场地的比赛日程。无需额外创建账号，裁判可在需要时返回此处切换场地。
          </Alert>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>选择场地</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 2 }}>
            {courts.map(court => {
              const courtSchedules = assigned.filter(schedule => schedule.court === court);
              const courtDates = [...new Set(courtSchedules.map(schedule => schedule.scheduleDate))].sort();
              const participantCount = courtSchedules.reduce((total, schedule) => total + (schedule.participants?.length || 0), 0);
              return (
                <Paper
                  key={court}
                  variant="outlined"
                  onClick={() => chooseCourt(court)}
                  sx={{ p: 3, cursor: 'pointer', borderColor: 'primary.light', transition: '0.2s', '&:hover': { bgcolor: '#e3f2fd', transform: 'translateY(-2px)', boxShadow: 3 } }}
                >
                  <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold', mb: 1 }}>{court}</Typography>
                  <Typography variant="body2" color="text.secondary">{courtSchedules.length} 个比赛项目 · {participantCount} 人/队</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{courtDates.join('、')}</Typography>
                  <Button variant="contained" size="small" sx={{ mt: 2 }} onClick={(event) => { event.stopPropagation(); chooseCourt(court); }}>进入该场地</Button>
                </Paper>
              );
            })}
          </Box>
        </Box>
      ) : (
        <Box>
          {hasMultipleCourts && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{activeCourt}</Typography>
                <Typography variant="body2" color="text.secondary">仅显示该场地的比赛日程</Typography>
              </Box>
              <Button variant="outlined" onClick={() => setSearchParams({})}>切换场地</Button>
            </Box>
          )}
          {paginatedDates.map(date => (
            <Box key={date} sx={{ mb: 5 }}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>{date}</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table sx={{ border: '1px solid #e0e0e0' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell width="10%" sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold' }}>时间段</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>{activeCourt || '比赛项目'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {timeSlots.map(slot => {
                      const hasAnySchedule = visibleSchedules.some(s => s.scheduleDate === date && s.timeSlot === slot);
                      if (!hasAnySchedule) return null;

                      return (
                        <TableRow key={slot}>
                          <TableCell sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold', bgcolor: '#fafafa' }}>{slot}</TableCell>
                          {(() => {
                            const cellSchedules = visibleSchedules.filter(s => s.scheduleDate === date && s.timeSlot === slot);
                            return (
                              <TableCell align="center" sx={{ verticalAlign: 'top' }}>
                                <Box sx={{ minHeight: '80px', height: '100%', p: 1 }}>
                                  {cellSchedules.map((s, index) => (
                                    <Paper 
                                      key={s._id}
                                      elevation={1}
                                      onClick={() => navigate(`/competitions/${id}/score/${s._id}`)}
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
                                          <span style={{ 
                                            display: 'inline-block', 
                                            backgroundColor: s.status === 'completed' ? '#2e7d32' : '#1976d2', 
                                            color: 'white', 
                                            borderRadius: '4px', 
                                            padding: '1px 6px', 
                                            marginRight: '6px',
                                            fontSize: '0.85em'
                                          }}>
                                            {index + 1}
                                          </span>
                                          {getScheduleDisplayName(competition, s)}
                                        </Typography>
                                        {s.status === 'completed' && (
                                          <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 'bold', bgcolor: '#c8e6c9', px: 0.5, borderRadius: 1 }}>
                                            已结束
                                          </Typography>
                                        )}
                                      </Box>
                                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', textAlign: 'left' }}>
                                        {s.participants?.length > 0 && s.participants[0].isVirtualTeam 
                                          ? `${s.participants.length}队 ${s.participants.reduce((acc, p) => acc + (p.teamMembers ? p.teamMembers.length : 0), 0)}人` 
                                          : `${s.participants?.length || 0}人`}
                                      </Typography>
                                    </Paper>
                                  ))}
                                </Box>
                              </TableCell>
                            );
                          })()}
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
      )}
    </Container>
  );
};

export default CompetitionScorePage;
