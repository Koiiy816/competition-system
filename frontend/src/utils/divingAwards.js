const defaultParticipant = (entry) => entry?.participant;
const defaultScore = (entry) => Number(entry?.finalScore ?? entry?.score ?? 0) || 0;
const defaultAbsent = (entry) => Boolean(entry?.details?.isAbsent);
const defaultTest = (entry) => Boolean(entry?.participant?.isTest);

const unitKey = (participant, index) => {
  const unit = String(participant?.schoolName || participant?.teamName || participant?.user?.schoolName || '').trim();
  return unit || `__unaffiliated_${index}`;
};

const awardLimitFor = (participant) => (participant?.isVirtualTeam || participant?.teamMembers?.length === 2 ? 2 : 3);

export const isDivingResult = (result) => !/素质力量|素質力量/.test(String(result?.schedule?.name || ''))
  && result?.details?.scoringType !== 'strength'
  && (result?.schedule?.scoringMode === 'diving' || Array.isArray(result?.details?.dives));

export const rankDivingAwardEntries = (entries, {
  getParticipant = defaultParticipant,
  getScore = defaultScore,
  isAbsent = defaultAbsent,
  isTest = defaultTest
} = {}) => {
  const sorted = [...entries].sort((left, right) => Number(isAbsent(left)) - Number(isAbsent(right)) || getScore(right) - getScore(left));
  const winners = [];
  const remaining = [];
  const awardedByUnit = new Map();

  sorted.forEach((entry, index) => {
    const participant = getParticipant(entry);
    const key = unitKey(participant, index);
    const awardedCount = awardedByUnit.get(key) || 0;
    if (!isAbsent(entry) && !isTest(entry) && winners.length < 8 && awardedCount < awardLimitFor(participant)) {
      winners.push(entry);
      awardedByUnit.set(key, awardedCount + 1);
    } else {
      remaining.push(entry);
    }
  });

  return [...winners, ...remaining].map((entry, index) => {
    const isAwarded = index < winners.length;
    return {
      entry,
      rank: isAbsent(entry) ? '-' : (isAwarded ? index + 1 : 9 + index - winners.length),
      isAwarded
    };
  });
};
