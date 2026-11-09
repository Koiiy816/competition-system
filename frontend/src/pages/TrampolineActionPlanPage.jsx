import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Pagination, Paper, TextField, Typography } from '@mui/material';
import participantService from '../services/participantService';
import competitionService from '../services/competitionService';
import { useAuth } from '../contexts/AuthContext';
import { trampolinePostures } from '../data/trampolineDifficultyTable';
import { isTrampolineCompetition, SPORT_TYPES } from '../utils/competitionType';
import { buildTrampolinePlan as buildPlan, getTrampolineActionDifficulty as getDifficulty, trampolineRoutineDifficulty as totalDifficulty, isLargeTrampolineEvent } from '../utils/trampolinePlan';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 30];
const isTrampolineParticipant = (participant) => isTrampolineCompetition(participant?.competition) && isLargeTrampolineEvent(participant);
const hasDifficulty = (action) => {
  const value = getDifficulty(action) ?? action?.difficulty;
  return value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0;
};
const getPlanIssues = (plan) => (plan?.routines || []).flatMap(routine => routine.actions.map((action, index) => ({ action, label: `${routine.name}第${index + 1}个` }))).reduce((issues, { action, label }) => {
  if (!String(action?.actionCode || '').trim() || !action?.posture) issues.missingActionIndexes.push(label);
  else if (getDifficulty(action) === undefined) {
    issues.unmatchedIndexes.push(label);
    if (!hasDifficulty(action)) issues.missingDifficultyIndexes.push(label);
  }
  return issues;
}, { missingActionIndexes: [], unmatchedIndexes: [], missingDifficultyIndexes: [] });
export function TrampolinePlanCard({ item, plan, saving, onChange, onSave }) {
  const issues = getPlanIssues(plan);
  return <Paper sx={{ p: 2, mb: 2 }}>
    <Typography fontWeight={800}>{item.competition?.name} · {item.name} · {item.event} · {item.ageGroup || item.grade}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>大网填写两套动作，每套固定10个，共20个。A 部分填写数字，B 部分选择姿势符号；两套动作分别计算难度并带入打分界面。</Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5, mb: 1 }}>
      <Chip color={issues.missingActionIndexes.length ? 'warning' : 'success'} label={issues.missingActionIndexes.length ? `待补动作：${issues.missingActionIndexes.length}个` : '两套动作代码和姿势已完整'} />
    </Box>
    {issues.unmatchedIndexes.length > 0 && <Alert severity={issues.missingDifficultyIndexes.length ? 'warning' : 'info'} sx={{ mb: 1 }}>未匹配官方难度：{issues.unmatchedIndexes.join('、')}。{issues.missingDifficultyIndexes.length ? `其中${issues.missingDifficultyIndexes.length}个动作的难度尚未确认，对应套次暂不自动带入D分。` : '已使用手填难度系数。'}</Alert>}
    {plan.routines.map((routine, routineIndex) => <Box key={routine.name} sx={{ mt: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Typography fontWeight={800}>{routine.name} · {routine.actions.length}个动作 · 预计难度 {totalDifficulty(routine).toFixed(2)}</Typography>
      {routine.actions.length !== 10 && <Alert severity="warning">旧表动作超过规定数量，请核对并删至10个后保存。</Alert>}
      {routine.actions.map((action, index) => {
      const officialDifficulty = getDifficulty(action);
      const changeAction = (change) => onChange(current => ({ ...current, routines: current.routines.map((entry, ri) => ri === routineIndex ? { ...entry, actions: entry.actions.map((value, ai) => ai === index ? { ...value, ...change } : value) } : entry) }));
      return <Box key={index} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 150px 170px auto' }, gap: 1, mt: 1 }}>
        <TextField label={`第 ${index + 1} 个动作 · A 部分（数字）`} required size="small" value={action.actionCode} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} onChange={(event) => changeAction({ actionCode: event.target.value.replace(/\D/g, '') })} />
        <TextField select label="B 部分（姿势符号）" required size="small" value={action.posture} onChange={(event) => changeAction({ posture: event.target.value })}>
          <MenuItem value="">请选择</MenuItem>
          {trampolinePostures.map((posture) => <MenuItem key={posture} value={posture}>{posture}</MenuItem>)}
        </TextField>
        <TextField label={officialDifficulty === undefined ? '难度系数（手填）' : '官方难度系数'} type="number" size="small" disabled={officialDifficulty !== undefined} value={officialDifficulty ?? action.difficulty} inputProps={{ min: 0, max: 10, step: 0.1 }} helperText={officialDifficulty === undefined ? '未收录动作可手动填写' : '已自动带出'} onChange={(event) => changeAction({ difficulty: event.target.value })} />
        {routine.actions.length > 10 && <Button color="error" onClick={() => onChange(current => ({ ...current, routines: current.routines.map((entry, ri) => ri === routineIndex ? { ...entry, actions: entry.actions.filter((_, ai) => ai !== index) } : entry) }))}>删除</Button>}
      </Box>;
    })}</Box>)}
    <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <Button variant="contained" disabled={saving} onClick={() => onSave(item, plan)}>{saving ? '保存中…' : '保存两套动作表'}</Button>
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
    const routines = plan.routines.map(routine => ({ ...routine, actions: routine.actions.map(action => ({ ...action, difficulty: getDifficulty(action) ?? action.difficulty })) }));
    if (routines.length !== 2 || routines.some(routine => routine.actions.length !== 10 || routine.actions.some((action) => !String(action.actionCode || '').trim() || !action.posture || (action.difficulty !== '' && action.difficulty != null && (!Number.isFinite(Number(action.difficulty)) || Number(action.difficulty) < 0 || Number(action.difficulty) > 10))))) {
      setMessage({ severity: 'error', text: '请完整填写两套各10个动作的代码和姿势；已填写的难度系数必须有效。' });
      return;
    }
    setSavingId(item._id);
    try {
      const response = await participantService.saveTrampolinePlan(item.competition._id || item.competition, item._id, { routines });
      const savedPlan = response.data.additionalInfo.trampolinePlan;
      setPlans((current) => ({ ...current, [item._id]: buildPlan(savedPlan) }));
      setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, additionalInfo: { ...(entry.additionalInfo || {}), trampolinePlan: savedPlan } } : entry));
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
    <Typography color="text.secondary" sx={{ mb: 2 }}>仅大网选手填写“蹦床1”“蹦床2”，每套10个动作。小网和蹦床操按规定动作评分，无需填写。未收录动作可先保存，难度待确认后补填。</Typography>
    {canManageAll && <Alert severity="info" sx={{ mb: 2 }}>管理员、主裁和裁判可补录所有大网选手的两套动作表。</Alert>}
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
