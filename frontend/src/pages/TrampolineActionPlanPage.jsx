import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Pagination, Paper, TextField, Typography } from '@mui/material';
import participantService from '../services/participantService';
import competitionService from '../services/competitionService';
import { useAuth } from '../contexts/AuthContext';
import { findTrampolineDifficulties, trampolinePostures } from '../data/trampolineDifficultyTable';
import { isTrampolineCompetition, SPORT_TYPES } from '../utils/competitionType';

const MIN_ACTIONS = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 30];
const emptyAction = () => ({ actionCode: '', posture: '', difficulty: '' });
const isTrampolineParticipant = (participant) => isTrampolineCompetition(participant?.competition);
const buildPlan = (existingPlan) => {
  const actions = Array.isArray(existingPlan?.actions) ? existingPlan.actions.map((action) => ({
    actionCode: action?.actionCode || '', posture: action?.posture || '', difficulty: action?.difficulty ?? ''
  })) : [];
  while (actions.length < MIN_ACTIONS) actions.push(emptyAction());
  return { actions };
};
const getDifficulty = (action) => findTrampolineDifficulties(action?.actionCode, action?.posture)[0]?.difficulty;
const hasDifficulty = (action) => Number.isFinite(Number(getDifficulty(action) ?? action?.difficulty)) && Number(getDifficulty(action) ?? action?.difficulty) > 0;
const getPlanIssues = (plan) => (plan?.actions || []).reduce((issues, action, index) => {
  if (!String(action?.actionCode || '').trim() || !action?.posture) issues.missingActionIndexes.push(index + 1);
  else if (getDifficulty(action) === undefined) {
    issues.unmatchedIndexes.push(index + 1);
    if (!hasDifficulty(action)) issues.missingDifficultyIndexes.push(index + 1);
  }
  return issues;
}, { missingActionIndexes: [], unmatchedIndexes: [], missingDifficultyIndexes: [] });
const totalDifficulty = (plan) => Math.round((plan?.actions || []).reduce((total, action) => {
  const value = getDifficulty(action) ?? Number(action?.difficulty);
  return Number.isFinite(value) && value > 0 ? total + value : total;
}, 0) * 100) / 100;

function TrampolinePlanCard({ item, plan, saving, onChange, onSave }) {
  const issues = getPlanIssues(plan);
  const total = totalDifficulty(plan);
  return <Paper sx={{ p: 2, mb: 2 }}>
    <Typography fontWeight={800}>{item.competition?.name} · {item.name} · {item.event} · {item.ageGroup || item.grade}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>每位选手至少录入 10 个动作。A 部分只填写数字，B 部分从原表姿势符号中选择；系统会自动带出已导入的官方难度系数。</Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5, mb: 1 }}>
      <Chip color={issues.missingActionIndexes.length ? 'warning' : 'success'} label={issues.missingActionIndexes.length ? `待补动作：第 ${issues.missingActionIndexes.join('、')} 个` : '动作代码和姿势已完整'} />
      <Chip color="primary" variant="outlined" label={`预计难度总分：${total.toFixed(2)}`} />
    </Box>
    {issues.unmatchedIndexes.length > 0 && <Alert severity={issues.missingDifficultyIndexes.length ? 'warning' : 'info'} sx={{ mb: 1 }}>未匹配官方难度：第 {issues.unmatchedIndexes.join('、')} 个动作。{issues.missingDifficultyIndexes.length ? `第 ${issues.missingDifficultyIndexes.join('、')} 个动作的难度可先留空，待向举办方确认后再补填。` : '已使用手填难度系数。'}</Alert>}
    {plan.actions.map((action, index) => {
      const officialDifficulty = getDifficulty(action);
      return <Box key={index} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 150px 170px auto' }, gap: 1, mt: 1 }}>
        <TextField label={`第 ${index + 1} 个动作 · A 部分（数字）`} required size="small" value={action.actionCode} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} onChange={(event) => onChange((current) => ({ ...current, actions: current.actions.map((entry, actionIndex) => actionIndex === index ? { ...entry, actionCode: event.target.value.replace(/\D/g, '') } : entry) }))} />
        <TextField select label="B 部分（姿势符号）" required size="small" value={action.posture} onChange={(event) => onChange((current) => ({ ...current, actions: current.actions.map((entry, actionIndex) => actionIndex === index ? { ...entry, posture: event.target.value } : entry) }))}>
          <MenuItem value="">请选择</MenuItem>
          {trampolinePostures.map((posture) => <MenuItem key={posture} value={posture}>{posture}</MenuItem>)}
        </TextField>
        <TextField label={officialDifficulty === undefined ? '难度系数（手填）' : '官方难度系数'} type="number" size="small" disabled={officialDifficulty !== undefined} value={officialDifficulty ?? action.difficulty} inputProps={{ min: 0.1, max: 10, step: 0.1 }} helperText={officialDifficulty === undefined ? '未收录动作可手动填写' : '已自动带出'} onChange={(event) => onChange((current) => ({ ...current, actions: current.actions.map((entry, actionIndex) => actionIndex === index ? { ...entry, difficulty: event.target.value } : entry) }))} />
        <Button color="error" disabled={plan.actions.length <= MIN_ACTIONS} onClick={() => onChange((current) => ({ ...current, actions: current.actions.filter((_, actionIndex) => actionIndex !== index) }))}>删除</Button>
      </Box>;
    })}
    <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <Button variant="outlined" onClick={() => onChange((current) => ({ ...current, actions: [...current.actions, emptyAction()] }))}>＋ 添加动作</Button>
      <Button variant="contained" disabled={saving} onClick={() => onSave(item, plan)}>{saving ? '保存中…' : '保存动作表'}</Button>
    </Box>
  </Paper>;
}

export default function TrampolineActionPlanPage() {
  const { user } = useAuth();
  const canManageAll = user?.roles?.some((role) => ['admin', 'chief_referee', 'referee'].includes(role));
  const hasOrganizationAccess = user?.roles?.includes('organization') && user?.sportTypes?.includes(SPORT_TYPES.TRAMPOLINE);
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState('');
  const [issueFilter, setIssueFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let rows;
      if (canManageAll) {
        const response = await competitionService.getCompetitions({ limit: 100, sportType: SPORT_TYPES.TRAMPOLINE });
        const competitions = (response.data || []).filter(isTrampolineCompetition);
        const responses = await Promise.all(competitions.map((competition) => participantService.getParticipants(competition._id, { limit: 10000 })));
        rows = responses.flatMap((response, index) => (response.data || []).map((row) => ({ ...row, competition: row.competition || competitions[index] })));
      } else {
        const response = await participantService.getMyParticipations();
        rows = response.data || [];
      }
      rows = rows.filter(isTrampolineParticipant);
      setItems(rows);
      setPlans(Object.fromEntries(rows.map((item) => [item._id, buildPlan(item.additionalInfo?.trampolinePlan)])));
      setPage(1);
    } catch (error) {
      setMessage({ severity: 'error', text: error.message || '无法读取蹦床报名资料' });
    } finally { setLoading(false); }
  }, [canManageAll]);

  useEffect(() => { if (canManageAll || hasOrganizationAccess) load(); else setLoading(false); }, [canManageAll, hasOrganizationAccess, load]);
  const updatePlan = useCallback((id, updater) => setPlans((current) => ({ ...current, [id]: updater(current[id]) })), []);
  const save = useCallback(async (item, plan) => {
    const actions = plan.actions.map((action) => ({ ...action, difficulty: getDifficulty(action) ?? action.difficulty }));
    if (actions.length < MIN_ACTIONS || actions.some((action) => !String(action.actionCode || '').trim() || !action.posture || (action.difficulty !== '' && action.difficulty !== null && action.difficulty !== undefined && (!Number.isFinite(Number(action.difficulty)) || Number(action.difficulty) <= 0)))) {
      setMessage({ severity: 'error', text: `请填写至少 ${MIN_ACTIONS} 个动作的代码和姿势；已填写的难度系数必须有效。` });
      return;
    }
    setSavingId(item._id);
    try {
      const savedPlan = { actions };
      const response = await participantService.saveTrampolinePlan(item.competition._id || item.competition, item._id, savedPlan);
      setPlans((current) => ({ ...current, [item._id]: savedPlan }));
      setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, additionalInfo: { ...(entry.additionalInfo || {}), trampolinePlan: { ...savedPlan, totalDifficulty: totalDifficulty(savedPlan) } } } : entry));
      setMessage({ severity: 'success', text: response.message || '蹦床动作表已保存。' });
    } catch (error) { setMessage({ severity: 'error', text: error.message || '保存失败' }); }
    finally { setSavingId(''); }
  }, []);
  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const matchesSearch = !term || [item.name, item.competition?.name, item.event, item.ageGroup, item.grade, item.schoolName, item.teamName].filter(Boolean).join(' ').toLocaleLowerCase().includes(term);
      const issues = getPlanIssues(plans[item._id]);
      const matchesIssue = issueFilter === 'all'
        || (issueFilter === 'missing-action' && issues.missingActionIndexes.length > 0)
        || (issueFilter === 'unmatched' && issues.unmatchedIndexes.length > 0)
        || (issueFilter === 'missing-difficulty' && issues.missingDifficultyIndexes.length > 0);
      return matchesSearch && matchesIssue;
    });
  }, [items, plans, search, issueFilter]);
  const issueSummary = useMemo(() => items.reduce((summary, item) => {
    const issues = getPlanIssues(plans[item._id]);
    if (issues.missingActionIndexes.length) summary.missingActionPeople += 1;
    if (issues.unmatchedIndexes.length) summary.unmatchedPeople += 1;
    if (issues.missingDifficultyIndexes.length) summary.missingDifficultyPeople += 1;
    return summary;
  }, { missingActionPeople: 0, unmatchedPeople: 0, missingDifficultyPeople: 0 }), [items, plans]);
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => visibleItems.slice((currentPage - 1) * pageSize, currentPage * pageSize), [currentPage, pageSize, visibleItems]);

  if (!canManageAll && !hasOrganizationAccess) return <Alert severity="error">仅已选择“蹦床”赛事类型的参赛单位，或管理员、主裁和裁判可以使用蹦床动作表。</Alert>;
  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  return <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
    <Typography variant="h4" fontWeight={800} gutterBottom>补录蹦床动作表</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>为每位选手录入至少 10 个动作。系统会自动汇总已确认的难度系数；未收录动作可先保存，待举办方确认后再补填难度。</Typography>
    {canManageAll && <Alert severity="info" sx={{ mb: 2 }}>管理员、主裁和裁判可补录所有蹦床选手的动作表。</Alert>}
    {message && <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ mb: 2 }}>{message.text}</Alert>}
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
      <TextField size="small" label="搜索选手" placeholder="姓名、赛事、项目、组别或单位" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} sx={{ flex: '1 1 320px' }} />
      <TextField select size="small" label="待处理筛选" value={issueFilter} onChange={(event) => { setIssueFilter(event.target.value); setPage(1); }} sx={{ minWidth: 190 }}>
        <MenuItem value="all">全部选手</MenuItem>
        <MenuItem value="missing-action">未填动作代码或姿势</MenuItem>
        <MenuItem value="unmatched">未匹配官方难度</MenuItem>
        <MenuItem value="missing-difficulty">未匹配且未填难度</MenuItem>
      </TextField>
      <TextField select size="small" label="每页人数" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} sx={{ width: 130 }}>
        {PAGE_SIZE_OPTIONS.map((size) => <MenuItem key={size} value={size}>{size} 人</MenuItem>)}
      </TextField>
    </Box>
    {canManageAll && <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" fontWeight={800}>动作表待处理概览</Typography>
      <Chip color={issueSummary.missingActionPeople ? 'warning' : 'success'} label={`未填动作代码或姿势：${issueSummary.missingActionPeople} 人`} />
      <Chip color={issueSummary.unmatchedPeople ? 'warning' : 'success'} label={`未匹配官方难度：${issueSummary.unmatchedPeople} 人`} />
      <Chip color={issueSummary.missingDifficultyPeople ? 'warning' : 'success'} label={`未匹配且未填难度：${issueSummary.missingDifficultyPeople} 人`} />
    </Paper>}
    {pageItems.map((item) => <TrampolinePlanCard key={item._id} item={item} plan={plans[item._id]} saving={savingId === item._id} onChange={(updater) => updatePlan(item._id, updater)} onSave={save} />)}
    {visibleItems.length > 0 && <Box sx={{ textAlign: 'center', mb: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>共匹配 {visibleItems.length} 名选手 · 第 {currentPage} / {totalPages} 页</Typography>
      {totalPages > 1 && <Pagination count={totalPages} page={currentPage} color="primary" onChange={(_, nextPage) => setPage(nextPage)} sx={{ display: 'inline-flex' }} />}
    </Box>}
    {!items.length && <Alert severity="info">目前没有需要补录动作表的蹦床报名。</Alert>}
    {items.length > 0 && !visibleItems.length && <Alert severity="info">没有找到符合条件的选手。</Alert>}
  </Box>;
}
