import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container,
  Divider, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import BlockIcon from '@mui/icons-material/Block';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import api from '../services/api';

const labels = {
  pending: '\u5f85\u73b0\u573a\u68c0\u5f55',
  checked_in: '\u5df2\u73b0\u573a\u68c0\u5f55',
  forfeited: '\u5df2\u653e\u5f03',
  confirmed: '\u5df2\u786e\u8ba4'
};

const StatusChip = ({ status }) => <Chip size="small" color={status === 'forfeited' ? 'error' : status === 'pending' ? 'warning' : 'success'} label={labels[status] || labels.pending} />;

export default function AwardManagementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get(`/competitions/${id}/awards`);
      setData(response.data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || '\u8f09\u5165\u734e\u9805\u8cc7\u6599\u5931\u6557');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const update = async (awardKey, entry, status) => {
    const actionKey = `${awardKey}|${entry.recipientKey}`;
    setSaving(actionKey); setError('');
    try {
      await api.put(`/competitions/${id}/awards/confirmation`, {
        awardKey, recipientKey: entry.recipientKey, recipientName: entry.name, status
      });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || '\u66f4\u65b0\u734e\u9805\u78ba\u8a8d\u5931\u6557');
    } finally { setSaving(''); }
  };

  const CeremonyTable = ({ title, description, awardKey, entries = [], scoreTitle = '\u7e3d\u5206' }) => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6"><EmojiEventsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />{title}</Typography>
        {description && <Typography color="text.secondary" sx={{ mt: .5, mb: 2 }}>{description}</Typography>}
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>\u9812\u734e\u540d\u6b21</TableCell><TableCell>\u5c0d\u8c61</TableCell><TableCell>\u55ae\u4f4d</TableCell><TableCell>{scoreTitle}</TableCell><TableCell>\u73fe\u5834\u72c0\u614b</TableCell><TableCell>\u64cd\u4f5c</TableCell></TableRow></TableHead>
            <TableBody>
              {entries.length === 0 ? <TableRow><TableCell colSpan={6}>\u76ee\u524d\u6c92\u6709\u7b26\u5408\u8cc7\u683c\u7684\u6210\u7e3e\u3002</TableCell></TableRow> : entries.map(entry => {
                const actionKey = `${awardKey}|${entry.recipientKey}`;
                return <TableRow key={entry.recipientKey}>
                  <TableCell>{entry.awardedRank || entry.rank}{entry.promoted ? '（\u905e\u88dc）' : ''}</TableCell>
                  <TableCell>{entry.name}</TableCell><TableCell>{entry.schoolName || '-'}</TableCell>
                  <TableCell>{Number(entry.score || 0).toFixed(2)}</TableCell><TableCell><StatusChip status={entry.ceremonyStatus} /></TableCell>
                  <TableCell><Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" color="success" disabled={saving === actionKey} startIcon={<HowToRegIcon />} onClick={() => update(awardKey, entry, 'checked_in')}>\u6aa2\u9304\u5230\u5834</Button>
                    <Button size="small" variant="outlined" color="error" disabled={saving === actionKey} startIcon={<BlockIcon />} onClick={() => update(awardKey, entry, 'forfeited')}>\u653e\u68c4\u734e\u9805</Button>
                  </Stack></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  const SpecialList = ({ title, awardKey, entries = [] }) => <Card sx={{ height: '100%' }}><CardContent>
    <Typography variant="h6">{title}</Typography><Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>\u900f\u904e\u300c\u78ba\u8a8d\u300d\u8a18\u9304\u7d44\u59d4\u6703\u6700\u7d42\u9078\u5b9a\u7684\u540d\u55ae\u3002</Typography>
    <Stack spacing={1}>{entries.length === 0 && <Typography color="text.secondary">\u66ab\u7121\u5019\u9078\u540d\u55ae</Typography>}
      {entries.map(entry => { const actionKey = `${awardKey}|${entry.recipientKey}`; return <Box key={entry.recipientKey} sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid #eee', borderRadius: 1, p: 1 }}>
        <Box sx={{ flexGrow: 1 }}><Typography>{entry.name}</Typography><Typography variant="caption" color="text.secondary">{entry.schoolName || ''}{entry.score !== undefined ? `  ·  ${entry.score}` : ''}</Typography></Box><StatusChip status={entry.ceremonyStatus} />
        <Button size="small" disabled={saving === actionKey} onClick={() => update(awardKey, entry, 'confirmed')}>\u78ba\u8a8d</Button><Button size="small" color="error" disabled={saving === actionKey} onClick={() => update(awardKey, entry, 'forfeited')}>\u53d6\u6d88</Button>
      </Box>; })}
    </Stack></CardContent></Card>;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  return <Container maxWidth="xl" sx={{ py: 4 }}>
    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/competitions/${id}`)} sx={{ mb: 2 }}>\u8fd4\u56de\u6bd4\u8cfd\u8a73\u60c5</Button>
    <Typography variant="h4">\u734e\u9805\u7d71\u8a08\u8207\u78ba\u8a8d</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{data?.competition?.name}</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Alert severity="info" sx={{ mb: 3 }}>\u5c0d\u524d\u516d\u540d\u8a2d\u70ba\u300c\u653e\u68c4\u734e\u9805\u300d\u5f8c\uff0c\u7cfb\u7d71\u6703\u81ea\u52d5\u905e\u88dc\u4e0b\u4e00\u540d\u5019\u9078\u8005\u3002\u300c\u6aa2\u9304\u5230\u5834\u300d\u53ea\u662f\u7528\u65bc\u9812\u734e\u73fe\u5834\u7684\u78ba\u8a8d\u7d00\u9304\u3002</Alert>
    <CeremonyTable title="\u5718\u9ad4\u7a4d\u5206\u8cfd\uff08\u524d\u516d\u540d\uff09" description="\u50c5\u7d0d\u5165\u6bcf\u540d\u904b\u52d5\u54e1\u5b8c\u6210\u81f3\u5c11\u5169\u500b\u500b\u4eba\u9805\u76ee\u5f8c\u53d6\u5f97\u7684\u7a4d\u5206\u3002" awardKey="team-total" entries={data?.teamAwards} scoreTitle="\u5718\u9ad4\u7a4d\u5206" />
    <Typography variant="h5" sx={{ mb: 2 }}>\u6b66\u8853\u500b\u4eba\u5168\u80fd\u734e</Typography>
    {data?.kings?.map(item => <CeremonyTable key={item.key} title={item.title} description={`\u53d6\u540c\u985e\u9805\u76ee\u6700\u9ad8 ${item.requiredEvents} \u9805\u6210\u7e3e\u7d2f\u8a08\uff0c\u524d\u516d\u540d\u53ef\u73fe\u5834\u6aa2\u9304\u3001\u905e\u88dc\u3002`} awardKey={item.key} entries={item.awards} />)}
    <Divider sx={{ my: 4 }} /><Typography variant="h5" sx={{ mb: 2 }}>\u512a\u79c0\u6559\u7df4\u54e1\u8207\u6b66\u5fb7\u98a8\u5c1a\u734e</Typography>
    <Grid container spacing={2}><Grid item xs={12} md={4}><SpecialList title="\u512a\u79c0\u6559\u7df4\u54e1" awardKey="excellentCoaches" entries={data?.specialAwards?.excellentCoaches} /></Grid><Grid item xs={12} md={4}><SpecialList title="\u6b66\u5fb7\u98a8\u5c1a\u734e\u904b\u52d5\u54e1" awardKey="wudeAthletes" entries={data?.specialAwards?.wudeAthletes} /></Grid><Grid item xs={12} md={4}><SpecialList title="\u6b66\u5fb7\u98a8\u5c1a\u734e\u904b\u52d5\u968a" awardKey="wudeTeams" entries={data?.specialAwards?.wudeTeams} /></Grid></Grid>
    <Card sx={{ mt: 4 }}><CardContent><Typography variant="h6">\u55ae\u9805\u8207\u5c0d\u7df4\u7d50\u679c\u7d71\u8a08</Typography><Typography color="text.secondary" sx={{ mb: 2 }}>\u4ee5\u524d\u4e09\u540d\u540d\u6b21\u3001\u5176\u9918\u6210\u7e3e 50% / 30% / 20% \u8a55\u5b9a\u4e00\u3001\u4e8c\u3001\u4e09\u7b49\u734e\u3002</Typography>
    {data?.eventAwards?.map(event => <Box key={event.scheduleId} sx={{ mb: 2 }}><Typography fontWeight={700}>{event.scheduleName}（{event.count}\u4eba）</Typography><Typography variant="body2">{event.awards.map(item => `${item.rank}\u3001${item.name}\uff08${item.awardLevel}\uff09`).join('  |  ')}</Typography></Box>)}</CardContent></Card>
  </Container>;
}
