export function calculateDivingDiveScore(scores, difficulty, deduction = 0) {
  if (!Array.isArray(scores) || scores.length !== 5 || !scores.every(Number.isFinite)) return 0;
  const factor = Number(difficulty);
  const penalty = Number(deduction);
  if (!Number.isFinite(factor) || factor < 0 || !Number.isFinite(penalty) || penalty < 0) return 0;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.max(0, Math.round(((total - Math.max(...scores) - Math.min(...scores)) * factor - penalty) * 100) / 100);
}
