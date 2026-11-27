export const isWushuFloorAwardCompetition = (competition) => (
  Boolean(competition?.awardRules?.enabled)
  && competition?.awardRules?.mode === 'wushu_floor_percentage'
);

export const isCollectiveAwardSchedule = (scheduleName = '') => /集体/.test(String(scheduleName));

// 正雷杯：个人金/银/铜为 3:4:3，集体一/二等为 6:4。
// 采用四舍五入的累计边界，最后一档覆盖余下全部完赛对象，确保人人录取且同分同奖。
export const getWushuFloorAwardLevel = (rank, completedCount, scheduleName = '') => {
  const numericRank = Number(rank);
  if (!Number.isInteger(numericRank) || numericRank < 1 || numericRank > completedCount || completedCount <= 0) return null;
  if (isCollectiveAwardSchedule(scheduleName)) {
    const firstLimit = Math.round(completedCount * 0.6);
    if (numericRank <= firstLimit) return '一等奖';
    return '二等奖';
  }
  if (completedCount < 3) return numericRank === 1 ? '金奖' : (numericRank === 2 ? '银奖' : null);
  const goldLimit = Math.round(completedCount * 0.3);
  const silverLimit = Math.round(completedCount * 0.7);
  if (numericRank <= goldLimit) return '金奖';
  if (numericRank <= silverLimit) return '银奖';
  return '铜奖';
};

export const usesPrizeLevelAwards = (competition) => (
  isWushuFloorAwardCompetition(competition)
  || Boolean(competition?.awardRules?.enabled && competition?.awardRules?.mode === 'legacy_percentage')
);
