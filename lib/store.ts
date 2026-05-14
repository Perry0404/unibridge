import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import {
  Token, AMMPool, LPPosition, LendingPosition,
  YieldPosition, SwapOffer, TxRecord, OracleCommitment,
} from './unicity/types';
import { UniquenessOracle } from './unicity/oracle';
import { sigPred, sigWitness } from './unicity/predicates';
import { mint, transition } from './unicity/engine';
import { randomId } from './utils/crypto';

// DeFi functions
import {
  createPool, addLiquidity, removeLiquidity, executeAmmSwap, getSpotPrice,
} from './defi/amm';
import {
  initiateSwap, acceptSwap, claimSwap, completeSwap, refundSwap,
} from './defi/swap';
import {
  openLendingPosition, repayLoan, isLiquidatable, accrueInterest, collateralRatio,
} from './defi/lending';
import {
  stakeLP, claimRewards, unstakeLP, pendingRewards,
} from './defi/yield';

// ─── Wallet identity ──────────────────────────────────────────────────────────

export const MY_PUBKEY  = 'alice_pub_key_0x1a2b3c';
export const BOB_PUBKEY = 'bob_pub_key_0x4d5e6f';

// ─── State shape ──────────────────────────────────────────────────────────────

export interface WalletState {
  // Identity
  pubkey: string;
  address: string;

  // Oracle (serialised)
  oracleSnapshot: Record<string, OracleCommitment>;

  // Tokens owned by the user
  tokens: Record<string, Token>;

  // System time (advances per action to simulate blocks)
  tau: number;

  // DeFi
  pools: Record<string, AMMPool>;
  lpPositions: Record<string, LPPosition>;
  lendingPositions: Record<string, LendingPosition>;
  yieldPositions: Record<string, YieldPosition>;
  swapOffers: Record<string, SwapOffer>;

  // Tx history
  txHistory: TxRecord[];

  // ── Actions ──────────────────────────────────────────────────────────────
  advanceTau: (delta?: number) => void;

  // Token ops
  mintTokens: (symbol: string, amount: number) => void;
  transferToken: (tokenId: string, toPubkey: string) => void;

  // Atomic swap
  createSwapOffer: (tokenId: string, wantSymbol: string, wantAmount: number) => SwapOffer;
  fulfillSwapOffer: (offerId: string, myTokenId: string) => void;
  refundSwapOffer: (offerId: string) => void;

  // AMM
  initPool: (symbolA: string, symbolB: string) => AMMPool;
  depositLiquidity: (poolId: string, amountA: number, amountB: number) => void;
  withdrawLiquidity: (lpPositionId: string, fraction: number) => void;
  swapInPool: (poolId: string, fromSymbol: string, amountIn: number) => void;

  // Lending
  openLoan: (collateralTokenId: string, debtSymbol: string, debtAmount: number) => void;
  repay: (positionId: string, amount: number) => void;

  // Yield
  stake: (lpPositionId: string) => void;
  unstake: (yieldPositionId: string) => void;
  claim: (yieldPositionId: string) => void;
}

// ─── Helper: get or create oracle from snapshot ───────────────────────────────

function getOracle(snap: Record<string, OracleCommitment>): UniquenessOracle {
  return UniquenessOracle.fromSnapshot(snap);
}

// ─── Helper: create tx record ─────────────────────────────────────────────────

function tx(
  type: TxRecord['type'],
  description: string,
  opts: Partial<Pick<TxRecord, 'amount' | 'symbol'>> = {}
): TxRecord {
  return {
    id: randomId(),
    type,
    description,
    timestamp: Date.now(),
    success: true,
    ...opts,
  };
}

// ─── Helper: sum token amounts by symbol ─────────────────────────────────────

export function balanceOf(tokens: Record<string, Token>, symbol: string): number {
  return Object.values(tokens)
    .filter(t => t.symbol === symbol && t.predicate.type !== 'always')
    .reduce((s, t) => s + t.amount, 0);
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      pubkey:  MY_PUBKEY,
      address: MY_PUBKEY.slice(-8),
      oracleSnapshot: {},
      tokens: {},
      tau: 100,
      pools: {},
      lpPositions: {},
      lendingPositions: {},
      yieldPositions: {},
      swapOffers: {},
      txHistory: [],

      // ── Time ───────────────────────────────────────────────────────────────

      advanceTau: (delta = 10) =>
        set(s => ({ tau: s.tau + delta })),

      // ── Minting ────────────────────────────────────────────────────────────

      mintTokens: (symbol, amount) => {
        const token = mint(symbol, amount, MY_PUBKEY);
        set(s => ({
          tokens: { ...s.tokens, [token.id]: token },
          txHistory: [tx('mint', `Minted ${amount} ${symbol}`, { amount, symbol }), ...s.txHistory],
        }));
      },

      // ── Transfer ───────────────────────────────────────────────────────────

      transferToken: (tokenId, toPubkey) => {
        const s = get();
        const token = s.tokens[tokenId];
        if (!token) throw new Error('Token not found');
        const oracle = getOracle(s.oracleSnapshot);
        const { token: newToken } = transition(
          token, sigWitness(MY_PUBKEY), sigPred(toPubkey), s.tau, oracle
        );
        const { [tokenId]: _removed, ...rest } = s.tokens;
        set({
          tokens: { ...rest, [newToken.id]: newToken },
          oracleSnapshot: oracle.snapshot(),
          txHistory: [
            tx('transfer', `Sent ${token.amount} ${token.symbol} to ${toPubkey.slice(-6)}`, {
              amount: token.amount, symbol: token.symbol,
            }),
            ...s.txHistory,
          ],
        });
      },

      // ── Atomic swap ────────────────────────────────────────────────────────

      createSwapOffer: (tokenId, wantSymbol, wantAmount) => {
        const s = get();
        const token = s.tokens[tokenId];
        if (!token) throw new Error('Token not found');
        const oracle = getOracle(s.oracleSnapshot);

        const { lockedToken, offer } = initiateSwap({
          myToken: token,
          myPubkey: MY_PUBKEY,
          counterpartyPubkey: BOB_PUBKEY,
          wantSymbol,
          wantAmount,
          tau: s.tau,
          oracle,
        });

        const { [tokenId]: _rm, ...rest } = s.tokens;
        set({
          tokens: { ...rest, [lockedToken.id]: lockedToken },
          swapOffers: { ...s.swapOffers, [offer.id]: offer },
          oracleSnapshot: oracle.snapshot(),
          tau: s.tau + 5,
          txHistory: [
            tx('swap_initiate',
              `Swap offer: ${token.amount} ${token.symbol} ↔ ${wantAmount} ${wantSymbol}`,
              { amount: token.amount, symbol: token.symbol }
            ),
            ...s.txHistory,
          ],
        });
        return offer;
      },

      fulfillSwapOffer: (offerId, myTokenId) => {
        const s = get();
        const offer  = s.swapOffers[offerId];
        const myTok  = s.tokens[myTokenId];
        if (!offer || offer.status !== 'open') throw new Error('Offer not available');
        if (!myTok) throw new Error('Token not found');

        const oracle = getOracle(s.oracleSnapshot);

        // Bob locks his token
        const { bobLockedToken } = acceptSwap({
          offer, bobToken: myTok, bobPubkey: MY_PUBKEY, tau: s.tau, oracle,
        });

        // Alice (user) immediately claims Bob's token
        const claimedToken = claimSwap({
          offer,
          bobLockedToken,
          claimerPubkey: MY_PUBKEY,
          tau: s.tau,
          oracle,
        });

        // Alice's locked token → Bob completes (simulated)
        const aliceLockedTok = Object.values(s.tokens).find(t => t.id !== myTokenId &&
          t.predicate.type === 'htlc') ?? s.tokens[offer.offerTokenId];

        const updatedOffer: SwapOffer = { ...offer, status: 'completed' };
        const { [myTokenId]: _rm, ...rest } = s.tokens;

        set({
          tokens: { ...rest, [claimedToken.id]: claimedToken },
          swapOffers: { ...s.swapOffers, [offerId]: updatedOffer },
          oracleSnapshot: oracle.snapshot(),
          tau: s.tau + 10,
          txHistory: [
            tx('swap_complete',
              `Swap complete: received ${claimedToken.amount} ${claimedToken.symbol}`,
              { amount: claimedToken.amount, symbol: claimedToken.symbol }
            ),
            ...s.txHistory,
          ],
        });
      },

      refundSwapOffer: (offerId) => {
        const s = get();
        const offer = s.swapOffers[offerId];
        if (!offer || offer.status !== 'open') throw new Error('Offer not refundable');
        if (s.tau < offer.timeout) throw new Error(`Timeout not reached (tau ${s.tau} < ${offer.timeout})`);

        const oracle = getOracle(s.oracleSnapshot);
        const lockedToken = Object.values(s.tokens).find(t =>
          t.predicate.type === 'htlc'
        );
        if (!lockedToken) throw new Error('Locked token not found');

        const refunded = refundSwap(lockedToken, MY_PUBKEY, s.tau, oracle);
        const { [lockedToken.id]: _rm, ...rest } = s.tokens;

        set({
          tokens: { ...rest, [refunded.id]: refunded },
          swapOffers: { ...s.swapOffers, [offerId]: { ...offer, status: 'refunded' } },
          oracleSnapshot: oracle.snapshot(),
          txHistory: [
            tx('swap_refund',
              `Refunded ${refunded.amount} ${refunded.symbol}`,
              { amount: refunded.amount, symbol: refunded.symbol }
            ),
            ...s.txHistory,
          ],
        });
      },

      // ── AMM ────────────────────────────────────────────────────────────────

      initPool: (symbolA, symbolB) => {
        const pool = createPool(symbolA, symbolB);
        set(s => ({ pools: { ...s.pools, [pool.id]: pool } }));
        return pool;
      },

      depositLiquidity: (poolId, amountA, amountB) => {
        const s = get();
        const pool = s.pools[poolId];
        if (!pool) throw new Error('Pool not found');

        const tokA = Object.values(s.tokens).find(t => t.symbol === pool.symbolA && t.predicate.type === 'sig');
        const tokB = Object.values(s.tokens).find(t => t.symbol === pool.symbolB && t.predicate.type === 'sig');
        if (!tokA || tokA.amount < amountA) throw new Error(`Insufficient ${pool.symbolA}`);
        if (!tokB || tokB.amount < amountB) throw new Error(`Insufficient ${pool.symbolB}`);

        // For partial deposits: split tokens if needed
        const oracle = getOracle(s.oracleSnapshot);

        const { pool: updPool, lpPosition, tokenA, tokenB, lpToken } = addLiquidity(
          pool, amountA, amountB, MY_PUBKEY,
          tokA.amount === amountA ? tokA : { ...tokA, amount: amountA },
          tokB.amount === amountB ? tokB : { ...tokB, amount: amountB },
          s.tau, oracle
        );

        // Deduct from balances
        const newTokA = { ...tokA, amount: tokA.amount - amountA };
        const newTokB = { ...tokB, amount: tokB.amount - amountB };

        set({
          pools: { ...s.pools, [poolId]: updPool },
          lpPositions: { ...s.lpPositions, [lpPosition.id]: lpPosition },
          tokens: {
            ...s.tokens,
            [tokA.id]: newTokA,
            [tokB.id]: newTokB,
            [lpToken.id]: lpToken,
          },
          oracleSnapshot: oracle.snapshot(),
          tau: s.tau + 5,
          txHistory: [
            tx('amm_add',
              `Added ${amountA} ${pool.symbolA} + ${amountB} ${pool.symbolB} → ${lpPosition.lpAmount.toFixed(4)} LP`,
            ),
            ...s.txHistory,
          ],
        });
      },

      withdrawLiquidity: (lpPositionId, fraction) => {
        const s = get();
        const lp = s.lpPositions[lpPositionId];
        if (!lp) throw new Error('LP position not found');
        const pool = s.pools[lp.poolId];
        if (!pool) throw new Error('Pool not found');

        const lpAmount = lp.lpAmount * fraction;
        const { pool: updPool, receivedA, receivedB } = removeLiquidity(pool, lpAmount);

        const updLp = { ...lp, lpAmount: lp.lpAmount - lpAmount };

        // Add tokens back to wallet
        const newTokA = mint(pool.symbolA, receivedA, MY_PUBKEY);
        const newTokB = mint(pool.symbolB, receivedB, MY_PUBKEY);

        set({
          pools: { ...s.pools, [lp.poolId]: updPool },
          lpPositions: fraction >= 1
            ? (() => { const { [lpPositionId]: _, ...rest } = s.lpPositions; return rest; })()
            : { ...s.lpPositions, [lpPositionId]: updLp },
          tokens: { ...s.tokens, [newTokA.id]: newTokA, [newTokB.id]: newTokB },
          tau: s.tau + 3,
          txHistory: [
            tx('amm_remove',
              `Removed ${fraction * 100}% LP → ${receivedA.toFixed(4)} ${pool.symbolA} + ${receivedB.toFixed(4)} ${pool.symbolB}`
            ),
            ...s.txHistory,
          ],
        });
      },

      swapInPool: (poolId, fromSymbol, amountIn) => {
        const s = get();
        const pool = s.pools[poolId];
        if (!pool) throw new Error('Pool not found');

        const fromTok = Object.values(s.tokens).find(
          t => t.symbol === fromSymbol && t.predicate.type === 'sig' && t.amount >= amountIn
        );
        if (!fromTok) throw new Error(`Insufficient ${fromSymbol}`);

        const { pool: updPool, amountOut, toSymbol, priceImpact } =
          executeAmmSwap(pool, fromSymbol, amountIn);

        // Deduct input, add output
        const newFromTok = { ...fromTok, amount: fromTok.amount - amountIn };
        const outTok     = mint(toSymbol, amountOut, MY_PUBKEY);

        set({
          pools: { ...s.pools, [poolId]: updPool },
          tokens: { ...s.tokens, [fromTok.id]: newFromTok, [outTok.id]: outTok },
          tau: s.tau + 2,
          txHistory: [
            tx('amm_swap',
              `Swapped ${amountIn} ${fromSymbol} → ${amountOut.toFixed(4)} ${toSymbol} (impact ${(priceImpact * 100).toFixed(2)}%)`,
              { amount: amountIn, symbol: fromSymbol }
            ),
            ...s.txHistory,
          ],
        });
      },

      // ── Lending ────────────────────────────────────────────────────────────

      openLoan: (collateralTokenId, debtSymbol, debtAmount) => {
        const s = get();
        const collateralToken = s.tokens[collateralTokenId];
        if (!collateralToken) throw new Error('Collateral token not found');

        const position = openLendingPosition(
          collateralToken.symbol,
          collateralToken.amount,
          debtSymbol,
          debtAmount
        );

        // Lock collateral token (set to never – locked in protocol)
        const lockedCollateral = { ...collateralToken, predicate: { type: 'never' as const, params: {} } };

        // Mint borrowed tokens to user
        const debtToken = mint(debtSymbol, debtAmount, MY_PUBKEY);

        set({
          lendingPositions: { ...s.lendingPositions, [position.id]: position },
          tokens: {
            ...s.tokens,
            [collateralTokenId]: lockedCollateral,
            [debtToken.id]: debtToken,
          },
          tau: s.tau + 5,
          txHistory: [
            tx('lend_open',
              `Borrowed ${debtAmount} ${debtSymbol} collateralised by ${collateralToken.amount} ${collateralToken.symbol}`,
              { amount: debtAmount, symbol: debtSymbol }
            ),
            ...s.txHistory,
          ],
        });
      },

      repay: (positionId, amount) => {
        const s = get();
        const position = s.lendingPositions[positionId];
        if (!position) throw new Error('Position not found');

        const repayToken = Object.values(s.tokens).find(
          t => t.symbol === position.debtSymbol && t.predicate.type === 'sig' && t.amount >= amount
        );
        if (!repayToken) throw new Error(`Insufficient ${position.debtSymbol} to repay`);

        const { position: updPos, collateralReleased, closed } =
          repayLoan(position, amount, Date.now());

        const newRepayTok = { ...repayToken, amount: repayToken.amount - amount };

        // Release collateral if any
        let newTokens = { ...s.tokens, [repayToken.id]: newRepayTok };
        if (collateralReleased > 0) {
          const releasedTok = mint(position.collateralSymbol, collateralReleased, MY_PUBKEY);
          newTokens[releasedTok.id] = releasedTok;
        }

        set({
          lendingPositions: closed
            ? (() => { const { [positionId]: _, ...rest } = s.lendingPositions; return rest; })()
            : { ...s.lendingPositions, [positionId]: updPos },
          tokens: newTokens,
          tau: s.tau + 3,
          txHistory: [
            tx('lend_repay',
              `Repaid ${amount} ${position.debtSymbol}, released ${collateralReleased.toFixed(4)} ${position.collateralSymbol}${closed ? ' (closed)' : ''}`,
              { amount, symbol: position.debtSymbol }
            ),
            ...s.txHistory,
          ],
        });
      },

      // ── Yield ──────────────────────────────────────────────────────────────

      stake: (lpPositionId) => {
        const s = get();
        const lp = s.lpPositions[lpPositionId];
        if (!lp) throw new Error('LP position not found');
        const pool = s.pools[lp.poolId];
        if (!pool) throw new Error('Pool not found');

        const yp = stakeLP(lp.poolId, lp.lpAmount, 'UNI');
        const { [lpPositionId]: _rm, ...restLp } = s.lpPositions;

        set({
          lpPositions: restLp,
          yieldPositions: { ...s.yieldPositions, [yp.id]: yp },
          tau: s.tau + 2,
          txHistory: [
            tx('yield_stake',
              `Staked ${lp.lpAmount.toFixed(4)} LP from pool ${pool.symbolA}/${pool.symbolB}`
            ),
            ...s.txHistory,
          ],
        });
      },

      unstake: (yieldPositionId) => {
        const s = get();
        const yp = s.yieldPositions[yieldPositionId];
        if (!yp) throw new Error('Yield position not found');

        const { lpReturned, rewardsClaimed } = unstakeLP(yp, Date.now());

        // Restore LP position
        const restoredLp: LPPosition = {
          id: `lp_${randomId()}`,
          poolId: yp.poolId,
          lpAmount: lpReturned,
          createdAt: Date.now(),
        };

        // Mint reward tokens
        const rewardTok = mint(yp.rewardSymbol, rewardsClaimed, MY_PUBKEY);

        const { [yieldPositionId]: _rm, ...restYield } = s.yieldPositions;

        set({
          yieldPositions: restYield,
          lpPositions: { ...s.lpPositions, [restoredLp.id]: restoredLp },
          tokens: { ...s.tokens, [rewardTok.id]: rewardTok },
          tau: s.tau + 2,
          txHistory: [
            tx('yield_unstake',
              `Unstaked ${lpReturned.toFixed(4)} LP, claimed ${rewardsClaimed.toFixed(6)} ${yp.rewardSymbol}`
            ),
            ...s.txHistory,
          ],
        });
      },

      claim: (yieldPositionId) => {
        const s = get();
        const yp = s.yieldPositions[yieldPositionId];
        if (!yp) throw new Error('Yield position not found');

        const { claimed, updatedPosition } = claimRewards(yp, Date.now());
        if (claimed < 0.000001) throw new Error('No rewards to claim yet');

        const rewardTok = mint(yp.rewardSymbol, claimed, MY_PUBKEY);

        set({
          yieldPositions: { ...s.yieldPositions, [yieldPositionId]: updatedPosition },
          tokens: { ...s.tokens, [rewardTok.id]: rewardTok },
          txHistory: [
            tx('yield_claim',
              `Claimed ${claimed.toFixed(6)} ${yp.rewardSymbol}`,
              { amount: claimed, symbol: yp.rewardSymbol }
            ),
            ...s.txHistory,
          ],
        });
      },
    }),
    {
      name: 'unicity-defi-wallet',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null, setItem: () => {}, removeItem: () => {},
        }
      ),
    }
  )
);
