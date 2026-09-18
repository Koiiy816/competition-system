const strengthSchedulePattern = /素质力量|素質力量/;

const isStrengthSchedule = (schedule, participant) => strengthSchedulePattern.test(String(schedule?.name || ''))
  || strengthSchedulePattern.test(String(participant?.event || ''));

const normalizeStrengthEvents = (events) => (Array.isArray(events) ? events : []).map((event, index) => {
  const actionName = String(event?.actionName || event?.name || event?.actionCode || '')
    .trim()
    .replace(/提膝跳\s*10\s*次/g, '提膝跳')
    .replace(/引体控\s*40\s*秒/g, '引体控');
  const rawScore = Number(event?.rawScore);
  if (!actionName || !Number.isFinite(rawScore) || rawScore < 0) return null;
  return {
    actionCode: String(event?.actionCode || '').trim(),
    actionName,
    rawScore: Math.round(rawScore * 100) / 100,
    order: Number.isFinite(Number(event?.order)) ? Number(event.order) : index + 1,
    // 计时项目越小越好；立定跳远、提膝跳（完成次数）及引体控（坚持时间）越大越好。
    direction: /立定跳远|立定跳遠|提膝跳|引体控|引體控/.test(actionName) ? 'desc' : 'asc'
  };
}).filter(Boolean);

// A strength score can be entered one action at a time.  Keep previously
// recorded actions when the client submits only the actions completed so far.
const mergeStrengthEvents = (currentEvents, incomingEvents) => {
  const merged = new Map();
  (Array.isArray(currentEvents) ? currentEvents : []).forEach((event) => {
    if (event?.actionName) merged.set(event.actionName, event);
  });
  (Array.isArray(incomingEvents) ? incomingEvents : []).forEach((event) => {
    if (event?.actionName) merged.set(event.actionName, event);
  });
  return [...merged.values()].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
};

const pointsForRank = (rank) => rank === 1 ? 20 : Math.max(0, 20 - rank);

module.exports = { isStrengthSchedule, normalizeStrengthEvents, mergeStrengthEvents, pointsForRank };
