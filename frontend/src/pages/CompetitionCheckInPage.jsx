import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import scheduleService from '../services/scheduleService';

const CompetitionCheckInPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState('');
  const [datePage, setDatePage] = useState(() => {
    const savedPage = sessionStorage.getItem(`checkInDatePage_${id}`);
    return savedPage ? parseInt(savedPage, 10) : 1;
  });

  useEffect(() => {
    sessionStorage.setItem(`checkInDatePage_${id}`, datePage.toString());
  }, [datePage, id]);

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const res = await scheduleService.getSchedules(id, { limit: 1000 });
        setSchedules(res.data || []);
      } catch (err) {
        setError(err.message || '加载赛程失败');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, [id]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;
  }

  const assigned = schedules
    .filter(s => s.scheduleDate && s.timeSlot && s.court)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const dates = [...new Set(assigned.map(s => s.scheduleDate))].sort();
  const timeSlots = ['上午', '下午', '晚上'];
  const courts = [...new Set(assigned.map(s => s.court))].sort();

  const totalPages = dates.length;
  const safePage = Math.max(1, Math.min(datePage, totalPages || 1));
  const paginatedDates = dates.slice(safePage - 1, safePage);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1" sx={{ mb: 4, fontWeight: 'bold' }}>
        参赛检录 - 场次选择
      </Typography>

      {assigned.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
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
                                      onClick={() => navigate(`/competitions/${id}/check-in/${s._id}`)}
                                      sx={{
                                        p: 1.5,
                                        mb: 1.5,
                                        bgcolor: '#e8f5e9',
                                        border: '1px solid #81c784',
                                        cursor: 'pointer',
                                        transition: '0.2s',
                                        '&:hover': { bgcolor: '#c8e6c9', transform: 'translateY(-2px)', boxShadow: 3 }
                                      }}
                                    >
                                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#2e7d32', textAlign: 'left' }}>
                                        <span style={{
                                          display: 'inline-block',
                                          backgroundColor: '#2e7d32',
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
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'left' }}>
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

export default CompetitionCheckInPage;
