const { getScheduleGender } = require('./scheduleNaming');

// Preview and generation must resolve the same project, age group and gender.
function getParticipantScheduleGroup(participant, competition) {
  const originalEvent = participant.event || '未知项目';
  const sourceEvent = originalEvent.replace('集体混合', '集体项目');
  const eventConfig = competition.events?.find(event => event.name === originalEvent)
    || competition.events?.find(event => event.name === sourceEvent);
  const event = String(participant.manualEventGroup || '').trim() || sourceEvent;
  const age = participant.ageGroup || participant.grade || '未知组别';
  const isGroup = Boolean(eventConfig?.isGroupEvent || sourceEvent.includes('集体') || age.includes('集体'));
  const restrictedGender = ['male', 'female'].includes(eventConfig?.genderRestriction);
  const forceMixed = !restrictedGender && ((eventConfig?.isGroupEvent && eventConfig.genderRestriction === 'both')
    || sourceEvent.includes('集体') || sourceEvent.includes('武术操'));
  let ageGroup = age;
  if (isGroup && eventConfig && Array.isArray(eventConfig.ageGroups) && eventConfig.ageGroups.length === 0) {
    // An unrestricted collective event groups teams, never their members' ages.
    ageGroup = forceMixed ? '混合集体' : '集体';
  } else if (forceMixed) {
    let stripped = age.replace(/男(子|童)?|女(子|童)?/g, '').trim();
    if (sourceEvent.includes('武术操') || sourceEvent.includes('集体拳')) {
      stripped = stripped.replace(/U\d+组?\s*/g, '').trim();
    }
    ageGroup = stripped.includes('混合') ? stripped : ['混合集体', stripped].filter(Boolean).join(' ');
  }
  const gender = forceMixed || ageGroup.includes('混合') || sourceEvent.includes('混合')
    ? 'mixed' : getScheduleGender({ eventName: sourceEvent, eventConfig, participantGender: participant.gender });
  return { key: [event, ageGroup, gender].join('|'), event, sourceEvent, ageGroup, gender, isGroup };
}

function mergeUndersizedAgeGroups(groups, competition) {
  const minimum = competition?.awardRules?.mergeGroupsBelow || 0;
  // Award settings from older documents may contain the former default of 3.
  if (!competition?.awardRules?.enabled || minimum < 2) return groups;
  const order = (competition?.ageGroups || []).map(group => group.name);
  const buckets = {};
  Object.values(groups).forEach(group => {
    const eventConfig = (competition?.events || []).find(event => event.name === (group.sourceEvent || group.event));
    if (group.isGroup || !String(eventConfig?.category || '').includes('个人')) return;
    const key = [group.event, group.gender || 'mixed'].join('|');
    (buckets[key] ||= []).push(group);
  });
  Object.values(buckets).forEach(list => {
    list.sort((a, b) => {
      const ai = order.indexOf(a.ageGroup); const bi = order.indexOf(b.ageGroup);
      return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
    });
    const merged = []; let pending = null;
    list.forEach(group => {
      if (!pending) { pending = { ...group, participants: [...group.participants], mergedAgeGroups: [group.ageGroup] }; return; }
      if (pending.participants.length < minimum) { pending.participants.push(...group.participants); pending.mergedAgeGroups.push(group.ageGroup); }
      else { merged.push(pending); pending = { ...group, participants: [...group.participants], mergedAgeGroups: [group.ageGroup] }; }
    });
    if (pending) {
      if (pending.participants.length < minimum && merged.length > 0) { const previous = merged[merged.length - 1]; previous.participants.push(...pending.participants); previous.mergedAgeGroups.push(...pending.mergedAgeGroups); }
      else merged.push(pending);
    }
    list.forEach(group => Object.keys(groups).forEach(key => { if (groups[key] === group) delete groups[key]; }));
    merged.forEach((group, index) => {
      if (group.mergedAgeGroups.length > 1) group.ageGroup = group.mergedAgeGroups.join('/');
      group.key = ['merged', group.event, group.gender, index, group.ageGroup].join('|');
      groups[group.key] = group;
    });
  });
  return groups;
}

module.exports = { getParticipantScheduleGroup, mergeUndersizedAgeGroups };
