'use client';

import { useEffect, useState, useMemo } from 'react';
import WalletCard from '@/components/WalletCard';
import { useSphereWallet } from '@/hooks/useSphereWallet';
import {
  GitMerge, ArrowRight, ChevronDown, Shield, Loader2, Wallet,
  History, CheckCircle2, Clock, XCircle,
} from 'lucide-react';

const DEST_NETWORKS = [
  { id: 'ethereum',  label: 'Ethereum',     symbol: 'ETH',  logo: 'E',  color: 'text-blue-400',   border: 'border-blue-500/30'   },
  { id: 'solana',    label: 'Solana',        symbol: 'SOL',  logo: 'S',  color: 'text-purple-400', border: 'border-purple-500/30' },
  { id: 'bsc',       label: 'BNB Chain',     symbol: 'BNB',  logo: 'B',  color: 'text-yellow-400', border: 'border-yellow-500/30' },
  { id: 'polygon',   label: 'Polygon',       symbol: 'MATIC',logo: 'P',  color: 'text-violet-400', border: 'border-violet-500/30' },
  { id: 'avalanche', label: 'Avalanche',     symbol: 'AVAX', logo: 'A',  color: 'text-red-400',    border: 'border-red-500/30'    },
  { id: 'arbitrum',  label: 'Arbitrum One',  symbol: 'ARB',  logo: 'Ar', color: 'text-sky-400',    border: 'border-sky-500/30'    },
];

type BridgeStatus = 'idle' | 'pending' | 'done' | 'error';

function StatusIcon({ status }: { status?: string }) {
  if (!status) return <Clock className="w-4 h-4 text-zinc-500" />;
  if (status === 'confirmed' || status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (status === 'failed' || status === 'error') return <XCircle className="w-4 h-4 text-red-400" />;
  return <Clock className="w-4 h-4 text-amber-400 animate-pulse" />;
}

export default function BridgePage() {
  const {
    isConnected, isConnecting, isLocked,
    identity, tokenBalances, nativeBalance,
    history, l1History,
    connect, fetchHistory,
    sendBridge,
  } = useSphereWallet();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [view, setView] = useState<'bridge' | 'history'>('bridge');

  const tokens = useMemo(() => {
    const list: { coinId: string; label: string; balance: string }[] = [];
    if (nativeBalance) list.push({ coinId: 'UCT', label: 'UCT (Native)', balance: nativeBalance.available });
    for (const t of tokenBalances) list.push({ coinId: t.coinId, label: t.symbol || t.coinId, balance: t.balance });
    return list;
  }, [nativeBalance, tokenBalances]);

  const [coinId, setCoinId]       = useState('UCT');
  const [amount, setAmount]       = useState('');
  const [destNet, setDestNet]     = useState(DEST_NETWORKS[0]);
  const [destAddr, setDestAddr]   = useState('');
  const [status, setStatus]       = useState<BridgeStatus>('idle');
  const [txId, setTxId]           = useState('');
  const [error, setError]         = useState('');
  const [showNetPicker, setShowNetPicker] = useState(false);
  const [histLoading, setHistLoading] = useState(false);

  if (!mounted) return null;

  const selectedToken = tokens.find(t => t.coinId === coinId) ?? tokens[0];
  const available     = parseFloat(selectedToken?.balance ?? '0');
  const amt           = parseFloat(amount);
  const canBridge     = isConnected && !isLocked && !isNaN(amt) && amt > 0 && amt <= available && destAddr.length > 5;

  async function handleBridge() {
    if (!canBridge) return;
    setError(''); setStatus('pending');
    try {
      const result = await sendBridge({ coinId: selectedToken?.coinId ?? coinId, amount: String(amt), recipient: destAddr });
      setTxId(result.txId ?? '');
      setStatus('done');
      setAmount('');
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Bridge failed');
      setStatus('error');
    }
  }

  async function handleLoadHistory() {
    setHistLoading(true);
    await fetchHistory();
    setHistLoading(false);
  }

  // Merge both history arrays and sort by timestamp
  const allHistory = useMemo(() => {
    const merged = [
      ...l1History.map(h => ({ ...h, _src: 'l1' })),
      ...history.map(h => ({ ...h, _src: 'sphere' })),
    ];
    merged.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return merged;
  }, [history, l1History]);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GitMerge className="w-8 h-8 text-orange-500" /> Bridge
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Lock tokens on Unicity · Mint wrapped assets on destination chains
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
          {(['bridge', 'history'] as const).map(v => (
            <button
              key={v}
              onClick={() => { setView(v); if (v === 'history') handleLoadHistory(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === v ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v === 'bridge' ? <GitMerge className="w-4 h-4" /> : <History className="w-4 h-4" />}
              {v === 'bridge' ? 'Bridge' : 'History'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main panel */}
        <div className="lg:col-span-2 space-y-4">

          {/* ── BRIDGE VIEW ── */}
          {view === 'bridge' && (
            <>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 text-xs text-zinc-500">
                <div className="flex items-center gap-2 text-orange-400 font-medium shrink-0">
                  <Shield className="w-4 h-4" /> Unicity Testnet
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-700 shrink-0" />
                <p>Tokens are locked by a Unicity predicate + Oracle proof, then a relayer mints wrapped tokens on the destination chain.</p>
              </div>

              {/* Connect prompt */}
              {!isConnected && (
                <div className="bg-zinc-950 border border-orange-500/20 rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
                  <Wallet className="w-10 h-10 text-orange-500 opacity-60" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-300 mb-1">Connect your Sphere wallet to bridge</p>
                    <p className="text-xs text-zinc-500">
                      Opens <span className="text-orange-400">sphere.unicity.network</span> to approve the connection.
                    </p>
                  </div>
                  <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
                  >
                    {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    {isConnecting ? 'Connecting...' : 'Connect Sphere Wallet'}
                  </button>
                </div>
              )}

              {/* Bridge form */}
              {isConnected && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
                  {/* Identity row */}
                  {identity && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900 rounded-xl px-3 py-2">
                      <span className={`w-2 h-2 rounded-full ${isLocked ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`} />
                      <span className="text-zinc-300 font-mono">
                        {identity.nametag ? `@${identity.nametag}` : `${identity.chainPubkey.slice(0, 20)}...`}
                      </span>
                      <span className="ml-auto text-orange-500 font-medium">Unicity Testnet</span>
                    </div>
                  )}

                  {isLocked && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400 flex items-center justify-between gap-3">
                      <span>Wallet is locked — reconnect to approve the bridge transaction.</span>
                      <button onClick={connect} disabled={isConnecting}
                        className="shrink-0 bg-amber-500 hover:bg-amber-600 text-black font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 disabled:opacity-50">
                        {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {isConnecting ? 'Reconnecting...' : 'Unlock'}
                      </button>
                    </div>
                  )}

                  {/* From token */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-xs text-zinc-500">From · Unicity Testnet</label>
                      {selectedToken && (
                        <span className="text-xs text-zinc-500">
                          Available: <span className="text-zinc-300 font-mono">{isNaN(available) ? '—' : available.toLocaleString()}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {tokens.length > 0 ? (
                        <select
                          value={coinId}
                          onChange={e => setCoinId(e.target.value)}
                          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 w-44"
                        >
                          {tokens.map(t => <option key={t.coinId} value={t.coinId}>{t.label}</option>)}
                        </select>
                      ) : (
                        <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-500 w-44">UCT</div>
                      )}
                      <div className="flex-1 relative">
                        <input
                          type="number" placeholder="0.00" min={0} value={amount}
                          onChange={e => setAmount(e.target.value)}
                          disabled={isLocked}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 font-mono disabled:opacity-40"
                        />
                        <button
                          onClick={() => setAmount(String(available))}
                          disabled={isLocked}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-500 hover:text-orange-400 font-semibold disabled:opacity-40"
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 border-t border-zinc-800" />
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-full p-2">
                      <ArrowRight className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="flex-1 border-t border-zinc-800" />
                  </div>

                  {/* Destination */}
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">To · Destination Network</label>
                    <div className="relative mb-3">
                      <button
                        onClick={() => setShowNetPicker(v => !v)}
                        disabled={isLocked}
                        className={`w-full flex items-center justify-between bg-zinc-900 border ${destNet.border} rounded-xl px-4 py-3 text-sm transition-colors hover:border-zinc-600 disabled:opacity-40`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`font-mono font-bold text-sm ${destNet.color}`}>{destNet.logo}</span>
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
                              <span className={`font-mono font-bold text-sm ${net.color}`}>{net.logo}</span>
                              <span className={`font-medium ${net.color}`}>{net.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={`Destination ${destNet.label} address (0x...)`}
                      value={destAddr}
                      onChange={e => setDestAddr(e.target.value)}
                      disabled={isLocked}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 font-mono disabled:opacity-40"
                    />
                  </div>

                  {/* Fee summary */}
                  {amt > 0 && !isNaN(amt) && (
                    <div className="bg-zinc-900 rounded-xl p-4 text-xs space-y-1.5 text-zinc-500">
                      <div className="flex justify-between">
                        <span>You send</span>
                        <span className="text-zinc-300 font-mono">{amt} {selectedToken?.coinId ?? coinId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bridge fee (0.1%)</span>
                        <span className="text-zinc-300 font-mono">{(amt * 0.001).toFixed(6)} {selectedToken?.coinId ?? coinId}</span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-800 pt-1.5">
                        <span>You receive on {destNet.label}</span>
                        <span className="text-orange-400 font-mono font-semibold">
                          ~{(amt * 0.999).toFixed(6)} w{selectedToken?.coinId ?? coinId}
                        </span>
                      </div>
                    </div>
                  )}

                  {error && <p className="text-red-400 text-xs">{error}</p>}

                  {/* Bridge button */}
                  {(status === 'idle' || status === 'error') && (
                    <button
                      onClick={handleBridge}
                      disabled={!canBridge}
                      className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <GitMerge className="w-4 h-4" />
                      Bridge {amount || '0'} {selectedToken?.coinId ?? coinId} to {destNet.label}
                    </button>
                  )}

                  {status === 'pending' && (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-orange-500 animate-spin shrink-0" />
                      <div>
                        <p className="text-orange-400 font-medium text-sm">Waiting for wallet approval...</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Your Sphere wallet will open. Confirm the bridge to lock tokens and generate the proof.
                        </p>
                      </div>
                    </div>
                  )}

                  {status === 'done' && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <p className="text-green-400 font-semibold text-sm">Bridge submitted!</p>
                      </div>
                      {txId && <p className="text-zinc-500 text-xs font-mono break-all mb-2">Tx: {txId}</p>}
                      <p className="text-xs text-zinc-500 mb-3">
                        The Unicity oracle is processing the proof. Wrapped tokens will appear on {destNet.label} once the relayer confirms.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setStatus('idle'); setTxId(''); setError(''); }}
                          className="text-xs text-orange-500 hover:text-orange-400"
                        >
                          Bridge another
                        </button>
                        <button
                          onClick={() => { setView('history'); handleLoadHistory(); }}
                          className="text-xs text-zinc-500 hover:text-zinc-400"
                        >
                          View history
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* How it works */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">How UniBridge works</h3>
                <div className="grid grid-cols-3 gap-4 text-xs text-center text-zinc-500">
                  {[
                    ['1', 'Connect Sphere', 'Your real Unicity testnet wallet connects via the Sphere SDK — no browser extension needed.'],
                    ['2', 'Approve in Wallet', 'The Sphere wallet confirms the bridge intent — locking tokens and generating the Oracle proof.'],
                    ['3', 'Mint on Destination', 'A relayer submits the proof to the destination chain to mint wrapped tokens at your address.'],
                  ].map(([n, title, desc]) => (
                    <div key={n} className="bg-zinc-900 rounded-xl p-4">
                      <p className="text-orange-500 font-mono font-semibold mb-2 text-base">{n}</p>
                      <p className="text-zinc-300 font-medium mb-1">{title}</p>
                      <p>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── HISTORY VIEW ── */}
          {view === 'history' && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">Bridge &amp; Transfer History</h2>
                <button
                  onClick={handleLoadHistory}
                  disabled={histLoading || !isConnected}
                  className="flex items-center gap-2 text-xs text-orange-500 hover:text-orange-400 disabled:opacity-40 transition-colors"
                >
                  {histLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
                  {histLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {!isConnected && (
                <div className="text-center py-12">
                  <Wallet className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500">Connect your wallet to see bridge history.</p>
                </div>
              )}

              {isConnected && !histLoading && allHistory.length === 0 && (
                <div className="text-center py-12">
                  <History className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500">No bridge history yet.</p>
                  <p className="text-xs text-zinc-600 mt-1">Your l1_send and transfer transactions will appear here.</p>
                </div>
              )}

              {histLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                </div>
              )}

              {!histLoading && allHistory.length > 0 && (
                <div className="space-y-3">
                  {allHistory.map((item, i) => (
                    <div key={item.id ?? i} className="bg-zinc-900 rounded-xl p-4 flex items-start gap-3">
                      <StatusIcon status={item.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold uppercase ${item._src === 'l1' ? 'text-orange-400' : 'text-blue-400'}`}>
                            {item._src === 'l1' ? 'L1 BRIDGE' : 'TRANSFER'}
                          </span>
                          {item.type && <span className="text-xs text-zinc-600">{item.type}</span>}
                        </div>
                        {item.amount && item.symbol && (
                          <p className="text-sm font-mono font-semibold text-white">
                            {item.amount} {item.symbol}
                          </p>
                        )}
                        {item.recipient && (
                          <p className="text-xs text-zinc-500 font-mono truncate mt-0.5">
                            To: {item.recipient.slice(0, 20)}...
                          </p>
                        )}
                        {item.network && (
                          <p className="text-xs text-zinc-600 mt-0.5">Network: {item.network}</p>
                        )}
                        <p className="text-xs text-zinc-600 mt-1">
                          {item.timestamp ? new Date(item.timestamp * 1000).toLocaleString() : 'Pending'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.status === 'confirmed' || item.status === 'success'
                            ? 'bg-green-500/10 text-green-400'
                            : item.status === 'failed' || item.status === 'error'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {item.status ?? 'pending'}
                        </span>
                        {item.txId && (
                          <span className="text-xs text-zinc-600 font-mono">
                            {item.txId.slice(0, 10)}...
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <WalletCard />
        </div>
      </div>
    </div>
  );
}
