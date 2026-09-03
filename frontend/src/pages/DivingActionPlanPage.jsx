import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, TextField, Typography } from '@mui/material';
import participantService from '../services/participantService';
import competitionService from '../services/competitionService';
import { useAuth } from '../contexts/AuthContext';
import divingDifficultyTable from '../data/divingDifficultyTable';

const isDiving = (participant) => /跳水|跳板|跳台|陆上|陸上/.test(String(participant.event || ''));

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
  '向后冰棍A': 0.6,
  '向后冰棍C': 0.7,
  '三弹101B': 1.3,
  '三弹101C': 1.2
};
const getDifficulty = (participant, platformHeight, actionCode) => {
  const event = String(participant.event || '');
  const code = String(actionCode || '').trim().toUpperCase();
  const custom = customDifficulties[code];
  if (custom !== undefined) return custom;
  if (/跳板/.test(event)) return divingDifficultyTable.board[/3米/.test(event) ? '3m' : '1m']?.[code];
  if (/跳台/.test(event) && platformHeight) return divingDifficultyTable.platform[platformHeight]?.[code];
  return undefined;
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
    ? existing.map((dive) => ({ actionCode: dive?.actionCode || '', difficulty: dive?.difficulty ?? '' }))
    : [{ actionCode: '', difficulty: '' }];
  return { takeoffOrHeight: currentPlan?.takeoffOrHeight || rule.platformHeight || '', dives };
};

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

  const load = async () => {
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
    } catch (error) {
      setMessage({ severity: 'error', text: '加载失败：' + (error.message || '无法读取报名资料') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [canManageAll]);

  const save = async (item) => {
    const rule = getRule(item);
    const plan = buildPlan(item, plans[item._id]);
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
  };

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  return <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
    <Typography variant="h4" gutterBottom>补录跳水动作表</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>先填写第一个动作代码；需要增加动作时点击“＋ 添加动作”。已收录的动作会自动带出难度，未收录动作可先保存，之后再补录难度。</Typography>
    {canManageAll && <Alert severity="info" sx={{ mb: 2 }}>{focusParticipantId ? '已定位到当前报名项目；完成动作表后可返回参赛者管理继续编辑。' : '管理员模式：这里显示所有比赛的跳水选手，可补填任意选手的动作和难度系数。'}</Alert>}
    {message && <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
    {items.map((item) => {
      const rule = getRule(item);
      const plan = buildPlan(item, plans[item._id]);
      const showPlatformHeight = /跳台/.test(String(item.event || '')) && ['U12', 'U10'].includes(rule.group);
      return <Paper key={item._id} sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight="bold">{item.competition?.name} · {item.additionalInfo?.divingPair ? `${item.name}／${item.additionalInfo.divingPair.partnerName}` : item.name} · {item.event} · {item.ageGroup || item.grade}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          动作数量可按实际参赛轮次添加；未收录动作的难度系数可暂时留空。
        </Typography>
        {item.additionalInfo?.divingPair && <Typography variant="body2" color="primary">双人 {item.additionalInfo.divingPair.pairCode} · 搭档：{item.additionalInfo.divingPair.partnerName} · 只需填写这一份动作表，保存后会自动同步。</Typography>}
        {showPlatformHeight && <TextField
          select fullWidth size="small" required disabled={rule.group === 'U10'} label="实际跳台高度"
          value={plan.takeoffOrHeight}
          onChange={(event) => setPlans((current) => ({ ...current, [item._id]: { ...plan, takeoffOrHeight: event.target.value } }))}
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
          return <Box key={index} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 180px auto' }, gap: 1, mt: 1 }}>
            <TextField
              fullWidth size="small" required label={'第 ' + (index + 1) + ' 个动作'} value={dive.actionCode || ''}
              onChange={(event) => setPlans((current) => ({
                ...current,
                [item._id]: { ...plan, dives: plan.dives.map((entry, diveIndex) => diveIndex === index ? { ...entry, actionCode: event.target.value.toUpperCase() } : entry) }
              }))}
            />
            <TextField
              size="small" type="number" label={matchedDifficulty === undefined ? '难度系数（可选）' : '官方难度系数'}
              value={matchedDifficulty ?? dive.difficulty ?? ''} disabled={matchedDifficulty !== undefined}
              inputProps={{ min: 0.1, max: 10, step: 0.1 }}
              helperText={matchedDifficulty === undefined ? '未收录动作可暂不填写，之后可补录' : '已自动带出'}
              onChange={(event) => setPlans((current) => ({
                ...current,
                [item._id]: { ...plan, dives: plan.dives.map((entry, diveIndex) => diveIndex === index ? { ...entry, difficulty: event.target.value } : entry) }
              }))}
            />
            <Button color="error" disabled={plan.dives.length === 1} onClick={() => setPlans((current) => ({
              ...current,
              [item._id]: { ...plan, dives: plan.dives.filter((_, diveIndex) => diveIndex !== index) }
            }))}>删除</Button>
          </Box>;
        })}
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
          <Button variant="outlined" disabled={plan.dives.length >= rule.maxDives} onClick={() => setPlans((current) => ({
            ...current,
            [item._id]: { ...plan, dives: [...plan.dives, { actionCode: '', difficulty: '' }] }
          }))}>＋ 添加动作</Button>
          <Button variant="contained" disabled={savingId === item._id} onClick={() => save(item)}>
            {savingId === item._id ? '保存中…' : '保存动作表'}
          </Button>
        </Box>
      </Paper>;
    })}
    {!items.length && <Alert severity="info">目前没有需要补录动作表的跳水报名。</Alert>}
  </Box>;
}
