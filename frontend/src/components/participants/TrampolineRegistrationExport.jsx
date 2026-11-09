import React, { useState } from 'react';
import { Box, Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { createTrampolineSchoolPdf, toTrampolineSchoolSections } from '../../utils/trampolineRegistrationPdf';
import participantService from '../../services/participantService';

export default function TrampolineRegistrationExport({ group, competition, myRegistrations, onError }) {
  const [ageGroup, setAgeGroup] = useState('');
  const [exporting, setExporting] = useState(false);
  const sections = toTrampolineSchoolSections(group, competition);
  const selected = sections.find(section => section.ageGroup === ageGroup) || sections[0];
  const handleExport = async () => {
    setExporting(true);
    onError('');
    try {
      const response = await participantService.getParticipants(competition._id, {
        groupBy: 'school', exportPdf: true, ...(myRegistrations ? { myRegistrations: true } : {})
      });
      const fullGroup = response.data?.find(item => item.schoolName === group.schoolName);
      const section = fullGroup && toTrampolineSchoolSections(fullGroup, competition).find(item => item.ageGroup === selected.ageGroup);
      const pdf = await createTrampolineSchoolPdf(section, competition);
      const filename = `${competition.name}_${selected.schoolName}_${selected.ageGroup}_报名表`.replace(/[\\/:*?"<>|]/g, '_');
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      onError(error.message || '报名信息 PDF 导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };
  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 180 }} disabled={exporting || !selected}>
        <InputLabel id={`export-group-${group.schoolName}`}>导出组别</InputLabel>
        <Select labelId={`export-group-${group.schoolName}`} label="导出组别" value={selected?.ageGroup || ''} onChange={event => setAgeGroup(event.target.value)}>
          {sections.map(section => <MenuItem key={section.ageGroup} value={section.ageGroup}>{section.ageGroup}（{section.rows.length}项报名）</MenuItem>)}
        </Select>
      </FormControl>
      <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExport} disabled={exporting || !selected}>
        {exporting ? '正在导出…' : '导出组别报名表 (PDF)'}
      </Button>
    </Box>
  );
}
