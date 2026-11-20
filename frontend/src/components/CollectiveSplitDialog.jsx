import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import scheduleService from '../services/scheduleService';

export default function CollectiveSplitDialog({ schedule, schedules, competitionId, onClose, onSaved }) {
  const [batches, setBatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!schedule) return;
    const groupId = schedule.rankingGroupId || schedule._id;
    const related = schedules.filter(item => (item.rankingGroupId || item._id) === groupId)
      .sort((a, b) => (a.batchNumber || 1) - (b.batchNumber || 1));
    const initial = related.map(item => ({ court: item.court || '', scheduleDate: item.scheduleDate || '',
      timeSlot: item.timeSlot || '上午', exactTime: item.exactTime || '' }));
    if (initial.length === 1) initial.push({ ...initial[0], court: '' });
    setBatches(initial);
    setTeams(related.flatMap(item => item.participants || []));
    setAssignments(Object.fromEntries(related.flatMap((item, index) => (item.participants || []).map(team => [team._id, index]))));
    setError('');
  }, [schedule, schedules]);
  const updateBatch = (index, field, value) => setBatches(current => current.map((batch, i) => i === index ? { ...batch, [field]: value } : batch));
  const count = index => teams.filter(team => assignments[team._id] === index).length;
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await scheduleService.splitCollectiveSchedule(competitionId, schedule._id,
        batches.map((batch, index) => ({ ...batch, participantIds: teams.filter(team => assignments[team._id] === index).map(team => team._id) })));
      onSaved(response.message);
    } catch (err) {
      setError(err.message || '分场编排失败');
    } finally {
      setSaving(false);
    }
  };
  return <Dialog open={Boolean(schedule)} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
    <DialogTitle>集体项目分场编排</DialogTitle>
    <DialogContent>
      <Typography sx={{ mb: 2 }}>{schedule?.rankingGroupName || schedule?.name}</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>按整支队伍分配比赛批次，各场地分别打分，成绩按同一项目统一排名。请在项目开始及录分前完成编排。</Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {batches.map((batch, index) => <Box key={index} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mb: 2 }}>
        <Typography sx={{ mb: 1, fontWeight: 'bold' }}>第 {index + 1} 批 · {count(index)} 队 / {teams.filter(team => assignments[team._id] === index).reduce((sum, team) => sum + (team.teamMembers?.length || 0), 0)} 人</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField label="比赛日期" type="date" size="small" InputLabelProps={{ shrink: true }} value={batch.scheduleDate} onChange={event => updateBatch(index, 'scheduleDate', event.target.value)} disabled={saving} />
          <TextField select label="时间段" size="small" value={batch.timeSlot} onChange={event => updateBatch(index, 'timeSlot', event.target.value)} disabled={saving} sx={{ minWidth: 100 }}>{['上午', '下午', '晚上'].map(slot => <MenuItem key={slot} value={slot}>{slot}</MenuItem>)}</TextField>
          <TextField label="场地" size="small" value={batch.court} onChange={event => updateBatch(index, 'court', event.target.value)} disabled={saving} placeholder="例如：第一场地" />
          <TextField label="具体时间（选填）" size="small" value={batch.exactTime} onChange={event => updateBatch(index, 'exactTime', event.target.value)} disabled={saving} />
        </Box>
      </Box>)}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button disabled={saving || batches.length >= 30} onClick={() => setBatches(current => [...current, { ...current[0], court: '' }])}>增加批次</Button>
        <Button disabled={saving || batches.length <= 2} onClick={() => {
          setAssignments(current => Object.fromEntries(Object.entries(current).map(([id, index]) => [id, index === batches.length - 1 ? 0 : index])));
          setBatches(current => current.slice(0, -1));
        }}>移除末批（队伍转至第1批）</Button>
        <Button disabled={saving || teams.length < batches.length} onClick={() => setAssignments(Object.fromEntries(teams.map((team, index) => [team._id, index % batches.length])))}>按队数均分</Button>
      </Box>
      <Table size="small"><TableHead><TableRow><TableCell>队伍 / 代表单位</TableCell><TableCell>人数</TableCell><TableCell>比赛批次</TableCell></TableRow></TableHead>
        <TableBody>{teams.map(team => <TableRow key={team._id}>
          <TableCell>{team.teamName || team.schoolName || team.name}</TableCell><TableCell>{team.teamMembers?.length || 0}</TableCell>
          <TableCell><TextField select size="small" value={assignments[team._id] ?? 0} disabled={saving} onChange={event => setAssignments(current => ({ ...current, [team._id]: Number(event.target.value) }))} sx={{ minWidth: 180 }}>{batches.map((batch, index) => <MenuItem key={index} value={index}>第 {index + 1} 批 · {batch.court || '待设置场地'}</MenuItem>)}</TextField></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving}>取消</Button><Button variant="contained" onClick={save} disabled={saving || !batches.length || batches.some((batch, index) => !batch.court.trim() || !batch.scheduleDate || !count(index))}>{saving ? '保存中…' : '保存分场编排'}</Button></DialogActions>
  </Dialog>;
}
