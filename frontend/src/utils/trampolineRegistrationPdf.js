import { getAgeGroupDisplayName, getEventDisplayName } from './trampolineRegistration.js';

export function toTrampolineSchoolSections(group, competition) {
  const participants = (group.participants || []).filter(row => !row.isVirtualTeam);
  const contacts = (name, phone) => [...new Set(participants.map(row =>
    [row[name], row[phone] && `（${row[phone]}）`].filter(Boolean).join('')
  ).filter(Boolean))].join('、') || '未填写';
  const sections = new Map();
  for (const row of participants) {
    const ageGroup = getAgeGroupDisplayName(competition, row.ageGroup || row.grade) || '未填写组别';
    if (!sections.has(ageGroup)) sections.set(ageGroup, []);
    sections.get(ageGroup).push(row);
  }
  return [...sections].map(([ageGroup, rows]) => ({
    ageGroup,
    schoolName: group.schoolName || group.displayName || '未知单位',
    leader: contacts('teamLeader', 'leaderPhone'),
    coach: contacts('coach', 'coachPhone'),
    rows: rows.sort((a, b) => String(a.event || '').localeCompare(String(b.event || ''), 'zh-CN')
      || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')).map((row, index) => [
      String(index + 1),
      getEventDisplayName(competition, competition.events?.find(event => event.name === row.event) || { name: row.event }) || '未填写项目',
      row.name || '',
      ({ male: '男', female: '女', mixed: '混合' })[row.gender] || row.gender || '',
      row.idCard || '',
      row.additionalInfo?.notes || row.remark || ''
    ].map(String))
  }));
}

// 逐页用浏览器中文字体绘制，沿用现有报名 PDF 的中文兼容方式。
export async function createTrampolineSchoolPdf(section, competition) {
  if (!section?.rows.length) throw new Error('该组别没有可导出的报名记录');
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const width = 794, height = 1123, margin = 48, bottom = height - 55;
  const columns = [['序号', 38], ['项目', 162], ['姓名', 80], ['性别', 40], ['身份证号', 205], ['备注', 173]];
  const tableWidth = width - margin * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 PDF 导出');
  ctx.scale(2, 2);
  const font = '"Microsoft YaHei", "PingFang SC", sans-serif';
  const lineHeight = 22;
  let y, pageNumber = 0;
  const wrap = (value, availableWidth) => {
    const lines = [];
    let line = '';
    for (const character of String(value)) {
      if (character === '\n' || (line && ctx.measureText(line + character).width > availableWidth)) {
        lines.push(line);
        line = '';
      }
      if (character !== '\n') line += character;
    }
    lines.push(line);
    return lines;
  };
  const textBlock = (value, size, bold = false, centered = false) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
    ctx.fillStyle = '#111';
    for (const line of wrap(value, tableWidth)) {
      ctx.fillText(line, centered ? (width - ctx.measureText(line).width) / 2 : margin, y + size);
      y += size + 10;
    }
  };
  const drawCells = (cells, rowHeight) => {
    let x = margin;
    cells.forEach((lines, index) => {
      const cellWidth = columns[index][1];
      ctx.strokeStyle = '#111';
      ctx.strokeRect(x, y, cellWidth, rowHeight);
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, x + (cellWidth - ctx.measureText(line).width) / 2, y + 20 + lineIndex * lineHeight);
      });
      x += cellWidth;
    });
    y += rowHeight;
  };
  const finishPage = () => {
    ctx.font = `12px ${font}`;
    const footer = `第 ${pageNumber} 页`;
    ctx.fillText(footer, (width - ctx.measureText(footer).width) / 2, height - 28);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  };
  const startPage = () => {
    if (pageNumber) { finishPage(); pdf.addPage(); }
    pageNumber += 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    y = margin;
    textBlock(competition.name, 22, true, true);
    textBlock(section.schoolName, 20, true, true);
    y += 15;
    textBlock(`领队：${section.leader}`, 16);
    textBlock(`教练员：${section.coach}`, 16);
    y += 15;
    textBlock(section.ageGroup, 20, true, true);
    y += 10;
    textBlock(`单位盖章：${section.schoolName}`, 16);
    y += 75;
    textBlock('运动员：', 16, true);
    ctx.font = `bold 14px ${font}`;
    drawCells(columns.map(([label]) => [label]), 32);
    ctx.font = `14px ${font}`;
    if (bottom - y < lineHeight + 10) throw new Error('领队、教练信息过长，请精简后导出');
  };
  startPage();
  for (const row of section.rows) {
    let lines = row.map((cell, index) => wrap(cell, columns[index][1] - 10));
    let count = Math.max(...lines.map(cell => cell.length));
    const rowHeight = count * lineHeight + 10;
    if (y + rowHeight > bottom && rowHeight < 500) startPage();
    while (count > 0) {
      const take = Math.min(count, Math.floor((bottom - y - 10) / lineHeight));
      if (take <= 0) { startPage(); continue; }
      drawCells(lines.map(cell => cell.slice(0, take)), take * lineHeight + 10);
      lines = lines.map(cell => cell.slice(take));
      count -= take;
      if (count > 0) startPage();
    }
  }
  finishPage();
  return pdf;
}
