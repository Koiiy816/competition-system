import React, { useMemo, useState } from 'react';
import { Alert, Box, Chip, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import divingDifficultyTable from '../data/divingDifficultyTable';

const typeLabels = { board: '跳板', platform: '跳台' };
const rows = Object.entries(divingDifficultyTable).flatMap(([type, heights]) => Object.entries(heights).flatMap(([height, actions]) => (
  Object.entries(actions).map(([code, difficulty]) => ({ type, height, code, difficulty }))
))).sort((left, right) => left.type.localeCompare(right.type) || Number(left.height.replace('m', '')) - Number(right.height.replace('m', '')) || left.code.localeCompare(right.code, undefined, { numeric: true }));

export default function DivingDifficultyTablePage() {
  const [code, setCode] = useState('');
  const [type, setType] = useState('');
  const [height, setHeight] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const heights = useMemo(() => [...new Set(rows.filter((row) => !type || row.type === type).map((row) => row.height))].sort((left, right) => Number(left.replace('m', '')) - Number(right.replace('m', ''))), [type]);
  const filteredRows = useMemo(() => {
    const normalizedCode = code.trim().toUpperCase();
    return rows.filter((row) => (!normalizedCode || row.code.includes(normalizedCode)) && (!type || row.type === type) && (!height || row.height === height));
  }, [code, height, type]);
  const pageRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return <Box>
    <Typography variant="h4" fontWeight={800} gutterBottom>跳水难度系数表</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>系统补录跳水动作表所使用的官方动作难度数据，可按动作代码、跳板/跳台和实际高度查询。</Typography>
    <Alert severity="info" sx={{ mb: 2 }}>已收录 {rows.length} 条动作难度记录：跳板 1 米、3 米及跳台 5 米、7.5 米、10 米。</Alert>
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <TextField label="动作代码" value={code} onChange={(event) => { setCode(event.target.value); setPage(0); }} placeholder="例如 101B" size="small" />
        <TextField select label="器械" value={type} onChange={(event) => { setType(event.target.value); setHeight(''); setPage(0); }} size="small" sx={{ minWidth: 140 }}>
          <MenuItem value="">全部器械</MenuItem>
          {Object.entries(typeLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField select label="高度" value={height} onChange={(event) => { setHeight(event.target.value); setPage(0); }} size="small" sx={{ minWidth: 140 }}>
          <MenuItem value="">全部高度</MenuItem>
          {heights.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
        <Chip label={`匹配 ${filteredRows.length} 条`} color="primary" variant="outlined" sx={{ alignSelf: 'center' }} />
      </Box>
    </Paper>
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="跳水难度系数表">
        <TableHead><TableRow><TableCell>器械</TableCell><TableCell>高度</TableCell><TableCell>动作代码</TableCell><TableCell align="right">难度系数</TableCell></TableRow></TableHead>
        <TableBody>
          {pageRows.map((row) => <TableRow key={`${row.type}-${row.height}-${row.code}`} hover>
            <TableCell>{typeLabels[row.type]}</TableCell><TableCell>{row.height}</TableCell><TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{row.code}</TableCell><TableCell align="right">{row.difficulty.toFixed(1)}</TableCell>
          </TableRow>)}
          {!filteredRows.length && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>没有匹配的动作。</TableCell></TableRow>}
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
