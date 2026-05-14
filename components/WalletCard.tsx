'use client';

import { useWallet, balanceOf, MY_PUBKEY } from '@/lib/store';
import { Wallet, Clock, Database } from 'lucide-react';

const DISPLAY_SYMBOLS = ['USDT', 'BTC', 'ETH', 'SOL', 'UNI'];

export default function WalletCard() {
  const { tokens, tau, pubkey, oracleSnapshot } = useWallet();

  const oracleCount = Object.keys(oracleSnapshot).length;
  const tokenCount  = Object.values(tokens).filter(t => t.predicate.type === 'sig').length;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="w-4 h-4 text-orange-500" />
          Wallet
        </div>
        <span className="text-xs text-zinc-500 font-mono">{pubkey.slice(-12)}</span>
      </div>

      {/* Balances */}
      <div className="space-y-2">
        {DISPLAY_SYMBOLS.map(sym => {
          const bal = balanceOf(tokens, sym);
          return bal > 0 ? (
            <div key={sym} className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">{sym}</span>
              <span className="font-mono text-sm font-semibold">
                {bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </span>
            </div>
          ) : null;
        })}
        {DISPLAY_SYMBOLS.every(sym => balanceOf(tokens, sym) === 0) && (
          <p className="text-xs text-zinc-600 text-center py-2">No token balances yet</p>
        )}
      </div>

      {/* Stats */}
      <div className="border-t border-zinc-800 pt-4 grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
            <Clock className="w-3 h-3" /> System Time τ
          </div>
          <span className="font-mono text-lg font-bold text-orange-500">{tau}</span>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
            <Database className="w-3 h-3" /> Oracle Records
          </div>
          <span className="font-mono text-lg font-bold text-green-400">{oracleCount}</span>
        </div>
      </div>
    </div>
  );
}
