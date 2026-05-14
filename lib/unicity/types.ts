// ─── Core Unicity Predicate Types ─────────────────────────────────────────────
// Based on the "Unicity: Predicates and Atomic Swaps" paper.
//
// Key insight: tokens are self-authenticating cryptographic objects that move
// peer-to-peer. A Uniqueness Oracle prevents double-spend without global ledger.

export type PredicateType =
  | 'sig'       // sig(pubkey)    – passes if witness has valid sig for pubkey
  | 'timelock'  // timelock(t, P) – passes if tau >= t AND inner P passes
  | 'htlc'      // htlc(hash, timeout, claimP, refundP)
  | 'swap_lock' // swap_lock(commitRef, timeout, claimP, refundP)
  | 'multisig'  // multisig(threshold, preds[])
  | 'always'    // unconditionally true  (pool custody token)
  | 'never';    // unconditionally false (burned token)

export interface SigParams       { pubkey: string }
export interface TimelockParams  { t: number; pred: Predicate }
export interface HtlcParams      {
  hash: string;         // sha256(preimage)
  timeout: number;      // tau at which refund path opens
  claimPred: Predicate;
  refundPred: Predicate;
}
export interface SwapLockParams  {
  commitmentRef: string;   // oracle commitment ID of counterparty
  timeout: number;
  claimPred: Predicate;
  refundPred: Predicate;
}
export interface MultisigParams  { threshold: number; preds: Predicate[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PredicateParams = any;

export interface Predicate {
  type: PredicateType;
  params: PredicateParams;
}

// ─── Witness ──────────────────────────────────────────────────────────────────
export interface Witness {
  type: string;
  signature?: string;      // for sig
  preimage?: string;       // for htlc / swap_lock claim path
  witnesses?: Witness[];   // for multisig
  innerWitness?: Witness;  // for timelock / htlc inner pred
}

// ─── Token ────────────────────────────────────────────────────────────────────
export interface Token {
  id: string;            // globally unique, immutable
  symbol: string;        // e.g. 'UNI-USDT'
  amount: number;        // value (6 decimal precision stored as float)
  predicate: Predicate;  // current ownership condition
  nonce: string;         // changes on every state transition
  createdAt: number;
  history: StateTransition[];
}

// ─── Oracle ───────────────────────────────────────────────────────────────────
export interface OracleCommitment {
  id: string;
  tokenId: string;
  nonce: string;
  nextPredicateHash: string;
  timestamp: number;
  proof: string;
}

// ─── State transition ─────────────────────────────────────────────────────────
export interface StateTransition {
  tokenId: string;
  fromPredicate: Predicate;
  toPredicate: Predicate;
  witness: Witness;
  nonce: string;
  oracleProof: string;
  timestamp: number;
}

// ─── DeFi ─────────────────────────────────────────────────────────────────────
export interface AMMPool {
  id: string;
  symbolA: string;
  symbolB: string;
  reserveA: number;
  reserveB: number;
  lpSupply: number;
  fee: number;          // e.g. 0.003 = 0.3%
  createdAt: number;
}

export interface LPPosition {
  id: string;
  poolId: string;
  lpAmount: number;
  createdAt: number;
}

export interface LendingPosition {
  id: string;
  collateralSymbol: string;
  collateralAmount: number;
  debtSymbol: string;
  debtAmount: number;
  interestRate: number;    // annual rate, e.g. 0.08 = 8%
  openedAt: number;
  lastAccruedAt: number;
}

export interface YieldPosition {
  id: string;
  poolId: string;
  stakedLp: number;
  stakedAt: number;
  lastClaimedAt: number;
  rewardSymbol: string;
  rewardRatePerSecond: number;
}

export interface SwapOffer {
  id: string;
  initiatorPubkey: string;
  offerTokenId: string;
  offerSymbol: string;
  offerAmount: number;
  wantSymbol: string;
  wantAmount: number;
  secret: string;
  secretHash: string;
  timeout: number;
  commitmentId: string;
  status: 'open' | 'completed' | 'expired' | 'refunded';
  createdAt: number;
}

export type TxType =
  | 'mint' | 'transfer' | 'split' | 'merge'
  | 'swap_initiate' | 'swap_complete' | 'swap_refund'
  | 'amm_add' | 'amm_remove' | 'amm_swap'
  | 'lend_open' | 'lend_repay' | 'lend_liquidate'
  | 'yield_stake' | 'yield_unstake' | 'yield_claim';

export interface TxRecord {
  id: string;
  type: TxType;
  description: string;
  amount?: number;
  symbol?: string;
  timestamp: number;
  success: boolean;
  error?: string;
}
