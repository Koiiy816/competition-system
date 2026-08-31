import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import participantService from '../services/participantService';

const isDiving = (participant) => /跳水|跳板|跳台|陆上|陸上/.test(String(participant.event || ''));

const fixedActions = {
  U8: {
    '1米跳板': ['三弹冰棍B', '向后冰棍C', '三弹101B', '三弹101C'],
    '3米跳台': ['向前冰棍B', '向后冰棍A', '向前站倒B', '后倒A'],
    '陆上网': ['十弹A', '连续五弹C', '三弹B', '三弹C'],
    '陆上板': ['五弹A', '五弹C', '三弹B', '向后立定C'],
    '素质力量': ['肋木举腿5次', '立定跳远', '提膝跳10次', '引体控40秒']
  },
  U7: {
    '1米跳板': ['三弹冰棍A', '三弹冰棍B', '向后冰棍A', '向后冰棍C'],
    '1米跳台': ['向前冰棍B', '向前冰棍C', '向后冰棍A', '向后冰棍C'],
    '陆上网': ['十弹A', '十弹C（最后一弹C）', '三弹B', '三弹C'],
    '陆上板': ['五弹A', '三弹C', '向后立定A', '向后立定C'],
    '素质力量': ['垫上两头起10次', '立定跳远', '提膝跳5次', '引体控20秒']
  }
};

const groupKey = (participant) => {
  const group = String(participant.ageGroup || participant.grade || '');
  return ['U12', 'U10', 'U8', 'U7'].find((key) => group.includes(key)) || '';
};

const getRule = (participant) => {
  const group = groupKey(participant);
  const event = String(participant.event || '');
  const fixed = fixedActions[group] && Object.entries(fixedActions[group]).find(([name]) => event.includes(name))?.[1];
  return {
    group,
    count: group === 'U12' ? 5 : 4,
    fixed: fixed || null
  };
};

const buildPlan = (participant, currentPlan) => {
  const rule = getRule(participant);
  const existing = Array.isArray(currentPlan?.dives) ? currentPlan.dives : [];
  const dives = Array.from({ length: rule.count }, (_, index) => ({
    actionCode: rule.fixed?.[index] || existing[index]?.actionCode || ''
  }));
  return { dives };
};

export default function DivingActionPlanPage() {
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await participantService.getMyParticipations();
      const rows = (response.data || []).filter(isDiving);
      setItems(rows);
      setPlans(Object.fromEntries(rows.map((row) => [row._id, buildPlan(row, row.additionalInfo?.divingPlan)])));
    } catch (error) {
      setMessage({ severity: 'error', text: '加载失败：' + (error.message || '无法读取报名资料') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (item) => {
    const rule = getRule(item);
    const plan = buildPlan(item, plans[item._id]);
    if (plan.dives.some((dive) => !String(dive.actionCode || '').trim())) {
      setMessage({ severity: 'error', text: `请完整填写 ${rule.count} 个动作。` });
      return;
    }

    setSavingId(item._id);
    try {
      const response = await participantService.saveDivingPlan(item.competition._id || item.competition, item._id, plan);
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
    <Typography color="text.secondary" sx={{ mb: 2 }}>U12 组填写 5 个自选动作；U10、U8、U7 组填写 4 个动作。U8、U7 的规定动作已按竞赛规程锁定。</Typography>
    {message && <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
    {items.map((item) => {
      const rule = getRule(item);
      const plan = buildPlan(item, plans[item._id]);
      return <Paper key={item._id} sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight="bold">{item.competition?.name} · {item.name} · {item.event} · {item.ageGroup || item.grade}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {rule.fixed ? `规程规定动作，共 ${rule.count} 个（不可修改）` : `请填写 ${rule.count} 个自选动作`}
        </Typography>
        {item.additionalInfo?.divingPair && <Typography variant="body2" color="primary">双人 {item.additionalInfo.divingPair.pairCode} · 搭档：{item.additionalInfo.divingPair.partnerName}</Typography>}
        {plan.dives.map((dive, index) => <Box key={index} sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField
            fullWidth
            size="small"
            required
            disabled={Boolean(rule.fixed)}
            label={'第 ' + (index + 1) + ' 个动作'}
            value={dive.actionCode || ''}
            onChange={(event) => setPlans((current) => ({
              ...current,
              [item._id]: { dives: plan.dives.map((entry, diveIndex) => diveIndex === index ? { ...entry, actionCode: event.target.value.toUpperCase() } : entry) }
            }))}
          />
        </Box>)}
        <Box sx={{ mt: 1.5 }}>
          <Button variant="contained" disabled={savingId === item._id} onClick={() => save(item)}>
            {savingId === item._id ? '保存中…' : '保存动作表'}
          </Button>
        </Box>
      </Paper>;
    })}
    {!items.length && <Alert severity="info">目前没有需要补录动作表的跳水报名。</Alert>}
  </Box>;
}
