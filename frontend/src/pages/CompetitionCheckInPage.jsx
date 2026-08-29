import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import scheduleService from '../services/scheduleService';

const normalizeCheckInStatus = (participant) => {
  if (!participant) return 'not_checked';
  if (['not_checked', 'checked', 'absent'].includes(participant.checkInStatus)) return participant.checkInStatus;
  return participant.isCheckedIn ? 'checked' : 'not_checked';
};

const CompetitionCheckInPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const makeupMode = new URLSearchParams(location.search).get('makeup') === '1';
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState('');
  const [datePage, setDatePage] = useState(() => {
    const savedPage = sessionStorage.getItem(`checkInDatePage_${id}`);
    return savedPage ? parseInt(savedPage, 10) : 1;
  });
  const [uncheckedOpen, setUncheckedOpen] = useState(false);
  const [uncheckedLoading, setUncheckedLoading] = useState(false);
  const [uncheckedError, setUncheckedError] = useState('');
  const [uncheckedRows, setUncheckedRows] = useState([]);
  const [uncheckedSearch, setUncheckedSearch] = useState('');

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

  const filteredUncheckedRows = useMemo(() => {
    const keyword = uncheckedSearch.trim().toLowerCase();
    if (!keyword) return uncheckedRows;
    return uncheckedRows.filter((row) => [row.name, row.schoolName, row.scheduleName, row.scheduleDate, row.court]
      .some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [uncheckedRows, uncheckedSearch]);

  const handleOpenUnchecked = async () => {
    setUncheckedOpen(true);
    setUncheckedLoading(true);
    setUncheckedError('');
    setUncheckedSearch('');
    setUncheckedRows([]);
    try {
      const detailedSchedules = await Promise.all(schedules.map(async (schedule) => {
        const response = await scheduleService.getSchedule(id, schedule._id);
        return response.data;
      }));
      // 只追踪已结束场次的漏检人员；尚未开始或正在进行的场次仍可正常检录，不列入补打名单。
      const rows = detailedSchedules
        .filter((schedule) => schedule.status === 'completed')
        .flatMap((schedule) => (schedule.participants || []).flatMap((participant) => {
        if (participant.isVirtualTeam && Array.isArray(participant.teamMembers)) {
          return participant.teamMembers
            .filter((member) => normalizeCheckInStatus(member) === 'not_checked')
            .map((member) => ({
              key: `${schedule._id}_${member._id}`,
              name: member.name,
              schoolName: member.schoolName || participant.schoolName,
              scheduleName: schedule.name,
              scheduleDate: schedule.scheduleDate,
              timeSlot: schedule.timeSlot,
              court: schedule.court
            }));
        }
        if (normalizeCheckInStatus(participant) !== 'not_checked') return [];
        return [{
          key: `${schedule._id}_${participant._id}`,
          name: participant.name || participant.teamName,
          schoolName: participant.schoolName,
          scheduleName: schedule.name,
          scheduleDate: schedule.scheduleDate,
          timeSlot: schedule.timeSlot,
          court: schedule.court
        }];
        })).sort((a, b) => String(a.scheduleDate || '').localeCompare(String(b.scheduleDate || '')) || String(a.court || '').localeCompare(String(b.court || '')) || String(a.scheduleName || '').localeCompare(String(b.scheduleName || ''), 'zh-CN'));
      setUncheckedRows(rows);
    } catch (err) {
      setUncheckedError(err.message || '加载未检录选手失败');
    } finally {
      setUncheckedLoading(false);
    }
  };

  const handleMakeup = async (row) => {
    const [scheduleId, participantId] = String(row.key).split('_');
    await scheduleService.updateParticipantCheckInStatus(id, participantId, 'checked', scheduleId);
    navigate('/competitions/' + id + '/score/' + scheduleId + '?makeup=' + participantId);
  };

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>{makeupMode ? '补打管理 - 未检录选手' : '参赛检录 - 场次选择'}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>请选择要进入检录的比赛。进入后可按场次对参赛者进行检录。</Typography>
        </Box>
        <Button variant="contained" color="warning" startIcon={<PersonSearchIcon />} onClick={handleOpenUnchecked}>
          查看未检录选手
        </Button>
      </Box>

      {assigned.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}><Typography variant="h6" color="text.secondary">暂无已排程的比赛日程。</Typography></Paper>
      ) : (
        <Box>
          {paginatedDates.map(date => (
            <Box key={date} sx={{ mb: 5 }}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>{date}</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table sx={{ border: '1px solid #e0e0e0' }}><TableHead><TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell width="10%" sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold' }}>时间段</TableCell>
                  {courts.map(court => <TableCell key={court} align="center" sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold' }}>{court}</TableCell>)}
                </TableRow></TableHead><TableBody>{timeSlots.map(slot => {
                  const hasAnySchedule = courts.some(court => assigned.some(s => s.scheduleDate === date && s.timeSlot === slot && s.court === court));
                  if (!hasAnySchedule) return null;
                  return <TableRow key={slot}><TableCell sx={{ borderRight: '1px solid #e0e0e0', fontWeight: 'bold', bgcolor: '#fafafa' }}>{slot}</TableCell>{courts.map(court => {
                    const cellSchedules = assigned.filter(s => s.scheduleDate === date && s.timeSlot === slot && s.court === court);
                    return <TableCell key={court} align="center" sx={{ borderRight: '1px solid #e0e0e0', verticalAlign: 'top', width: `${100 / courts.length}%` }}><Box sx={{ minHeight: '80px', p: 1 }}>{cellSchedules.map((s, index) => <Paper key={s._id} elevation={1} onClick={() => navigate(`/competitions/${id}/check-in/${s._id}`)} sx={{ p: 1.5, mb: 1.5, bgcolor: '#e8f5e9', border: '1px solid #81c784', cursor: 'pointer', transition: '0.2s', '&:hover': { bgcolor: '#c8e6c9', transform: 'translateY(-2px)', boxShadow: 3 } }}><Typography variant="body2" sx={{ fontWeight: 'bold', color: '#2e7d32', textAlign: 'left' }}><span style={{ display: 'inline-block', backgroundColor: '#2e7d32', color: 'white', borderRadius: '4px', padding: '1px 6px', marginRight: '6px', fontSize: '0.85em' }}>{index + 1}</span>{s.name}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'left' }}>{s.participants?.length > 0 && s.participants[0].isVirtualTeam ? `${s.participants.length}队 ${s.participants.reduce((acc, p) => acc + (p.teamMembers ? p.teamMembers.length : 0), 0)}人` : `${s.participants?.length || 0}人`}</Typography></Paper>)}</Box></TableCell>;
                  })}</TableRow>;
                })}</TableBody></Table>
              </TableContainer>
            </Box>
          ))}
          {totalPages > 1 && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}><Pagination count={totalPages} page={safePage} onChange={(e, v) => setDatePage(v)} color="primary" size="large" /></Box>}
        </Box>
      )}

      <Dialog open={uncheckedOpen} onClose={() => setUncheckedOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>未检录选手</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>这里只显示已结束场次中仍未检录的选手。选手回来后，进入对应场次完成检录，即可补打。</Alert>
          <TextField fullWidth label="搜索姓名、单位、项目、日期或场地" value={uncheckedSearch} onChange={(event) => setUncheckedSearch(event.target.value)} sx={{ mb: 2 }} />
          {uncheckedError && <Alert severity="error" sx={{ mb: 2 }}>{uncheckedError}</Alert>}
          {uncheckedLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box> : <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow sx={{ bgcolor: '#f5f5f5' }}><TableCell>姓名</TableCell><TableCell>单位</TableCell><TableCell>比赛项目</TableCell><TableCell>日期 / 时段</TableCell><TableCell>场地</TableCell>{makeupMode && <TableCell>补打</TableCell>}</TableRow></TableHead><TableBody>{filteredUncheckedRows.map(row => <TableRow key={row.key}><TableCell>{row.name || '-'}</TableCell><TableCell>{row.schoolName || '-'}</TableCell><TableCell>{row.scheduleName || '-'}</TableCell><TableCell>{[row.scheduleDate, row.timeSlot].filter(Boolean).join(' ') || '-'}</TableCell><TableCell>{row.court || '-'}</TableCell>{makeupMode && <TableCell><Button size="small" variant="contained" onClick={() => handleMakeup(row)}>回来检录并补打</Button></TableCell>}</TableRow>)}{!filteredUncheckedRows.length && <TableRow><TableCell colSpan={5} align="center">目前没有未检录选手</TableCell></TableRow>}</TableBody></Table></TableContainer>}
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default CompetitionCheckInPage;