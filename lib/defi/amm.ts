import { AMMPool, LPPosition, Token } from '../unicity/types';
import { sigPred, alwaysPred, sigWitness } from '../unicity/predicates';
import { transition, mint } from '../unicity/engine';
import { UniquenessOracle } from '../unicity/oracle';
import { randomId } from '../utils/crypto';

/**
 * AMM – Constant-product (x·y = k) automated market maker.
 *
 * Pool tokens are held as Unicity tokens with 'always' predicate (pool custody).
 * LP shares are minted as UNI-LP tokens owned by the liquidity provider.
 */

export function createPool(
  symbolA: string,
  symbolB: string,
  fee: number = 0.003
): AMMPool {
  return {
    id: `pool_${symbolA}_${symbolB}_${randomId()}`,
    symbolA,
    symbolB,
    reserveA: 0,
    reserveB: 0,
    lpSupply: 0,
    fee,
    createdAt: Date.now(),
  };
}

// ─── Add liquidity ────────────────────────────────────────────────────────────

export interface AddLiquidityResult {
  pool: AMMPool;
  lpPosition: LPPosition;
  lpMinted: number;
  actualA: number;
  actualB: number;
}

/**
 * Deposit tokenA and tokenB amounts into the pool.
 * Returns updated pool state and LP position.
 *
 * If pool is empty: set initial price.
 * Otherwise: enforce the current ratio (amountB is derived from amountA).
 */
export function addLiquidity(
  pool: AMMPool,
  amountA: number,
  amountB: number,
  ownerPubkey: string,
  tokenA: Token,
  tokenB: Token,
  tau: number,
  oracle: UniquenessOracle
): { pool: AMMPool; lpPosition: LPPosition; tokenA: Token; tokenB: Token; lpToken: Token } {
  if (amountA <= 0 || amountB <= 0) throw new Error('Amounts must be positive');
  if (tokenA.amount < amountA) throw new Error('Insufficient tokenA balance');
  if (tokenB.amount < amountB) throw new Error('Insufficient tokenB balance');

  let actualA = amountA;
  let actualB = amountB;
  let lpMinted: number;

  if (pool.lpSupply === 0) {
    // First deposit – set price, mint LP = sqrt(A * B)
    lpMinted = Math.sqrt(actualA * actualB);
  } else {
    // Enforce pool ratio: use amountA, compute required amountB
    const requiredB = (amountA * pool.reserveB) / pool.reserveA;
    if (requiredB > amountB) {
      // Re-compute amountA given amountB
      actualA = (amountB * pool.reserveA) / pool.reserveB;
      actualB = amountB;
    } else {
      actualB = requiredB;
    }
    lpMinted = Math.min(
      (actualA / pool.reserveA) * pool.lpSupply,
      (actualB / pool.reserveB) * pool.lpSupply
    );
  }

  // Transfer tokens into pool custody (alwaysPred = pool custody)
  const { token: newTokenA } = transition(tokenA, sigWitness(ownerPubkey), alwaysPred(), tau, oracle);
  const { token: newTokenB } = transition(tokenB, sigWitness(ownerPubkey), alwaysPred(), tau, oracle);

  // Mint LP token for provider
  const lpToken = mint(`UNI-LP-${pool.symbolA}-${pool.symbolB}`, lpMinted, ownerPubkey);

  const updatedPool: AMMPool = {
    ...pool,
    reserveA: pool.reserveA + actualA,
    reserveB: pool.reserveB + actualB,
    lpSupply: pool.lpSupply + lpMinted,
  };

  const lpPosition: LPPosition = {
    id: `lp_${randomId()}`,
    poolId: pool.id,
    lpAmount: lpMinted,
    createdAt: Date.now(),
  };

  return {
    pool: updatedPool,
    lpPosition,
    tokenA: newTokenA,
    tokenB: newTokenB,
    lpToken,
  };
}

// ─── Remove liquidity ─────────────────────────────────────────────────────────

export interface RemoveLiquidityResult {
  pool: AMMPool;
  receivedA: number;
  receivedB: number;
}

export function removeLiquidity(
  pool: AMMPool,
  lpAmount: number
): { pool: AMMPool; receivedA: number; receivedB: number } {
  if (pool.lpSupply === 0) throw new Error('Pool has no liquidity');
  if (lpAmount <= 0 || lpAmount > pool.lpSupply) throw new Error('Invalid LP amount');

  const share = lpAmount / pool.lpSupply;
  const receivedA = share * pool.reserveA;
  const receivedB = share * pool.reserveB;

  const updatedPool: AMMPool = {
    ...pool,
    reserveA: pool.reserveA - receivedA,
    reserveB: pool.reserveB - receivedB,
    lpSupply: pool.lpSupply - lpAmount,
  };

  return { pool: updatedPool, receivedA, receivedB };
}

// ─── Swap ─────────────────────────────────────────────────────────────────────

/**
 * Compute output amount for a constant-product swap.
 * dx = amountIn * (1 - fee)
 * dy = reserveOut * dx / (reserveIn + dx)
 */
export function computeSwapOutput(
  amountIn: number,
  reserveIn: number,
  reserveOut: number,
  fee: number
): { amountOut: number; priceImpact: number; newReserveIn: number; newReserveOut: number } {
  if (reserveIn <= 0 || reserveOut <= 0) throw new Error('Empty pool reserves');
  if (amountIn <= 0) throw new Error('amountIn must be positive');

  const amountInAfterFee = amountIn * (1 - fee);
  const amountOut = (reserveOut * amountInAfterFee) / (reserveIn + amountInAfterFee);
  const priceImpact = amountInAfterFee / (reserveIn + amountInAfterFee);

  return {
    amountOut,
    priceImpact,
    newReserveIn:  reserveIn  + amountIn,
    newReserveOut: reserveOut - amountOut,
  };
}

export function executeAmmSwap(
  pool: AMMPool,
  fromSymbol: string,
  amountIn: number
): { pool: AMMPool; amountOut: number; toSymbol: string; priceImpact: number } {
  const swappingAtoB = fromSymbol === pool.symbolA;
  if (!swappingAtoB && fromSymbol !== pool.symbolB) {
    throw new Error(`Token ${fromSymbol} not in pool ${pool.id}`);
  }

  const reserveIn  = swappingAtoB ? pool.reserveA : pool.reserveB;
  const reserveOut = swappingAtoB ? pool.reserveB : pool.reserveA;
  const { amountOut, priceImpact, newReserveIn, newReserveOut } =
    computeSwapOutput(amountIn, reserveIn, reserveOut, pool.fee);

  const updatedPool: AMMPool = {
    ...pool,
    reserveA: swappingAtoB ? newReserveIn  : newReserveOut,
    reserveB: swappingAtoB ? newReserveOut : newReserveIn,
  };

  return {
    pool: updatedPool,
    amountOut,
    toSymbol: swappingAtoB ? pool.symbolB : pool.symbolA,
    priceImpact,
  };
}

// ─── Price helpers ────────────────────────────────────────────────────────────

export function getSpotPrice(pool: AMMPool, fromSymbol: string): number {
  if (pool.reserveA === 0 || pool.reserveB === 0) return 0;
  return fromSymbol === pool.symbolA
    ? pool.reserveB / pool.reserveA
    : pool.reserveA / pool.reserveB;
}

export function getTVL(pool: AMMPool, priceA: number): number {
  return pool.reserveA * priceA * 2; // assumes priceB derived from pool
}
