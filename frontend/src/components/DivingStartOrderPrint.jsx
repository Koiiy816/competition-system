import React from 'react';
import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { isDivingStartOrderSchedule, toDivingStartOrderRecord } from '../utils/divingPlanPrint';

const formatDifficulty = (difficulty) => difficulty === '' || difficulty === null || difficulty === undefined ? '-' : difficulty;

export default function DivingStartOrderPrint({ competitionName, schedules, className = '' }) {
  const divingSchedules = (schedules || []).filter(isDivingStartOrderSchedule);
  return <Box className={`diving-start-order-print ${className}`.trim()}>
    <style>{`@media print {
      @page { size: A4 landscape; margin: 10mm; }
      .diving-start-order-print { display: block !important; color: #000; font-family: SimSun, "宋体", serif; }
      .diving-start-order-title, .diving-start-order-subtitle, .diving-start-order-event-title { color: #000; text-align: center; font-family: SimHei, "黑体", sans-serif; }
      .diving-start-order-title { font-size: 19pt; font-weight: bold; margin: 0 0 2mm; }
      .diving-start-order-subtitle { font-size: 15pt; font-weight: bold; margin: 0 0 5mm; }
      .diving-start-order-event { break-before: page; page-break-before: always; }
      .diving-start-order-event:first-of-type { break-before: auto; page-break-before: auto; }
      .diving-start-order-event-title { font-size: 13pt; font-weight: bold; margin: 0 0 3mm; }
      .diving-start-order-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
      .diving-start-order-table .MuiTableCell-root { border: 1px solid #000 !important; color: #000; padding: 1.4mm 0.7mm; font-size: 8.5pt; line-height: 1.3; text-align: center; white-space: normal; word-break: break-all; }
      .diving-start-order-table .MuiTableHead-root .MuiTableCell-root { font-weight: bold; }
      .diving-start-order-table .MuiTableCell-root:nth-child(1) { width: 5%; }
      .diving-start-order-table .MuiTableCell-root:nth-child(2) { width: 9%; }
      .diving-start-order-table .MuiTableCell-root:nth-child(3) { width: 13%; }
      .diving-start-order-table .MuiTableCell-root:last-child { width: 7%; }
    }
    .diving-start-order-print { display: none; }`}</style>
    <Typography className="diving-start-order-title">{competitionName || '跳水比赛'}</Typography>
    <Typography className="diving-start-order-subtitle">出场顺序</Typography>
    {divingSchedules.map((schedule) => {
      const records = (schedule.participants || []).map((participant) => toDivingStartOrderRecord(participant, schedule));
      const roundCount = Math.max(schedule.divingProgram?.length || 0, ...records.map((record) => record.dives.length), 1);
      return <Box className="diving-start-order-event" key={schedule._id || schedule.name}>
        <Typography className="diving-start-order-event-title">{schedule.name}</Typography>
        <Table className="diving-start-order-table" size="small">
          <TableHead><TableRow>
            <TableCell rowSpan={2}>序号</TableCell><TableCell rowSpan={2}>姓名</TableCell><TableCell rowSpan={2}>单位</TableCell>
            {Array.from({ length: roundCount }, (_, index) => <TableCell colSpan={2} key={index}>动作{index + 1}</TableCell>)}
            <TableCell rowSpan={2}>难度系数总和</TableCell>
          </TableRow><TableRow>
            {Array.from({ length: roundCount }, (_, index) => <React.Fragment key={index}><TableCell>代码</TableCell><TableCell>难度</TableCell></React.Fragment>)}
          </TableRow></TableHead>
          <TableBody>{records.map((record, index) => <TableRow key={`${record.name}-${index}`}>
            <TableCell>{index + 1}</TableCell><TableCell>{record.name}</TableCell><TableCell>{record.unit}</TableCell>
            {Array.from({ length: roundCount }, (_, round) => <React.Fragment key={round}><TableCell>{record.dives[round]?.actionCode || '-'}</TableCell><TableCell>{formatDifficulty(record.dives[round]?.difficulty)}</TableCell></React.Fragment>)}
            <TableCell>{record.totalDifficulty}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </Box>;
    })}
  </Box>;
}
