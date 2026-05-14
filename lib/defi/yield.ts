import { YieldPosition } from '../unicity/types';
import { randomId } from '../utils/crypto';

/**
 * LP staking / yield farming.
 *
 * Providers stake their LP tokens to earn UNI rewards.
 * Rewards accrue per-second proportional to staked LP share.
 *
 * APY = rewardRatePerSecond * secondsPerYear / lpPrice   (simplified)
 */

export const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
export const DEFAULT_REWARD_RATE = 0.0000001; // UNI per LP per second ≈ ~315% APY at 1:1

// ─── Stake ────────────────────────────────────────────────────────────────────

export function stakeLP(
  poolId: string,
  stakedLp: number,
  rewardSymbol = 'UNI',
  rewardRate = DEFAULT_REWARD_RATE
): YieldPosition {
  if (stakedLp <= 0) throw new Error('Must stake a positive LP amount');
  const now = Date.now();
  return {
    id: `yield_${randomId()}`,
    poolId,
    stakedLp,
    stakedAt: now,
    lastClaimedAt: now,
    rewardSymbol,
    rewardRatePerSecond: rewardRate,
  };
}

// ─── Pending rewards ─────────────────────────────────────────────────────────

export function pendingRewards(position: YieldPosition, nowMs: number): number {
  const dtSeconds = (nowMs - position.lastClaimedAt) / 1000;
  return position.stakedLp * position.rewardRatePerSecond * dtSeconds;
}

export function totalRewardsSinceStake(position: YieldPosition, nowMs: number): number {
  const dtSeconds = (nowMs - position.stakedAt) / 1000;
  return position.stakedLp * position.rewardRatePerSecond * dtSeconds;
}

// ─── Claim rewards ────────────────────────────────────────────────────────────

export function claimRewards(
  position: YieldPosition,
  nowMs: number
): { claimed: number; updatedPosition: YieldPosition } {
  const claimed = pendingRewards(position, nowMs);
  return {
    claimed,
    updatedPosition: { ...position, lastClaimedAt: nowMs },
  };
}

// ─── Unstake ──────────────────────────────────────────────────────────────────

export function unstakeLP(
  position: YieldPosition,
  nowMs: number
): { lpReturned: number; rewardsClaimed: number } {
  const rewardsClaimed = pendingRewards(position, nowMs);
  return { lpReturned: position.stakedLp, rewardsClaimed };
}

// ─── APY calculation ──────────────────────────────────────────────────────────

/** Approximate APY given reward rate and prices (both in same unit). */
export function computeAPY(
  rewardRatePerSecond: number,
  lpPrice: number,
  rewardPrice: number
): number {
  const rewardPerLpPerYear = rewardRatePerSecond * SECONDS_PER_YEAR * rewardPrice;
  return rewardPerLpPerYear / lpPrice;
}
