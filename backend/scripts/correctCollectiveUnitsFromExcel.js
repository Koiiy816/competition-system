/*
 * 一次性修正集体项目的代表单位。
 *
 * 默认仅预览：
 *   node scripts/correctCollectiveUnitsFromExcel.js --competition <比赛ID> --event "陈氏太极拳精要十八式（集体）" --file /app/uploads/collective.xlsx
 *
 * 预览中的 unmatched、ambiguous、duplicateExcelRows、virtualTeamConflicts 均为 0 后，才可执行：
 *   node scripts/correctCollectiveUnitsFromExcel.js --competition <比赛ID> --event "陈氏太极拳精要十八式（集体）" --file /app/uploads/collective.xlsx --apply --sync-virtual-teams
 *
 * 只会查询和更新指定比赛、指定集体项目的真实报名记录。不会触及个人项目或 groupTeam（队伍编号）。
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Participant = require('../models/Participant');

require('dotenv').config({ path: path.resolve(__dirname, '../config/.env') });

const requiredArg = (args, name) => {
  const value = args[name];
  if (!value) throw new Error(`缺少参数 --${name}`);
  return value;
};

const parseArgs = () => {
  const args = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const token = process.argv[index];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const next = process.argv[index + 1];
    args[name] = next && !next.startsWith('--') ? next : true;
    if (args[name] === next) index += 1;
  }
  return args;
};

const text = (value) => String(value ?? '').trim();
const normalizeEvent = (value) => text(value).replace(/[()]/g, (character) => character === '(' ? '（' : '）').replace(/\s+/g, '');
const normalizeName = (value) => text(value)
  // Excel 中“于军（Yu Jun）”应能匹配系统的“于军”，但不会移除中文括号内容。
  .replace(/[（(][^）)]*[A-Za-z][^）)]*[）)]/g, '')
  .replace(/[\s·・、,，.。'"“”]/g, '')
  .toLocaleLowerCase('zh-CN');
const normalizeGender = (value) => {
  const input = text(value).toLocaleLowerCase('zh-CN');
  if (['男', 'male', 'm', '男性'].includes(input)) return 'male';
  if (['女', 'female', 'f', '女性'].includes(input)) return 'female';
  return input;
};
const normalizeUnit = (value) => text(value).replace(/[\s·・、,，.。'"“”]/g, '').toLocaleLowerCase('zh-CN');

const reportPath = (args) => path.resolve(args.report || path.join(process.cwd(), `collective-unit-preview-${Date.now()}.json`));

function readRoster(file, targetEvent) {
  const workbook = XLSX.readFile(file, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const headerIndex = rows.findIndex((row) => row.some((cell) => text(cell) === '姓名') && row.some((cell) => ['单位', '参赛单位', '代表单位'].includes(text(cell))));
  if (headerIndex < 0) throw new Error('Excel 中未找到包含“姓名”和“单位”的表头行');
  const headers = rows[headerIndex].map(text);
  const column = (names) => headers.findIndex((header) => names.includes(header));
  const nameColumn = column(['姓名']);
  const unitColumn = column(['单位', '参赛单位', '代表单位']);
  const genderColumn = column(['性别']);
  const eventColumn = column(['项目', '比赛项目']);
  if (nameColumn < 0 || unitColumn < 0 || eventColumn < 0) throw new Error('Excel 必须包含“姓名、单位、项目”列');

  const normalizedTargetEvent = normalizeEvent(targetEvent);
  return rows.slice(headerIndex + 1).map((row, offset) => ({
    excelRow: headerIndex + offset + 2,
    name: text(row[nameColumn]),
    schoolName: text(row[unitColumn]),
    gender: text(row[genderColumn]),
    event: text(row[eventColumn])
  })).filter((row) => row.name && row.schoolName && normalizeEvent(row.event) === normalizedTargetEvent);
}

function buildReport({ competitionId, event, roster, participants, virtualTeams }) {
  const candidatesByKey = new Map();
  participants.forEach((participant) => {
    const key = `${normalizeName(participant.name)}\u0000${normalizeGender(participant.gender)}`;
    const list = candidatesByKey.get(key) || [];
    list.push(participant);
    candidatesByKey.set(key, list);
  });

  const duplicateRows = new Map();
  roster.forEach((row) => {
    const key = `${normalizeName(row.name)}\u0000${normalizeGender(row.gender)}`;
    const list = duplicateRows.get(key) || [];
    list.push(row);
    duplicateRows.set(key, list);
  });

  const matched = [];
  const unmatched = [];
  const ambiguous = [];
  roster.forEach((row) => {
    const key = `${normalizeName(row.name)}\u0000${normalizeGender(row.gender)}`;
    const candidates = candidatesByKey.get(key) || [];
    if (candidates.length === 1) {
      const participant = candidates[0];
      matched.push({
        excelRow: row.excelRow,
        participantId: participant._id.toString(),
        name: participant.name,
        gender: participant.gender,
        groupTeam: participant.groupTeam || '',
        oldSchoolName: participant.schoolName || '',
        newSchoolName: row.schoolName,
        changed: text(participant.schoolName) !== row.schoolName
      });
    } else if (candidates.length === 0) {
      unmatched.push({ excelRow: row.excelRow, name: row.name, gender: row.gender, schoolName: row.schoolName });
    } else {
      // 集体项目历史报名有重名。优先以原“代表单位 + 队伍编号”与 Excel 的完整队名匹配；
      // 只有最高分仍并列时才拒绝写入，不会凭数组顺序猜测。
      const targetUnit = normalizeUnit(row.schoolName);
      const scoredCandidates = candidates.map((candidate) => {
        const schoolName = normalizeUnit(candidate.schoolName);
        const groupTeam = normalizeUnit(candidate.groupTeam);
        let score = 0;
        if (groupTeam && targetUnit === groupTeam) score = 4;
        else if (groupTeam && targetUnit === `${schoolName}${groupTeam}`) score = 3;
        else if (targetUnit === schoolName) score = 2;
        else if (groupTeam && targetUnit.includes(schoolName) && targetUnit.endsWith(groupTeam)) score = 1;
        return { candidate, score };
      });
      const highestScore = Math.max(...scoredCandidates.map((item) => item.score));
      const bestCandidates = scoredCandidates.filter((item) => item.score === highestScore);
      if (highestScore > 0 && bestCandidates.length === 1) {
        const participant = bestCandidates[0].candidate;
        matched.push({
          excelRow: row.excelRow,
          participantId: participant._id.toString(),
          name: participant.name,
          gender: participant.gender,
          groupTeam: participant.groupTeam || '',
          oldSchoolName: participant.schoolName || '',
          newSchoolName: row.schoolName,
          changed: text(participant.schoolName) !== row.schoolName,
          resolvedBy: '单位与队伍编号'
        });
      } else {
        ambiguous.push({ excelRow: row.excelRow, name: row.name, gender: row.gender, schoolName: row.schoolName, candidates: scoredCandidates.map(({ candidate, score }) => ({ id: candidate._id.toString(), schoolName: candidate.schoolName || '', groupTeam: candidate.groupTeam || '', score })) });
      }
    }
  });

  const duplicateExcelRows = [...duplicateRows.values()].filter((rows) => rows.length > 1).map((rows) => ({
    name: rows[0].name,
    gender: rows[0].gender,
    rows: rows.map((row) => ({ excelRow: row.excelRow, schoolName: row.schoolName }))
  }));
  const matchedByParticipant = new Map();
  matched.forEach((item) => {
    const rows = matchedByParticipant.get(item.participantId) || [];
    rows.push(item);
    matchedByParticipant.set(item.participantId, rows);
  });
  const reusedParticipantMatches = [...matchedByParticipant.values()].filter((rows) => rows.length > 1).map((rows) => ({
    participantId: rows[0].participantId,
    name: rows[0].name,
    rows: rows.map((row) => ({ excelRow: row.excelRow, schoolName: row.newSchoolName }))
  }));
  const newUnitById = new Map(matched.map((item) => [item.participantId, item.newSchoolName]));
  const virtualTeamConflicts = [];
  const virtualTeamUpdates = [];
  const virtualKeys = new Map();
  virtualTeams.forEach((team) => {
    const memberUnits = [...new Set((team.teamMembers || []).map((member) => newUnitById.get(member.toString())).filter(Boolean))];
    if (!memberUnits.length) return;
    if (memberUnits.length !== 1) {
      virtualTeamConflicts.push({ teamId: team._id.toString(), teamName: team.teamName || team.name, reason: '同一现有虚拟队伍的成员在 Excel 中对应多个单位', units: memberUnits });
      return;
    }
    const newSchoolName = memberUnits[0];
    const key = [normalizeEvent(team.event), text(team.ageGroup || team.grade), normalizeGender(team.gender), newSchoolName, text(team.groupTeam)].join('\u0000');
    const relatedTeams = virtualKeys.get(key) || [];
    relatedTeams.push(team);
    virtualKeys.set(key, relatedTeams);
    virtualTeamUpdates.push({ teamId: team._id.toString(), oldSchoolName: team.schoolName || '', newSchoolName, groupTeam: team.groupTeam || '' });
  });
  virtualKeys.forEach((teams, key) => {
    if (teams.length > 1) virtualTeamConflicts.push({ reason: '单位更新后会产生重复虚拟队伍', key, teamIds: teams.map((team) => team._id.toString()) });
  });

  return {
    generatedAt: new Date().toISOString(),
    scope: { competitionId, event, realParticipantCount: participants.length, excelRosterCount: roster.length, virtualTeamCount: virtualTeams.length },
    summary: {
      matched: matched.length,
      changed: matched.filter((item) => item.changed).length,
      unchanged: matched.filter((item) => !item.changed).length,
      unmatched: unmatched.length,
      ambiguous: ambiguous.length,
      duplicateExcelRows: duplicateExcelRows.length,
      reusedParticipantMatches: reusedParticipantMatches.length,
      virtualTeamConflicts: virtualTeamConflicts.length,
      canApply: unmatched.length === 0 && ambiguous.length === 0 && reusedParticipantMatches.length === 0 && virtualTeamConflicts.length === 0
    },
    matched, unmatched, ambiguous, duplicateExcelRows, reusedParticipantMatches, virtualTeamUpdates, virtualTeamConflicts
  };
}

async function main() {
  const args = parseArgs();
  const competitionId = requiredArg(args, 'competition');
  const event = requiredArg(args, 'event');
  const file = path.resolve(requiredArg(args, 'file'));
  if (!fs.existsSync(file)) throw new Error(`找不到 Excel 文件：${file}`);
  if (!mongoose.isValidObjectId(competitionId)) throw new Error('比赛 ID 格式不正确');

  const roster = readRoster(file, event);
  if (!roster.length) throw new Error(`Excel 中没有项目“${event}”的有效队员行`);
  await mongoose.connect(process.env.MONGO_URI);
  const allRealParticipants = await Participant.find({ competition: competitionId, isVirtualTeam: { $ne: true } }).select('_id name schoolName groupTeam gender event ageGroup grade').lean();
  const participants = allRealParticipants.filter((participant) => normalizeEvent(participant.event) === normalizeEvent(event));
  const targetEventValues = [...new Set(allRealParticipants
    .map((participant) => participant.event)
    .filter((value) => normalizeEvent(value) === normalizeEvent(event)))];
  const virtualTeams = await Participant.find({ competition: competitionId, isVirtualTeam: true, event: { $in: targetEventValues } }).select('_id name teamName schoolName groupTeam gender event ageGroup grade teamMembers').lean();
  const report = buildReport({ competitionId, event, roster, participants, virtualTeams });
  const output = reportPath(args);
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ report: output, summary: report.summary }, null, 2));

  if (!args.apply) {
    console.log('预览完成。未修改数据库；确认 summary.canApply 为 true 后，添加 --apply --sync-virtual-teams 执行。');
    return;
  }
  if (!args['sync-virtual-teams']) throw new Error('执行更新必须同时提供 --sync-virtual-teams，避免真实队员单位与赛程中的虚拟队伍信息不一致');
  if (!report.summary.canApply) throw new Error('预览存在未匹配、歧义、重复 Excel 行或虚拟队伍冲突，已拒绝写入数据库；请先处理报告中的问题');

  // 生产 MongoDB 以单节点容器运行，不假定它已启用副本集事务。所有歧义已在写入前阻断，
  // 此处使用有序批量更新；执行前的 mongodump 可用于完整回滚。
  const now = new Date();
  const realUpdates = report.matched.filter((item) => item.changed).map((item) => ({
    updateOne: {
      filter: { _id: item.participantId, competition: competitionId, isVirtualTeam: { $ne: true } },
      update: { $set: { schoolName: item.newSchoolName, updatedAt: now } }
    }
  }));
  const virtualUpdates = report.virtualTeamUpdates.filter((item) => item.oldSchoolName !== item.newSchoolName).map((item) => ({
    updateOne: {
      filter: { _id: item.teamId, competition: competitionId, isVirtualTeam: true },
      update: { $set: { schoolName: item.newSchoolName, teamName: item.groupTeam ? `${item.newSchoolName}${item.groupTeam}` : item.newSchoolName, updatedAt: now } }
    }
  }));
  if (realUpdates.length) await Participant.bulkWrite(realUpdates, { ordered: true });
  if (virtualUpdates.length) await Participant.bulkWrite(virtualUpdates, { ordered: true });
  console.log(`已更新 ${realUpdates.length} 名集体项目队员的代表单位，并同步 ${virtualUpdates.length} 支虚拟队伍。个人项目和队伍编号均未修改。`);
}

main().catch((error) => {
  console.error(`执行失败：${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});
