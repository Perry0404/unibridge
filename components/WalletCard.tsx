'use client';

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
