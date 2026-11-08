import React from 'react';
import { Alert, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

export default function WushuFeeTable({ roster, renderActions, getStatusInfo, getGenderLabel }) {
  // 两层表格都使用固定轨道：不让某一行的长项目名或长单位名重新分配“操作”列位置。
  const outerColumnWidths = ['220px', '1004px', '132px'];
  const registrationColumnWidths = ['300px', '72px', '92px', '64px', '76px', '128px', '176px', '96px'];

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>按参赛者编号跨单位统计：一至两项每人300元，每增加一项加100元。同名项目去重，已拒绝项目不计费。费用显示在最早有效报名所属单位，其他单位标注“已计费”；筛选不截断个人全赛事费用。</Alert>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="单位参赛者报名费用" sx={{ minWidth: 1356, tableLayout: 'fixed' }}>
          <colgroup>{outerColumnWidths.map((width) => <col key={width} style={{ width }} />)}</colgroup>
          <TableHead><TableRow>
            <TableCell>参赛者</TableCell><TableCell>报名项目信息及操作</TableCell><TableCell align="right">会务费（元）</TableCell>
          </TableRow></TableHead>
          <TableBody>{roster.map(person => (
            <TableRow key={person.key}>
              <TableCell sx={{ verticalAlign: 'top', overflowWrap: 'anywhere' }}>{person.name}<Typography variant="caption" display="block" sx={{ mt: .5, overflowWrap: 'anywhere' }}>{person.athleteNumber || '待管理员确认编号'}</Typography></TableCell>
              <TableCell sx={{ px: 0 }}>
                <Table size="small" aria-label={`${person.name}的报名项目`} sx={{ minWidth: 1004, tableLayout: 'fixed' }}>
                  <colgroup>{registrationColumnWidths.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup>
                  <TableHead><TableRow>
                    {['项目', '性别', '年龄组别', '类型', '状态', '备注', '报名时间', '操作'].map((label) => <TableCell key={label} align={label === '操作' ? 'center' : 'left'} sx={{ whiteSpace: 'nowrap' }}>{label}</TableCell>)}
                  </TableRow></TableHead>
                  <TableBody>{person.registrations.map(row => (
                    <TableRow key={row._id}>
                      <TableCell sx={{ overflowWrap: 'anywhere' }}>{row.event || '未分类项目'}{row.additionalInfo?.eventDetail && `（${row.additionalInfo.eventDetail}）`}{row.groupTeam && ` / ${row.groupTeam}`}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{getGenderLabel(row.gender)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.ageGroup || row.grade || '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.isGroupEvent ? '集体' : '个人'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{getStatusInfo(row.status).name}</TableCell>
                      <TableCell sx={{ overflowWrap: 'anywhere' }}>{row.additionalInfo?.notes || row.remark || '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.registrationDate ? new Date(row.registrationDate).toLocaleString() : '-'}</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{renderActions(row)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </TableCell>
              <TableCell align="right" sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                <Typography fontWeight="bold">{person.fee === null ? '待确认' : person.isFeeBillingUnit === false ? '已计费' : person.fee}</Typography>
                <Typography variant="caption">{person.eventCount}个计费项目</Typography>
                {person.schoolCount > 1 && <Typography variant="caption" display="block" sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>个人合计{person.totalFee}元{person.isFeeBillingUnit === false && `，已在${person.billingSchoolName}列计`}</Typography>}
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
