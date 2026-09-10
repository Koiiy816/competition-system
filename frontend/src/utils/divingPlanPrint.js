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

const getDivingPlan = (participant, schedule) => {
  const teamPlan = (participant?.teamMembers || [])
    .map((member) => member?.additionalInfo?.divingPlan)
    .find((plan) => Array.isArray(plan?.dives) && plan.dives.length);
  const plan = participant?.additionalInfo?.divingPlan || teamPlan || {};
  const dives = Array.isArray(plan.dives) && plan.dives.length ? plan.dives : (schedule?.divingProgram || []);
  return dives.map((dive) => ({
    actionCode: String(dive?.actionCode || '').trim() || '-',
    difficulty: dive?.difficulty ?? ''
  }));
};

export const isDivingStartOrderSchedule = (schedule) => schedule?.scoringMode === 'diving'
  || (schedule?.participants || []).some((participant) => {
    if (Array.isArray(participant?.additionalInfo?.divingPlan?.dives)) return true;
    return (participant?.teamMembers || []).some((member) => Array.isArray(member?.additionalInfo?.divingPlan?.dives));
  });

export const toDivingStartOrderRecord = (participant, schedule) => {
  const isTeam = participant?.isVirtualTeam || participant?.type === 'team';
  const teamMembers = participant?.teamMembers || [];
  const teamMemberNames = teamMembers.map((member) => member?.name || member?.user?.name).filter(Boolean);
  const name = isTeam && teamMemberNames.length
    ? teamMemberNames.join('／')
    : (participant?.name || participant?.user?.name || '-');
  const dives = getDivingPlan(participant, schedule);
  const totalDifficulty = dives.reduce((total, dive) => {
    const difficulty = Number(dive.difficulty);
    return Number.isFinite(difficulty) ? total + difficulty : total;
  }, 0);
  return {
    name,
    unit: participant?.schoolName || participant?.teamName || participant?.user?.schoolName || '-',
    dives,
    totalDifficulty: Number(totalDifficulty.toFixed(2))
  };
};
