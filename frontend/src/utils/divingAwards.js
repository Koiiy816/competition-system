const defaultParticipant = (entry) => entry?.participant;
const defaultScore = (entry) => Number(entry?.finalScore ?? entry?.score ?? 0) || 0;
const defaultAbsent = (entry) => Boolean(entry?.details?.isAbsent);
const defaultTest = (entry) => Boolean(entry?.participant?.isTest);
const scoreOf = (value) => {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
};
const actionScores = (entry) => (Array.isArray(entry?.details?.dives) ? entry.details.dives : [])
  .map((dive) => scoreOf(dive?.score));
const stableEntryKey = (entry, participant) => String(
  entry?._id || entry?.id || participant?._id || participant?.id || participant?.name || ''
);

const unitKey = (participant, index) => {
  const unit = String(participant?.schoolName || participant?.teamName || participant?.user?.schoolName || '').trim();
  return unit || `__unaffiliated_${index}`;
};

const awardLimitFor = (participant) => (participant?.isVirtualTeam || participant?.teamMembers?.length === 2 ? 2 : 3);

export const isDivingResult = (result) => !/素质力量|素質力量/.test(String(result?.schedule?.name || ''))
  && result?.details?.scoringType !== 'strength'
  && (result?.schedule?.scoringMode === 'diving' || Array.isArray(result?.details?.dives));

// 跳水总分相同，按动作表从第一跳起逐项比较；当前动作得分高者优先。
// 所有动作得分仍完全相同才使用固定标识，确保录取名次唯一且可复现。
export const compareDivingEntries = (left, right, {
  getParticipant = defaultParticipant,
  getScore = defaultScore,
  isAbsent = defaultAbsent
} = {}) => {
  if (isAbsent(left) !== isAbsent(right)) return Number(isAbsent(left)) - Number(isAbsent(right));
  const totalDifference = getScore(right) - getScore(left);
  if (totalDifference) return totalDifference;

  const compareActions = (leftValues, rightValues) => {
    const length = Math.max(leftValues.length, rightValues.length);
    for (let index = 0; index < length; index += 1) {
      const difference = (rightValues[index] ?? 0) - (leftValues[index] ?? 0);
      if (difference) return difference;
    }
    return 0;
  };
  const actionDifference = compareActions(actionScores(left), actionScores(right));
  if (actionDifference) return actionDifference;

  const leftParticipant = getParticipant(left);
  const rightParticipant = getParticipant(right);
  return stableEntryKey(left, leftParticipant).localeCompare(stableEntryKey(right, rightParticipant), 'zh-Hans-CN');
};

export const rankDivingAwardEntries = (entries, {
  getParticipant = defaultParticipant,
  getScore = defaultScore,
  isAbsent = defaultAbsent,
  isTest = defaultTest
} = {}) => {
  const statusOf = (entry) => (isTest(entry) ? 1 : (isAbsent(entry) ? 2 : 0));
  const sorted = [...entries].sort((left, right) => (
    statusOf(left) - statusOf(right)
    || compareDivingEntries(left, right, { getParticipant, getScore, isAbsent })
  ));
  const winners = [];
  const remaining = [];
  const awardedByUnit = new Map();

  sorted.forEach((entry, index) => {
    const participant = getParticipant(entry);
    const key = unitKey(participant, index);
    const awardedCount = awardedByUnit.get(key) || 0;
    if (statusOf(entry) === 0 && winners.length < 8 && awardedCount < awardLimitFor(participant)) {
      winners.push(entry);
      awardedByUnit.set(key, awardedCount + 1);
    } else {
      remaining.push(entry);
    }
  });

  // 未录取组合紧随最后一个录取名次编号，避免在单位限额导致录取人数不足八人时跳过名次。
  return [...winners, ...remaining].map((entry, index) => {
    const eligible = statusOf(entry) === 0;
    const isAwarded = index < winners.length;
    return {
      entry,
      rank: eligible ? index + 1 : '-',
      isAwarded
    };
  });
};
