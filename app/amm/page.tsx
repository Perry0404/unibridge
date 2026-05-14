'use client';

import { useEffect, useState } from 'react';
import { useWallet, balanceOf } from '@/lib/store';
import WalletCard from '@/components/WalletCard';
import TxLog from '@/components/TxLog';
import { Layers, Plus, Minus, ArrowDownUp, RefreshCw, Zap } from 'lucide-react';
import { getSpotPrice } from '@/lib/defi/amm';

const POOL_PAIRS: [string, string][] = [
  ['USDT', 'ETH'],
  ['USDT', 'BTC'],
  ['USDT', 'SOL'],
  ['ETH',  'BTC'],
];

export default function AMMPage() {
  const {
    tokens, pools, lpPositions,
    initPool, depositLiquidity, withdrawLiquidity, swapInPool, mintTokens,
  } = useWallet();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [amountA, setAmountA]     = useState('');
  const [amountB, setAmountB]     = useState('');
  const [swapFrom, setSwapFrom]   = useState('USDT');
  const [swapAmt, setSwapAmt]     = useState('');
  const [selPool, setSelPool]     = useState('');
  const [tab, setTab]             = useState<'add'|'remove'|'swap'>('add');
  const [error, setError]         = useState('');
  const [msg, setMsg]             = useState('');

  if (!mounted) return null;

  const poolList = Object.values(pools);

  function handleCreatePool(symA: string, symB: string) {
    setError(''); setMsg('');
    const existing = poolList.find(p =>
      (p.symbolA === symA && p.symbolB === symB) ||
      (p.symbolA === symB && p.symbolB === symA)
    );
    if (existing) return setError('Pool already exists');
    const pool = initPool(symA, symB);
    setSelPool(pool.id);
    setMsg(`Pool ${symA}/${symB} created`);
  }

  function handleAdd() {
    setError(''); setMsg('');
    if (!selPool) return setError('Select a pool');
    const a = parseFloat(amountA), b = parseFloat(amountB);
    if (isNaN(a) || isNaN(b) || a <= 0 || b <= 0) return setError('Enter valid amounts');
    try {
      depositLiquidity(selPool, a, b);
      setMsg('Liquidity added!'); setAmountA(''); setAmountB('');
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function handleSwap() {
    setError(''); setMsg('');
    if (!selPool) return setError('Select a pool');
    const a = parseFloat(swapAmt);
    if (isNaN(a) || a <= 0) return setError('Enter a valid amount');
    try {
      swapInPool(selPool, swapFrom, a);
      setMsg('Swap executed!'); setSwapAmt('');
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function handleRemove(lpId: string, pct: number) {
    setError(''); setMsg('');
    try {
      withdrawLiquidity(lpId, pct / 100);
      setMsg(`Removed ${pct}% liquidity`);
    } catch (e: unknown) { setError((e as Error).message); }
  }

  const selPoolObj = pools[selPool];
  const poolLPs    = Object.values(lpPositions).filter(lp => lp.poolId === selPool);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Layers className="w-8 h-8 text-green-400" /> AMM Pools
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Constant-product (x·y=k) pools. Provide liquidity, earn fees, swap tokens.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <WalletCard />

          {/* Faucet */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 mb-3">Need testnet tokens to add liquidity?</p>
            <button
              onClick={() => { ['USDT','ETH','BTC','SOL','UNI'].forEach(s => mintTokens(s, ({USDT:1000,ETH:1,BTC:0.05,SOL:10,UNI:100} as Record<string,number>)[s])); setMsg('Testnet tokens added!'); }}
              className="w-full flex items-center justify-center gap-2 border border-orange-500/40 hover:bg-orange-500/10 text-orange-400 text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              <Zap className="w-4 h-4" /> Get Testnet Tokens
            </button>
          </div>

          {/* Create pool */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
            <h3 className="text-sm font-medium mb-3">Create New Pool</h3>
            <div className="grid grid-cols-2 gap-2">
              {POOL_PAIRS.map(([a, b]) => {
                const exists = poolList.some(p =>
                  (p.symbolA === a && p.symbolB === b) ||
                  (p.symbolA === b && p.symbolB === a)
                );
                return (
                  <button
                    key={`${a}-${b}`}
                    onClick={() => handleCreatePool(a, b)}
                    disabled={exists}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all
                      ${exists
                        ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                        : 'border-zinc-700 hover:border-green-400/50 hover:bg-zinc-900'
                      }`}
                  >
                    {exists ? '✓ ' : '+'} {a}/{b}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Pool list */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Active Pools</h2>
            {poolList.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-8">No pools yet — create one above</p>
            ) : (
              <div className="space-y-3">
                {poolList.map(pool => {
                  const price = getSpotPrice(pool, pool.symbolA);
                  const active = selPool === pool.id;
                  return (
                    <button
                      key={pool.id}
                      onClick={() => setSelPool(pool.id)}
                      className={`w-full text-left bg-zinc-900 hover:bg-zinc-800 rounded-xl p-4 border transition-all
                        ${active ? 'border-green-400/50' : 'border-zinc-700'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{pool.symbolA} / {pool.symbolB}</span>
                        <span className="text-xs text-zinc-500">Fee {(pool.fee * 100).toFixed(1)}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
                        <div>
                          <p className="text-zinc-600">Reserve A</p>
                          <p className="font-mono text-white">{pool.reserveA.toFixed(4)} {pool.symbolA}</p>
                        </div>
                        <div>
                          <p className="text-zinc-600">Reserve B</p>
                          <p className="font-mono text-white">{pool.reserveB.toFixed(4)} {pool.symbolB}</p>
                        </div>
                        <div>
                          <p className="text-zinc-600">Price</p>
                          <p className="font-mono text-green-400">{price > 0 ? price.toFixed(4) : '—'} {pool.symbolB}/{pool.symbolA}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions panel */}
          {selPoolObj && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="font-semibold">{selPoolObj.symbolA} / {selPoolObj.symbolB}</h2>
                <div className="flex gap-1 ml-auto">
                  {(['add', 'swap', 'remove'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize
                        ${tab === t ? 'bg-green-400 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                    >
                      {t === 'add' ? 'Add Liquidity' : t === 'remove' ? 'Remove' : 'Swap'}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
              {msg   && <p className="text-green-400 text-xs mb-3">{msg}</p>}

              {tab === 'add' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Amount {selPoolObj.symbolA}</label>
                      <input type="number" min="0" step="any" value={amountA} onChange={e => setAmountA(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Amount {selPoolObj.symbolB}</label>
                      <input type="number" min="0" step="any" value={amountB} onChange={e => setAmountB(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
                    </div>
                  </div>
                  <button onClick={handleAdd}
                    className="w-full bg-green-400 hover:bg-green-500 text-black font-semibold py-3 rounded-xl transition">
                    <Plus className="w-4 h-4 inline mr-2" /> Add Liquidity
                  </button>
                </div>
              )}

              {tab === 'swap' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">From</label>
                      <select value={swapFrom} onChange={e => setSwapFrom(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400">
                        <option value={selPoolObj.symbolA}>{selPoolObj.symbolA}</option>
                        <option value={selPoolObj.symbolB}>{selPoolObj.symbolB}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Amount</label>
                      <input type="number" min="0" step="any" value={swapAmt} onChange={e => setSwapAmt(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
                    </div>
                  </div>
                  <button onClick={handleSwap}
                    className="w-full bg-green-400 hover:bg-green-500 text-black font-semibold py-3 rounded-xl transition">
                    <ArrowDownUp className="w-4 h-4 inline mr-2" /> Swap
                  </button>
                </div>
              )}

              {tab === 'remove' && (
                <div className="space-y-3">
                  {poolLPs.length === 0 ? (
                    <p className="text-xs text-zinc-600 text-center py-4">No LP positions in this pool</p>
                  ) : poolLPs.map(lp => (
                    <div key={lp.id} className="bg-zinc-900 rounded-xl p-4">
                      <p className="text-sm font-mono mb-3">{lp.lpAmount.toFixed(6)} LP tokens</p>
                      <div className="flex gap-2">
                        {[25, 50, 100].map(pct => (
                          <button key={pct} onClick={() => handleRemove(lp.id, pct)}
                            className="flex-1 border border-zinc-700 hover:bg-zinc-800 py-2 rounded-lg text-xs transition">
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <TxLog max={6} />
        </div>
      </div>
    </div>
  );
}
