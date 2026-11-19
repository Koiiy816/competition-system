import React from 'react';
import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

const isTeam = (participant) => participant?.isVirtualTeam || participant?.type === 'team';

const participantName = (participant) => {
  const memberNames = (participant?.teamMembers || [])
    .map((member) => member?.name || member?.user?.name)
    .filter(Boolean);
  if (isTeam(participant) && memberNames.length) return memberNames.join('、');
  return participant?.name || participant?.user?.name || participant?.teamName || '-';
};

const participantUnit = (participant) => participant?.schoolName || participant?.teamName || participant?.user?.schoolName || '-';

const participantGroup = (participant) => participant?.ageGroup || participant?.grade || participant?.user?.ageGroup || (isTeam(participant) ? '集体' : '-');

// 普通（含武术）项目的上场顺序打印页。跳水项目继续使用其带动作栏的专用版式。
export default function StartOrderPrint({ competitionName, schedule, participants = [] }) {
  const roster = Array.isArray(participants) ? participants : (schedule?.participants || []);

  return <Box className="start-order-print">
    <style>{`@media print {
      @page { size: A4 portrait; margin: 12mm; }
      .start-order-print { display: block !important; color: #000; background: #fff; font-family: SimSun, "宋体", serif; }
      .start-order-print-title, .start-order-print-subtitle, .start-order-print-event { color: #000; text-align: center; font-family: SimHei, "黑体", sans-serif; }
      .start-order-print-title { font-size: 19pt; font-weight: bold; margin: 0 0 2mm; }
      .start-order-print-subtitle { font-size: 15pt; font-weight: bold; margin: 0 0 5mm; }
      .start-order-print-event { font-size: 13pt; font-weight: bold; margin: 0 0 4mm; }
      .start-order-print-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .start-order-print-table .MuiTableCell-root { border: 1px solid #000 !important; color: #000; padding: 2mm 1.5mm; font-size: 10.5pt; line-height: 1.45; text-align: center; white-space: normal; word-break: break-word; }
      .start-order-print-table .MuiTableHead-root .MuiTableCell-root { font-weight: bold; }
      .start-order-print-table .MuiTableCell-root:nth-child(1) { width: 10%; }
      .start-order-print-table .MuiTableCell-root:nth-child(2) { width: 35%; }
      .start-order-print-table .MuiTableCell-root:nth-child(3) { width: 35%; }
      .start-order-print-table .MuiTableCell-root:nth-child(4) { width: 20%; }
    }
    .start-order-print { display: none; }`}</style>
    <Typography className="start-order-print-title">{competitionName || '比赛'}</Typography>
    <Typography className="start-order-print-subtitle">出场顺序</Typography>
    <Typography className="start-order-print-event">{schedule?.name || '比赛项目'}</Typography>
    <Table className="start-order-print-table" size="small">
      <TableHead><TableRow><TableCell>序号</TableCell><TableCell>姓名</TableCell><TableCell>单位</TableCell><TableCell>组别</TableCell></TableRow></TableHead>
      <TableBody>
        {roster.map((participant, index) => <TableRow key={participant?._id || index}>
          <TableCell>{index + 1}</TableCell><TableCell>{participantName(participant)}</TableCell><TableCell>{participantUnit(participant)}</TableCell><TableCell>{participantGroup(participant)}</TableCell>
        </TableRow>)}
        {!roster.length && <TableRow><TableCell colSpan={4}>暂无已编排选手</TableCell></TableRow>}
      </TableBody>
    </Table>
  </Box>;
}
