import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';

const scoreOf = (result) => Number(result?.finalScore ?? result?.score ?? 0) || 0;
const athlete = (participant) => participant?.isVirtualTeam ? (participant.teamMembers || []).map((item) => item.name).filter(Boolean).join('、') || '未知' : participant?.teamName || participant?.name || participant?.user?.name || '未知';
const unit = (participant) => participant?.schoolName || participant?.teamName || participant?.user?.schoolName || '-';
const dateOf = (value) => value ? new Date(value).toLocaleDateString() : '';

const rankRows = (rows, getValue) => {
  let previousValue = null;
  let previousRank = 0;
  return rows.map((row, index) => {
    if (row.absent) return { ...row, rank: '-' };
    const value = getValue(row);
    if (previousValue === null || value !== previousValue) {
      previousRank = index + 1;
      previousValue = value;
    }
    return { ...row, rank: previousRank };
  });
};

const preparedResults = (results = []) => rankRows(
  results.filter((result) => !result.participant?.isTest)
    .map((result) => ({ result, absent: Boolean(result.details?.isAbsent), score: scoreOf(result) }))
    .sort((left, right) => Number(left.absent) - Number(right.absent) || right.score - left.score),
  (row) => row.score
);

const PrintAllResultsModal = ({ open, onClose, groupedResults, competition, teamRankings = [] }) => {
  const [signatureImage, setSignatureImage] = useState(localStorage.getItem('chief_signature') || '');
  if (!competition) return null;

  const schedules = Object.entries(groupedResults || {}).map(([name, results]) => ({ name, entries: preparedResults(results) })).filter((section) => section.entries.length);
  const reportHeader = (title, scheduleName = '') => <Box sx={{ textAlign: 'center', mb: 0.8, fontFamily: '"SimSun", "宋体", serif' }}>
    <Typography sx={{ fontSize: '20px', fontWeight: 'bold', lineHeight: 1.35, fontFamily: '"SimHei", "黑体", sans-serif' }}>{competition.name}</Typography>
    <Typography sx={{ fontSize: '18px', fontWeight: 'bold', lineHeight: 1.35, fontFamily: '"SimHei", "黑体", sans-serif' }}>{title}</Typography>
    {scheduleName && <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', fontSize: '12px', mt: 0.5 }}><span style={{ textAlign: 'left' }}>跳水</span><span>{scheduleName}</span><span style={{ textAlign: 'right' }}>{dateOf(competition.startDate)} {competition.location || ''}</span></Box>}
  </Box>;
  const tableStyle = { borderTop: '1px solid black', borderBottom: '1px solid black' };

  const teamPage = teamRankings.length ? <Box className="report-page" key="team">
    {reportHeader('团体总分')}
    <TableContainer className="report-table" sx={tableStyle}><Table size="small"><TableHead><TableRow>{['名次', '单位', '总分'].map((label) => <TableCell key={label} align="center">{label}</TableCell>)}</TableRow></TableHead><TableBody>
      {teamRankings.map((team, index) => <TableRow key={team.schoolName || index}><TableCell align="center">{index + 1}</TableCell><TableCell align="center">{team.schoolName}</TableCell><TableCell align="center">{Number(team.totalPoints || 0).toFixed(2)}</TableCell></TableRow>)}
    </TableBody></Table></TableContainer>
  </Box> : null;

  const rankPage = ({ name, entries }) => {
    const leader = entries.find((entry) => !entry.absent)?.score || 0;
    return <Box className="report-page" key={`${name}-rank`}>
      {reportHeader('名次公告', name)}
      <TableContainer className="report-table" sx={tableStyle}><Table size="small"><TableHead><TableRow>{['名次', '姓名', '单位', '成绩', '分差', '备注'].map((label) => <TableCell key={label} align="center">{label}</TableCell>)}</TableRow></TableHead><TableBody>
        {entries.map((entry, index) => <TableRow key={entry.result._id || index}><TableCell align="center">{entry.rank}</TableCell><TableCell align="center">{athlete(entry.result.participant)}</TableCell><TableCell align="center">{unit(entry.result.participant)}</TableCell><TableCell align="center">{entry.absent ? '弃权' : entry.score.toFixed(2)}</TableCell><TableCell align="center">{entry.absent || entry.rank === 1 ? '' : (leader - entry.score).toFixed(2)}</TableCell><TableCell align="center">{entry.absent ? '弃权' : ''}</TableCell></TableRow>)}
      </TableBody></Table></TableContainer>
    </Box>;
  };

  const detailPage = ({ name, entries }) => {
    if (!entries.some(({ result }) => Array.isArray(result.details?.dives))) return null;
    const rounds = Math.max(1, ...entries.map(({ result }) => result.details?.dives?.length || 0));
    const totals = entries.map(() => 0);
    const roundRanks = Array.from({ length: rounds }, (_, roundIndex) => {
      entries.forEach((entry, entryIndex) => { totals[entryIndex] += Number(entry.result.details?.dives?.[roundIndex]?.score || 0); });
      const ordered = entries.map((entry, entryIndex) => ({ entryIndex, absent: entry.absent, score: totals[entryIndex] })).sort((left, right) => Number(left.absent) - Number(right.absent) || right.score - left.score);
      return new Map(rankRows(ordered, (row) => row.score).map((row) => [row.entryIndex, row.rank]));
    });
    const leader = entries.find((entry) => !entry.absent)?.score || 0;
    const headings = ['名次', '姓名', '单位', '动作', '难度', 'E1', 'E2', 'E3', 'E4', 'E5', '得分', '轮次名次', '累计分', '总名次', '分差'];
    return <Box className="report-page report-detail-page" key={`${name}-detail`}>
      {reportHeader('明细成绩公告', name)}
      <TableContainer className="report-table detail-table" sx={tableStyle}><Table size="small"><TableHead><TableRow>{headings.map((label) => <TableCell key={label} align="center">{label}</TableCell>)}</TableRow></TableHead><TableBody>
        {entries.flatMap((entry, entryIndex) => {
          const dives = entry.result.details?.dives || [];
          const count = Math.max(1, dives.length);
          let cumulative = 0;
          return Array.from({ length: count }, (_, roundIndex) => {
            const dive = dives[roundIndex];
            cumulative += Number(dive?.score || 0);
            return <TableRow key={`${entry.result._id || entryIndex}-${roundIndex}`}>
              {roundIndex === 0 && <TableCell rowSpan={count} align="center">{entry.rank}</TableCell>}{roundIndex === 0 && <TableCell rowSpan={count} align="center">{athlete(entry.result.participant)}</TableCell>}{roundIndex === 0 && <TableCell rowSpan={count} align="center">{unit(entry.result.participant)}</TableCell>}
              <TableCell align="center">{dive?.actionCode || dive?.actionName || (entry.absent ? '弃权' : '-')}</TableCell><TableCell align="center">{dive?.difficulty ?? '-'}</TableCell>{[0, 1, 2, 3, 4].map((judge) => <TableCell key={judge} align="center">{dive?.scores?.[judge] ?? '-'}</TableCell>)}<TableCell align="center">{dive ? Number(dive.score || 0).toFixed(2) : '-'}</TableCell><TableCell align="center">{dive ? roundRanks[roundIndex]?.get(entryIndex) ?? '-' : '-'}</TableCell><TableCell align="center">{dive ? cumulative.toFixed(2) : '-'}</TableCell>
              {roundIndex === 0 && <TableCell rowSpan={count} align="center">{entry.rank}</TableCell>}{roundIndex === 0 && <TableCell rowSpan={count} align="center">{entry.absent || entry.rank === 1 ? '' : (leader - entry.score).toFixed(2)}</TableCell>}
            </TableRow>;
          });
        })}
      </TableBody></Table></TableContainer>
    </Box>;
  };

  const uploadSignature = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setSignatureImage(reader.result); localStorage.setItem('chief_signature', reader.result); };
    reader.readAsDataURL(file);
  };

  return <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth PaperProps={{ sx: { minHeight: '80vh' } }}>
    <DialogTitle className="no-print" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Typography variant="h6">打印总成绩册</Typography><Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>打印</Button></DialogTitle>
    <DialogContent dividers sx={{ bgcolor: '#f5f5f5' }}><Box className="no-print" sx={{ mb: 2 }}><Typography variant="body2" color="text.secondary" gutterBottom>可上传总裁判长电子签名，签名将显示在成绩册末尾。</Typography><Button variant="outlined" component="label" size="small">上传裁判长电子签<input type="file" hidden accept="image/*" onChange={uploadSignature} /></Button></Box>
      <Box className="all-results-printable" sx={{ p: 3, bgcolor: 'white', color: 'black' }}>{teamPage}{schedules.map(rankPage)}{schedules.map(detailPage)}<Box className="report-page signature-page" sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', minHeight: '80mm' }}><Box sx={{ textAlign: 'center', minWidth: '210px' }}><Typography sx={{ fontWeight: 'bold', mb: 1 }}>总裁判长签名：</Typography>{signatureImage ? <img src={signatureImage} alt="总裁判长签名" style={{ maxWidth: '150px', maxHeight: '60px' }} /> : <Box sx={{ borderBottom: '1px solid black', height: '35px' }} />}</Box></Box>
        <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } body * { visibility: hidden; } .all-results-printable, .all-results-printable * { visibility: visible; } .all-results-printable { position: absolute; inset: 0; width: 100%; padding: 0 !important; } .no-print, .MuiBackdrop-root { display: none !important; } .report-page { break-before: page; page-break-before: always; } .report-page:first-child { break-before: auto; page-break-before: auto; } .report-table { overflow: visible !important; } .report-table table { width: 100%; border-collapse: collapse; } .report-table th, .report-table td { border-bottom: 1px solid #000 !important; padding: 3px 4px !important; color: #000 !important; font-family: SimSun, serif !important; font-size: 10px !important; white-space: nowrap; } .report-table th { font-weight: bold !important; } .detail-table th, .detail-table td { font-size: 7px !important; padding: 2px !important; } .signature-page { break-before: page; page-break-before: always; } }`}</style>
      </Box>
    </DialogContent><DialogActions className="no-print"><Button onClick={onClose}>取消</Button></DialogActions>
  </Dialog>;
};

export default PrintAllResultsModal;
