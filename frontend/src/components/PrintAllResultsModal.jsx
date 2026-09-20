import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { isDivingResult, rankDivingAwardEntries } from '../utils/divingAwards';
import { isStrengthResult, rankStrengthEntries } from '../utils/strengthRanking';

const scoreOf = (result) => Number(result?.finalScore ?? result?.score ?? 0) || 0;
const athlete = (participant) => participant?.isVirtualTeam ? (participant.teamMembers || []).map((item) => item.name).filter(Boolean).join('、') || '未知' : participant?.teamName || participant?.name || participant?.user?.name || '未知';
const unit = (participant) => participant?.schoolName || participant?.teamName || participant?.user?.schoolName || '-';
const strengthActionName = (value) => String(value || '').replace(/提膝跳\s*10\s*次/g, '提膝跳').replace(/引体控\s*40\s*秒/g, '引体控');
const savedChiefSignatures = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('chief_signatures') || '[]');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    // Fall through to the legacy single-signature value.
  }
  return [localStorage.getItem('chief_signature') || ''];
};
const savedOrganizerSignature = () => localStorage.getItem('organizer_signature') || '';

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

const preparedResults = (results = []) => {
  const entries = results.filter((result) => !result.participant?.isTest)
    .map((result) => ({ result, absent: Boolean(result.details?.isAbsent), score: scoreOf(result) }))
    .sort((left, right) => Number(left.absent) - Number(right.absent) || right.score - left.score);
  if (results.some(isStrengthResult)) return rankStrengthEntries(entries, { getParticipant: (entry) => entry.result.participant, getScore: (entry) => entry.score, isAbsent: (entry) => entry.absent, getEvents: (entry) => entry.result.details?.events }).map(({ entry, rank }) => ({ ...entry, rank }));
  if (!results.some(isDivingResult)) return rankRows(entries, (row) => row.score);
  return rankDivingAwardEntries(entries, {
    getParticipant: (entry) => entry.result.participant,
    getScore: (entry) => entry.score,
    isAbsent: (entry) => entry.absent
  }).map(({ entry, rank }) => ({ ...entry, rank }));
};

const PrintAllResultsModal = ({ open, onClose, groupedResults, competition, teamRankings = [] }) => {
  const [signatureImages, setSignatureImages] = useState(savedChiefSignatures);
  const [organizerSignature, setOrganizerSignature] = useState(savedOrganizerSignature);
  if (!competition) return null;

  const schedules = Object.entries(groupedResults || {}).map(([name, results]) => ({ name, schedule: results.find((result) => result.schedule)?.schedule, entries: preparedResults(results) })).filter((section) => section.entries.length);
  const reportHeader = (title, scheduleName = '', discipline = '跳水', schedule = null, locationOnly = false) => <Box className="report-header" sx={{ textAlign: 'center', mb: 0.8, fontFamily: '"SimSun", "宋体", serif' }}>
    <Typography className="report-title" sx={{ fontSize: '24px', fontWeight: 'bold', lineHeight: 1.5, fontFamily: '"SimHei", "黑体", sans-serif' }}>{competition.name}</Typography>
    <Typography className="report-subtitle" sx={{ fontSize: '18px', fontWeight: 'bold', lineHeight: 1.35, fontFamily: '"SimHei", "黑体", sans-serif' }}>{title}</Typography>
    {scheduleName && <Box className="report-meta" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr)', columnGap: 1, alignItems: 'center', fontSize: '14px', mt: 0.5 }}><span style={{ textAlign: 'left', overflowWrap: 'anywhere' }}>{discipline}</span><span style={{ textAlign: 'center', overflowWrap: 'anywhere' }}>{scheduleName}</span><span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{locationOnly ? (competition.location || schedule?.location || schedule?.court || '') : `${schedule?.startTime ? new Date(schedule.startTime).toLocaleDateString() : ''} ${competition.location || schedule?.location || ''}`}</span></Box>}
  </Box>;
  const tableStyle = { borderTop: '1px solid black', borderBottom: '1px solid black' };
  const teamPage = teamRankings.length ? <Box className="report-page" key="team">
    {reportHeader('团体总分')}
    <TableContainer className="report-table" sx={tableStyle}><Table size="small"><TableHead><TableRow>{['名次', '单位', '总分'].map((label) => <TableCell key={label} align="center">{label}</TableCell>)}</TableRow></TableHead><TableBody>
      {teamRankings.map((team, index) => <TableRow key={team.schoolName || index}><TableCell align="center">{index + 1}</TableCell><TableCell align="center">{team.schoolName}</TableCell><TableCell align="center">{Number(team.totalPoints || 0).toFixed(2)}</TableCell></TableRow>)}
    </TableBody></Table></TableContainer>
  </Box> : null;

  const rankPage = ({ name, schedule, entries }) => {
    const leader = entries.find((entry) => !entry.absent)?.score || 0;
    const discipline = entries.some(({ result }) => isStrengthResult(result)) ? '跳水·素质力量' : '跳水';
    const isDivingReport = entries.some(({ result }) => isDivingResult(result) || isStrengthResult(result));
    return <Box className="report-page" key={`${name}-rank`}>
      {reportHeader('名次公告', name, discipline, schedule, isDivingReport)}
      <TableContainer className="report-table rank-table" sx={{ border: '1px solid black' }}><Table size="small"><TableHead><TableRow>{['名次', '姓名', '单位', '成绩', '分差', '备注'].map((label) => <TableCell key={label} align="center">{label}</TableCell>)}</TableRow></TableHead><TableBody>
        {entries.map((entry, index) => <TableRow key={entry.result._id || index}><TableCell align="center">{entry.rank}</TableCell><TableCell align="center">{athlete(entry.result.participant)}</TableCell><TableCell align="center">{unit(entry.result.participant)}</TableCell><TableCell align="center">{entry.absent ? '弃权' : entry.score.toFixed(2)}</TableCell><TableCell align="center">{entry.absent || entry.rank === 1 ? '' : (leader - entry.score).toFixed(2)}</TableCell><TableCell align="center">{entry.absent ? '弃权' : ''}</TableCell></TableRow>)}
      </TableBody></Table></TableContainer>
    </Box>;
  };

  const detailPage = ({ name, schedule, entries }) => {
    const strength = entries.some(({ result }) => isStrengthResult(result));
    if (strength) {
      const leader = entries.find((entry) => !entry.absent)?.score || 0;
      const headings = ['姓名', '单位', '小项', '原始成绩', '积分', '总分', '总名次', '分差'];
      return <Box className="report-page report-detail-page" key={`${name}-detail`}>
        {reportHeader('素质力量明细成绩公告', name, '跳水·素质力量', schedule, true)}
        <TableContainer className="report-table detail-table" sx={tableStyle}><Table size="small"><TableHead><TableRow>{headings.map((label) => <TableCell key={label} align="center">{label}</TableCell>)}</TableRow></TableHead><TableBody>
          {entries.flatMap((entry, entryIndex) => {
            const events = entry.result.details?.events || [];
            const count = Math.max(1, events.length);
            const participantRows = Array.from({ length: count }, (_, eventIndex) => {
              const event = events[eventIndex];
              return <TableRow key={`${entry.result._id || entryIndex}-${eventIndex}`}>
                {eventIndex === 0 && <TableCell rowSpan={count} align="center" className="detail-name-cell">{athlete(entry.result.participant)}</TableCell>}
                {eventIndex === 0 && <TableCell rowSpan={count} align="center" className="detail-unit-cell">{unit(entry.result.participant)}</TableCell>}
                <TableCell align="center" className="detail-action-cell">{event ? strengthActionName(event.actionName) : (entry.absent ? '弃权' : '-')}</TableCell>
                <TableCell align="center">{event?.rawScore ?? '-'}</TableCell><TableCell align="center">{event?.points ?? '-'}</TableCell>
                {eventIndex === 0 && <TableCell rowSpan={count} align="center">{entry.absent ? '弃权' : entry.score.toFixed(2)}</TableCell>}
                {eventIndex === 0 && <TableCell rowSpan={count} align="center">{entry.rank}</TableCell>}
                {eventIndex === 0 && <TableCell rowSpan={count} align="center">{entry.absent || entry.rank === 1 ? '' : (leader - entry.score).toFixed(2)}</TableCell>}
              </TableRow>;
            });
            if (entryIndex < entries.length - 1) participantRows.push(<TableRow key={`${entry.result._id || entryIndex}-spacer`} sx={{ height: 14 }}><TableCell colSpan={headings.length} sx={{ border: 'none !important', p: '0 !important', fontSize: 0 }} /></TableRow>);
            return participantRows;
          })}
        </TableBody></Table></TableContainer>
      </Box>;
    }
    if (!entries.some(({ result }) => Array.isArray(result.details?.dives))) return null;
    const rounds = Math.max(1, ...entries.map(({ result }) => result.details?.dives?.length || 0));
    const totals = entries.map(() => 0);
    const roundRanks = Array.from({ length: rounds }, (_, roundIndex) => {
      entries.forEach((entry, entryIndex) => { totals[entryIndex] += Number(entry.result.details?.dives?.[roundIndex]?.score || 0); });
      const ordered = entries.map((entry, entryIndex) => ({ entryIndex, absent: entry.absent, score: totals[entryIndex] })).sort((left, right) => Number(left.absent) - Number(right.absent) || right.score - left.score);
      return new Map(rankRows(ordered, (row) => row.score).map((row) => [row.entryIndex, row.rank]));
    });
    const leader = entries.find((entry) => !entry.absent)?.score || 0;
    const headings = ['姓名', '单位', '动作', '难度', 'E1', 'E2', 'E3', 'E4', 'E5', '得分', '轮次名次', '累计分', '总名次', '分差'];
    const columnWidths = ['12%', '13%', '15.5%', '5%', '4.5%', '4.5%', '4.5%', '4.5%', '4.5%', '6%', '6%', '7%', '7%', '5%'];
    return <Box className="report-page report-detail-page" key={`${name}-detail`}>
      {reportHeader('明细成绩公告', name, '跳水', schedule, true)}
      <TableContainer className="report-table detail-table" sx={tableStyle}><Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}><colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup><TableHead><TableRow>{headings.map((label) => <TableCell key={label} align="center">{label === '轮次名次' ? <>轮次<br />名次</> : label}</TableCell>)}</TableRow></TableHead><TableBody>
        {entries.flatMap((entry, entryIndex) => {
          const dives = entry.result.details?.dives || [];
          const count = Math.max(1, dives.length);
          let cumulative = 0;
          const participantRows = Array.from({ length: count }, (_, roundIndex) => {
            const dive = dives[roundIndex];
            cumulative += Number(dive?.score || 0);
            return <TableRow key={`${entry.result._id || entryIndex}-${roundIndex}`}>
              {roundIndex === 0 && <TableCell rowSpan={count} align="center" className="detail-name-cell">{entry.result.participant?.isVirtualTeam ? (entry.result.participant.teamMembers || []).map((member, memberIndex) => <React.Fragment key={member._id || memberIndex}>{member.name}{memberIndex < entry.result.participant.teamMembers.length - 1 && <br />}</React.Fragment>) : athlete(entry.result.participant)}</TableCell>}{roundIndex === 0 && <TableCell rowSpan={count} align="center" className="detail-unit-cell">{unit(entry.result.participant)}</TableCell>}
              <TableCell align="center" className="detail-action-cell">{dive?.actionCode || dive?.actionName || (entry.absent ? '弃权' : '-')}</TableCell><TableCell align="center">{dive?.difficulty ?? '-'}</TableCell>{[0, 1, 2, 3, 4].map((judge) => <TableCell key={judge} align="center">{dive?.scores?.[judge] ?? '-'}</TableCell>)}<TableCell align="center">{dive ? Number(dive.score || 0).toFixed(2) : '-'}</TableCell><TableCell align="center">{dive ? roundRanks[roundIndex]?.get(entryIndex) ?? '-' : '-'}</TableCell><TableCell align="center">{dive ? cumulative.toFixed(2) : '-'}</TableCell>
              {roundIndex === 0 && <TableCell rowSpan={count} align="center">{entry.rank}</TableCell>}{roundIndex === 0 && <TableCell rowSpan={count} align="center">{entry.absent || entry.rank === 1 ? '' : (leader - entry.score).toFixed(2)}</TableCell>}
            </TableRow>;
          });
          if (entryIndex < entries.length - 1) participantRows.push(<TableRow key={`${entry.result._id || entryIndex}-spacer`} sx={{ height: 14 }}><TableCell colSpan={headings.length} sx={{ border: 'none !important', p: '0 !important', fontSize: 0 }} /></TableRow>);
          return participantRows;
        })}
      </TableBody></Table></TableContainer>
    </Box>;
  };

  const signaturePage = <Box className="report-page chief-signature-page" key="chief-signature-page">
    <Typography sx={{ mt: '70mm', textAlign: 'center', fontSize: '20pt', fontWeight: 'bold', fontFamily: '"SimHei", "黑体", sans-serif' }}>裁判长、编排长签名页</Typography>
    <Box sx={{ mt: '35mm', ml: '12%', mr: '8%', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: '18mm', rowGap: '14mm', fontSize: '18pt', fontFamily: '"SimSun", "宋体", serif' }}>
      {signatureImages.map((signatureImage, index) => <Box key={`chief-${index}`} sx={{ display: 'flex', alignItems: 'center', minHeight: '34px' }}>裁判长：{signatureImage ? <img src={signatureImage} alt={`裁判长签名 ${index + 1}`} style={{ maxWidth: '240px', maxHeight: '100px', marginLeft: '18px' }} /> : <Box sx={{ width: '200px', height: '34px', ml: 2, borderBottom: '1px solid black' }} />}</Box>)}
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '34px' }}>编排长：{organizerSignature ? <img src={organizerSignature} alt="编排长签名" style={{ maxWidth: '240px', maxHeight: '100px', marginLeft: '18px' }} /> : <Box sx={{ width: '200px', height: '34px', ml: 2, borderBottom: '1px solid black' }} />}</Box>
    </Box>
  </Box>;

  const saveSignatures = (next) => {
    setSignatureImages(next);
    localStorage.setItem('chief_signatures', JSON.stringify(next));
  };
  const uploadSignature = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const next = [...signatureImages];
      next[index] = reader.result;
      saveSignatures(next);
    };
    reader.readAsDataURL(file);
  };
  const uploadOrganizerSignature = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const next = reader.result;
      setOrganizerSignature(next);
      localStorage.setItem('organizer_signature', next);
    };
    reader.readAsDataURL(file);
  };

  return <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth className="all-results-print-dialog" PaperProps={{ sx: { minHeight: '80vh' } }}>
    <DialogTitle className="no-print" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Typography variant="h6">打印总成绩册</Typography><Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>打印</Button></DialogTitle>
    <DialogContent dividers sx={{ bgcolor: '#f5f5f5' }}><Box className="no-print" sx={{ mb: 2 }}><Typography variant="body2" color="text.secondary" gutterBottom>裁判长、编排长电子签会显示在总成绩册最后的独立签名页；可按需新增多位裁判长签名。</Typography><Box sx={{ display: 'grid', gap: 1 }}>{signatureImages.map((signatureImage, index) => <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography variant="body2">裁判长 {index + 1}</Typography><Button variant="outlined" component="label" size="small">{signatureImage ? '更换签名' : '上传签名'}<input type="file" hidden accept="image/*" onChange={(event) => uploadSignature(index, event)} /></Button>{signatureImage && <Button size="small" color="error" onClick={() => saveSignatures(signatureImages.map((item, itemIndex) => itemIndex === index ? '' : item))}>清除</Button>}{signatureImages.length > 1 && <Button size="small" color="error" onClick={() => saveSignatures(signatureImages.filter((_, itemIndex) => itemIndex !== index))}>删除此位</Button>}</Box>)}</Box><Button sx={{ mt: 1 }} variant="outlined" size="small" onClick={() => saveSignatures([...signatureImages, ''])}>新增裁判长签名</Button><Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}><Typography variant="body2">编排长</Typography><Button variant="outlined" component="label" size="small">{organizerSignature ? '更换签名' : '上传签名'}<input type="file" hidden accept="image/*" onChange={uploadOrganizerSignature} /></Button>{organizerSignature && <Button size="small" color="error" onClick={() => { setOrganizerSignature(''); localStorage.removeItem('organizer_signature'); }}>清除</Button>}</Box></Box>
      <Box className="all-results-printable" sx={{ p: 3, bgcolor: 'white', color: 'black' }}>{teamPage}{schedules.map(rankPage)}{schedules.map(detailPage)}{signaturePage}
        <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } body > * { display: none !important; } body > .all-results-print-dialog { display: block !important; } .all-results-print-dialog { position: static !important; width: 100% !important; height: auto !important; min-height: 0 !important; overflow: visible !important; } .all-results-print-dialog .MuiDialog-container, .all-results-print-dialog .MuiPaper-root, .all-results-print-dialog .MuiDialogContent-root { display: block !important; position: static !important; width: 100% !important; height: auto !important; min-height: 0 !important; max-height: none !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; box-shadow: none !important; } .all-results-printable { position: static !important; width: 100% !important; padding: 0 !important; } .no-print, .MuiBackdrop-root { display: none !important; } .report-page { break-before: page; page-break-before: always; } .report-page:first-child { break-before: auto; page-break-before: auto; } .chief-signature-page { min-height: 260mm; } .report-table { overflow: visible !important; } .report-table table { width: 100%; border-collapse: collapse; } .report-title { font-size: 18pt !important; } .report-subtitle { font-size: 14pt !important; } .report-meta { font-size: 10pt !important; } .rank-table th, .rank-table td { border-bottom: 1px solid #000 !important; border-right: 1px solid #000 !important; padding: 4px 6px !important; color: #000 !important; font-family: SimSun, serif !important; font-size: 12pt !important; white-space: nowrap; } .rank-table th:last-child, .rank-table td:last-child { border-right: none !important; } .rank-table th { font-weight: bold !important; } .rank-table td:nth-child(2), .rank-table td:nth-child(3) { white-space: normal !important; word-break: break-all !important; overflow-wrap: anywhere !important; } .report-table:not(.rank-table):not(.detail-table) th, .report-table:not(.rank-table):not(.detail-table) td { border-bottom: 1px solid #000 !important; padding: 4px 5px !important; color: #000 !important; font-family: SimSun, serif !important; font-size: 10pt !important; white-space: nowrap; } .detail-table .MuiTableHead-root .MuiTableCell-root { border: 1px solid #000 !important; padding: 3px 2px !important; color: #000 !important; font-family: SimSun, serif !important; font-size: 9.5pt !important; line-height: 1.25 !important; white-space: nowrap; } .detail-table .MuiTableBody-root .MuiTableCell-root { border: none !important; padding: 3px 2px !important; color: #000 !important; font-family: SimSun, serif !important; font-size: 9.5pt !important; line-height: 1.25 !important; white-space: nowrap; } .detail-table .detail-name-cell, .detail-table .detail-unit-cell, .detail-table .detail-action-cell { white-space: normal !important; word-break: break-all !important; overflow-wrap: anywhere !important; } }`}</style>
      </Box>
    </DialogContent><DialogActions className="no-print"><Button onClick={onClose}>取消</Button></DialogActions>
  </Dialog>;
};

export default PrintAllResultsModal;
