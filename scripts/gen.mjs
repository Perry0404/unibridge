import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const w = (f, s) => { writeFileSync(join(root, f), s, 'utf8'); console.log('wrote', f); };

// ── TxLog.tsx ─────────────────────────────────────────────────────────────────
w('components/TxLog.tsx', `'use client';

import { useWallet } from '@/lib/store';
import { TxRecord } from '@/lib/unicity/types';
import { CheckCircle2, XCircle } from 'lucide-react';

const TX_LABELS: Record<TxRecord['type'], string> = {
  mint:           'MINT',
  transfer:       'SEND',
  split:          'SPLIT',
  merge:          'MERGE',
  swap_initiate:  'SWAP',
  swap_complete:  'SWAP OK',
  swap_refund:    'REFUND',
  amm_add:        'ADD LIQ',
  amm_remove:     'REM LIQ',
  amm_swap:       'POOL SWAP',
  lend_open:      'LOAN',
  lend_repay:     'REPAY',
  lend_liquidate: 'LIQ',
  yield_stake:    'STAKE',
  yield_unstake:  'UNSTAKE',
  yield_claim:    'CLAIM',
};

const TX_COLORS: Record<TxRecord['type'], string> = {
  mint:           'text-purple-400',
  transfer:       'text-blue-400',
  split:          'text-zinc-400',
  merge:          'text-zinc-400',
  swap_initiate:  'text-orange-400',
  swap_complete:  'text-green-400',
  swap_refund:    'text-red-400',
  amm_add:        'text-green-400',
  amm_remove:     'text-yellow-400',
  amm_swap:       'text-orange-400',
  lend_open:      'text-blue-400',
  lend_repay:     'text-green-400',
  lend_liquidate: 'text-red-400',
  yield_stake:    'text-green-400',
  yield_unstake:  'text-yellow-400',
  yield_claim:    'text-orange-400',
};

export default function TxLog({ max = 12 }: { max?: number }) {
  const { txHistory } = useWallet();
  const visible = txHistory.slice(0, max);

  if (visible.length === 0) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Transaction History</h3>
        <p className="text-xs text-zinc-600 text-center py-8">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Transaction History</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {visible.map(t => (
          <div
            key={t.id}
            className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors"
          >
            <span className={\`text-xs font-bold font-mono w-16 flex-shrink-0 mt-0.5 \${TX_COLORS[t.type] ?? 'text-zinc-400'}\`}>
              {TX_LABELS[t.type] ?? 'TX'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 truncate">{t.description}</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                {new Date(t.timestamp).toLocaleTimeString()}
              </p>
            </div>
            {t.success
              ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              : <XCircle     className="w-4 h-4 text-red-500  flex-shrink-0 mt-0.5" />
            }
          </div>
        ))}
      </div>
    </div>
  );
}
`);

// ── app/swap/page.tsx ─────────────────────────────────────────────────────────
w('app/swap/page.tsx', `'use client';

import { useEffect, useState } from 'react';
import { useWallet, balanceOf } from '@/lib/store';
import { useSphereWallet } from '@/hooks/useSphereWallet';
import WalletCard from '@/components/WalletCard';
import TxLog from '@/components/TxLog';
import { ArrowDownUp, Send, Zap, ArrowLeftRight, Loader2 } from 'lucide-react';
import { executeAmmSwap } from '@/lib/defi/amm';

const SYMBOLS = ['USDT', 'ETH', 'BTC', 'SOL', 'UNI'];
const FAUCET: Record<string, number> = { USDT: 1000, ETH: 1, BTC: 0.05, SOL: 10, UNI: 100 };

export default function SwapPage() {
  const { tokens, pools, swapInPool, mintTokens } = useWallet();
  const { isConnected, identity, nativeBalance, tokenBalances, sendToken } = useSphereWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [tab, setTab] = useState<'pool' | 'send'>('pool');

  // Pool swap
  const [fromSym, setFromSym] = useState('USDT');
  const [toSym, setToSym]     = useState('ETH');
  const [fromAmt, setFromAmt] = useState('');

  // Wallet send
  const [sendCoin, setSendCoin] = useState('UCT');
  const [sendTo, setSendTo]     = useState('');
  const [sendAmt, setSendAmt]   = useState('');
  const [sending, setSending]   = useState(false);

  const [error, setError] = useState('');
  const [msg, setMsg]     = useState('');

  if (!mounted) return null;

  const poolList  = Object.values(pools);
  const fromBal   = balanceOf(tokens, fromSym);
  const parsedAmt = parseFloat(fromAmt);

  const activePool = poolList.find(p =>
    (p.symbolA === fromSym && p.symbolB === toSym) ||
    (p.symbolA === toSym   && p.symbolB === fromSym),
  );

  let estimatedOut = 0;
  let priceImpact  = 0;
  if (activePool && !isNaN(parsedAmt) && parsedAmt > 0) {
    try {
      const r = executeAmmSwap(activePool, fromSym, parsedAmt);
      estimatedOut = r.amountOut;
      priceImpact  = r.priceImpact;
    } catch { /* empty pool */ }
  }

  function handlePoolSwap() {
    setError(''); setMsg('');
    if (!activePool) return setError('No pool for this pair — create one in Pool page.');
    if (isNaN(parsedAmt) || parsedAmt <= 0) return setError('Enter a valid amount.');
    if (parsedAmt > fromBal) return setError(\`Insufficient \${fromSym}. Click "Get Testnet Tokens" below.\`);
    try {
      swapInPool(activePool.id, fromSym, parsedAmt);
      setMsg(\`Swapped \${parsedAmt} \${fromSym} for ~\${estimatedOut.toFixed(6)} \${toSym}\`);
      setFromAmt('');
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleWalletSend() {
    if (!isConnected) return setError('Connect your Sphere wallet first.');
    setError(''); setMsg(''); setSending(true);
    const a = parseFloat(sendAmt);
    if (isNaN(a) || a <= 0) { setSending(false); return setError('Enter a valid amount.'); }
    if (!sendTo.trim())     { setSending(false); return setError('Enter a recipient address.'); }
    try {
      await sendToken({ coinId: sendCoin, amount: a, recipient: sendTo.trim() });
      setMsg(\`Sent \${a} \${sendCoin} — confirm in your Sphere wallet.\`);
      setSendAmt(''); setSendTo('');
    } catch (e: unknown) { setError((e as Error).message ?? 'Send failed'); }
    finally { setSending(false); }
  }

  function handleFaucet() {
    Object.entries(FAUCET).forEach(([sym, amt]) => mintTokens(sym, amt));
    setMsg('Testnet tokens added to pool wallet!');
  }

  const sendCoins = ['UCT', ...tokenBalances.map(t => t.symbol || t.coinId)];

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-orange-500" /> Swap
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Pool Swap uses testnet liquidity pools &middot; Send uses your real Sphere wallet
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <WalletCard />
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 mb-3">Need tokens for pool swaps?</p>
            <button
              onClick={handleFaucet}
              className="w-full flex items-center justify-center gap-2 border border-orange-500/40 hover:bg-orange-500/10 text-orange-400 text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              <Zap className="w-4 h-4" /> Get Testnet Tokens
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
            {(['pool', 'send'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setMsg(''); }}
                className={\`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all \${
                  tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }\`}
              >
                {t === 'pool' ? 'Pool Swap' : 'Send via Wallet'}
              </button>
            ))}
          </div>

          {/* Pool Swap */}
          {tab === 'pool' && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
              {/* From */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs text-zinc-500">You pay</label>
                  <span className="text-xs text-zinc-500">
                    Balance: <span className="text-zinc-300 font-mono">{fromBal.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                  </span>
                </div>
                <div className="flex gap-3">
                  <select
                    value={fromSym}
                    onChange={e => { setFromSym(e.target.value); setFromAmt(''); }}
                    className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 w-28"
                  >
                    {SYMBOLS.filter(s => s !== toSym).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <div className="flex-1 relative">
                    <input
                      type="number" min="0" step="any" value={fromAmt}
                      onChange={e => setFromAmt(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 font-mono"
                    />
                    <button
                      onClick={() => setFromAmt(String(fromBal))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-500 hover:text-orange-400 font-semibold"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              {/* Flip */}
              <div className="flex justify-center">
                <button
                  onClick={() => { setFromSym(toSym); setToSym(fromSym); setFromAmt(''); }}
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-2.5 transition-colors"
                >
                  <ArrowDownUp className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              {/* To */}
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">You receive</label>
                <div className="flex gap-3">
                  <select
                    value={toSym}
                    onChange={e => setToSym(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 w-28"
                  >
                    {SYMBOLS.filter(s => s !== fromSym).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 font-mono text-sm text-zinc-400">
                    {estimatedOut > 0 ? \`~\${estimatedOut.toFixed(6)}\` : '—'}
                  </div>
                </div>
              </div>

              {/* Pool info */}
              {activePool && estimatedOut > 0 && (
                <div className="bg-zinc-900 rounded-xl p-3 text-xs text-zinc-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Price impact</span>
                    <span className={priceImpact > 0.05 ? 'text-red-400' : 'text-zinc-300'}>
                      {(priceImpact * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pool fee</span>
                    <span className="text-zinc-300">{(activePool.fee * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}

              {!activePool && (
                <p className="text-xs text-amber-500/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  No pool for {fromSym}/{toSym}. Go to Pool page, create a pool, and add liquidity first.
                </p>
              )}

              {error && <p className="text-red-400 text-xs">{error}</p>}
              {msg   && <p className="text-green-400 text-xs">{msg}</p>}

              <button
                onClick={handlePoolSwap}
                disabled={!activePool || isNaN(parsedAmt) || parsedAmt <= 0}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Swap {fromSym} for {toSym}
              </button>
            </div>
          )}

          {/* Wallet Send */}
          {tab === 'send' && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <p className="text-xs text-zinc-500">
                Send UCT or tokens directly to any Sphere address. Your wallet will open to confirm.
              </p>

              {!isConnected && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-sm text-orange-400 text-center">
                  Connect your Sphere wallet (sidebar) to send tokens.
                </div>
              )}

              {isConnected && identity && (
                <div className="text-xs text-zinc-500 bg-zinc-900 rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap">
                  <span>From: <span className="text-orange-400 font-mono">{identity.nametag ? \`@\${identity.nametag}\` : identity.chainPubkey.slice(0, 20) + '...'}</span></span>
                  {nativeBalance && (
                    <span className="text-zinc-400">Available: <span className="font-mono">{nativeBalance.available} UCT</span></span>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Token &amp; Amount</label>
                <div className="flex gap-3">
                  <select
                    value={sendCoin}
                    onChange={e => setSendCoin(e.target.value)}
                    className="w-28 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500"
                  >
                    {sendCoins.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="number" min="0" step="any" value={sendAmt}
                    onChange={e => setSendAmt(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Recipient</label>
                <input
                  type="text" value={sendTo}
                  onChange={e => setSendTo(e.target.value)}
                  placeholder="@username or Sphere address"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
              {msg   && <p className="text-green-400 text-xs">{msg}</p>}

              <button
                onClick={handleWalletSend}
                disabled={!isConnected || sending}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending...' : 'Send via Sphere Wallet'}
              </button>
            </div>
          )}

          <TxLog max={6} />
        </div>
      </div>
    </div>
  );
}
`);

// ── Patch app/yield/page.tsx (remove elapsed, fix decimals) ───────────────────
{
  let y = readFileSync(join(root, 'app/yield/page.tsx'), 'utf8');
  // Remove elapsed variable declaration
  y = y.replace(/\s*const elapsed = \(\(now - yp\.stakedAt\) \/ 1000\)\.toFixed\(0\);\n?/g, '\n');
  // Remove "· {elapsed}s ago" from the LP staked line
  y = y.replace(/ ·[^{]*\{elapsed\}s ago/g, '');
  // Fix 8 decimal places → 6
  y = y.replace(/\.toFixed\(8\)/g, '.toFixed(6)');
  writeFileSync(join(root, 'app/yield/page.tsx'), y, 'utf8');
  console.log('patched app/yield/page.tsx');
}

// ── Patch app/amm/page.tsx (add faucet + import mintTokens) ──────────────────
{
  let a = readFileSync(join(root, 'app/amm/page.tsx'), 'utf8');

  // Add mintTokens to the destructured import from useWallet
  a = a.replace(
    'const {\n    tokens, pools, lpPositions,\n    initPool, depositLiquidity, withdrawLiquidity, swapInPool,\n  } = useWallet();',
    'const {\n    tokens, pools, lpPositions,\n    initPool, depositLiquidity, withdrawLiquidity, swapInPool, mintTokens,\n  } = useWallet();'
  );

  // Add Zap import to lucide imports
  a = a.replace(
    "import { Layers, Plus, Minus, ArrowDownUp, RefreshCw } from 'lucide-react';",
    "import { Layers, Plus, Minus, ArrowDownUp, RefreshCw, Zap } from 'lucide-react';"
  );

  // Add faucet card after WalletCard in the sidebar
  a = a.replace(
    '          {/* Create pool */}\n          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">',
    `          {/* Faucet */}
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
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">`
  );

  writeFileSync(join(root, 'app/amm/page.tsx'), a, 'utf8');
  console.log('patched app/amm/page.tsx');
}

console.log('\nAll done!');
