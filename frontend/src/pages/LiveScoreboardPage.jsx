import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { ArrowBack, Fullscreen, FullscreenExit, Refresh } from '@mui/icons-material';
import resultService from '../services/resultService';
import scheduleService from '../services/scheduleService';
import competitionService from '../services/competitionService';

const REFRESH_INTERVAL = 2000;
const rowsOf = (payload) => Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
const idOf = (value) => !value ? '' : (typeof value === 'object' ? String(value._id || value.id || '') : String(value));
const timestamp = (value) => { const number = new Date(value || 0).getTime(); return Number.isFinite(number) ? number : 0; };
const scoreOf = (value) => { const number = Number(value); return Number.isFinite(number) ? number : null; };
const showScore = (value) => { const number = scoreOf(value); return number === null ? '待评分' : number.toFixed(2); };
const participantName = (participant) => participant?.teamName || participant?.name || participant?.user?.name || participant?.schoolName || '未关联选手';
const participantUnit = (participant) => participant?.schoolName || participant?.teamName || participant?.user?.schoolName || '—';
const membersOf = (participant) => Array.isArray(participant?.teamMembers)
  ? participant.teamMembers.map((member) => member?.name || member?.user?.name || member?.participant?.name || '').filter(Boolean).join('、')
  : '';
const courtOrder = (court) => {
  const value = String(court || '未设置场地');
  const match = value.match(/([一二三四五六七八九十\d]+)\s*号?场地/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const names = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return /^\d+$/.test(match[1]) ? Number(match[1]) : (names[match[1]] || Number.MAX_SAFE_INTEGER);
};

export default function LiveScoreboardPage() {
  const { id: competitionId } = useParams();
  const navigate = useNavigate();
  const [competition, setCompetition] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedCourt, setSelectedCourt] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [fullScreen, setFullScreen] = useState(Boolean(document.fullscreenElement));

  const load = useCallback(async (silent = false) => {
    if (!competitionId) return;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [competitionPayload, schedulesPayload, resultsPayload] = await Promise.all([
        competitionService.getCompetition(competitionId),
        scheduleService.getSchedules(competitionId, { limit: 1000 }),
        resultService.getResults(competitionId, { limit: 1000 })
      ]);
      setCompetition(competitionPayload?.data || competitionPayload || null);
      setSchedules(rowsOf(schedulesPayload));
      setResults(rowsOf(resultsPayload));
      setError('');
    } catch (loadError) {
      setError(loadError?.response?.data?.message || loadError?.message || '暂时无法读取即时成绩');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [competitionId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const onFullScreen = () => setFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullScreen);
    return () => document.removeEventListener('fullscreenchange', onFullScreen);
  }, []);

  const panels = useMemo(() => {
    const resultMap = new Map();
    results.forEach((result) => {
      const key = idOf(result.schedule);
      if (!key) return;
      const list = resultMap.get(key) || [];
      list.push(result);
      resultMap.set(key, list);
    });
    const byCourt = new Map();
    schedules.forEach((schedule) => {
      const court = schedule.court || '未设置场地';
      const list = byCourt.get(court) || [];
      list.push(schedule);
      byCourt.set(court, list);
    });
    return [...byCourt.entries()].map(([court, courtSchedules]) => {
      const activity = (schedule) => Math.max(timestamp(schedule.updatedAt), ...((resultMap.get(idOf(schedule)) || []).map((item) => Math.max(timestamp(item.updatedAt), timestamp(item.submittedAt), timestamp(item.createdAt)))));
      const ongoing = courtSchedules.filter((schedule) => schedule.status === 'ongoing');
      const scored = courtSchedules.filter((schedule) => (resultMap.get(idOf(schedule)) || []).length > 0);
      const candidates = ongoing.length ? ongoing : scored;
      const currentSchedule = [...candidates].sort((a, b) => activity(b) - activity(a) || Number(a.order || 0) - Number(b.order || 0))[0];
      const scoredRows = currentSchedule ? [...(resultMap.get(idOf(currentSchedule)) || [])] : [];
      scoredRows.sort((a, b) => (scoreOf(b.score) ?? -Infinity) - (scoreOf(a.score) ?? -Infinity) || timestamp(a.updatedAt) - timestamp(b.updatedAt));
      return { court, schedule: currentSchedule, rows: scoredRows, live: Boolean(currentSchedule && currentSchedule.status === 'ongoing') };
    }).sort((a, b) => courtOrder(a.court) - courtOrder(b.court) || a.court.localeCompare(b.court, 'zh-CN'));
  }, [results, schedules]);

  const visiblePanels = selectedCourt === 'all' ? panels : panels.filter((panel) => panel.court === selectedCourt);
  const toggleFullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (fullscreenError) {
      setError('此浏览器不支持全屏显示');
    }
  };

  if (loading) return <Box sx={{ minHeight: '100vh', bgcolor: '#07101f', display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: '#f7c948' }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#07101f', color: '#edf4ff', p: { xs: 2, md: 4 }, fontFamily: 'Microsoft YaHei, sans-serif' }}>
      <Box sx={{ maxWidth: 1800, mx: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button startIcon={<ArrowBack />} onClick={() => navigate('/results')} sx={{ color: '#9ec5ff' }}>返回成绩管理</Button>
            <Typography sx={{ color: '#f7c948', fontWeight: 800, fontSize: { xs: 24, md: 40 }, letterSpacing: 2 }}>大屏即时成绩</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="立即刷新"><IconButton onClick={() => load(true)} sx={{ color: '#f7c948' }}><Refresh /></IconButton></Tooltip>
            <Tooltip title={fullScreen ? '退出全屏' : '全屏显示'}><IconButton onClick={toggleFullScreen} sx={{ color: '#f7c948' }}>{fullScreen ? <FullscreenExit /> : <Fullscreen />}</IconButton></Tooltip>
          </Stack>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ borderTop: '1px solid #24466d', borderBottom: '1px solid #24466d', py: 2, mb: 3 }}>
          <Typography sx={{ fontSize: { xs: 18, md: 30 }, fontWeight: 700 }}>{competition?.name || '比赛即时成绩'}</Typography>
          <Chip label={`每 ${REFRESH_INTERVAL / 1000} 秒自动更新`} sx={{ bgcolor: '#12385a', color: '#9ed8ff', fontWeight: 700, fontSize: 16 }} />
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 3, gap: 1 }}>
          <Button variant={selectedCourt === 'all' ? 'contained' : 'outlined'} onClick={() => setSelectedCourt('all')} sx={{ fontWeight: 700 }}>全部场地</Button>
          {panels.map((panel) => <Button key={panel.court} variant={selectedCourt === panel.court ? 'contained' : 'outlined'} onClick={() => setSelectedCourt(panel.court)} sx={{ fontWeight: 700 }}>{panel.court}</Button>)}
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Math.max(visiblePanels.length, 1), 2)}, minmax(0, 1fr))`, gap: 3 }}>
          {visiblePanels.map((panel) => <CourtPanel key={panel.court} panel={panel} />)}
        </Box>
        {!visiblePanels.length && <Box sx={{ py: 12, textAlign: 'center', color: '#93a7bd', fontSize: 26 }}>尚未设置场地或暂时没有成绩</Box>}
      </Box>
    </Box>
  );
}

function CourtPanel({ panel }) {
  return <Box sx={{ border: '1px solid #315a84', borderRadius: 3, overflow: 'hidden', bgcolor: '#0c1a2d', boxShadow: '0 12px 30px rgba(0,0,0,.28)' }}>
    <Box sx={{ px: { xs: 2, md: 3 }, py: 2, bgcolor: '#103253', borderBottom: '3px solid #f7c948' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography sx={{ color: '#f7c948', fontWeight: 900, fontSize: { xs: 24, md: 36 } }}>{panel.court}</Typography>
        <Chip label={panel.live ? '正在打分' : '最近成绩'} sx={{ bgcolor: panel.live ? '#1d7f5f' : '#3b5875', color: '#fff', fontWeight: 800, fontSize: 15 }} />
      </Stack>
      <Typography sx={{ mt: 1, minHeight: 58, fontWeight: 800, fontSize: { xs: 20, md: 30 }, lineHeight: 1.35 }}>{panel.schedule?.eventName || panel.schedule?.name || '暂无正在进行的项目'}</Typography>
      {panel.schedule && <Typography sx={{ color: '#9ec5ff', fontSize: 16 }}>{panel.schedule.period || '比赛时段未设置'}</Typography>}
    </Box>
    {panel.rows.length ? <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '72px minmax(140px,1fr) minmax(160px,1fr) 130px', px: 2, py: 1.5, bgcolor: '#152b45', color: '#9ec5ff', fontWeight: 800, fontSize: { xs: 15, md: 18 } }}>
        <span>名次</span><span>运动员 / 队伍</span><span>代表单位</span><span style={{ textAlign: 'right' }}>分数</span>
      </Box>
      {panel.rows.map((result, index) => {
        const participant = result.participant || {};
        const teamMembers = membersOf(participant);
        return <Box key={result._id || `${index}-${idOf(participant)}`} sx={{ display: 'grid', gridTemplateColumns: '72px minmax(140px,1fr) minmax(160px,1fr) 130px', alignItems: 'center', px: 2, py: 2, borderTop: '1px solid #203b58', bgcolor: index % 2 ? '#0d2035' : '#0a192b' }}>
          <Box sx={{ color: index < 3 ? '#f7c948' : '#c7d2df', fontWeight: 900, fontSize: { xs: 24, md: 34 } }}>{index + 1}</Box>
          <Box><Typography sx={{ fontSize: { xs: 19, md: 27 }, fontWeight: 800, color: '#f7d76a' }}>{participantName(participant)}</Typography>{teamMembers && <Typography sx={{ mt: .5, color: '#b8cce3', fontSize: { xs: 13, md: 16 } }}>{teamMembers}</Typography>}</Box>
          <Typography sx={{ color: '#d6e4f3', fontSize: { xs: 16, md: 21 }, pr: 1 }}>{participantUnit(participant)}</Typography>
          <Typography sx={{ textAlign: 'right', color: '#ff766d', fontWeight: 900, fontSize: { xs: 24, md: 40 } }}>{showScore(result.score)}</Typography>
        </Box>;
      })}
    </Box> : <Box sx={{ px: 3, py: 9, textAlign: 'center', color: '#92a7bc', fontSize: 22 }}>等待裁判开始打分</Box>}
  </Box>;
}