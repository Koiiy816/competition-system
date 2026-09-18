const defaultParticipant = (entry) => entry?.participant;
const defaultScore = (entry) => Number(entry?.finalScore ?? entry?.score ?? 0) || 0;
const defaultAbsent = (entry) => Boolean(entry?.details?.isAbsent);
const defaultEvents = (entry) => entry?.details?.events;
const pointsOf = (entry, getEvents) => (Array.isArray(getEvents(entry)) ? getEvents(entry) : [])
  .slice()
  .sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0))
  .map((event) => Number(event?.points) || 0);
const stableKey = (entry, participant) => String(entry?._id || entry?.id || participant?._id || participant?.id || participant?.name || '');

export const isStrengthResult = (result) => /素质力量|素質力量/.test(String(result?.schedule?.name || ''))
  || result?.details?.scoringType === 'strength'
  || Array.isArray(result?.details?.events);

// 素质力量总分相同，按小项录入顺序逐项比较积分；仍完全相同则稳定排序，确保不并列。
export const compareStrengthEntries = (left, right, {
  getParticipant = defaultParticipant,
  getScore = defaultScore,
  isAbsent = defaultAbsent,
  getEvents = defaultEvents
} = {}) => {
  if (isAbsent(left) !== isAbsent(right)) return Number(isAbsent(left)) - Number(isAbsent(right));
  const totalDifference = getScore(right) - getScore(left);
  if (totalDifference) return totalDifference;
  const leftPoints = pointsOf(left, getEvents);
  const rightPoints = pointsOf(right, getEvents);
  for (let index = 0; index < Math.max(leftPoints.length, rightPoints.length); index += 1) {
    const difference = (rightPoints[index] || 0) - (leftPoints[index] || 0);
    if (difference) return difference;
  }
  return stableKey(left, getParticipant(left)).localeCompare(stableKey(right, getParticipant(right)), 'zh-Hans-CN');
};

export const rankStrengthEntries = (entries, options = {}) => {
  const { isAbsent = defaultAbsent } = options;
  return [...entries].sort((left, right) => compareStrengthEntries(left, right, options))
    .map((entry, index) => ({ entry, rank: isAbsent(entry) ? '-' : index + 1 }));
};
