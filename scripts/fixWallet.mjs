import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const w = (f, s) => { writeFileSync(join(root, f), s, 'utf8'); console.log('wrote', f); };

// ── hooks/useSphereWallet.ts ──────────────────────────────────────────────────
w('hooks/useSphereWallet.ts', `'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

export function useSphereWallet(): UseSphereWalletReturn {
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
`);

// ── components/WalletCard.tsx ─────────────────────────────────────────────────
w('components/WalletCard.tsx', `'use client';

import { useSphereWallet } from '@/hooks/useSphereWallet';
import { Wallet, ExternalLink, Loader2, Lock, RefreshCw } from 'lucide-react';

export default function WalletCard() {
  const {
    isConnected, isConnecting, isLocked,
    identity, nativeBalance, tokenBalances,
    connect, disconnect, refreshBalances,
  } = useSphereWallet();

  // ── Not connected ──────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
        <Wallet className="w-8 h-8 text-orange-500 opacity-60" />
        <p className="text-sm text-zinc-400">Connect your Sphere wallet to see balances and transact.</p>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
          {isConnecting ? 'Connecting...' : 'Connect Sphere Wallet'}
        </button>
        <a href="https://sphere.unicity.network" target="_blank" rel="noopener noreferrer"
          className="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1">
          <ExternalLink className="w-3 h-3" /> Open Sphere Wallet
        </a>
      </div>
    );
  }

  // ── Connected (possibly locked) ────────────────────────────────────────
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="w-4 h-4 text-orange-500" />
          Sphere Wallet
        </div>
        <div className="flex items-center gap-2">
          {isLocked
            ? <span className="flex items-center gap-1 text-xs text-amber-400"><Lock className="w-3 h-3" /> Locked</span>
            : <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          }
          <button onClick={refreshBalances} title="Refresh balances" className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Identity */}
      {identity && (
        <div>
          {identity.nametag && (
            <p className="text-sm font-semibold text-orange-400">@{identity.nametag}</p>
          )}
          <p className="text-xs font-mono text-zinc-500 break-all mt-0.5">
            {identity.chainPubkey.slice(0, 20)}...{identity.chainPubkey.slice(-6)}
          </p>
          {identity.l1Address && (
            <p className="text-xs font-mono text-zinc-600 mt-0.5 truncate">
              L1: {identity.l1Address.slice(0, 18)}...
            </p>
          )}
        </div>
      )}

      {/* Locked banner */}
      {isLocked && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <p className="text-xs text-amber-400 mb-2">
            Your wallet is locked. Reconnect to approve transactions and view balances.
          </p>
          <button
            onClick={connect}
            disabled={isConnecting}
            className="flex items-center gap-2 text-xs bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
            {isConnecting ? 'Reconnecting...' : 'Unlock / Reconnect'}
          </button>
        </div>
      )}

      {/* UCT balance */}
      {nativeBalance && !isLocked && (
        <div className="bg-zinc-900 rounded-xl p-3">
          <p className="text-xs text-zinc-500 mb-1">UCT Balance</p>
          <p className="text-2xl font-bold font-mono text-orange-400">{nativeBalance.available}</p>
          {nativeBalance.pending && nativeBalance.pending !== '0' && (
            <p className="text-xs text-zinc-600 font-mono mt-0.5">+{nativeBalance.pending} pending</p>
          )}
        </div>
      )}

      {/* Token balances */}
      {tokenBalances.length > 0 && !isLocked && (
        <div className="space-y-1.5 border-t border-zinc-800 pt-3">
          {tokenBalances.map(t => (
            <div key={t.coinId} className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">{t.symbol || t.coinId}</span>
              <span className="font-mono text-sm font-medium">{t.balance}</span>
            </div>
          ))}
        </div>
      )}

      {!nativeBalance && !isLocked && (
        <p className="text-xs text-zinc-600 text-center py-2">Loading balance...</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <a href="https://sphere.unicity.network" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-400 transition-colors">
          <ExternalLink className="w-3 h-3" /> Open Wallet
        </a>
        <button onClick={disconnect} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
          Disconnect
        </button>
      </div>
    </div>
  );
}
`);

console.log('Done!');
