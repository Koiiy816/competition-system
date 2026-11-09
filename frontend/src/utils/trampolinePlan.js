import { findTrampolineDifficulties } from '../data/trampolineDifficultyTable.js';

export const isLargeTrampolineEvent = (participant) => /大网/.test(String(participant?.event || ''))
  && !/小网|蹦床操/.test(String(participant?.event || ''));

export const buildTrampolinePlan = (plan) => ({
  routines: [0, 1].map(index => {
    // 旧版单表顺序带入两套；超出20个的旧动作仍保留，供用户核对后删除。
    const existing = plan?.routines?.[index]?.actions
      || (index === 0 ? plan?.actions?.slice(0, 10) : plan?.actions?.slice(10)) || [];
    const actions = existing.map(action => ({ actionCode: action?.actionCode || '', posture: action?.posture || '', difficulty: action?.difficulty ?? '' }));
    while (actions.length < 10) actions.push({ actionCode: '', posture: '', difficulty: '' });
    return { name: `蹦床${index + 1}`, actions };
  })
});

export const getTrampolineActionDifficulty = (action) => String(action?.actionCode || '').trim() && action?.posture
  ? findTrampolineDifficulties(action.actionCode, action.posture)[0]?.difficulty : undefined;
export const trampolineRoutineDifficulty = (routine) => Math.round((routine?.actions || []).reduce((sum, action) => {
  const value = getTrampolineActionDifficulty(action) ?? Number(action?.difficulty);
  return Number.isFinite(value) && value >= 0 ? sum + value : sum;
}, 0) * 100) / 100;

export const getTrampolineRoutineD = (routine) => routine?.actions?.length === 10
  && routine.actions.every(action => action.actionCode && ['o', '<', '/'].includes(action.posture)
    && action.difficulty !== '' && action.difficulty != null && Number.isFinite(Number(action.difficulty)) && Number(action.difficulty) >= 0)
  ? Number(routine.totalDifficulty) : null;
