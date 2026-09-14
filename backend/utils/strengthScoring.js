const strengthSchedulePattern = /素质力量|素質力量/;

const isStrengthSchedule = (schedule, participant) => strengthSchedulePattern.test(String(schedule?.name || ''))
  || strengthSchedulePattern.test(String(participant?.event || ''));

const normalizeStrengthEvents = (events) => (Array.isArray(events) ? events : []).map((event, index) => {
  const actionName = String(event?.actionName || event?.name || event?.actionCode || '').trim();
  const rawScore = Number(event?.rawScore);
  if (!actionName || !Number.isFinite(rawScore) || rawScore < 0) return null;
  return {
    actionCode: String(event?.actionCode || '').trim(),
    actionName,
    rawScore: Math.round(rawScore * 100) / 100,
    order: Number.isFinite(Number(event?.order)) ? Number(event.order) : index + 1,
    // 计时项目越小越好；立定跳远、引体控（坚持时间）越大越好。
    direction: /立定跳远|立定跳遠|引体控|引體控/.test(actionName) ? 'desc' : 'asc'
  };
}).filter(Boolean);

const pointsForRank = (rank) => rank === 1 ? 20 : Math.max(0, 20 - rank);

module.exports = { isStrengthSchedule, normalizeStrengthEvents, pointsForRank };
