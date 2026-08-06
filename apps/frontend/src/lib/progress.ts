export function getPercentage(realized: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((realized / target) * 100), 100);
}

export function getRemaining(realized: number, target: number): number {
  return Math.max(target - realized, 0);
}
