import { LendingPosition } from '../unicity/types';
import { randomId } from '../utils/crypto';

/**
 * Over-collateralised lending protocol.
 *
 * Collateral is locked in a Unicity predicate (htlc with liquidation condition).
 * Debt accrues interest continuously. Positions can be liquidated when
 * collateral ratio drops below the liquidation threshold.
 */

export const LIQUIDATION_THRESHOLD = 1.5;  // 150% collateralisation required
export const COLLATERAL_FACTOR     = 0.67; // max borrow = 67% of collateral value
export const BASE_INTEREST_RATE    = 0.08; // 8% annual

// Rough price oracle (in a real system this would come from an AMM or Chainlink)
export const TOKEN_PRICES: Record<string, number> = {
  USDT: 1,
  BTC:  65000,
  ETH:  3500,
  SOL:  160,
  UNI:  12,
};

export function getPrice(symbol: string): number {
  return TOKEN_PRICES[symbol] ?? 1;
}

// ─── Open position ────────────────────────────────────────────────────────────

export function openLendingPosition(
  collateralSymbol: string,
  collateralAmount: number,
  debtSymbol: string,
  debtAmount: number
): LendingPosition {
  const collateralValue = collateralAmount * getPrice(collateralSymbol);
  const debtValue       = debtAmount       * getPrice(debtSymbol);

  const ratio = collateralValue / debtValue;
  if (ratio < LIQUIDATION_THRESHOLD) {
    throw new Error(
      `UNDER_COLLATERALISED: ratio ${ratio.toFixed(2)} < ${LIQUIDATION_THRESHOLD}`
    );
  }
  if (debtValue > collateralValue * COLLATERAL_FACTOR) {
    throw new Error(
      `EXCEEDS_BORROW_LIMIT: max borrow is ${(collateralValue * COLLATERAL_FACTOR / getPrice(debtSymbol)).toFixed(2)} ${debtSymbol}`
    );
  }

  return {
    id: `loan_${randomId()}`,
    collateralSymbol,
    collateralAmount,
    debtSymbol,
    debtAmount,
    interestRate: BASE_INTEREST_RATE,
    openedAt: Date.now(),
    lastAccruedAt: Date.now(),
  };
}

// ─── Accrue interest ──────────────────────────────────────────────────────────

/**
 * Compound interest: debt *= (1 + r)^(dt_years)
 */
export function accrueInterest(position: LendingPosition, nowMs: number): LendingPosition {
  const dtYears = (nowMs - position.lastAccruedAt) / (1000 * 60 * 60 * 24 * 365);
  const factor  = Math.pow(1 + position.interestRate, dtYears);
  return {
    ...position,
    debtAmount:    position.debtAmount * factor,
    lastAccruedAt: nowMs,
  };
}

// ─── Collateral ratio ─────────────────────────────────────────────────────────

export function collateralRatio(position: LendingPosition): number {
  const cv = position.collateralAmount * getPrice(position.collateralSymbol);
  const dv = position.debtAmount       * getPrice(position.debtSymbol);
  return dv === 0 ? Infinity : cv / dv;
}

export function isLiquidatable(position: LendingPosition): boolean {
  return collateralRatio(position) < LIQUIDATION_THRESHOLD;
}

// ─── Repay ────────────────────────────────────────────────────────────────────

/**
 * Partially or fully repay debt.
 * Returns { updatedPosition, collateralReleased, closed }.
 */
export function repayLoan(
  position: LendingPosition,
  repayAmount: number,
  nowMs: number
): { position: LendingPosition; collateralReleased: number; closed: boolean } {
  const accrued = accrueInterest(position, nowMs);

  if (repayAmount > accrued.debtAmount) {
    throw new Error('Repay amount exceeds debt');
  }

  const repayFraction = repayAmount / accrued.debtAmount;
  const collateralReleased = accrued.collateralAmount * repayFraction;
  const newDebt        = accrued.debtAmount       - repayAmount;
  const newCollateral  = accrued.collateralAmount - collateralReleased;
  const closed         = newDebt < 0.0001;

  return {
    position: {
      ...accrued,
      debtAmount:       closed ? 0 : newDebt,
      collateralAmount: closed ? 0 : newCollateral,
    },
    collateralReleased,
    closed,
  };
}

// ─── Liquidation ──────────────────────────────────────────────────────────────

/**
 * Liquidator repays 50% of debt and receives collateral at a 5% bonus.
 */
export function liquidate(
  position: LendingPosition,
  nowMs: number
): { collateralSeized: number; debtRepaid: number } {
  if (!isLiquidatable(accrueInterest(position, nowMs))) {
    throw new Error('Position is not liquidatable');
  }
  const accrued     = accrueInterest(position, nowMs);
  const debtRepaid  = accrued.debtAmount * 0.5;
  const debtValueUsd = debtRepaid * getPrice(accrued.debtSymbol);
  const collateralSeized = (debtValueUsd / getPrice(accrued.collateralSymbol)) * 1.05;

  return { collateralSeized, debtRepaid };
}
