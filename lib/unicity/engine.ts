import { Token, Predicate, Witness, StateTransition } from './types';
import { UniquenessOracle } from './oracle';
import { evaluate, sigPred } from './predicates';
import { hashObject, randomNonce, randomId } from '../utils/crypto';

// ─── Core state-transition ────────────────────────────────────────────────────

/**
 * Perform a Unicity state transition:
 * 1. Verify witness satisfies the current predicate.
 * 2. Submit commitment to the oracle (double-spend prevention).
 * 3. Return the updated token.
 *
 * Throws on invalid witness or double-spend.
 */
export function transition(
  token: Token,
  witness: Witness,
  nextPredicate: Predicate,
  tau: number,
  oracle: UniquenessOracle
): { token: Token; stateTransition: StateTransition } {

  if (!evaluate(token.predicate, witness, tau, oracle)) {
    throw new Error(
      `INVALID_WITNESS: does not satisfy '${token.predicate.type}' predicate on token ${token.id.slice(0, 12)}…`
    );
  }

  const nextHash = hashObject(nextPredicate);
  const commitment = oracle.commit(token.id, token.nonce, nextHash);

  const st: StateTransition = {
    tokenId: token.id,
    fromPredicate: token.predicate,
    toPredicate: nextPredicate,
    witness,
    nonce: token.nonce,
    oracleProof: commitment.proof,
    timestamp: Date.now(),
  };

  const updated: Token = {
    ...token,
    predicate: nextPredicate,
    nonce: randomNonce(),
    history: [...token.history, st],
  };

  return { token: updated, stateTransition: st };
}

// ─── Token minting ────────────────────────────────────────────────────────────

/**
 * Mint a new off-chain token backed by a locked on-chain asset.
 */
export function mint(
  symbol: string,
  amount: number,
  ownerPubkey: string
): Token {
  return {
    id: `tok_${symbol.toLowerCase()}_${randomId()}`,
    symbol,
    amount,
    predicate: sigPred(ownerPubkey),
    nonce: randomNonce(),
    createdAt: Date.now(),
    history: [],
  };
}

// ─── Split ────────────────────────────────────────────────────────────────────

/**
 * Split a token into two tokens with differing amounts.
 * Both outputs can have different predicates.
 */
export function split(
  token: Token,
  witness: Witness,
  amountA: number,
  predA: Predicate,
  predB: Predicate,
  tau: number,
  oracle: UniquenessOracle
): { tokenA: Token; tokenB: Token; stateTransition: StateTransition } {
  if (amountA <= 0 || amountA >= token.amount) {
    throw new Error('INVALID_SPLIT: amountA must be in (0, token.amount)');
  }

  if (!evaluate(token.predicate, witness, tau, oracle)) {
    throw new Error('INVALID_WITNESS on split');
  }

  const amountB = token.amount - amountA;
  const nextHash = hashObject({ split: [predA, predB] });
  const commitment = oracle.commit(token.id, token.nonce, nextHash);

  const st: StateTransition = {
    tokenId: token.id,
    fromPredicate: token.predicate,
    toPredicate: predA,
    witness,
    nonce: token.nonce,
    oracleProof: commitment.proof,
    timestamp: Date.now(),
  };

  const tokenA: Token = {
    id: `tok_${token.symbol.toLowerCase()}_${randomId()}`,
    symbol: token.symbol,
    amount: amountA,
    predicate: predA,
    nonce: randomNonce(),
    createdAt: Date.now(),
    history: [st],
  };

  const tokenB: Token = {
    id: `tok_${token.symbol.toLowerCase()}_${randomId()}`,
    symbol: token.symbol,
    amount: amountB,
    predicate: predB,
    nonce: randomNonce(),
    createdAt: Date.now(),
    history: [st],
  };

  return { tokenA, tokenB, stateTransition: st };
}

// ─── Merge ────────────────────────────────────────────────────────────────────

/**
 * Merge multiple tokens of the same symbol into one.
 */
export function merge(
  tokens: Token[],
  witnesses: Witness[],
  ownerPubkey: string,
  tau: number,
  oracle: UniquenessOracle
): Token {
  if (tokens.length < 2) throw new Error('Need at least 2 tokens to merge');
  const sym = tokens[0].symbol;
  for (const t of tokens) {
    if (t.symbol !== sym) throw new Error('Cannot merge different symbols');
  }
  for (let i = 0; i < tokens.length; i++) {
    if (!evaluate(tokens[i].predicate, witnesses[i], tau, oracle)) {
      throw new Error(`INVALID_WITNESS for token ${i}`);
    }
    // Each token transition is committed to oracle independently
    const nextHash = hashObject({ merge: ownerPubkey, i });
    oracle.commit(tokens[i].id, tokens[i].nonce, nextHash);
  }

  return {
    id: `tok_${sym.toLowerCase()}_${randomId()}`,
    symbol: sym,
    amount: tokens.reduce((s, t) => s + t.amount, 0),
    predicate: sigPred(ownerPubkey),
    nonce: randomNonce(),
    createdAt: Date.now(),
    history: [],
  };
}
