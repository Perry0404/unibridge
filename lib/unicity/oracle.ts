import { OracleCommitment } from './types';
import { sha256, randomId } from '../utils/crypto';

/**
 * UniquenessOracle – the core anti-double-spend mechanism.
 *
 * Rule: for every (tokenId, nonce) pair, only the FIRST commitment is recorded.
 * Any subsequent attempt to commit the same pair is rejected as a double-spend.
 *
 * In production this is a distributed Unicity network service.
 * Here it is a serialisable class whose state lives in the Zustand store.
 */
export class UniquenessOracle {
  constructor(private records: Record<string, OracleCommitment> = {}) {}

  private key(tokenId: string, nonce: string): string {
    return `${tokenId}::${nonce}`;
  }

  /**
   * Submit a commitment for a token state transition.
   * Throws Error('DOUBLE_SPEND') if the (tokenId, nonce) pair is already taken.
   */
  commit(tokenId: string, nonce: string, nextPredicateHash: string): OracleCommitment {
    const k = this.key(tokenId, nonce);
    if (this.records[k]) {
      throw new Error(
        `DOUBLE_SPEND: token ${tokenId.slice(0, 12)}… nonce ${nonce.slice(0, 8)}… already committed`
      );
    }
    const proof = sha256(`${tokenId}:${nonce}:${nextPredicateHash}:seal`);
    const commitment: OracleCommitment = {
      id: `oracle_${randomId()}`,
      tokenId,
      nonce,
      nextPredicateHash,
      timestamp: Date.now(),
      proof,
    };
    this.records[k] = commitment;
    return commitment;
  }

  /** Retrieve a commitment by its oracle ID. */
  getById(commitmentId: string): OracleCommitment | null {
    return (
      Object.values(this.records).find(c => c.id === commitmentId) ?? null
    );
  }

  /** Retrieve a commitment by tokenId + nonce. */
  getByKey(tokenId: string, nonce: string): OracleCommitment | null {
    return this.records[this.key(tokenId, nonce)] ?? null;
  }

  /** Number of accepted commitments. */
  get size(): number { return Object.keys(this.records).length; }

  /** Plain-object snapshot for Zustand persistence. */
  snapshot(): Record<string, OracleCommitment> {
    return { ...this.records };
  }

  /** Restore from snapshot. */
  static fromSnapshot(snap: Record<string, OracleCommitment>): UniquenessOracle {
    return new UniquenessOracle({ ...snap });
  }
}
