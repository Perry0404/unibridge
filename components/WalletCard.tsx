'use client';

import { useSphereWallet } from '@/hooks/useSphereWallet';
import { Wallet, ExternalLink, Loader2 } from 'lucide-react';

export default function WalletCard() {
  const { isConnected, isConnecting, identity, nativeBalance, tokenBalances, connect } =
    useSphereWallet();

  if (!isConnected) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
        <Wallet className="w-8 h-8 text-orange-500 opacity-60" />
        <p className="text-sm text-zinc-500">Connect your Sphere wallet to see your balance</p>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    );
  }

  const hasBalance = nativeBalance || tokenBalances.length > 0;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="w-4 h-4 text-orange-500" />
          Sphere Wallet
        </div>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </div>

      {identity && (
        <div>
          {identity.nametag && (
            <p className="text-sm font-semibold text-orange-400 mb-0.5">@{identity.nametag}</p>
          )}
          <p className="text-xs font-mono text-zinc-500 break-all">
            {identity.chainPubkey.slice(0, 24)}...
          </p>
        </div>
      )}

      {nativeBalance && (
        <div className="bg-zinc-900 rounded-xl p-3">
          <p className="text-xs text-zinc-500 mb-1">UCT Balance</p>
          <p className="text-2xl font-bold font-mono text-orange-400">{nativeBalance.available}</p>
          {nativeBalance.pending && nativeBalance.pending !== '0' && (
            <p className="text-xs text-zinc-600 font-mono mt-0.5">+{nativeBalance.pending} pending</p>
          )}
        </div>
      )}

      {tokenBalances.length > 0 && (
        <div className="space-y-1.5 border-t border-zinc-800 pt-3">
          {tokenBalances.map(t => (
            <div key={t.coinId} className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">{t.symbol || t.coinId}</span>
              <span className="font-mono text-sm font-medium">{t.balance}</span>
            </div>
          ))}
        </div>
      )}

      {!hasBalance && <p className="text-xs text-zinc-600 text-center py-2">Loading balance...</p>}

      <a
        href="https://sphere.unicity.network"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-400 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Open Sphere Wallet
      </a>
    </div>
  );
}