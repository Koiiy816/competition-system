import React from 'react';
import { Alert, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

export default function WushuFeeTable({ roster, renderActions, getStatusInfo, getGenderLabel }) {
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>一至两项每人300元，每增加一项加100元（双人项目每人各计一项）。同名项目去重，已拒绝项目不计费。筛选仅筛选人员，费用按该人全部报名计算。</Alert>
      <TableContainer>
        <Table size="small" aria-label="单位参赛者报名费用">
          <TableHead><TableRow>
            <TableCell>参赛者</TableCell><TableCell>报名项目信息及操作</TableCell><TableCell align="right">报名费用（元）</TableCell>
          </TableRow></TableHead>
          <TableBody>{roster.map(person => (
            <TableRow key={person.key}>
              <TableCell sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>{person.name}<Typography variant="caption" display="block" sx={{ whiteSpace: 'normal', maxWidth: 180, overflowWrap: 'anywhere' }}>{person.athleteNumber || '待管理员确认编号'}</Typography></TableCell>
              <TableCell>
                <Table size="small" aria-label={`${person.name}的报名项目`}>
                  <TableHead><TableRow>
                    {['项目', '性别', '年龄组别', '类型', '状态', '备注', '报名时间', '操作'].map(label => <TableCell key={label}>{label}</TableCell>)}
                  </TableRow></TableHead>
                  <TableBody>{person.registrations.map(row => (
                    <TableRow key={row._id}>
                      <TableCell>{row.event || '未分类项目'}{row.additionalInfo?.eventDetail && `（${row.additionalInfo.eventDetail}）`}{row.groupTeam && ` / ${row.groupTeam}`}</TableCell>
                      <TableCell>{getGenderLabel(row.gender)}</TableCell>
                      <TableCell>{row.ageGroup || row.grade || '-'}</TableCell>
                      <TableCell>{row.type === 'team' ? '团队' : '个人'}</TableCell>
                      <TableCell>{getStatusInfo(row.status).name}</TableCell>
                      <TableCell>{row.additionalInfo?.notes || row.remark || '-'}</TableCell>
                      <TableCell>{row.registrationDate ? new Date(row.registrationDate).toLocaleString() : '-'}</TableCell>
                      <TableCell>{renderActions(row)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </TableCell>
              <TableCell align="right" sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                <Typography fontWeight="bold">{person.fee === null ? '待确认' : person.fee}</Typography>
                <Typography variant="caption">{person.eventCount}个计费项目</Typography>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
