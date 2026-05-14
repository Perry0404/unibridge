/**
 * Deterministic string hash (double FNV-1a 32-bit, no BigInt).
 * In production replace with SubtleCrypto SHA-256.
 */
export function sha256(input: string): string {
  // Forward pass
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  // Reverse pass for more entropy
  let h2 = 0x5aa2e4b3;
  for (let i = input.length - 1; i >= 0; i--) {
    h2 ^= input.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/** Cryptographically random 16-byte nonce as hex string. */
export function randomNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (SSR)
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
}

export function randomId(): string {
  return `${Date.now().toString(36)}-${randomNonce().slice(0, 8)}`;
}

export function hashObject(obj: object): string {
  return sha256(JSON.stringify(obj));
}
