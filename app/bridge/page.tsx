'use client';

import { useEffect, useState } from 'react';
import { useWallet, balanceOf } from '@/lib/store';
import WalletCard from '@/components/WalletCard';
import TxLog from '@/components/TxLog';
import { GitMerge, ArrowRight, ChevronDown, Shield, Loader2 } from 'lucide-react';

// Supported destination networks
const DEST_NETWORKS = [
  { id: 'solana',   label: 'Solana',         logo: '◎', color: 'text-purple-400',  border: 'border-purple-500/30' },
  { id: 'ethereum', label: 'Ethereum',        logo: 'Ξ', color: 'text-blue-400',    border: 'border-blue-500/30'   },
  { id: 'bsc',      label: 'BNB Chain',       logo: '⬡', color: 'text-yellow-400',  border: 'border-yellow-500/30' },
  { id: 'polygon',  label: 'Polygon',         logo: '⬟', color: 'text-violet-400',  border: 'border-violet-500/30' },
  { id: 'avalanche',label: 'Avalanche',       logo: '▲', color: 'text-red-400',     border: 'border-red-500/30'    },
  { id: 'arbitrum', label: 'Arbitrum One',    logo: '⧖', color: 'text-sky-400',     border: 'border-sky-500/30'    },
];

const BRIDGE_TOKENS = ['USDT', 'ETH', 'BTC', 'SOL', 'UNI'];

type BridgeStatus = 'idle' | 'locking' | 'oracle' | 'minting' | 'done' | 'error';

export default function BridgePage() {
  const { tokens, mintTokens, tau } = useWallet();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [symbol, setSymbol]         = useState('USDT');
  const [amount, setAmount]         = useState('');
  const [destNet, setDestNet]       = useState(DEST_NETWORKS[0]);
  const [destAddr, setDestAddr]     = useState('');
  const [status, setStatus]         = useState<BridgeStatus>('idle');
  const [txHash, setTxHash]         = useState('');
  const [error, setError]           = useState('');
  const [showNetPicker, setShowNetPicker] = useState(false);

  if (!mounted) return null;

  const available = balanceOf(tokens, symbol);
  const amt = parseFloat(amount);
  const valid = !isNaN(amt) && amt > 0 && amt <= available && destAddr.length > 5;

  async function handleBridge() {
    if (!valid) return;
    setError(''); setStatus('locking');

    // Step 1 – simulate source-chain lock (oracle commit)
    await delay(900);
    setStatus('oracle');

    // Step 2 – Uniqueness Oracle records the commitment
    await delay(1100);
    setStatus('minting');

    // Step 3 – mint wrapped token on destination (simulated)
    try {
      mintTokens(`w${symbol}`, amt); // wrapped token credited in Unicity
      await delay(800);
      const hash = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      setTxHash(hash);
      setStatus('done');
      setAmount('');
    } catch (e: unknown) {
      setError((e as Error).message);
      setStatus('error');
    }
  }

  const statusSteps: { key: BridgeStatus; label: string }[] = [
    { key: 'locking',  label: 'Locking tokens on Unicity' },
    { key: 'oracle',   label: 'Uniqueness Oracle commit' },
    { key: 'minting',  label: `Minting w${symbol} on ${destNet.label}` },
    { key: 'done',     label: 'Bridge complete' },
  ];
  const stepIdx = statusSteps.findIndex(s => s.key === status);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <GitMerge className="w-8 h-8 text-orange-500" />
          Bridge
        </h1>
        <p className="text-zinc-500 mt-1 text-sm">
          Lock tokens on Unicity testnet · Mint wrapped assets on destination chains
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bridge form */}
        <div className="lg:col-span-2 space-y-4">

          {/* Architecture banner */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-2 text-orange-400 font-medium">
              <Shield className="w-4 h-4" /> Unicity Testnet
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-700 shrink-0" />
            <p>Tokens are locked by a Unicity predicate + Oracle commitment, then a proof is relayed to the destination chain to mint the wrapped version.</p>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
            {/* From */}
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">From · Unicity Testnet</label>
              <div className="flex gap-3">
                <select
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 w-28"
                >
                  {BRIDGE_TOKENS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    min={0}
                    max={available}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 font-mono"
                  />
                  <button
                    onClick={() => setAmount(String(available))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-500 hover:text-orange-400 font-semibold"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-1.5">
                Available: <span className="text-zinc-400 font-mono">{available.toLocaleString()}</span> {symbol}
              </p>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-4">
              <div className="flex-1 border-t border-zinc-800" />
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-full p-2">
                <ArrowRight className="w-4 h-4 text-orange-500" />
              </div>
              <div className="flex-1 border-t border-zinc-800" />
            </div>

            {/* To */}
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">To · Destination Network</label>
              <div className="relative mb-3">
                <button
                  onClick={() => setShowNetPicker(v => !v)}
                  className={`w-full flex items-center justify-between bg-zinc-900 border ${destNet.border} rounded-xl px-4 py-3 text-sm transition-colors hover:border-zinc-600`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`text-xl leading-none ${destNet.color}`}>{destNet.logo}</span>
                    <span className={`font-semibold ${destNet.color}`}>{destNet.label}</span>
                  </span>
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                </button>
                {showNetPicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl z-10 overflow-hidden shadow-xl">
                    {DEST_NETWORKS.map(net => (
                      <button
                        key={net.id}
                        onClick={() => { setDestNet(net); setShowNetPicker(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 text-sm transition-colors"
                      >
                        <span className={`text-xl leading-none ${net.color}`}>{net.logo}</span>
                        <span className={`font-medium ${net.color}`}>{net.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder={`Destination ${destNet.label} address`}
                value={destAddr}
                onChange={e => setDestAddr(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>

            {/* Fee summary */}
            {amt > 0 && (
              <div className="bg-zinc-900 rounded-xl p-4 text-xs space-y-1.5 text-zinc-500">
                <div className="flex justify-between">
                  <span>You send</span>
                  <span className="text-zinc-300 font-mono">{amt} {symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bridge fee (0.1%)</span>
                  <span className="text-zinc-300 font-mono">{(amt * 0.001).toFixed(6)} {symbol}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-1.5">
                  <span>You receive on {destNet.label}</span>
                  <span className="text-orange-400 font-mono font-semibold">{(amt * 0.999).toFixed(6)} w{symbol}</span>
                </div>
              </div>
            )}

            {error && <p className="text-red-400 text-xs">{error}</p>}

            {/* Bridge button */}
            {status === 'idle' || status === 'error' ? (
              <button
                onClick={handleBridge}
                disabled={!valid}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <GitMerge className="w-4 h-4" />
                Bridge {amount || '0'} {symbol} → {destNet.label}
              </button>
            ) : status === 'done' ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-sm">
                <p className="text-green-400 font-semibold mb-1">Bridge successful!</p>
                <p className="text-zinc-500 text-xs font-mono break-all">Tx: {txHash}</p>
                <button
                  onClick={() => { setStatus('idle'); setTxHash(''); }}
                  className="mt-3 text-xs text-orange-500 hover:text-orange-400"
                >
                  Bridge another →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {statusSteps.map((step, i) => {
                  const done    = stepIdx > i;
                  const active  = stepIdx === i;
                  return (
                    <div key={step.key} className={`flex items-center gap-3 text-sm rounded-xl px-4 py-2.5 ${active ? 'bg-orange-500/10 border border-orange-500/30' : done ? 'text-zinc-600' : 'text-zinc-700'}`}>
                      {active ? (
                        <Loader2 className="w-4 h-4 text-orange-500 animate-spin shrink-0" />
                      ) : done ? (
                        <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0 text-[10px]">✓</span>
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
                      )}
                      <span className={active ? 'text-orange-400' : done ? 'text-green-600' : ''}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">How UniBridge works</h3>
            <div className="grid grid-cols-3 gap-4 text-xs text-center text-zinc-500">
              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-orange-500 font-mono font-semibold mb-2 text-base">1</p>
                <p className="text-zinc-300 font-medium mb-1">Lock on Unicity</p>
                <p>Your tokens are locked by a cryptographic predicate on the Unicity testnet</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-orange-500 font-mono font-semibold mb-2 text-base">2</p>
                <p className="text-zinc-300 font-medium mb-1">Oracle Proof</p>
                <p>The Uniqueness Oracle commits the state transition — preventing any double-spend</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-orange-500 font-mono font-semibold mb-2 text-base">3</p>
                <p className="text-zinc-300 font-medium mb-1">Mint on Destination</p>
                <p>A relayer submits the proof to the destination chain to mint wrapped tokens</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <WalletCard />
          <TxLog max={10} />
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
