'use client';

import { useEffect, useState } from 'react';
import { useWallet, balanceOf } from '@/lib/store';
import WalletCard from '@/components/WalletCard';
import TxLog from '@/components/TxLog';
import { Landmark, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { collateralRatio, isLiquidatable, accrueInterest, LIQUIDATION_THRESHOLD, getPrice } from '@/lib/defi/lending';

const SYMBOLS = ['USDT', 'BTC', 'ETH', 'SOL', 'UNI'];

export default function LendingPage() {
  const { tokens, lendingPositions, openLoan, repay } = useWallet();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [collateralId, setCollateralId] = useState('');
  const [debtSymbol, setDebtSymbol]     = useState('USDT');
  const [debtAmount, setDebtAmount]     = useState('');
  const [repayAmt, setRepayAmt]         = useState<Record<string, string>>({});
  const [error, setError]               = useState('');
  const [msg, setMsg]                   = useState('');

  if (!mounted) return null;

  const ownedTokens = Object.values(tokens).filter(t => t.predicate.type === 'sig');
  const positions   = Object.values(lendingPositions);
  const collToken   = tokens[collateralId];

  const collValue = collToken ? collToken.amount * getPrice(collToken.symbol) : 0;
  const maxBorrow  = collValue * 0.67;

  function handleOpen() {
    setError(''); setMsg('');
    if (!collateralId) return setError('Select collateral token');
    const d = parseFloat(debtAmount);
    if (isNaN(d) || d <= 0) return setError('Enter valid borrow amount');
    if (collToken?.symbol === debtSymbol) return setError('Cannot borrow same asset as collateral');
    try {
      openLoan(collateralId, debtSymbol, d);
      setMsg('Loan opened!'); setDebtAmount(''); setCollateralId('');
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function handleRepay(posId: string) {
    setError(''); setMsg('');
    const amt = parseFloat(repayAmt[posId] ?? '0');
    if (isNaN(amt) || amt <= 0) return setError('Enter repay amount');
    try {
      repay(posId, amt);
      setMsg('Repaid!');
      setRepayAmt(prev => ({ ...prev, [posId]: '' }));
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function crColor(cr: number) {
    if (cr < LIQUIDATION_THRESHOLD) return 'text-red-400';
    if (cr < LIQUIDATION_THRESHOLD + 0.3) return 'text-orange-400';
    return 'text-green-400';
  }

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Landmark className="w-8 h-8 text-blue-400" /> Lending
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Over-collateralised borrowing. Collateral locked in Unicity predicate. Min CR: {(LIQUIDATION_THRESHOLD * 100).toFixed(0)}%.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <WalletCard />

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-xs text-zinc-500 space-y-2">
            <h3 className="text-zinc-300 font-medium">Protocol Parameters</h3>
            <div className="flex justify-between"><span>Min Collateral Ratio</span><span className="text-white">{(LIQUIDATION_THRESHOLD * 100).toFixed(0)}%</span></div>
            <div className="flex justify-between"><span>Max LTV</span><span className="text-white">67%</span></div>
            <div className="flex justify-between"><span>Base Interest</span><span className="text-white">8% APR</span></div>
            <div className="flex justify-between"><span>Liquidation Bonus</span><span className="text-white">5%</span></div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Open loan */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-blue-400" /> Open New Position
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Collateral Token</label>
                <select value={collateralId} onChange={e => setCollateralId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400">
                  <option value="">— Select token —</option>
                  {ownedTokens.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {t.symbol}
                      {' '}(≈ ${(t.amount * getPrice(t.symbol)).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                    </option>
                  ))}
                </select>
              </div>

              {collToken && (
                <div className="bg-zinc-900 rounded-xl px-4 py-3 text-xs text-zinc-400 flex justify-between">
                  <span>Collateral value</span>
                  <span className="text-white">${collValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  <span>Max borrow</span>
                  <span className="text-blue-400">${maxBorrow.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Borrow Symbol</label>
                  <select value={debtSymbol} onChange={e => setDebtSymbol(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400">
                    {SYMBOLS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Borrow Amount</label>
                  <input type="number" min="0" step="any" value={debtAmount} onChange={e => setDebtAmount(e.target.value)}
                    placeholder={`Max ${(maxBorrow / getPrice(debtSymbol)).toFixed(4)} ${debtSymbol}`}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
              {msg   && <p className="text-green-400 text-xs">{msg}</p>}

              <button onClick={handleOpen}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition">
                Open Lending Position
              </button>
            </div>
          </div>

          {/* Active positions */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Active Positions</h2>
            {positions.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-8">No open positions</p>
            ) : (
              <div className="space-y-4">
                {positions.map(pos => {
                  const accrued = accrueInterest(pos, Date.now());
                  const cr = collateralRatio(accrued);
                  const liq = isLiquidatable(accrued);
                  return (
                    <div key={pos.id} className={`bg-zinc-900 rounded-xl p-4 border ${liq ? 'border-red-500/50' : 'border-zinc-800'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold">
                          {accrued.collateralAmount.toFixed(6)} {accrued.collateralSymbol}
                          {' '}→ {accrued.debtAmount.toFixed(6)} {accrued.debtSymbol}
                        </span>
                        <span className={`text-xs font-bold ${crColor(cr)}`}>
                          CR {(cr * 100).toFixed(0)}%
                        </span>
                      </div>

                      {liq && (
                        <div className="flex items-center gap-1.5 text-xs text-red-400 mb-3">
                          <AlertTriangle className="w-3 h-3" />
                          At risk of liquidation!
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 mb-4">
                        <div className="bg-zinc-800 rounded-lg p-2">
                          <p className="text-zinc-600">Debt (with interest)</p>
                          <p className="text-white font-mono">{accrued.debtAmount.toFixed(6)} {accrued.debtSymbol}</p>
                        </div>
                        <div className="bg-zinc-800 rounded-lg p-2">
                          <p className="text-zinc-600">Interest Rate</p>
                          <p className="text-white font-mono">{(pos.interestRate * 100).toFixed(1)}% APR</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="number" min="0" step="any"
                          value={repayAmt[pos.id] ?? ''}
                          onChange={e => setRepayAmt(prev => ({ ...prev, [pos.id]: e.target.value }))}
                          placeholder={`Repay ${accrued.debtSymbol}`}
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                        />
                        <button onClick={() => handleRepay(pos.id)}
                          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-xl text-sm transition">
                          Repay
                        </button>
                        <button onClick={() => {
                          const full = accrued.debtAmount.toFixed(6);
                          setRepayAmt(prev => ({ ...prev, [pos.id]: full }));
                        }}
                          className="border border-zinc-700 hover:bg-zinc-800 px-3 py-2 rounded-xl text-xs transition">
                          Full
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <TxLog max={6} />
        </div>
      </div>
    </div>
  );
}
