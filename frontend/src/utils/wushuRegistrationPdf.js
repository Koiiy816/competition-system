const detailColumns = [
  ['序号', 44], ['姓名', 120], ['性别', 42], ['出生日期', 85], ['证件号码', 170],
  ['参赛单位', 160], ['报名项目', 190], ['组别', 80], ['队伍', 85], ['报名状态', 80]
];
const groupedColumns = [
  ['参赛者', 150], ['所属单位', 180], ['性别', 60], ['年龄组别', 100],
  ['类型', 65], ['状态', 75], ['备注', 246], ['报名时间', 130]
];
const statusLabels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
const genderLabels = { male: '男', female: '女', mixed: '男女混合' };
const dateText = value => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleDateString('zh-CN') : '-';

export const toWushuRegistrationRows = (participants, competition) => participants
  .filter(participant => !participant.isVirtualTeam
    && String(participant.competition?._id || participant.competition) === String(competition._id))
  .map((participant, index) => ({
    cells: [index + 1, participant.name, genderLabels[participant.gender] || participant.gender,
      dateText(participant.birthDate), participant.idCard, participant.schoolName,
      [participant.event, participant.additionalInfo?.eventDetail].filter(Boolean).join(' / '),
      participant.ageGroup || participant.grade, participant.groupTeam || participant.teamName,
      statusLabels[participant.status] || participant.status].map(value => String(value || '-')),
    details: [
      `序号：${index + 1}`,
      `报名编号：${participant.registrationNumber || '-'}`,
      `运动员编号：${participant.athleteNumber || '-'}`,
      `报名日期：${dateText(participant.registrationDate)}`,
      `联系电话：${participant.phone || '-'}`,
      `领队：${participant.teamLeader || '-'}（${participant.leaderPhone || '-'}）`,
      `教练：${participant.coach || '-'}（${participant.coachPhone || '-'}）`,
      `备注：${participant.additionalInfo?.notes || '-'}`
    ].join('　　')
  }));

export const toWushuRegistrationGroups = (groups, competition) => groups.map(group => ({
  title: [group.displayName || group.event || '未分类项目', group.ageGroup,
    group.schoolName !== '未知单位' && group.schoolName,
    `人数：${(group.participants || []).length}`].filter(Boolean).join('　｜　'),
  rows: (group.participants || []).map(participant => ({
    cells: [
      participant.type === 'team' ? participant.teamName : (participant.name || participant.user?.name || '未知参赛者'),
      participant.schoolName || '-',
      ({ male: '男', female: '女' })[participant.gender] || participant.gender || '-',
      participant.ageGroup || participant.grade || '-',
      participant.isGroupEvent === true || competition.events?.some(event => event.name === participant.event && event.isGroupEvent) ? '集体' : '个人',
      statusLabels[participant.status] || participant.status || '-',
      participant.additionalInfo?.notes || '-',
      participant.registrationDate && !Number.isNaN(new Date(participant.registrationDate).getTime())
        ? new Date(participant.registrationDate).toLocaleString() : '-'
    ].map(value => String(value || '-'))
  }))
}));

export function createWushuRegistrationPdf(participants, competition) {
  return renderWushuRegistrationPdf([{ rows: toWushuRegistrationRows(participants, competition) }], competition, false);
}

export function createWushuGroupedRegistrationPdf(groups, competition) {
  return renderWushuRegistrationPdf(toWushuRegistrationGroups(groups, competition), competition, true);
}

// 使用浏览器中文字体绘制，避免 PDF 默认字体缺少中文字形；逐页生成防止长表格截断。
async function renderWushuRegistrationPdf(sections, competition, grouped) {
  const columns = grouped ? groupedColumns : detailColumns;
  const rows = sections.flatMap(section => section.rows);
  if (!rows.length) throw new Error('当前赛事下没有可导出的报名记录');
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = 1120;
  const height = 792;
  const margin = 22;
  const tableWidth = columns.reduce((sum, column) => sum + column[1], 0);
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 PDF 导出');
  ctx.scale(2, 2);
  const font = '"Microsoft YaHei", "PingFang SC", sans-serif';
  let y;
  let pageNumber = 0;
  let currentSection;
  const lineHeight = 21;
  const bottom = height - 44;
  const wrap = (text, availableWidth) => {
    const lines = [];
    let line = '';
    for (const character of String(text)) {
      if (character === '\n' || (line && ctx.measureText(line + character).width > availableWidth)) {
        lines.push(line);
        line = '';
      }
      if (character !== '\n') line += character;
    }
    lines.push(line);
    return lines;
  };
  const drawCells = (cells, widths, rowHeight, header = false) => {
    let x = margin;
    cells.forEach((lines, index) => {
      ctx.fillStyle = header ? '#e8edf2' : '#ffffff';
      ctx.fillRect(x, y, widths[index], rowHeight);
      ctx.strokeStyle = '#89939e';
      ctx.strokeRect(x, y, widths[index], rowHeight);
      ctx.fillStyle = '#111111';
      lines.forEach((line, lineIndex) => ctx.fillText(line, x + 7, y + 20 + lineIndex * lineHeight));
      x += widths[index];
    });
    y += rowHeight;
  };
  const finishPage = () => {
    ctx.font = `12px ${font}`;
    ctx.fillStyle = '#333333';
    ctx.fillText(`第 ${pageNumber} 页　｜　共 ${rows.length} 条报名项目`, margin, height - 20);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210, undefined, 'FAST');
  };
  const startPage = () => {
    if (pageNumber) { finishPage(); pdf.addPage(); }
    pageNumber += 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#111111';
    ctx.font = `bold 20px ${font}`;
    const title = wrap(`${competition.name} - ${grouped ? '按项目分组报名表' : '报名明细'}`, tableWidth);
    title.forEach((line, index) => ctx.fillText(line, margin, 32 + index * 25));
    y = 47 + (title.length - 1) * 25;
    ctx.font = `12px ${font}`;
    ctx.fillText(grouped ? '按当前页面分组、顺序和筛选结果导出（包含所有折叠分组）'
      : '当前账号全部报名项目（含待审核、已通过、已拒绝），不受列表筛选和分页影响', margin, y + 14);
    y += 28;
    if (grouped) {
      ctx.font = `bold 16px ${font}`;
      const heading = wrap(currentSection.title, tableWidth);
      heading.forEach((line, index) => ctx.fillText(line, margin, y + 18 + index * lineHeight));
      y += heading.length * lineHeight + 12;
    }
    ctx.font = `14px ${font}`;
    drawCells(columns.map(([label]) => [label]), columns.map(([, size]) => size), 32, true);
  };
  const drawWrappedRow = (cells, widths) => {
    let lines = cells.map((text, index) => wrap(text, widths[index] - 14));
    let count = Math.max(...lines.map(cell => cell.length));
    // 超过整页的长备注直接利用当前页剩余空间，再跨页续写。
    if (y + count * lineHeight + 10 > bottom && count * lineHeight + 10 <= bottom - 150) startPage();
    while (count > 0) {
      const take = Math.min(count, Math.floor((bottom - y - 10) / lineHeight));
      if (take <= 0) { startPage(); continue; }
      drawCells(lines.map(cell => cell.slice(0, take)), widths, take * lineHeight + 10);
      lines = lines.map(cell => cell.slice(take));
      count -= take;
      if (count > 0) startPage();
    }
  };
  sections.forEach(section => {
    if (!section.rows.length) return;
    currentSection = section;
    startPage();
    section.rows.forEach(row => {
      drawWrappedRow(row.cells, columns.map(([, size]) => size));
      if (row.details) drawWrappedRow([row.details], [tableWidth]);
    });
  });
  finishPage();
  return pdf;
}
