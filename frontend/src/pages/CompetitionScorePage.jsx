import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, CircularProgress, Alert, Container, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Pagination
} from '@mui/material';
import scheduleService from '../services/scheduleService';

const CompetitionScorePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState('');
  
  // 从 sessionStorage 初始化页码，实现返回时记住页码
  const [datePage, setDatePage] = useState(() => {
    const savedPage = sessionStorage.getItem(`scoreDatePage_${id}`);
    return savedPage ? parseInt(savedPage, 10) : 1;
  });

  // 当页码改变时，保存到 sessionStorage
  useEffect(() => {
    sessionStorage.setItem(`scoreDatePage_${id}`, datePage.toString());
  }, [datePage, id]);

  useEffect(() => {
    fetchSchedules();
  }, [id]);

  const fetchSchedules = async () => {
    try {
      // Get all schedules (large limit)
      const res = await scheduleService.getSchedules(id, { limit: 1000 });
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
  const dates = [...new Set(assigned.map(s => s.scheduleDate))].sort();
  const timeSlots = ['上午', '下午', '晚上'];
  const courts = [...new Set(assigned.map(s => s.court))].sort();

  const totalPages = dates.length;
  const safePage = Math.max(1, Math.min(datePage, totalPages));
  const paginatedDates = dates.slice(safePage - 1, safePage);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1" sx={{ mb: 4 }}>
        比赛打分 - 场次选择
      </Typography>

      {assigned.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary">
            暂无已排程的比赛日程。
          </Typography>
        </Paper>
      ) : (
        <Box>
          {paginatedDates.map(date => (
            <Box key={date} sx={{ mb: 5 }}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>{date}</Typography>
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
                                          {s.name}
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
      )}
    </Container>
  );
};

export default CompetitionScorePage;
