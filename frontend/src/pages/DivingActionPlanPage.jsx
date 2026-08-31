import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, TextField, Button, Alert, CircularProgress } from '@mui/material';
import participantService from '../services/participantService';

const isDiving = (participant) => /跳水|跳板|跳台|陆上|陸上/.test(String(participant.event || ''));
const emptyPlan = () => ({ dives: [{ actionCode: '' }] });

export default function DivingActionPlanPage() {
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await participantService.getMyParticipations();
      const rows = (response.data || []).filter(isDiving);
      setItems(rows);
      setPlans(Object.fromEntries(rows.map(row => [row._id, row.additionalInfo?.divingPlan || emptyPlan()])));
    } catch (error) { setMessage('加载失败：' + (error.message || '无法读取报名资料')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (item) => {
    const plan = plans[item._id] || emptyPlan();
    if (!plan.dives?.length || plan.dives.some(dive => !String(dive.actionCode || '').trim())) {
      setMessage('请填写至少一个完整动作代码，例如 101A。'); return;
    }
    try {
      await participantService.saveDivingPlan(item.competition._id || item.competition, item._id, plan);
      setMessage('动作表已保存' + (item.additionalInfo?.divingPair ? '，并已同步到搭档。' : '。'));
      await load();
    } catch (error) { setMessage(error.message || '保存失败'); }
  };

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  return <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
    <Typography variant="h4" gutterBottom>补录跳水动作表</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>填写完整动作代码，例如 101A。难度系数将由官方及自订难度表自动带出。</Typography>
    {message && <Alert severity={message.includes('失败') || message.includes('请填写') ? 'error' : 'success'} sx={{ mb: 2 }}>{message}</Alert>}
    {items.map(item => {
      const plan = plans[item._id] || emptyPlan();
      return <Paper key={item._id} sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight="bold">{item.competition?.name} · {item.name} · {item.event} · {item.ageGroup || item.grade}</Typography>
        {item.additionalInfo?.divingPair && <Typography variant="body2" color="primary">双人 {item.additionalInfo.divingPair.pairCode} · 搭档：{item.additionalInfo.divingPair.partnerName}</Typography>}
        {plan.dives.map((dive, index) => <Box key={index} sx={{ display:'flex', gap:1, mt:1 }}>
          <TextField fullWidth size="small" label={'第 '+(index+1)+' 轮动作代码'} value={dive.actionCode || ''} onChange={e => setPlans(prev => ({...prev,[item._id]:{...plan,dives:plan.dives.map((x,i)=>i===index?{...x,actionCode:e.target.value.toUpperCase()}:x)}}))} />
          <Button color="error" disabled={plan.dives.length===1} onClick={() => setPlans(prev => ({...prev,[item._id]:{...plan,dives:plan.dives.filter((_,i)=>i!==index)}}))}>删除</Button>
        </Box>)}
        <Box sx={{ mt: 1, display:'flex', gap:1 }}><Button size="small" onClick={() => setPlans(prev => ({...prev,[item._id]:{...plan,dives:[...plan.dives,{actionCode:''}]}}))}>添加动作</Button><Button variant="contained" onClick={() => save(item)}>保存动作表</Button></Box>
      </Paper>;
    })}
    {!items.length && <Alert severity="info">目前没有需要补录动作表的跳水报名。</Alert>}
  </Box>;
}