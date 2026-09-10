import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { ArrowBack, Fullscreen, FullscreenExit, Refresh } from '@mui/icons-material';
import resultService from '../services/resultService';
import scheduleService from '../services/scheduleService';
import competitionService from '../services/competitionService';

const REFRESH_INTERVAL = 2000;
const DISPLAYED_RANKS = 6;
const STANDARD_RANK_LIMIT = 8;
const DIVING_DISPLAYED_RANKS = 6;
const AUTO_SCROLL_START_PAUSE = 3000;
const AUTO_SCROLL_END_PAUSE = 5000;
const AUTO_SCROLL_STEP_INTERVAL = 2500;
const SCOREBOARD_COLUMNS = { xs: '86px minmax(150px, 1.25fr) minmax(120px, .9fr) 100px', md: '120px minmax(250px, 1.45fr) minmax(180px, 1fr) 155px' };
const rowsOf = (payload) => Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
const idOf = (value) => !value ? '' : (typeof value === 'object' ? String(value._id || value.id || '') : String(value));
const timestamp = (value) => { const number = new Date(value || 0).getTime(); return Number.isFinite(number) ? number : 0; };
const scoreOf = (value) => { const number = Number(value); return Number.isFinite(number) ? number : null; };
const showScore = (value) => { const number = scoreOf(value); return number === null ? '待评分' : number.toFixed(2); };
const divingCumulativeScore = (result, publishedRound) => (result?.details?.dives || []).slice(0, publishedRound).reduce((total, dive) => total + (scoreOf(dive?.score) || 0), 0);
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
      const isDiving = currentSchedule?.scoringMode === 'diving';
      const rawRows = currentSchedule ? [...(resultMap.get(idOf(currentSchedule)) || [])] : [];
      // 跳水只使用裁判长按轮确认后的 publishedRound；未确认的后续动作不会参与累计分或排名。
      const publishedRound = isDiving ? Math.max(0, ...rawRows.map((result) => Number(result.details?.publishedRound || 0))) : 0;
      const scoredRows = isDiving
        ? rawRows.filter((result) => Number(result.details?.publishedRound || 0) > 0 && !result.details?.isAbsent)
          .map((result) => ({ ...result, displayScore: divingCumulativeScore(result, Math.min(publishedRound, Number(result.details?.publishedRound || 0))) }))
        : rawRows.filter((result) => result.status === 'verified');
      scoredRows.sort((a, b) => (scoreOf(b.displayScore ?? b.score) ?? -Infinity) - (scoreOf(a.displayScore ?? a.score) ?? -Infinity) || timestamp(a.updatedAt) - timestamp(b.updatedAt));
      return {
        court,
        schedule: currentSchedule,
        rows: scoredRows,
        completedParticipantCount: scoredRows.filter((result) => !result.details?.isAbsent).length,
        live: Boolean(currentSchedule && currentSchedule.status === 'ongoing'),
        isDiving,
        publishedRound
      };
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#07101f', color: '#edf4ff', p: { xs: 1.5, md: 2.5 }, fontFamily: 'Microsoft YaHei, sans-serif' }}>
      <Box sx={{ maxWidth: 1800, mx: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1.25, minHeight: 38 }}>
          <Stack direction="row" spacing={{ xs: .5, md: 1 }} alignItems="center" sx={{ minWidth: 0 }}>
            <Button size="small" startIcon={<ArrowBack sx={{ fontSize: { xs: 15, md: 17 } }} />} onClick={() => navigate('/results')} sx={{ color: '#9ec5ff', minWidth: 0, px: .5, fontSize: { xs: 12, md: 14 }, whiteSpace: 'nowrap' }}>返回成绩管理</Button>
            <Typography sx={{ color: '#f7c948', fontWeight: 800, fontSize: { xs: 17, md: 22 }, letterSpacing: .5, whiteSpace: 'nowrap' }}>大屏即时成绩</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="立即刷新"><IconButton size="small" onClick={() => load(true)} sx={{ color: '#f7c948' }}><Refresh fontSize="small" /></IconButton></Tooltip>
            <Tooltip title={fullScreen ? '退出全屏' : '全屏显示'}><IconButton size="small" onClick={toggleFullScreen} sx={{ color: '#f7c948' }}>{fullScreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}</IconButton></Tooltip>
          </Stack>
        </Stack>
        <Stack direction="row" alignItems="center" sx={{ borderTop: '1px solid #24466d', borderBottom: '1px solid #24466d', py: 1, mb: 1.5, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: { xs: 15, md: 19 }, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{competition?.name || '比赛即时成绩'}</Typography>
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5, gap: 1 }}>
          <Button size="small" variant={selectedCourt === 'all' ? 'contained' : 'outlined'} onClick={() => setSelectedCourt('all')} sx={{ fontWeight: 700 }}>全部场地</Button>
          {panels.map((panel) => <Button size="small" key={panel.court} variant={selectedCourt === panel.court ? 'contained' : 'outlined'} onClick={() => setSelectedCourt(panel.court)} sx={{ fontWeight: 700 }}>{panel.court}</Button>)}
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Math.max(visiblePanels.length, 1), 2)}, minmax(0, 1fr))`, gap: 3 }}>
          {visiblePanels.map((panel) => <CourtPanel key={panel.court} panel={panel} showPrizeLevels={Boolean(competition?.awardRules?.enabled)} singlePanel={visiblePanels.length === 1} fullScreen={fullScreen} />)}
        </Box>
        {!visiblePanels.length && <Box sx={{ py: 12, textAlign: 'center', color: '#93a7bd', fontSize: 26 }}>尚未设置场地或暂时没有成绩</Box>}
      </Box>
    </Box>
  );
}

function CourtPanel({ panel, showPrizeLevels, singlePanel, fullScreen }) {
  const displayLimit = panel.isDiving ? DIVING_DISPLAYED_RANKS : DISPLAYED_RANKS;
  const usePrizeLevels = showPrizeLevels && !panel.isDiving;
  // 武术等常规项目保留原本“最多前八名”的范围，但每屏只展示六人，剩余名次自动滚动。
  const displayRows = panel.isDiving ? panel.rows : (showPrizeLevels ? panel.rows : panel.rows.slice(0, STANDARD_RANK_LIMIT));
  const shouldAutoScroll = displayRows.length > displayLimit;
  const prominentRows = singlePanel && fullScreen;
  const [windowStart, setWindowStart] = useState(0);
  const visibleRows = shouldAutoScroll ? displayRows.slice(windowStart, windowStart + displayLimit) : displayRows;
  // 单场地全屏时，按实际可见的 5 或 6 行均分高度，避免最后留下大块空白。
  const singlePanelRowHeight = `calc((100vh - 335px) / ${Math.min(Math.max(visibleRows.length, 5), 6)})`;

  useEffect(() => {
    setWindowStart(0);
    if (!shouldAutoScroll) return undefined;

    const maxStart = Math.max(displayRows.length - displayLimit, 0);
    let currentStart = 0;
    let timer;
    const advance = () => {
      if (currentStart >= maxStart) {
        currentStart = 0;
        setWindowStart(0);
        timer = window.setTimeout(advance, AUTO_SCROLL_START_PAUSE);
      } else {
        currentStart += 1;
        setWindowStart(currentStart);
        timer = window.setTimeout(advance, currentStart >= maxStart ? AUTO_SCROLL_END_PAUSE : AUTO_SCROLL_STEP_INTERVAL);
      }
    };

    timer = window.setTimeout(advance, AUTO_SCROLL_START_PAUSE);
    return () => window.clearTimeout(timer);
  }, [shouldAutoScroll, displayLimit, displayRows.length]);

  return <Box sx={{ border: '1px solid #315a84', borderRadius: 3, overflow: 'hidden', bgcolor: '#0c1a2d', boxShadow: '0 12px 30px rgba(0,0,0,.28)', minHeight: prominentRows ? 'calc(100vh - 175px)' : undefined }}>
    <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 1.5, md: 2 }, bgcolor: '#103253', borderBottom: '3px solid #f7c948' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography sx={{ color: '#f7c948', fontWeight: 800, fontSize: { xs: 13, md: 16 } }}>{panel.court}</Typography>
        <Stack direction="row" spacing={1}>
          {!panel.isDiving && <Chip label={panel.live ? '正在打分' : '最近成绩'} sx={{ bgcolor: panel.live ? '#1d7f5f' : '#3b5875', color: '#fff', fontWeight: 800, fontSize: 15 }} />}
        </Stack>
      </Stack>
      <Typography sx={{ mt: .5, minHeight: panel.isDiving ? 32 : 44, fontWeight: 900, fontSize: { xs: 20, md: panel.isDiving ? 32 : 26 }, lineHeight: 1.25 }}>{panel.schedule?.eventName || panel.schedule?.name || '暂无正在进行的项目'}</Typography>
      {panel.schedule && <Typography sx={{ color: '#9ec5ff', fontSize: panel.isDiving ? 21 : 16, fontWeight: panel.isDiving ? 800 : 400 }}>{panel.isDiving ? `成绩列表 - 第 ${panel.publishedRound} 轮` : (panel.schedule.period || '比赛时段未设置')}</Typography>}
    </Box>
    {displayRows.length ? <Box sx={{ minHeight: prominentRows ? 'calc(100vh - 285px)' : undefined }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: SCOREBOARD_COLUMNS, columnGap: { xs: 1, md: 3 }, px: 2, py: panel.isDiving ? 1 : 1.5, bgcolor: '#152b45', color: '#9ec5ff', fontWeight: 800, fontSize: { xs: 15, md: panel.isDiving ? 24 : 18 } }}>
        {usePrizeLevels ? <span>奖项</span> : <span>名次</span>}<span>{panel.isDiving ? '姓名／双人组合' : '运动员 / 队伍'}</span><span>单位</span><span style={{ textAlign: 'right' }}>{panel.isDiving ? '累计实得分' : '分数'}</span>
      </Box>
      <Box key={windowStart} sx={{ animation: shouldAutoScroll ? 'live-scoreboard-window-in .42s ease-out' : 'none', '@keyframes live-scoreboard-window-in': { from: { opacity: .55, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
      {visibleRows.map((result, index) => {
        const absoluteIndex = windowStart + index;
        const participant = result.participant || {};
        const teamMembers = membersOf(participant);
        const firstPrizeLimit = Math.max(1, Math.ceil(panel.completedParticipantCount * 0.3));
        const secondPrizeLimit = Math.max(firstPrizeLimit, Math.ceil(panel.completedParticipantCount * 0.6));
        const awardLevel = absoluteIndex + 1 <= firstPrizeLimit ? '一等奖' : (absoluteIndex + 1 <= secondPrizeLimit ? '二等奖' : '三等奖');
        const awardColor = awardLevel === '一等奖' ? '#f7c948' : (awardLevel === '二等奖' ? '#9ec5ff' : '#d7a86e');
        return <Box key={result._id || `${index}-${idOf(participant)}`} sx={{ display: 'grid', gridTemplateColumns: SCOREBOARD_COLUMNS, columnGap: { xs: 1, md: 3 }, alignItems: 'center', px: { xs: 1.25, md: 2 }, py: panel.isDiving ? 1.35 : 1.15, minHeight: panel.isDiving ? 104 : (prominentRows ? singlePanelRowHeight : 86), borderTop: '1px solid #203b58', bgcolor: absoluteIndex % 2 ? '#0d2035' : '#0a192b' }}>
          <Box sx={{ color: usePrizeLevels ? awardColor : (absoluteIndex < 3 ? '#f7c948' : '#c7d2df'), fontWeight: 900, fontSize: { xs: 24, md: panel.isDiving ? 42 : (prominentRows ? 34 : 29) } }}>{usePrizeLevels ? awardLevel : absoluteIndex + 1}</Box>
          <Box><Typography sx={{ fontSize: { xs: 19, md: panel.isDiving ? 38 : (prominentRows ? 42 : 32) }, fontWeight: 800, color: '#f7d76a' }}>{participantName(participant)}</Typography>{teamMembers && <Typography sx={{ mt: .25, color: '#b8cce3', fontSize: { xs: 13, md: panel.isDiving ? 18 : (prominentRows ? 20 : 17) } }}>{teamMembers}</Typography>}</Box>
          <Typography sx={{ color: '#d6e4f3', fontSize: { xs: 16, md: panel.isDiving ? 27 : (prominentRows ? 26 : 22) }, pr: 1 }}>{participantUnit(participant)}</Typography>
          <Typography sx={{ textAlign: 'right', color: '#ff766d', fontWeight: 900, fontSize: { xs: 24, md: panel.isDiving ? 45 : (prominentRows ? 46 : 39) } }}>{showScore(result.displayScore ?? result.score)}</Typography>
        </Box>;
      })}
      </Box>
    </Box> : <Box sx={{ px: 3, py: 9, textAlign: 'center', color: '#92a7bc', fontSize: 22 }}>等待裁判开始打分</Box>}
  </Box>;
}
