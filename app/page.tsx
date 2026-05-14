'use client';

import { useEffect, useState } from 'react';
import { useWallet, balanceOf } from '@/lib/store';
import WalletCard from '@/components/WalletCard';
import TxLog from '@/components/TxLog';
import StatCard from '@/components/StatCard';
import { Shield, Zap, Plus } from 'lucide-react';

const MINT_PRESETS: { symbol: string; amount: number }[] = [
  { symbol: 'USDT', amount: 10000 },
  { symbol: 'BTC',  amount: 0.5   },
  { symbol: 'ETH',  amount: 5     },
  { symbol: 'SOL',  amount: 100   },
];

export default function DashboardPage() {
  const {
    tokens, pools, lendingPositions, yieldPositions,
    mintTokens, advanceTau, tau, oracleSnapshot,
  } = useWallet();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const totalTokens   = Object.values(tokens).filter(t => t.predicate.type === 'sig').length;
  const activeLoan    = Object.keys(lendingPositions).length;
  const oracleRecords = Object.keys(oracleSnapshot).length;

  const TOKEN_PRICES: Record<string, number> = { USDT: 1, BTC: 65000, ETH: 3500, SOL: 160, UNI: 12 };
  const totalUsd = Object.values(tokens)
    .filter(t => t.predicate.type === 'sig')
    .reduce((sum, t) => sum + t.amount * (TOKEN_PRICES[t.symbol] ?? 1), 0);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-8">
      <div className="text-center space-y-3 pt-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Shield className="w-10 h-10 text-yellow-400" />
          <h1 className="text-4xl font-bold">Unicity DeFi</h1>
        </div>
        <p className="text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed">
          Programmable token ownership backed by the Unicity Uniqueness Oracle.
          Tokens move peer-to-peer with cryptographic guarantees — no bridges, no shared ledger.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Portfolio Value"  value={`$${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="across all assets" accent="yellow" />
        <StatCard label="Token Objects"    value={totalTokens}    sub="self-authenticating" accent="green"  />
        <StatCard label="Oracle Records"   value={oracleRecords}  sub="double-spend proof"  accent="blue"   />
        <StatCard label="System Time τ"    value={tau}            sub="Unicity time units"  accent="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <WalletCard />

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-medium">Mint Test Tokens</h2>
              <span className="text-xs text-zinc-600 ml-auto">simulates source-chain lock</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MINT_PRESETS.map(({ symbol, amount }) => (
                <button
                  key={symbol}
                  onClick={() => mintTokens(symbol, amount)}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-yellow-400/50 rounded-xl px-3 py-2.5 text-sm transition-all text-left"
                >
                  <span className="font-semibold">{amount}</span>{' '}
                  <span className="text-zinc-400">{symbol}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-medium">Advance Time τ</h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[10, 50, 100, 200, 500, 1000].map(d => (
                <button key={d} onClick={() => advanceTau(d)}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl py-2 text-sm font-mono transition-all">
                  +{d}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-600 mt-3">
              Advancing τ enables timelock and HTLC refund paths in predicates.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <TxLog max={15} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: 'Atomic Swaps', desc: 'Trustless P2P exchange using HTLC predicates. No counterparty risk.', href: '/swap', color: 'yellow' },
              { title: 'AMM Pools',   desc: 'Constant-product (x·y=k) market maker with LP token rewards.',       href: '/amm',     color: 'green'  },
              { title: 'Lending',     desc: 'Over-collateralised borrowing with predicate-locked collateral.',      href: '/lending', color: 'blue'   },
            ].map(c => (
              <a key={c.href} href={c.href}
                className="group bg-zinc-950 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-5 transition-all">
                <h3 className={`font-semibold mb-2 ${c.color === 'yellow' ? 'text-yellow-400' : c.color === 'green' ? 'text-green-400' : 'text-blue-400'}`}>
                  {c.title}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{c.desc}</p>
              </a>
            ))}
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-xs text-zinc-500">
            <h3 className="text-zinc-300 font-medium mb-3">Unicity Architecture</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-zinc-900 rounded-xl p-3">
                <p className="text-yellow-400 font-mono mb-1">Source Chain</p>
                <p>Assets locked on Solana / ETH / BTC</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-3">
                <p className="text-green-400 font-mono mb-1">Uniqueness Oracle</p>
                <p>First-commitment wins, prevents double-spend</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-3">
                <p className="text-blue-400 font-mono mb-1">Edge Verification</p>
                <p>Tokens self-verify, move P2P with full privacy</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

