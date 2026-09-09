import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { toDivingPlanPrintRecord } from '../utils/divingPlanPrint';

const genderText = (gender) => gender === '男女混合' ? '☑男　☑女（男女混合）' : `☑${gender || '　'}　□${gender === '男' ? '女' : '男'}`;

const DivingPlanItem = ({ participant }) => {
  const record = toDivingPlanPrintRecord(participant);
  const rows = record.dives.length ? record.dives : [{}];
  return <Box className="diving-plan-print-item">
    <Box className="diving-plan-print-meta">
      <span>姓名：{record.name}</span><span>参赛单位：{record.unit}</span><span>性别：{genderText(record.gender)}</span>
      <span>组别：{record.group}</span><span className="diving-plan-print-event">项目：{record.event}{record.takeoffOrHeight ? `　（${record.takeoffOrHeight}）` : ''}</span>
    </Box>
    <Table className="diving-plan-print-table" size="small">
      <TableHead><TableRow>
        <TableCell>轮次</TableCell><TableCell>起跳方式<br />或高度</TableCell><TableCell>动作<br />代码</TableCell><TableCell>姿势<br />A、B、C、D</TableCell><TableCell>难度<br />系数</TableCell>
      </TableRow></TableHead>
      <TableBody>{rows.map((dive, index) => <TableRow key={index}>
        <TableCell>{index + 1}</TableCell><TableCell>{index === 0 ? record.takeoffOrHeight : ''}</TableCell><TableCell>{dive.actionCode}</TableCell><TableCell>{dive.posture}</TableCell><TableCell>{dive.difficulty}</TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </Box>;
};

const DivingPlanSection = ({ title, participants }) => participants.length ? <Box className="diving-plan-print-section">
  <Typography className="diving-plan-print-subtitle">{title}</Typography>
  {participants.map((participant) => <DivingPlanItem key={participant._id} participant={participant} />)}
</Box> : null;

const competitionKey = (participant) => String(participant?.competition?._id || participant?.competition || 'default');

export default function DivingPlanPrintPreview({ open, onClose, participants }) {
  const handlePrint = () => window.print();
  const competitionGroups = Array.from(participants.reduce((groups, participant) => {
    const key = competitionKey(participant);
    const group = groups.get(key) || [];
    group.push(participant);
    groups.set(key, group);
    return groups;
  }, new Map()).values());
  return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper" className="diving-plan-print-dialog">
    <style>{`@media print {
      body > *:not(.diving-plan-print-dialog) { display: none !important; }
      .diving-plan-print-dialog, .diving-plan-print-dialog .MuiDialog-container, .diving-plan-print-dialog .MuiPaper-root { display: block !important; position: static !important; width: 100% !important; max-width: none !important; max-height: none !important; margin: 0 !important; box-shadow: none !important; overflow: visible !important; }
      .diving-plan-print-dialog .MuiDialogContent-root { padding: 0 !important; overflow: visible !important; }
      .diving-plan-print-dialog .no-print, .diving-plan-print-dialog .MuiBackdrop-root { display: none !important; }
      .diving-plan-print-item { break-inside: avoid; page-break-inside: avoid; }
      .diving-plan-print-table thead { display: table-header-group; }
      @page { size: A4 portrait; margin: 10mm; }
    }
    .diving-plan-print-document { color: #000; background: #fff; font-family: SimSun, "宋体", serif; padding: 8mm 10mm; }
    .diving-plan-print-title, .diving-plan-print-subtitle { text-align: center; font-family: SimHei, "黑体", sans-serif; color: #000; }
    .diving-plan-print-title { font-size: 19pt; margin-bottom: 4mm; }.diving-plan-print-subtitle { font-size: 14pt; margin: 5mm 0 4mm; }
    .diving-plan-print-item { margin-bottom: 8mm; }.diving-plan-print-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm 5mm; font-size: 10.5pt; margin-bottom: 3mm; }.diving-plan-print-event { grid-column: span 2; }
    .diving-plan-print-table { border-collapse: collapse; width: 100%; table-layout: fixed; }.diving-plan-print-table .MuiTableCell-root { border: 1px solid #000; color: #000; text-align: center; padding: 1.7mm 0.8mm; font-size: 9pt; height: 9.5mm; }.diving-plan-print-table .MuiTableHead-root .MuiTableCell-root { font-weight: bold; height: auto; }.diving-plan-print-table .MuiTableCell-root:nth-child(1) { width: 10%; }.diving-plan-print-table .MuiTableCell-root:nth-child(2) { width: 24%; }.diving-plan-print-table .MuiTableCell-root:nth-child(3) { width: 22%; }.diving-plan-print-table .MuiTableCell-root:nth-child(4) { width: 22%; }.diving-plan-print-table .MuiTableCell-root:nth-child(5) { width: 22%; }
    `}</style>
    <DialogTitle className="no-print">跳水动作表打印预览</DialogTitle>
    <DialogContent dividers>{competitionGroups.map((group) => {
      const pairParticipants = group.filter((participant) => participant?.additionalInfo?.divingPair);
      const individualParticipants = group.filter((participant) => !participant?.additionalInfo?.divingPair);
      return <Box className="diving-plan-print-document" key={competitionKey(group[0])}>
        <Typography className="diving-plan-print-title">{toDivingPlanPrintRecord(group[0]).competitionName}</Typography>
        <DivingPlanSection title="双人项目动作表" participants={pairParticipants} />
        <DivingPlanSection title="单人项目动作表" participants={individualParticipants} />
      </Box>;
    })}</DialogContent>
    <DialogActions className="no-print"><Button onClick={onClose}>取消</Button><Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>打印/另存为 PDF</Button></DialogActions>
  </Dialog>;
}
