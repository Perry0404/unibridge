import { Token, SwapOffer } from '../unicity/types';
import { sha256, randomNonce, randomId } from '../utils/crypto';
import { htlcPred, sigPred, sigWitness, htlcClaimWitness, htlcRefundWitness } from '../unicity/predicates';
import { transition } from '../unicity/engine';
import { UniquenessOracle } from '../unicity/oracle';

/**
 * Trustless Atomic Swap using HTLC predicates over the Unicity oracle.
 *
 * Protocol (from the paper):
 *   1. Alice locks tokenA with HTLC(hash(s), T, Bob_pred, Alice_pred)
 *      → commits to oracle, shares commitment ID
 *   2. Bob locks tokenB with HTLC(hash(s), T/2, Alice_pred, Bob_pred)
 *      using Alice's commitment as proof she's committed
 *   3. Alice reveals s, transitions tokenB to herself
 *   4. Bob uses revealed s to transition tokenA to himself
 *
 * Both sides complete or both can refund – no trust required.
 */

export const SWAP_TIMEOUT_BLOCKS = 200; // tau units until refund available

// ─── Step 1: Alice initiates swap ─────────────────────────────────────────────

export interface InitiateSwapParams {
  myToken: Token;
  myPubkey: string;
  counterpartyPubkey: string;
  wantSymbol: string;
  wantAmount: number;
  tau: number;
  oracle: UniquenessOracle;
}

export interface InitiateSwapResult {
  lockedToken: Token;
  offer: SwapOffer;
}

export function initiateSwap({
  myToken,
  myPubkey,
  counterpartyPubkey,
  wantSymbol,
  wantAmount,
  tau,
  oracle,
}: InitiateSwapParams): InitiateSwapResult {
  const secret = randomNonce();                       // Alice's secret s
  const secretHash = sha256(secret);                  // hash(s), published

  const timeout = tau + SWAP_TIMEOUT_BLOCKS;
  const claimPred  = sigPred(counterpartyPubkey);     // Bob can claim after revealing s
  const refundPred = sigPred(myPubkey);               // Alice can refund after timeout

  const lockPred = htlcPred(secretHash, timeout, claimPred, refundPred);
  const witness  = sigWitness(myPubkey);

  const { token: lockedToken, stateTransition } = transition(
    myToken, witness, lockPred, tau, oracle
  );

  const offer: SwapOffer = {
    id: `swap_${randomId()}`,
    initiatorPubkey: myPubkey,
    offerTokenId: myToken.id,
    offerSymbol: myToken.symbol,
    offerAmount: myToken.amount,
    wantSymbol,
    wantAmount,
    secret,
    secretHash,
    timeout,
    commitmentId: oracle.getByKey(myToken.id, myToken.nonce)?.id ?? stateTransition.oracleProof,
    status: 'open',
    createdAt: Date.now(),
  };

  return { lockedToken, offer };
}

// ─── Step 2: Bob accepts swap ─────────────────────────────────────────────────

export interface AcceptSwapParams {
  offer: SwapOffer;
  bobToken: Token;
  bobPubkey: string;
  tau: number;
  oracle: UniquenessOracle;
}

export interface AcceptSwapResult {
  bobLockedToken: Token;
}

export function acceptSwap({
  offer,
  bobToken,
  bobPubkey,
  tau,
  oracle,
}: AcceptSwapParams): AcceptSwapResult {
  const bobTimeout   = tau + Math.floor(SWAP_TIMEOUT_BLOCKS / 2); // shorter than Alice's
  const claimPred    = sigPred(offer.initiatorPubkey);             // Alice can claim
  const refundPred   = sigPred(bobPubkey);                         // Bob can refund
  const lockPred     = htlcPred(offer.secretHash, bobTimeout, claimPred, refundPred);
  const witness      = sigWitness(bobPubkey);

  const { token: bobLockedToken } = transition(
    bobToken, witness, lockPred, tau, oracle
  );

  return { bobLockedToken };
}

// ─── Step 3: Alice claims Bob's token ─────────────────────────────────────────

export interface ClaimSwapParams {
  offer: SwapOffer;
  bobLockedToken: Token;
  claimerPubkey: string;    // Alice's pubkey
  tau: number;
  oracle: UniquenessOracle;
}

export function claimSwap({
  offer,
  bobLockedToken,
  claimerPubkey,
  tau,
  oracle,
}: ClaimSwapParams): Token {
  const innerWitness = sigWitness(claimerPubkey);
  const witness = htlcClaimWitness(offer.secret, innerWitness);
  const newPred = sigPred(claimerPubkey);

  const { token } = transition(bobLockedToken, witness, newPred, tau, oracle);
  return token;
}

// ─── Step 4: Bob claims Alice's token (after seeing secret on chain) ──────────

export function completeSwap(
  aliceLockedToken: Token,
  secret: string,
  bobPubkey: string,
  tau: number,
  oracle: UniquenessOracle
): Token {
  const innerWitness = sigWitness(bobPubkey);
  const witness = htlcClaimWitness(secret, innerWitness);
  const newPred = sigPred(bobPubkey);

  const { token } = transition(aliceLockedToken, witness, newPred, tau, oracle);
  return token;
}

// ─── Refund (after timeout) ───────────────────────────────────────────────────

export function refundSwap(
  lockedToken: Token,
  ownerPubkey: string,
  tau: number,
  oracle: UniquenessOracle
): Token {
  const witness = htlcRefundWitness(sigWitness(ownerPubkey));
  const newPred = sigPred(ownerPubkey);

  const { token } = transition(lockedToken, witness, newPred, tau, oracle);
  return token;
}
