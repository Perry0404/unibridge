'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PublicIdentity } from '@unicitylabs/sphere-sdk/connect';

/** Minimal interface matching ConnectClient — avoids duplicate-declaration type conflicts */
interface SphereClient {
  query<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  intent<T = unknown>(action: string, params: Record<string, unknown>): Promise<T>;
  disconnect(): Promise<void>;
  on(event: string, handler: (data: unknown) => void): () => void;
}

const SESSION_KEY = 'sphere-connect-session';
const WALLET_URL = 'https://sphere.unicity.network';

const DAPP = {
  name: 'UniBridge',
  description: 'Bridge tokens from Unicity testnet to other networks',
  url: 'https://unibridge-nine.vercel.app',
} as const;

export interface SphereTokenBalance {
  coinId: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
}

export interface SphereNativeBalance {
  available: string;
  pending: string;
}

export interface UseSphereWalletReturn {
  isConnected: boolean;
  isConnecting: boolean;
  isLocked: boolean;
  identity: PublicIdentity | null;
  tokenBalances: SphereTokenBalance[];
  nativeBalance: SphereNativeBalance | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendBridge: (params: {
    coinId: string;
    amount: string;
    recipient: string;
  }) => Promise<{ txId?: string }>;
  sendToken: (params: {
    coinId: string;
    amount: number;
    recipient: string;
  }) => Promise<{ txId?: string }>;
  error: string | null;
}

export function useSphereWallet(): UseSphereWalletReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [identity, setIdentity] = useState<PublicIdentity | null>(null);
  const [tokenBalances, setTokenBalances] = useState<SphereTokenBalance[]>([]);
  const [nativeBalance, setNativeBalance] = useState<SphereNativeBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<SphereClient | null>(null);
  const disconnectRef = useRef<(() => Promise<void>) | null>(null);

  const fetchBalances = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      const [bal, tokens] = await Promise.all([
        client.query<SphereNativeBalance>('sphere_getBalance'),
        client.query<SphereTokenBalance[]>('sphere_getTokens').catch(() => [] as SphereTokenBalance[]),
      ]);
      setNativeBalance(bal);
      setTokenBalances(Array.isArray(tokens) ? tokens : []);
    } catch {
      // non-critical — wallet may not have permissions yet
    }
  }, []);

  const attachEvents = useCallback(
    (client: SphereClient) => {
      client.on('wallet:locked', () => {
        setIsLocked(true);
        setIsConnected(false);
      });
      client.on('identity:changed', (data) => {
        setIdentity(data as PublicIdentity);
      });
      client.on('balance:updated', () => fetchBalances());
    },
    [fetchBalances],
  );

  // Attempt silent auto-connect on page load (session resume)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { autoConnect } = await import('@unicitylabs/sphere-sdk/connect/browser');
        const saved = sessionStorage.getItem(SESSION_KEY) ?? undefined;
        const result = await autoConnect({
          dapp: { ...DAPP, url: window.location.origin },
          walletUrl: WALLET_URL,
          silent: true,
          resumeSessionId: saved,
        });
        if (cancelled) {
          await result.disconnect();
          return;
        }
        clientRef.current = result.client;
        disconnectRef.current = result.disconnect;
        if (result.connection.sessionId) {
          sessionStorage.setItem(SESSION_KEY, result.connection.sessionId);
        }
        setIdentity(result.connection.identity);
        setIsConnected(true);
        setIsLocked(false);
        attachEvents(result.client);
        await fetchBalances();
      } catch {
        // silent fail — user has not approved this origin yet
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachEvents, fetchBalances]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { autoConnect } = await import('@unicitylabs/sphere-sdk/connect/browser');
      const saved = sessionStorage.getItem(SESSION_KEY) ?? undefined;
      const result = await autoConnect({
        dapp: { ...DAPP, url: window.location.origin },
        walletUrl: WALLET_URL,
        silent: false,
        resumeSessionId: saved,
      });
      clientRef.current = result.client;
      disconnectRef.current = result.disconnect;
      if (result.connection.sessionId) {
        sessionStorage.setItem(SESSION_KEY, result.connection.sessionId);
      }
      setIdentity(result.connection.identity);
      setIsConnected(true);
      setIsLocked(false);
      attachEvents(result.client);
      await fetchBalances();
    } catch (e) {
      setError((e as Error).message ?? 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, [attachEvents, fetchBalances]);

  const disconnect = useCallback(async () => {
    try {
      if (disconnectRef.current) await disconnectRef.current();
      if (clientRef.current) await clientRef.current.disconnect().catch(() => {});
    } catch {
      // ignore
    }
    clientRef.current = null;
    disconnectRef.current = null;
    sessionStorage.removeItem(SESSION_KEY);
    setIsConnected(false);
    setIsLocked(false);
    setIdentity(null);
    setTokenBalances([]);
    setNativeBalance(null);
  }, []);

  const sendBridge = useCallback(
    async ({ coinId, amount, recipient }: { coinId: string; amount: string; recipient: string }) => {
      const client = clientRef.current;
      if (!client) throw new Error('Wallet not connected');
      const result = await client.intent<{ txId?: string }>('l1_send', {
        recipient,
        amount,
        coinId,
      });
      await fetchBalances();
      return result ?? {};
    },
    [fetchBalances],
  );

  const sendToken = useCallback(
    async ({ coinId, amount, recipient }: { coinId: string; amount: number; recipient: string }) => {
      const client = clientRef.current;
      if (!client) throw new Error('Wallet not connected');
      const result = await client.intent<{ txId?: string }>('send', {
        recipient,
        amount,
        coinId,
      });
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
    connect,
    disconnect,
    sendBridge,
    sendToken,
    error,
  };
}
