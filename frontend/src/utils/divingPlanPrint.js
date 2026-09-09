const displayGender = (gender) => ({ male: '男', female: '女', 男: '男', 女: '女' }[gender] || gender || '');

export const isCompletedDivingPlan = (participant) => {
  const dives = participant?.additionalInfo?.divingPlan?.dives;
  return Array.isArray(dives) && dives.length > 0 && dives.every((dive) => String(dive?.actionCode || '').trim());
};

export const toDivingPlanPrintRecord = (participant) => {
  const plan = participant?.additionalInfo?.divingPlan || {};
  const pair = participant?.additionalInfo?.divingPair;
  const dives = Array.isArray(plan.dives) ? plan.dives : [];
  return {
    competitionName: participant?.competition?.name || '跳水比赛',
    unit: participant?.schoolName || participant?.unit || participant?.teamName || '-',
    name: pair?.partnerName ? `${participant.name}／${pair.partnerName}` : (participant?.name || '-'),
    gender: /男女混合/.test(String(participant?.event || '')) ? '男女混合' : displayGender(participant?.gender),
    group: participant?.ageGroup || participant?.grade || '-',
    event: participant?.event || '-',
    takeoffOrHeight: plan.takeoffOrHeight || '',
    dives: dives.map((dive) => {
      const actionCode = String(dive?.actionCode || '').trim();
      const posture = actionCode.match(/[A-E]$/i)?.[0]?.toUpperCase() || '';
      return { actionCode, posture, difficulty: dive?.difficulty ?? '' };
    })
  };
};
