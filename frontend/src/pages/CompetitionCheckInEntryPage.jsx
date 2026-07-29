import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import scheduleService from '../services/scheduleService';

const normalizeCheckInStatus = (participant) => {
  if (!participant) return 'not_checked';
  if (['not_checked', 'checked', 'absent'].includes(participant.checkInStatus)) {
    return participant.checkInStatus;
  }
  return participant.isCheckedIn ? 'checked' : 'not_checked';
};

const getParticipantCheckInStatus = (participant) => {
  if (!participant?.isVirtualTeam) {
    return normalizeCheckInStatus(participant);
  }

  const teamMembers = participant.teamMembers || [];
  if (teamMembers.length === 0) return normalizeCheckInStatus(participant);

  const statuses = teamMembers.map(normalizeCheckInStatus);
  if (statuses.every(status => status === 'checked')) return 'checked';
  if (statuses.every(status => status === 'absent')) return 'absent';
  if (statuses.every(status => status === 'not_checked')) return 'not_checked';
  return 'mixed';
};

const getStatusMeta = (status) => {
  switch (status) {
    case 'checked':
      return { label: '已检录', color: 'success' };
    case 'absent':
      return { label: '缺席', color: 'error' };
    case 'mixed':
      return { label: '状态不一致', color: 'warning' };
    default:
      return { label: '未检录', color: 'warning' };
  }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
};

const CompetitionCheckInEntryPage = () => {
  const { id, scheduleId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [schedule, setSchedule] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const res = await scheduleService.getSchedule(id, scheduleId);
      setSchedule(res.data);
      setError('');
    } catch (err) {
      setError(err.message || '加载检录场次失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [id, scheduleId]);

  const rows = useMemo(() => {
    const participants = schedule?.participants || [];
    const keyword = search.trim().toLowerCase();

    return participants.filter(participant => {
      if (!keyword) return true;

      const fields = [
        participant.name,
        participant.teamName,
        participant.schoolName,
        ...(participant.teamMembers || []).map(member => member.name)
      ].filter(Boolean).join(' ').toLowerCase();

      return fields.includes(keyword);
    });
  }, [schedule, search]);

  const summary = useMemo(() => {
    const participants = schedule?.participants || [];
    const total = participants.length;
    let checked = 0;
    let absent = 0;
    let mixed = 0;

    participants.forEach(participant => {
      const status = getParticipantCheckInStatus(participant);
      if (status === 'checked') {
        checked += 1;
      } else if (status === 'absent') {
        absent += 1;
      } else if (status === 'mixed') {
        mixed += 1;
      }
    });

    return {
      total,
      checked,
      absent,
      mixed,
      unchecked: total - checked - absent - mixed
    };
  }, [schedule]);

  const handleUpdateStatus = async (participant, status) => {
    const messageMap = {
      not_checked: '已恢复为未检录',
      checked: '已标记为已检录',
      absent: '已标记为缺席'
    };

    try {
      setSavingId(participant._id);
      setError('');
      setSuccess('');
      await scheduleService.updateParticipantCheckInStatus(id, participant._id, status, scheduleId);
      setSuccess(messageMap[status] || '检录状态已更新');
      await fetchSchedule();
    } catch (err) {
      setError(err.message || '更新检录状态失败');
    } finally {
      setSavingId('');
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  if (!schedule) {
    return <Container sx={{ mt: 4 }}><Alert severity="error">{error || '未找到该检录场次'}</Alert></Container>;
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/competitions/${id}/check-in`)}
        sx={{ mb: 2 }}
      >
        返回场次选择
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
        场次检录
      </Typography>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {schedule.name}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {schedule.scheduleDate && <Chip label={schedule.scheduleDate} />}
        {schedule.timeSlot && <Chip label={schedule.timeSlot} color="secondary" />}
        {schedule.court && <Chip label={schedule.court} color="info" />}
        <Chip label={`共 ${summary.total} 项`} />
        <Chip label={`已检录 ${summary.checked}`} color="success" variant="outlined" />
        <Chip label={`缺席 ${summary.absent}`} color="error" variant="outlined" />
        <Chip label={`未检录 ${summary.unchecked}`} color="warning" variant="outlined" />
        {summary.mixed > 0 && (
          <Chip label={`待处理 ${summary.mixed}`} color="warning" />
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          label="搜索参赛者、队伍或单位"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell width="6%">编号</TableCell>
              <TableCell width="30%">参赛者 / 队伍</TableCell>
              <TableCell width="18%">单位</TableCell>
              <TableCell width="12%">类型</TableCell>
              <TableCell width="12%">检录状态</TableCell>
              <TableCell width="12%">检录时间</TableCell>
              <TableCell width="10%">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((participant, index) => {
              const status = getParticipantCheckInStatus(participant);
              const statusMeta = getStatusMeta(status);
              const checkInTime = participant.isVirtualTeam
                ? formatDateTime(
                    (participant.teamMembers || []).reduce((latest, member) => {
                      if (!member.checkedInAt) return latest;
                      const currentTime = new Date(member.checkedInAt).getTime();
                      return !latest || currentTime > latest ? currentTime : latest;
                    }, null)
                  )
                : formatDateTime(participant.checkedInAt);

              return (
                <TableRow key={participant._id} hover>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {participant.isVirtualTeam ? (participant.teamName || participant.schoolName || participant.name) : participant.name}
                    </Typography>
                    {participant.isVirtualTeam && participant.teamMembers?.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        成员：{participant.teamMembers.map(member => member.name).join('、')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{participant.schoolName || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={participant.isVirtualTeam ? '集体项目' : '个人项目'}
                      color={participant.isVirtualTeam ? 'secondary' : 'primary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={statusMeta.label} color={statusMeta.color} />
                  </TableCell>
                  <TableCell>{checkInTime}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant={status === 'not_checked' ? 'contained' : 'outlined'}
                        color="warning"
                        disabled={savingId === participant._id || status === 'not_checked'}
                        onClick={() => handleUpdateStatus(participant, 'not_checked')}
                      >
                        未检录
                      </Button>
                      <Button
                        size="small"
                        variant={status === 'checked' ? 'contained' : 'outlined'}
                        color="success"
                        disabled={savingId === participant._id || status === 'checked'}
                        onClick={() => handleUpdateStatus(participant, 'checked')}
                      >
                        已检录
                      </Button>
                      <Button
                        size="small"
                        variant={status === 'absent' ? 'contained' : 'outlined'}
                        color="error"
                        disabled={savingId === participant._id || status === 'absent'}
                        onClick={() => handleUpdateStatus(participant, 'absent')}
                      >
                        缺席
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  暂无符合条件的参赛者
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default CompetitionCheckInEntryPage;
