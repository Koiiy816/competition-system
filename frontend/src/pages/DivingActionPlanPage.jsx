import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Pagination, Paper, TextField, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import participantService from '../services/participantService';
import competitionService from '../services/competitionService';
import { useAuth } from '../contexts/AuthContext';
import divingDifficultyTable from '../data/divingDifficultyTable';
import DivingPlanPrintPreview from '../components/DivingPlanPrintPreview';
import { isCompletedDivingPlan } from '../utils/divingPlanPrint';

const isDiving = (participant) => /跳水|跳板|跳台|陆上|陸上|冰棍|倒下|素质/.test(String(participant.event || ''));
const isLandDiving = (participant) => /陆上|陸上/.test(String(participant.event || ''));
const isStrengthEvent = (participant) => /素质力量/.test(String(participant.event || ''));
const strengthActions = ['垫上两头起10次', '肋木举腿5次', '立定跳远', '提膝跳5次', '提膝跳10次', '引体控20秒', '引体控40秒'];

const collapseDivingPairs = (rows) => {
  const seenPairs = new Set();
  return rows.filter((row) => {
    const pairId = row.additionalInfo?.divingPair?.pairId;
    if (!pairId) return true;
    if (seenPairs.has(pairId)) return false;
    seenPairs.add(pairId);
    return true;
  });
};
const customDifficulties = {
  '五弹A': 1,
  '三弹C': 1,
  '向后立定A': 1,
  '向后立定C': 1,
  '三弹冰棍A': 0.5,
  '三弹冰棍B': 0.7,
  '向前冰棍A': 0.5,
  '向前冰棍B': 0.7,
  '向前冰棍C': 0.6,
  '向后冰棍A': 0.6,
  '向后冰棍B': 0.8,
  '向后冰棍C': 0.7,
  '前倒A': 1,
  '前倒B': 1,
  '向前站倒B': 1,
  '坐倒B': 1,
  '坐倒C': 1,
  '后倒A': 1,
  '后倒B': 1,
  '后倒C': 1,
  '三弹101B': 1.3,
  '三弹101C': 1.2
};
const getActionCode = (value) => String(value || '').normalize('NFKC').trim().toUpperCase().replace(/\s+/g, '');
const getCompatibleDifficulties = (event, platformHeight) => {
  const boardHeight = /3米跳板/.test(event) ? '3m' : '1m';
  const primary = /跳板/.test(event)
    ? divingDifficultyTable.board[boardHeight]
    : (/跳台/.test(event) && platformHeight ? divingDifficultyTable.platform[platformHeight] : null);
  const sources = /跳板/.test(event)
    ? [primary, divingDifficultyTable.board[boardHeight === '3m' ? '1m' : '3m'], ...Object.values(divingDifficultyTable.platform)]
    : [primary, ...Object.values(divingDifficultyTable.platform), ...Object.values(divingDifficultyTable.board)];
  return sources.filter(Boolean);
};
const getDifficulty = (participant, platformHeight, actionCode) => {
  const event = String(participant.event || '');
  const code = getActionCode(actionCode);
  if (isLandDiving(participant)) return undefined;
  const custom = customDifficulties[code];
  if (custom !== undefined) return custom;
  return getCompatibleDifficulties(event, platformHeight).find((actions) => actions[code] !== undefined)?.[code];
};

const groupKey = (participant) => {
  const group = String(participant.ageGroup || participant.grade || '');
  return ['U12', 'U10', 'U8', 'U7'].find((key) => group.includes(key)) || '';
};

const getRule = (participant) => {
  const group = groupKey(participant);
  const event = String(participant.event || '');
  return {
    group,
    maxDives: 20,
    platformHeight: group === 'U10' && /跳台/.test(event) ? '5m' : ''
  };
};

const buildPlan = (participant, currentPlan) => {
  const rule = getRule(participant);
  const existing = Array.isArray(currentPlan?.dives) ? currentPlan.dives : [];
  const dives = existing.length
    ? existing.map((dive) => ({ actionCode: dive?.actionCode || '', difficulty: isStrengthEvent(participant) ? '' : (isLandDiving(participant) && (dive?.difficulty === '' || dive?.difficulty == null) ? 1 : (dive?.difficulty ?? '')) }))
    : [{ actionCode: '', difficulty: isLandDiving(participant) ? 1 : '' }];
  return { takeoffOrHeight: currentPlan?.takeoffOrHeight || rule.platformHeight || '', dives };
};

const getPlanIssues = (participant, plan) => {
  const dives = Array.isArray(plan?.dives) ? plan.dives : [];
  const missingActionIndexes = dives.reduce((indexes, dive, index) => {
    if (!String(dive?.actionCode || '').trim()) indexes.push(index + 1);
    return indexes;
  }, []);
  if (isLandDiving(participant) || isStrengthEvent(participant)) return { missingActionIndexes, unmatchedDives: [], missingDifficultyDives: [] };

  const unmatchedDives = dives.reduce((entries, dive, index) => {
    const actionCode = getActionCode(dive?.actionCode);
    if (actionCode && getDifficulty(participant, plan?.takeoffOrHeight, actionCode) === undefined) entries.push({ index: index + 1, actionCode, difficulty: dive?.difficulty });
    return entries;
  }, []);
  const missingDifficultyDives = unmatchedDives.filter(({ difficulty }) => !Number.isFinite(Number(difficulty)) || Number(difficulty) <= 0);
  return { missingActionIndexes, unmatchedDives, missingDifficultyDives };
};

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

const searchableParticipantText = (participant) => [
  participant.name,
  participant.additionalInfo?.divingPair?.partnerName,
  participant.competition?.name,
  participant.event,
  participant.ageGroup,
  participant.grade,
  participant.unit,
  participant.teamName
].filter(Boolean).join(' ').toLocaleLowerCase();

const DivingPlanCard = memo(function DivingPlanCard({ item, plan, saving, onPlanChange, onSave }) {
  const rule = getRule(item);
  const landDiving = isLandDiving(item);
  const strengthEvent = isStrengthEvent(item);
  const issues = getPlanIssues(item, plan);
  const showPlatformHeight = /跳台/.test(String(item.event || '')) && ['U12', 'U10'].includes(rule.group);

  return <Paper sx={{ p: 2, mb: 2 }}>
    <Typography fontWeight="bold">{item.competition?.name} · {item.additionalInfo?.divingPair ? `${item.name}／${item.additionalInfo.divingPair.partnerName}` : item.name} · {item.event} · {item.ageGroup || item.grade}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
      {strengthEvent ? '请选择比赛动作；素质力量项目不设置难度系数。' : (landDiving ? '陆上网、陆上板动作的难度系数默认是 1，可按实际动作修改。' : '动作数量可按实际参赛轮次添加；未收录动作的难度系数可暂时留空。')}
    </Typography>
    {issues.missingActionIndexes.length > 0 && <Alert severity="warning" sx={{ mt: 1.5 }}>待补动作代码：第 {issues.missingActionIndexes.join('、')} 轮。</Alert>}
    {issues.unmatchedDives.length > 0 && <Alert severity={issues.missingDifficultyDives.length ? 'warning' : 'info'} sx={{ mt: 1.5 }}>
      未匹配官方难度：{issues.unmatchedDives.map(({ index, actionCode }) => `第 ${index} 轮「${actionCode}」`).join('、')}。{issues.missingDifficultyDives.length ? `其中第 ${issues.missingDifficultyDives.map(({ index }) => index).join('、')} 轮还未手填难度系数。` : '已使用手填难度系数。'}
    </Alert>}
    {item.additionalInfo?.divingPair && <Typography variant="body2" color="primary">双人 {item.additionalInfo.divingPair.pairCode} · 搭档：{item.additionalInfo.divingPair.partnerName} · 只需填写这一份动作表，保存后会自动同步。</Typography>}
    {showPlatformHeight && <TextField
      select fullWidth size="small" required disabled={rule.group === 'U10'} label="实际跳台高度"
      value={plan.takeoffOrHeight}
      onChange={(event) => onPlanChange(item._id, (current) => ({ ...current, takeoffOrHeight: event.target.value }))}
      helperText={rule.group === 'U10' ? 'U10 组按规程使用 5 米跳台。' : '请选择实际使用的跳台高度，以匹配官方难度系数。'}
      sx={{ mt: 1.5 }}
    >
      {rule.group === 'U12' && <MenuItem value="">请选择</MenuItem>}
      <MenuItem value="5m">5 米跳台</MenuItem>
      {rule.group === 'U12' && <MenuItem value="7.5m">7.5 米跳台</MenuItem>}
      {rule.group === 'U12' && <MenuItem value="10m">10 米跳台</MenuItem>}
    </TextField>}
    {plan.dives.map((dive, index) => {
      const matchedDifficulty = getDifficulty(item, plan.takeoffOrHeight, dive.actionCode);
      return <Box key={index} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: strengthEvent ? '1fr auto' : '1fr 180px auto' }, gap: 1, mt: 1 }}>
        <TextField
          select={strengthEvent} fullWidth size="small" required label={'第 ' + (index + 1) + ' 个动作'} value={dive.actionCode || ''}
          onChange={(event) => onPlanChange(item._id, (current) => ({
            ...current,
            dives: current.dives.map((entry, diveIndex) => diveIndex === index ? { ...entry, actionCode: event.target.value } : entry)
          }))}
        >
          {strengthEvent && <MenuItem value="">请选择动作</MenuItem>}
          {strengthEvent && strengthActions.map((action) => <MenuItem key={action} value={action}>{action}</MenuItem>)}
        </TextField>
        {!strengthEvent && <TextField
          size="small" type="number" label={landDiving ? '难度系数（默认 1）' : (matchedDifficulty === undefined ? '难度系数（可选）' : '官方难度系数')}
          value={matchedDifficulty ?? dive.difficulty ?? ''} disabled={matchedDifficulty !== undefined}
          inputProps={{ min: 0.1, max: 10, step: 0.1 }}
          helperText={landDiving ? '默认值为 1，可按实际动作修改' : (matchedDifficulty === undefined ? '未收录动作可暂不填写，之后可补录' : '已自动带出')}
          onChange={(event) => onPlanChange(item._id, (current) => ({
            ...current,
            dives: current.dives.map((entry, diveIndex) => diveIndex === index ? { ...entry, difficulty: event.target.value } : entry)
          }))}
        />}
        <Button color="error" disabled={plan.dives.length === 1} onClick={() => onPlanChange(item._id, (current) => ({
          ...current,
          dives: current.dives.filter((_, diveIndex) => diveIndex !== index)
        }))}>删除</Button>
      </Box>;
    })}
    <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
      <Button variant="outlined" disabled={plan.dives.length >= rule.maxDives} onClick={() => onPlanChange(item._id, (current) => ({
        ...current,
        dives: [...current.dives, { actionCode: '', difficulty: isLandDiving(item) ? 1 : '' }]
      }))}>＋ 添加动作</Button>
      <Button variant="contained" disabled={saving} onClick={() => onSave(item, plan)}>
        {saving ? '保存中…' : '保存动作表'}
      </Button>
    </Box>
  </Paper>;
});

export default function DivingActionPlanPage() {
  const [searchParams] = useSearchParams();
  const focusCompetitionId = searchParams.get('competitionId');
  const focusParticipantId = searchParams.get('participantId');
  const { user } = useAuth();
  const canManageAll = user?.roles?.some((role) => ['admin', 'chief_referee'].includes(role));
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [issueFilter, setIssueFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [printOpen, setPrintOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let rows;
      if (canManageAll) {
        const competitionResponse = await competitionService.getCompetitions({ limit: 100 });
        const competitions = competitionResponse.data || [];
        const participantResponses = await Promise.all(
          competitions.map((competition) => participantService.getParticipants(competition._id, { limit: 10000 }))
        );
        rows = participantResponses.flatMap((response) => response.data || []).filter(isDiving);
      } else {
        const response = await participantService.getMyParticipations();
        rows = (response.data || []).filter(isDiving);
      }
      rows = collapseDivingPairs(rows);
      if (focusCompetitionId || focusParticipantId) {
        rows = rows.filter((row) => {
          const rowCompetitionId = String(row.competition?._id || row.competition || '');
          const matchesCompetition = !focusCompetitionId || rowCompetitionId === focusCompetitionId;
          const matchesParticipant = !focusParticipantId || row._id === focusParticipantId || row.additionalInfo?.divingPair?.partnerId === focusParticipantId;
          return matchesCompetition && matchesParticipant;
        });
      }
      setItems(rows);
      setPlans(Object.fromEntries(rows.map((row) => [row._id, buildPlan(row, row.additionalInfo?.divingPlan)])));
      setPage(1);
    } catch (error) {
      setMessage({ severity: 'error', text: '加载失败：' + (error.message || '无法读取报名资料') });
    } finally {
      setLoading(false);
    }
  }, [canManageAll, focusCompetitionId, focusParticipantId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (item, currentPlan) => {
    const rule = getRule(item);
    const plan = buildPlan(item, currentPlan);
    const completedPlan = { ...plan, dives: plan.dives.map((dive) => ({ ...dive, difficulty: getDifficulty(item, plan.takeoffOrHeight, dive.actionCode) ?? dive.difficulty })) };
    if (rule.group === 'U12' && /跳台/.test(String(item.event || '')) && !completedPlan.takeoffOrHeight) {
      setMessage({ severity: 'error', text: '请选择实际跳台高度（5 米、7.5 米或 10 米）。' });
      return;
    }

    if (!completedPlan.dives.length || completedPlan.dives.length > rule.maxDives) {
      setMessage({ severity: 'error', text: `请至少填写 1 个动作，最多 ${rule.maxDives} 个。` });
      return;
    }

    if (completedPlan.dives.some((dive) => !String(dive.actionCode || '').trim())) {
      setMessage({ severity: 'error', text: '请填写每一个已添加动作的代码。' });
      return;
    }

    setSavingId(item._id);
    try {
      const response = await participantService.saveDivingPlan(item.competition._id || item.competition, item._id, completedPlan);
      setMessage({ severity: 'success', text: response.message || '动作表已保存。' });
      await load();
    } catch (error) {
      setMessage({ severity: 'error', text: error.message || '保存失败' });
    } finally {
      setSavingId('');
    }
  }, [load]);

  const updatePlan = useCallback((participantId, updater) => {
    setPlans((current) => {
      const existingPlan = current[participantId];
      if (!existingPlan) return current;
      return { ...current, [participantId]: updater(existingPlan) };
    });
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const plan = plans[item._id];
      const issues = getPlanIssues(item, plan);
      const matchesSearch = !normalizedTerm || searchableParticipantText(item).includes(normalizedTerm);
      const matchesIssue = issueFilter === 'all'
        || (issueFilter === 'missing-action' && issues.missingActionIndexes.length > 0)
        || (issueFilter === 'unmatched-difficulty' && issues.unmatchedDives.length > 0)
        || (issueFilter === 'missing-difficulty' && issues.missingDifficultyDives.length > 0);
      return matchesSearch && matchesIssue;
    });
  }, [items, plans, searchTerm, issueFilter]);
  const issueSummary = useMemo(() => items.reduce((summary, item) => {
    const issues = getPlanIssues(item, plans[item._id]);
    if (issues.missingActionIndexes.length) summary.missingActionPeople += 1;
    if (issues.unmatchedDives.length) summary.unmatchedDifficultyPeople += 1;
    if (issues.missingDifficultyDives.length) summary.missingDifficultyPeople += 1;
    return summary;
  }, { missingActionPeople: 0, unmatchedDifficultyPeople: 0, missingDifficultyPeople: 0 }), [items, plans]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const canPrint = items.length > 0 && items.every(isCompletedDivingPlan);
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [currentPage, filteredItems, pageSize]);

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  return <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
    <Typography variant="h4" gutterBottom>补录跳水动作表</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>先填写第一个动作代码；需要增加动作时点击“＋ 添加动作”。系统会优先按当前项目匹配难度，其他已收录项目的动作也会自动适配；未收录动作可先保存，之后再补录难度。</Typography>
    <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
      <TextField
        fullWidth
        size="small"
        label="搜索选手"
        placeholder="姓名、搭档、比赛、项目、组别或单位"
        value={searchTerm}
        onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }}
        sx={{ flex: '1 1 360px' }}
      />
      <TextField
        select
        size="small"
        label="待处理筛选"
        value={issueFilter}
        onChange={(event) => { setIssueFilter(event.target.value); setPage(1); }}
        sx={{ width: 190 }}
      >
        <MenuItem value="all">全部选手</MenuItem>
        <MenuItem value="missing-action">未填动作代码</MenuItem>
        <MenuItem value="unmatched-difficulty">未匹配官方难度</MenuItem>
        <MenuItem value="missing-difficulty">未匹配且未填难度</MenuItem>
      </TextField>
      <TextField
        select
        size="small"
        label="每页人数"
        value={pageSize}
        onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
        sx={{ width: 130 }}
      >
        {PAGE_SIZE_OPTIONS.map((size) => <MenuItem key={size} value={size}>{size} 人</MenuItem>)}
      </TextField>
      <Button variant="contained" startIcon={<PrintIcon />} disabled={!canPrint} onClick={() => setPrintOpen(true)}>打印全部动作表</Button>
      {items.length > 0 && !canPrint && <Typography variant="caption" color="text.secondary">完成本单位全部项目的动作补录后可打印。</Typography>}
    </Paper>
    {canManageAll && <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" fontWeight="bold" sx={{ mr: 0.5 }}>动作表待处理概览</Typography>
      <Chip color={issueSummary.missingActionPeople ? 'warning' : 'success'} label={`未填动作代码：${issueSummary.missingActionPeople} 人`} />
      <Chip color={issueSummary.unmatchedDifficultyPeople ? 'warning' : 'success'} label={`未匹配官方难度：${issueSummary.unmatchedDifficultyPeople} 人`} />
      <Chip color={issueSummary.missingDifficultyPeople ? 'error' : 'success'} label={`未匹配且未填难度：${issueSummary.missingDifficultyPeople} 人`} />
    </Paper>}
    {canManageAll && <Alert severity="info" sx={{ mb: 2 }}>{focusParticipantId ? '已定位到当前报名项目；完成动作表后可返回参赛者管理继续编辑。' : '管理员模式：这里显示所有比赛的跳水选手，可补填任意选手的动作和难度系数。'}</Alert>}
    {message && <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
    {pageItems.map((item) => <DivingPlanCard
      key={item._id}
      item={item}
      plan={plans[item._id]}
      saving={savingId === item._id}
      onPlanChange={updatePlan}
      onSave={save}
    />)}
    {filteredItems.length > 0 && <Box sx={{ textAlign: 'center', mb: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>共匹配 {filteredItems.length} 名选手 · 第 {currentPage} / {totalPages} 页</Typography>
      {totalPages > 1 && <Pagination count={totalPages} page={currentPage} color="primary" onChange={(_, nextPage) => setPage(nextPage)} sx={{ display: 'inline-flex' }} />}
    </Box>}
    {!items.length && <Alert severity="info">目前没有需要补录动作表的跳水报名。</Alert>}
    {items.length > 0 && !filteredItems.length && <Alert severity="info">没有找到符合搜索条件的选手。</Alert>}
    <DivingPlanPrintPreview open={printOpen} onClose={() => setPrintOpen(false)} participants={items} />
  </Box>;
}
