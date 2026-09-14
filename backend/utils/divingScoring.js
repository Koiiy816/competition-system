function calculateDivingDiveScore(scores, difficulty) {
  if (!Array.isArray(scores) || scores.length !== 5 || !scores.every(Number.isFinite)) return 0;
  const factor = Number(difficulty);
  if (!Number.isFinite(factor) || factor < 0) return 0;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round((total - Math.max(...scores) - Math.min(...scores)) * factor * 100) / 100;
}

module.exports = { calculateDivingDiveScore };
