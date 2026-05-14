'use client';

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import type { PublicIdentity } from '@unicitylabs/sphere-sdk/connect';

/** Minimal interface matching ConnectClient */
interface SphereClient {
  query<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  intent<T = unknown>(action: string, params: Record<string, unknown>): Promise<T>;
  disconnect(): Promise<void>;
  on(event: string, handler: (data: unknown) => void): () => void;
}

const SESSION_KEY = 'sphere-session-id';
const WALLET_URL  = 'https://sphere.unicity.network';

const DAPP = {
  name:        'UniBridge',
  description: 'Bridge tokens from Unicity to other networks',
  url:         'https://unibridge-nine.vercel.app',
} as const;

export interface SphereTokenBalance {
  coinId:   string;
  symbol:   string;
  name:     string;
  balance:  string;
  decimals: number;
}

export interface SphereNativeBalance {
  available: string;
  pending:   string;
}

export interface SphereHistoryItem {
  id:        string;
  type:      string;
  amount?:   string;
  symbol?:   string;
  recipient?: string;
  sender?:    string;
  timestamp:  number;
  status?:    string;
  txId?:      string;
  network?:   string;
}

export interface UseSphereWalletReturn {
  isConnected:   boolean;
  isConnecting:  boolean;
  isLocked:      boolean;
  identity:      PublicIdentity | null;
  tokenBalances: SphereTokenBalance[];
  nativeBalance: SphereNativeBalance | null;
  history:       SphereHistoryItem[];
  l1History:     SphereHistoryItem[];
  connect:       () => Promise<void>;
  disconnect:    () => Promise<void>;
  refreshBalances: () => Promise<void>;
  fetchHistory:  () => Promise<void>;
  sendBridge: (p: { coinId: string; amount: string; recipient: string }) => Promise<{ txId?: string }>;
  sendToken:  (p: { coinId: string; amount: number; recipient: string }) => Promise<{ txId?: string }>;
  error: string | null;
}

// ── Context ─────────────────────────────────────────────────────────────────
export const SphereWalletContext = createContext<UseSphereWalletReturn | null>(null);

export function useSphereWallet(): UseSphereWalletReturn {
  const ctx = useContext(SphereWalletContext);
  if (!ctx) throw new Error('useSphereWallet must be used inside <SphereWalletProvider>');
  return ctx;
}

// ── State hook (used by provider) ────────────────────────────────────────────
export function useSphereWalletState(): UseSphereWalletReturn {
  const [isConnected,   setIsConnected]   = useState(false);
  const [isConnecting,  setIsConnecting]  = useState(false);
  const [isLocked,      setIsLocked]      = useState(false);
  const [identity,      setIdentity]      = useState<PublicIdentity | null>(null);
  const [tokenBalances, setTokenBalances] = useState<SphereTokenBalance[]>([]);
  const [nativeBalance, setNativeBalance] = useState<SphereNativeBalance | null>(null);
  const [history,       setHistory]       = useState<SphereHistoryItem[]>([]);
  const [l1History,     setL1History]     = useState<SphereHistoryItem[]>([]);
  const [error,         setError]         = useState<string | null>(null);

  const clientRef     = useRef<SphereClient | null>(null);
  const disconnectRef = useRef<(() => Promise<void>) | null>(null);

  // ── Fetch balances ───────────────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      const [bal, toks] = await Promise.all([
        client.query<SphereNativeBalance>('sphere_getBalance'),
        client.query<SphereTokenBalance[]>('sphere_getTokens').catch(() => [] as SphereTokenBalance[]),
      ]);
      setNativeBalance(bal);
      setTokenBalances(Array.isArray(toks) ? toks : []);
      setIsLocked(false); // queries succeeded — wallet is unlocked
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? '';
      // If queries fail due to lock, mark as locked but keep identity
      if (msg.includes('4001') || msg.includes('NOT_CONNECTED') || msg.includes('SESSION_EXPIRED')) {
        setIsLocked(true);
      }
    }
  }, []);

  // ── Fetch history (sphere + l1) ──────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      const [h, l1h] = await Promise.all([
        client.query<SphereHistoryItem[]>('sphere_getHistory').catch(() => [] as SphereHistoryItem[]),
        client.query<SphereHistoryItem[]>('sphere_l1GetHistory').catch(() => [] as SphereHistoryItem[]),
      ]);
      setHistory(Array.isArray(h) ? h : []);
      setL1History(Array.isArray(l1h) ? l1h : []);
    } catch {
      // non-critical
    }
  }, []);

  // ── Attach wallet events ─────────────────────────────────────────────────
  const attachEvents = useCallback(
    (client: SphereClient) => {
      // Wallet locked — keep identity visible but mark as locked
      client.on('wallet:locked', () => {
        setIsLocked(true);
        // Do NOT setIsConnected(false) — keep identity so user sees their account
      });

      // Identity changed (e.g. user switched account)
      client.on('identity:changed', (data) => {
        setIdentity(data as PublicIdentity);
        fetchBalances();
      });

      // Balance updated
      client.on('balance:updated', () => fetchBalances());
    },
    [fetchBalances],
  );

  // ── Silent auto-reconnect on mount ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) ?? undefined : undefined;
      if (!saved) return; // no previous session — wait for user to click connect
      try {
        const { autoConnect } = await import('@unicitylabs/sphere-sdk/connect/browser');
        const result = await autoConnect({
          dapp:            { ...DAPP, url: window.location.origin },
          walletUrl:       WALLET_URL,
          silent:          true,
          resumeSessionId: saved,
        });
        if (cancelled) { await result.disconnect(); return; }
        clientRef.current     = result.client;
        disconnectRef.current = result.disconnect;
        if (result.connection.sessionId) {
          localStorage.setItem(SESSION_KEY, result.connection.sessionId);
        }
        if (result.connection.identity) setIdentity(result.connection.identity);
        setIsConnected(true);
        setIsLocked(false);
        attachEvents(result.client);
        await fetchBalances();
        await fetchHistory();
      } catch {
        // Silent fail — session expired or not approved yet
        localStorage.removeItem(SESSION_KEY);
      }
    })();
    return () => { cancelled = true; };
  }, [attachEvents, fetchBalances, fetchHistory]);

  // ── Connect (user-initiated) ─────────────────────────────────────────────
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      // Clear stale session — start fresh so wallet shows approval UI properly
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) ?? undefined : undefined;

      const { autoConnect } = await import('@unicitylabs/sphere-sdk/connect/browser');
      const result = await autoConnect({
        dapp:            { ...DAPP, url: window.location.origin },
        walletUrl:       WALLET_URL,
        silent:          false,
        resumeSessionId: saved,
      });
      clientRef.current     = result.client;
      disconnectRef.current = result.disconnect;
      if (result.connection.sessionId) {
        localStorage.setItem(SESSION_KEY, result.connection.sessionId);
      }
      if (result.connection.identity) setIdentity(result.connection.identity);

      // Try to fetch full identity via query as backup
      try {
        const id = await result.client.query<PublicIdentity>('sphere_getIdentity');
        if (id) setIdentity(id);
      } catch { /* use handshake identity */ }

      setIsConnected(true);
      setIsLocked(false);
      attachEvents(result.client);
      await fetchBalances();
      await fetchHistory();
    } catch (e) {
      setError((e as Error).message ?? 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, [attachEvents, fetchBalances, fetchHistory]);

  // ── Disconnect ───────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      if (disconnectRef.current) await disconnectRef.current();
      if (clientRef.current)     await clientRef.current.disconnect().catch(() => {});
    } catch { /* ignore */ }
    clientRef.current     = null;
    disconnectRef.current = null;
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
    setIsConnected(false);
    setIsLocked(false);
    setIdentity(null);
    setTokenBalances([]);
    setNativeBalance(null);
    setHistory([]);
    setL1History([]);
  }, []);

  // ── Bridge send (l1_send intent) ─────────────────────────────────────────
  const sendBridge = useCallback(
    async ({ coinId, amount, recipient }: { coinId: string; amount: string; recipient: string }) => {
      const client = clientRef.current;
      if (!client) throw new Error('Wallet not connected');
      const result = await client.intent<{ txId?: string }>('l1_send', { recipient, amount, coinId });
      await fetchBalances();
      await fetchHistory();
      return result ?? {};
    },
    [fetchBalances, fetchHistory],
  );

  // ── Send token (send intent) ─────────────────────────────────────────────
  const sendToken = useCallback(
    async ({ coinId, amount, recipient }: { coinId: string; amount: number; recipient: string }) => {
      const client = clientRef.current;
      if (!client) throw new Error('Wallet not connected');
      const result = await client.intent<{ txId?: string }>('send', { recipient, amount, coinId });
      await fetchBalances();
      return result ?? {};
    },
    [fetchBalances],
  );

  return {
    isConnected,
    isConnecting,
    isLocked,
    identity,
    tokenBalances,
    nativeBalance,
    history,
    l1History,
    connect,
    disconnect,
    refreshBalances: fetchBalances,
    fetchHistory,
    sendBridge,
    sendToken,
    error,
  };
}
