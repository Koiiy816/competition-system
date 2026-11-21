export const isWushuFloorAwardCompetition = (competition) => (
  Boolean(competition?.awardRules?.enabled)
  && competition?.awardRules?.mode === 'wushu_floor_percentage'
);

export const isCollectiveAwardSchedule = (scheduleName = '') => /集体/.test(String(scheduleName));

// 正雷杯：个人金/银/铜为 3:4:3，集体一/二等为 6:4；全部向下取整。
// 个人不足三人按名次只设金奖、银奖，避免百分比向下取整后没有奖项。
export const getWushuFloorAwardLevel = (rank, completedCount, scheduleName = '') => {
  const numericRank = Number(rank);
  if (!Number.isInteger(numericRank) || numericRank < 1 || completedCount <= 0) return null;
  if (isCollectiveAwardSchedule(scheduleName)) {
    const firstLimit = Math.floor(completedCount * 0.6);
    const secondLimit = firstLimit + Math.floor(completedCount * 0.4);
    if (numericRank <= firstLimit) return '一等奖';
    if (numericRank <= secondLimit) return '二等奖';
    return null;
  }
  if (completedCount < 3) return numericRank === 1 ? '金奖' : (numericRank === 2 ? '银奖' : null);
  const goldLimit = Math.floor(completedCount * 0.3);
  const silverLimit = goldLimit + Math.floor(completedCount * 0.4);
  const bronzeLimit = silverLimit + Math.floor(completedCount * 0.3);
  if (numericRank <= goldLimit) return '金奖';
  if (numericRank <= silverLimit) return '银奖';
  if (numericRank <= bronzeLimit) return '铜奖';
  return null;
};

export const usesPrizeLevelAwards = (competition) => (
  isWushuFloorAwardCompetition(competition)
  || Boolean(competition?.awardRules?.enabled && competition?.awardRules?.mode === 'legacy_percentage')
);
