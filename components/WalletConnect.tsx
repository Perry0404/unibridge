'use client';

import { useState } from 'react';
import { Wallet, LogOut, ChevronDown, Loader2, Lock } from 'lucide-react';
import { useSphereWallet } from '@/hooks/useSphereWallet';

export default function WalletConnect() {
  const {
    isConnected,
    isConnecting,
    isLocked,
    identity,
    nativeBalance,
    connect,
    disconnect,
    error,
  } = useSphereWallet();
  const [showMenu, setShowMenu] = useState(false);

  if (isLocked) {
    return (
      <div className="flex items-center gap-2 border border-orange-500/40 bg-orange-500/10 text-orange-400 text-sm px-3 py-1.5 rounded-lg">
        <Lock className="w-4 h-4" />
        Wallet locked
      </div>
    );
  }

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wallet className="w-4 h-4" />
        )}
        {isConnecting ? 'Connecting…' : 'Connect Sphere Wallet'}
      </button>
    );
  }

  const label = identity?.nametag
    ? `@${identity.nametag}`
    : identity?.chainPubkey
      ? `${identity.chainPubkey.slice(0, 10)}…${identity.chainPubkey.slice(-6)}`
      : 'Connected';

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(v => !v)}
        className="flex items-center gap-2 border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-4 z-50">
          <p className="text-xs text-zinc-500 mb-1">Connected · Unicity Testnet</p>
          {identity?.nametag && (
            <p className="text-sm font-semibold text-orange-400 mb-1">@{identity.nametag}</p>
          )}
          <p className="text-xs font-mono text-zinc-400 break-all mb-1">{identity?.chainPubkey}</p>
          {identity?.l1Address && (
            <p className="text-xs font-mono text-zinc-500 break-all mb-3">
              L1: {identity.l1Address.slice(0, 20)}…
            </p>
          )}
          {nativeBalance && (
            <div className="bg-zinc-800 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-zinc-500 mb-0.5">Balance</p>
              <p className="text-sm font-mono font-semibold text-orange-400">
                {nativeBalance.available} UCT
              </p>
              {nativeBalance.pending !== '0' && nativeBalance.pending !== '' && (
                <p className="text-xs text-zinc-500 font-mono">
                  Pending: {nativeBalance.pending} UCT
                </p>
              )}
            </div>
          )}
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <button
            onClick={() => {
              disconnect();
              setShowMenu(false);
            }}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Disconnect
          </button>
        </div>
      )}

      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}
    </div>
  );
}
