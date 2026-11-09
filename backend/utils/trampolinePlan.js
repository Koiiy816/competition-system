const isLargeTrampolineEvent = (participant) => /大网/.test(String(participant?.event || ''))
  && !/小网|蹦床操/.test(String(participant?.event || ''));

const normalizeTrampolinePlan = (plan) => {
  if (!Array.isArray(plan?.routines) || plan.routines.length !== 2) throw new Error('请填写蹦床1、蹦床2两套动作表');
  const routines = plan.routines.map((routine, routineIndex) => {
    const name = `蹦床${routineIndex + 1}`;
    if (!Array.isArray(routine?.actions) || routine.actions.length !== 10) throw new Error(`${name}必须填写10个动作`);
    const actions = routine.actions.map((action, index) => {
      const actionCode = String(action?.actionCode || '').normalize('NFKC').trim();
      const posture = String(action?.posture || '').trim();
      const hasDifficulty = action?.difficulty !== '' && action?.difficulty != null;
      const difficulty = hasDifficulty ? Number(action.difficulty) : undefined;
      if (!/^\d+$/.test(actionCode)) throw new Error(`${name}第${index + 1}个动作代码只能填写数字部分`);
      if (!['o', '<', '/'].includes(posture)) throw new Error(`${name}第${index + 1}个动作请选择有效姿势`);
      if (hasDifficulty && (!Number.isFinite(difficulty) || difficulty < 0 || difficulty > 10)) throw new Error(`${name}第${index + 1}个动作难度系数无效`);
      return { actionCode, posture, ...(hasDifficulty ? { difficulty } : {}) };
    });
    return { name, actions, totalDifficulty: Math.round(actions.reduce((sum, action) => sum + (action.difficulty || 0), 0) * 100) / 100,
      difficultyComplete: actions.every(action => action.difficulty !== undefined) };
  });
  return { routines, totalDifficulty: Math.round(routines.reduce((sum, routine) => sum + routine.totalDifficulty, 0) * 100) / 100 };
};

module.exports = { isLargeTrampolineEvent, normalizeTrampolinePlan };
