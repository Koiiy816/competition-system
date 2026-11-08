import React, { useMemo, useState } from 'react';
import { Alert, Box, Chip, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { trampolineDifficultyTable, trampolinePostures } from '../data/trampolineDifficultyTable';

export default function TrampolineDifficultyTablePage() {
  const [code, setCode] = useState('');
  const [posture, setPosture] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const filteredRows = useMemo(() => {
    const normalizedCode = code.trim();
    return trampolineDifficultyTable.filter((entry) => (
      (!normalizedCode || entry.code.includes(normalizedCode))
      && (!posture || entry.posture === posture)
    ));
  }, [code, posture]);
  const pageRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return <Box>
    <Typography variant="h4" fontWeight={800} gutterBottom>蹦床难度系数表</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>
      2025–2028 周期网上难度动作分值。动作编号、姿势符号及难度值均按原表录入。
    </Typography>
    <Alert severity="info" sx={{ mb: 2 }}>
      已导入 {trampolineDifficultyTable.length} 条记录；可按动作编号或姿势快速查询。原表的第 1 至第 4 栏仅用于保留录入来源，不代表额外分类。
    </Alert>
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <TextField label="动作编号" value={code} onChange={(event) => { setCode(event.target.value); setPage(0); }} placeholder="例如 12003" size="small" />
        <TextField select label="姿势" value={posture} onChange={(event) => { setPosture(event.target.value); setPage(0); }} size="small" sx={{ minWidth: 150 }}>
          <MenuItem value="">全部姿势</MenuItem>
          {trampolinePostures.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
        <Chip label={`匹配 ${filteredRows.length} 条`} color="primary" variant="outlined" sx={{ alignSelf: 'center' }} />
      </Box>
    </Paper>
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="蹦床难度系数表">
        <TableHead><TableRow><TableCell>动作编号</TableCell><TableCell>姿势</TableCell><TableCell align="right">难度系数</TableCell></TableRow></TableHead>
        <TableBody>
          {pageRows.map((entry, index) => <TableRow key={`${entry.code}-${entry.posture}-${entry.difficulty}-${index}`} hover>
            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{entry.code}</TableCell>
            <TableCell>{entry.posture}</TableCell>
            <TableCell align="right">{entry.difficulty.toFixed(1)}</TableCell>
          </TableRow>)}
          {!filteredRows.length && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>没有匹配的动作。</TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
    <TablePagination
      component="div"
      count={filteredRows.length}
      page={page}
      onPageChange={(_, nextPage) => setPage(nextPage)}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
      rowsPerPageOptions={[20, 50, 100]}
      labelRowsPerPage="每页显示"
      labelDisplayedRows={({ from, to, count }) => `${from}–${to} / 共 ${count} 条`}
    />
  </Box>;
}
