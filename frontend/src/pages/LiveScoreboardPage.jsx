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
// 奖项规则用于录取、证书和团体积分。大屏显示方式可逐场选择；旧的纯比例赛事未配置时继续显示等奖。
const usesPrizeLevelScoreboard = (competition) => {
  const rules = competition?.awardRules;
  if (rules?.scoreboardDisplay === 'prize') return true;
  if (rules?.scoreboardDisplay === 'rank') return false;
  return Boolean(rules?.enabled && rules?.mode === 'legacy_percentage');
};
const divingCumulativeScore = (result, publishedRound) => (result?.details?.dives || []).slice(0, publishedRound).reduce((total, dive) => total + (scoreOf(dive?.score) || 0), 0);
const isStrengthScore = (schedule, rows = []) => /素质力量|素質力量/.test(String(schedule?.name || '')) || rows.some((result) => result?.details?.scoringType === 'strength');
const isRoundDiving = (schedule, rows = []) => schedule?.scoringMode === 'diving' && !isStrengthScore(schedule, rows);
const genderLabel = (schedule) => {
  const name = String(schedule?.eventName || schedule?.name || '');
  if (/男子|男/.test(name)) return '男子';
  if (/女子|女/.test(name)) return '女子';
  return '';
};
// 跳水赛程以名称区分男女；大屏只在同日、同场地、同一器械项目时把男女归为一个大项目。
const divingGroupName = (schedule) => String(schedule?.eventName || schedule?.name || '').replace(/男子|女子/g, '').replace(/\s+/g, ' ').trim();
const divingGroupKey = (schedule) => [schedule?.scheduleDate || '', schedule?.court || '', divingGroupName(schedule)].join('|');
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
      const rowsFor = (schedule) => resultMap.get(idOf(schedule)) || [];
      // 只有主裁“确认并上屏”会更新 publishedAt；普通裁判保存分数不应切换大屏项目。
      const publicActivity = (schedule) => Math.max(0, ...rowsFor(schedule).map((result) => Number(result.details?.publishedRound || 0) > 0
        ? timestamp(result.details?.publishedAt || result.updatedAt || result.submittedAt)
        : 0));
      const activity = (schedule) => Math.max(publicActivity(schedule), timestamp(schedule.updatedAt), ...rowsFor(schedule).map((item) => Math.max(timestamp(item.updatedAt), timestamp(item.submittedAt), timestamp(item.createdAt))));
      const groupMap = new Map();
      courtSchedules.forEach((schedule) => {
        const rows = rowsFor(schedule);
        const isDivingSchedule = isRoundDiving(schedule, rows);
        const key = isDivingSchedule ? divingGroupKey(schedule) : `schedule:${idOf(schedule)}`;
        const group = groupMap.get(key) || { key, schedules: [], name: isDivingSchedule ? divingGroupName(schedule) : (schedule.eventName || schedule.name), isDiving: isDivingSchedule };
        group.schedules.push(schedule);
        groupMap.set(key, group);
      });
      const groups = [...groupMap.values()].map((group) => ({
        ...group,
        order: Math.min(...group.schedules.map((schedule) => Number(schedule.order || 0))),
        completed: group.schedules.every((schedule) => schedule.status === 'completed'),
        hasOngoing: group.schedules.some((schedule) => schedule.status === 'ongoing'),
        publicActivity: Math.max(0, ...group.schedules.map(publicActivity)),
        activity: Math.max(0, ...group.schedules.map(activity))
      }));
      // 同一跳水大项目的男女未都结束前，不能跳到下一器械项目。
      const activeGroups = groups.filter((group) => !group.completed && (group.hasOngoing || group.publicActivity > 0 || group.activity > 0));
      const currentGroup = [...(activeGroups.length ? activeGroups : groups)]
        .sort((a, b) => a.order - b.order || b.publicActivity - a.publicActivity || b.activity - a.activity)[0];
      const currentSchedule = currentGroup
        ? [...currentGroup.schedules].sort((a, b) => publicActivity(b) - publicActivity(a) || activity(b) - activity(a) || Number(a.order || 0) - Number(b.order || 0))[0]
        : null;
      const makeScoreboardRows = (schedule) => {
        const rawRows = schedule ? [...rowsFor(schedule)] : [];
        const isDivingSchedule = isRoundDiving(schedule, rawRows);
        const publishedRound = isDivingSchedule ? Math.max(0, ...rawRows.map((result) => Number(result.details?.publishedRound || 0))) : 0;
        // 跳水只显示主裁逐人确认后的公开动作快照；未确认的后续动作不会参与累计分或排名。
        const rows = isDivingSchedule
          ? rawRows.filter((result) => Number(result.details?.publishedRound || 0) > 0 && !result.details?.isAbsent)
            .map((result) => {
              const resultPublishedRound = Number(result.details?.publishedRound || 0);
              const publicDives = Array.isArray(result.details?.publishedDives) ? result.details.publishedDives : result.details?.dives;
              return { ...result, displayScore: divingCumulativeScore({ ...result, details: { ...result.details, dives: publicDives } }, resultPublishedRound) };
            })
          : rawRows.filter((result) => result.status === 'verified');
        rows.sort((a, b) => (scoreOf(b.displayScore ?? b.score) ?? -Infinity) - (scoreOf(a.displayScore ?? a.score) ?? -Infinity) || timestamp(a.updatedAt) - timestamp(b.updatedAt));
        return { schedule, rows, isDiving: isDivingSchedule, publishedRound, subgroupName: genderLabel(schedule) };
      };
      const currentData = makeScoreboardRows(currentSchedule);
      // 同一大项目内，男子榜完整显示后自动轮播女子榜；没有公开成绩的一方暂不占用大屏。
      const subgroups = currentGroup?.isDiving
        ? currentGroup.schedules.map(makeScoreboardRows).filter((subgroup) => subgroup.rows.length > 0)
          .sort((left, right) => ({ 男子: 0, 女子: 1 }[left.subgroupName] ?? 2) - ({ 男子: 0, 女子: 1 }[right.subgroupName] ?? 2))
        : [currentData];
      return {
        court,
        schedule: currentSchedule,
        groupName: currentGroup?.name,
        subgroupName: currentData.subgroupName,
        rows: currentData.rows,
        subgroups: subgroups.length ? subgroups : [currentData],
        completedParticipantCount: currentData.rows.filter((result) => !result.details?.isAbsent).length,
        live: Boolean(currentSchedule && currentSchedule.status === 'ongoing'),
        isDiving: currentData.isDiving,
        publishedRound: currentData.publishedRound
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
          {visiblePanels.map((panel) => <CourtPanel key={panel.court} panel={panel} showPrizeLevels={usesPrizeLevelScoreboard(competition)} singlePanel={visiblePanels.length === 1} fullScreen={fullScreen} />)}
        </Box>
        {!visiblePanels.length && <Box sx={{ py: 12, textAlign: 'center', color: '#93a7bd', fontSize: 26 }}>尚未设置场地或暂时没有成绩</Box>}
      </Box>
    </Box>
  );
}

function CourtPanel({ panel, showPrizeLevels, singlePanel, fullScreen }) {
  const rotationKey = (panel.subgroups || []).map((subgroup) => idOf(subgroup.schedule)).join('|');
  const [activeSubgroupIndex, setActiveSubgroupIndex] = useState(0);
  const activeSubgroup = panel.subgroups?.[activeSubgroupIndex] || panel.subgroups?.[0] || { rows: panel.rows, schedule: panel.schedule, isDiving: panel.isDiving, publishedRound: panel.publishedRound, subgroupName: panel.subgroupName };
  const displayLimit = activeSubgroup.isDiving ? DIVING_DISPLAYED_RANKS : DISPLAYED_RANKS;
  const usePrizeLevels = showPrizeLevels && !activeSubgroup.isDiving;
  // 武术等常规项目保留原本“最多前八名”的范围，但每屏只展示六人，剩余名次自动滚动。
  const displayRows = activeSubgroup.isDiving ? activeSubgroup.rows : (showPrizeLevels ? activeSubgroup.rows : activeSubgroup.rows.slice(0, STANDARD_RANK_LIMIT));
  const shouldAutoScroll = displayRows.length > displayLimit;
  const shouldRotateSubgroups = Boolean(activeSubgroup.isDiving && (panel.subgroups?.length || 0) > 1);
  const prominentRows = singlePanel && fullScreen;
  const [windowStart, setWindowStart] = useState(0);
  const visibleRows = shouldAutoScroll ? displayRows.slice(windowStart, windowStart + displayLimit) : displayRows;
  // 单场地全屏时，按实际可见的 5 或 6 行均分高度，避免最后留下大块空白。
  const singlePanelRowHeight = `calc((100vh - 335px) / ${Math.min(Math.max(visibleRows.length, 5), 6)})`;

  useEffect(() => {
    setWindowStart(0);
    setActiveSubgroupIndex((index) => index >= (panel.subgroups?.length || 1) ? 0 : index);
  }, [rotationKey]);

  useEffect(() => {
    const nextSubgroup = () => {
      if (!shouldRotateSubgroups) return;
      setWindowStart(0);
      setActiveSubgroupIndex((index) => (index + 1) % panel.subgroups.length);
    };

    if (!shouldAutoScroll) {
      if (!shouldRotateSubgroups) return undefined;
      const timer = window.setTimeout(nextSubgroup, AUTO_SCROLL_END_PAUSE);
      return () => window.clearTimeout(timer);
    }

    const maxStart = Math.max(displayRows.length - displayLimit, 0);
    let currentStart = 0;
    let timer;
    const advance = () => {
      if (currentStart >= maxStart) {
        currentStart = 0;
        setWindowStart(0);
        nextSubgroup();
        timer = window.setTimeout(advance, AUTO_SCROLL_START_PAUSE);
      } else {
        currentStart += 1;
        setWindowStart(currentStart);
        timer = window.setTimeout(advance, currentStart >= maxStart ? AUTO_SCROLL_END_PAUSE : AUTO_SCROLL_STEP_INTERVAL);
      }
    };

    timer = window.setTimeout(advance, AUTO_SCROLL_START_PAUSE);
    return () => window.clearTimeout(timer);
  }, [shouldAutoScroll, shouldRotateSubgroups, displayLimit, displayRows.length, activeSubgroupIndex, rotationKey]);

  return <Box sx={{ border: '1px solid #315a84', borderRadius: 3, overflow: 'hidden', bgcolor: '#0c1a2d', boxShadow: '0 12px 30px rgba(0,0,0,.28)', minHeight: prominentRows ? 'calc(100vh - 175px)' : undefined }}>
    <Box sx={{ position: 'relative', minHeight: { xs: 94, md: 126 }, px: { xs: 2, md: 3 }, py: { xs: 1.5, md: 2 }, pr: { xs: 10, md: 21 }, bgcolor: '#103253', borderBottom: '3px solid #f7c948' }}>
      <Box component="img" src="/assets/saiyitong-logo-watermark.png" alt="赛易通" sx={{ position: 'absolute', top: { xs: 10, md: 12 }, right: { xs: 12, md: 20 }, width: { xs: 62, md: 118 }, height: { xs: 62, md: 108 }, objectFit: 'contain' }} />
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography sx={{ color: '#f7c948', fontWeight: 800, fontSize: { xs: 13, md: 16 } }}>{panel.court}</Typography>
        <Stack direction="row" spacing={1}>
          {!panel.isDiving && <Chip label={panel.live ? '正在打分' : '最近成绩'} sx={{ bgcolor: panel.live ? '#1d7f5f' : '#3b5875', color: '#fff', fontWeight: 800, fontSize: 15 }} />}
        </Stack>
      </Stack>
      <Typography sx={{ mt: .5, minHeight: panel.isDiving ? 32 : 44, fontWeight: 900, fontSize: { xs: 20, md: panel.isDiving ? 32 : 26 }, lineHeight: 1.25 }}>{panel.groupName || panel.schedule?.eventName || panel.schedule?.name || '暂无正在进行的项目'}</Typography>
      {activeSubgroup.schedule && <Typography sx={{ color: '#9ec5ff', fontSize: activeSubgroup.isDiving ? 21 : 16, fontWeight: activeSubgroup.isDiving ? 800 : 400 }}>{activeSubgroup.isDiving ? `${activeSubgroup.subgroupName ? `${activeSubgroup.subgroupName} · ` : ''}已确认累计成绩 · 最高第 ${activeSubgroup.publishedRound} 轮` : (activeSubgroup.schedule.period || '比赛时段未设置')}</Typography>}
    </Box>
    {displayRows.length ? <Box sx={{ minHeight: prominentRows ? 'calc(100vh - 285px)' : undefined }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: SCOREBOARD_COLUMNS, columnGap: { xs: 1, md: 3 }, px: 2, py: panel.isDiving ? 1 : 1.5, bgcolor: '#152b45', color: '#9ec5ff', fontWeight: 800, fontSize: { xs: 15, md: panel.isDiving ? 24 : 18 } }}>
        {usePrizeLevels ? <span>奖项</span> : <span>名次</span>}<span>{activeSubgroup.isDiving ? '姓名／双人组合' : '运动员 / 队伍'}</span><span>单位</span><span style={{ textAlign: 'right' }}>{activeSubgroup.isDiving ? '累计实得分' : '分数'}</span>
      </Box>
      <Box key={windowStart} sx={{ animation: shouldAutoScroll ? 'live-scoreboard-window-in .42s ease-out' : 'none', '@keyframes live-scoreboard-window-in': { from: { opacity: .55, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
      {visibleRows.map((result, index) => {
        const absoluteIndex = windowStart + index;
        const participant = result.participant || {};
        const teamMembers = membersOf(participant);
        // 素质力量等项目会在后台保存正式名次；其余旧成绩尚未保存名次时保持原有排序序号，避免出现空白。
        const savedRank = Number(result.rank);
        const displayRank = Number.isFinite(savedRank) && savedRank > 0 ? savedRank : absoluteIndex + 1;
        const firstPrizeLimit = Math.max(1, Math.ceil(activeSubgroup.rows.filter((row) => !row.details?.isAbsent).length * 0.3));
        const secondPrizeLimit = Math.max(firstPrizeLimit, Math.ceil(panel.completedParticipantCount * 0.6));
        const awardLevel = absoluteIndex + 1 <= firstPrizeLimit ? '一等奖' : (absoluteIndex + 1 <= secondPrizeLimit ? '二等奖' : '三等奖');
        const awardColor = awardLevel === '一等奖' ? '#f7c948' : (awardLevel === '二等奖' ? '#9ec5ff' : '#d7a86e');
        return <Box key={result._id || `${index}-${idOf(participant)}`} sx={{ display: 'grid', gridTemplateColumns: SCOREBOARD_COLUMNS, columnGap: { xs: 1, md: 3 }, alignItems: 'center', px: { xs: 1.25, md: 2 }, py: activeSubgroup.isDiving ? 1.35 : 1.15, minHeight: activeSubgroup.isDiving ? 104 : (prominentRows ? singlePanelRowHeight : 86), borderTop: '1px solid #203b58', bgcolor: absoluteIndex % 2 ? '#0d2035' : '#0a192b' }}>
          <Box sx={{ color: usePrizeLevels ? awardColor : (displayRank <= 3 ? '#f7c948' : '#c7d2df'), fontWeight: 900, fontSize: { xs: 24, md: activeSubgroup.isDiving ? 42 : (prominentRows ? 34 : 29) } }}>{usePrizeLevels ? awardLevel : displayRank}</Box>
          <Box><Typography sx={{ fontSize: { xs: 19, md: activeSubgroup.isDiving ? 38 : (prominentRows ? 42 : 32) }, fontWeight: 800, color: '#f7d76a' }}>{participantName(participant)}</Typography>{teamMembers && <Typography sx={{ mt: .25, color: '#b8cce3', fontSize: { xs: 13, md: activeSubgroup.isDiving ? 18 : (prominentRows ? 20 : 17) } }}>{teamMembers}</Typography>}</Box>
          <Typography sx={{ color: '#d6e4f3', fontSize: { xs: 16, md: activeSubgroup.isDiving ? 27 : (prominentRows ? 26 : 22) }, pr: 1 }}>{participantUnit(participant)}</Typography>
          <Typography sx={{ textAlign: 'right', color: '#ff766d', fontWeight: 900, fontSize: { xs: 24, md: activeSubgroup.isDiving ? 45 : (prominentRows ? 46 : 39) } }}>{showScore(result.displayScore ?? result.score)}</Typography>
        </Box>;
      })}
      </Box>
    </Box> : <Box sx={{ px: 3, py: 9, textAlign: 'center', color: '#92a7bc', fontSize: 22 }}>等待裁判开始打分</Box>}
  </Box>;
}
