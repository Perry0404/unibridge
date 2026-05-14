import { Predicate, Witness, HtlcParams, TimelockParams, MultisigParams, SwapLockParams } from './types';
import { sha256 } from '../utils/crypto';
import { UniquenessOracle } from './oracle';

// ─── Predicate evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate a predicate against a witness at system time `tau`.
 * `oracle` is needed for swap_lock verification.
 */
export function evaluate(
  predicate: Predicate,
  witness: Witness,
  tau: number,
  oracle: UniquenessOracle
): boolean {
  switch (predicate.type) {
    case 'always': return true;
    case 'never':  return false;

    case 'sig': {
      const { pubkey } = predicate.params as { pubkey: string };
      // Production: verify EdDSA/ECDSA over token commitment bytes.
      // Here: witness.signature === sha256(pubkey + ':signed')
      return witness.signature === sha256(pubkey + ':signed');
    }

    case 'timelock': {
      const { t, pred } = predicate.params as TimelockParams;
      if (tau < t) return false;
      return evaluate(pred, witness.innerWitness ?? witness, tau, oracle);
    }

    case 'htlc': {
      const { hash, timeout, claimPred, refundPred } = predicate.params as HtlcParams;
      if (witness.preimage !== undefined) {
        // Claim path: hash(preimage) must match
        if (sha256(witness.preimage) !== hash) return false;
        return evaluate(claimPred, witness.innerWitness ?? witness, tau, oracle);
      } else if (tau >= timeout) {
        // Refund path: timeout elapsed
        return evaluate(refundPred, witness.innerWitness ?? witness, tau, oracle);
      }
      return false;
    }

    case 'swap_lock': {
      const { commitmentRef, timeout, claimPred, refundPred } = predicate.params as SwapLockParams;
      if (witness.preimage !== undefined) {
        // Verify the counterparty committed with hash of this preimage
        const commitment = oracle.getById(commitmentRef);
        if (!commitment) return false;
        const preimageHash = sha256(witness.preimage);
        // The counterparty's nextPredicateHash encodes the secret hash
        if (!commitment.nextPredicateHash.startsWith(preimageHash.slice(0, 8))) return false;
        return evaluate(claimPred, witness.innerWitness ?? witness, tau, oracle);
      } else if (tau >= timeout) {
        return evaluate(refundPred, witness.innerWitness ?? witness, tau, oracle);
      }
      return false;
    }

    case 'multisig': {
      const { threshold, preds } = predicate.params as MultisigParams;
      const ws = witness.witnesses ?? [];
      let satisfied = 0;
      for (let i = 0; i < preds.length; i++) {
        if (ws[i] && evaluate(preds[i], ws[i], tau, oracle)) satisfied++;
      }
      return satisfied >= threshold;
    }

    default:
      return false;
  }
}

// ─── Predicate factories ─────────────────────────────────────────────────────

export const sigPred        = (pubkey: string): Predicate =>
  ({ type: 'sig', params: { pubkey } });

export const timelockPred   = (t: number, pred: Predicate): Predicate =>
  ({ type: 'timelock', params: { t, pred } });

export const htlcPred       = (hash: string, timeout: number, claimPred: Predicate, refundPred: Predicate): Predicate =>
  ({ type: 'htlc', params: { hash, timeout, claimPred, refundPred } });

export const swapLockPred   = (commitmentRef: string, timeout: number, claimPred: Predicate, refundPred: Predicate): Predicate =>
  ({ type: 'swap_lock', params: { commitmentRef, timeout, claimPred, refundPred } });

export const multisigPred   = (threshold: number, preds: Predicate[]): Predicate =>
  ({ type: 'multisig', params: { threshold, preds } });

export const alwaysPred     = (): Predicate => ({ type: 'always', params: {} });
export const neverPred      = (): Predicate => ({ type: 'never',  params: {} });

// ─── Witness factories ───────────────────────────────────────────────────────

export const sigWitness = (pubkey: string): Witness =>
  ({ type: 'sig', signature: sha256(pubkey + ':signed') });

export const htlcClaimWitness = (preimage: string, innerWitness: Witness): Witness =>
  ({ type: 'htlc_claim', preimage, innerWitness });

export const htlcRefundWitness = (innerWitness: Witness): Witness =>
  ({ type: 'htlc_refund', innerWitness });
