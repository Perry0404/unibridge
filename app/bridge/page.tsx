'use client';

import { useEffect, useState, useMemo } from 'react';
import WalletCard from '@/components/WalletCard';
import TxLog from '@/components/TxLog';
import { useSphereWallet } from '@/hooks/useSphereWallet';
import { GitMerge, ArrowRight, ChevronDown, Shield, Loader2, Wallet } from 'lucide-react';

// Supported destination networks
const DEST_NETWORKS = [
  { id: 'ethereum', label: 'Ethereum',     logo: 'Ξ', color: 'text-blue-400',    border: 'border-blue-500/30'   },
  { id: 'solana',   label: 'Solana',       logo: '◎', color: 'text-purple-400',  border: 'border-purple-500/30' },
  { id: 'bsc',      label: 'BNB Chain',    logo: '⬡', color: 'text-yellow-400',  border: 'border-yellow-500/30' },
  { id: 'polygon',  label: 'Polygon',      logo: '⬟', color: 'text-violet-400',  border: 'border-violet-500/30' },
  { id: 'avalanche',label: 'Avalanche',    logo: '▲', color: 'text-red-400',     border: 'border-red-500/30'    },
  { id: 'arbitrum', label: 'Arbitrum One', logo: '⧖', color: 'text-sky-400',     border: 'border-sky-500/30'    },
];

type BridgeStatus = 'idle' | 'pending' | 'done' | 'error';

export default function BridgePage() {
  const {
    isConnected,
    isConnecting,
    identity,
    tokenBalances,
    nativeBalance,
    connect,
    sendBridge,
  } = useSphereWallet();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Build token list from real wallet: native UCT + wallet tokens
  const tokens = useMemo(() => {
    const list: { coinId: string; label: string; balance: string }[] = [];
    if (nativeBalance) list.push({ coinId: 'UCT', label: 'UCT (Native)', balance: nativeBalance.available });
    for (const t of tokenBalances) {
      list.push({ coinId: t.coinId, label: t.symbol || t.coinId, balance: t.balance });
    }
    return list;
  }, [nativeBalance, tokenBalances]);

  const [coinId, setCoinId]     = useState('UCT');
  const [amount, setAmount]     = useState('');
  const [destNet, setDestNet]   = useState(DEST_NETWORKS[0]);
  const [destAddr, setDestAddr] = useState('');
  const [status, setStatus]     = useState<BridgeStatus>('idle');
  const [txId, setTxId]         = useState('');
  const [error, setError]       = useState('');
  const [showNetPicker, setShowNetPicker] = useState(false);

  if (!mounted) return null;

  const selectedToken = tokens.find(t => t.coinId === coinId) ?? tokens[0];
  const available     = parseFloat(selectedToken?.balance ?? '0');
  const amt           = parseFloat(amount);
  const valid         = isConnected && !isNaN(amt) && amt > 0 && amt <= available && destAddr.length > 5;

  async function handleBridge() {
    if (!valid) return;
    setError('');
    setStatus('pending');
    try {
      // Opens the Sphere wallet — user approves the real l1_send intent
      const result = await sendBridge({
        coinId: selectedToken?.coinId ?? coinId,
        amount: String(amt),
        recipient: destAddr,
      });
      setTxId(result.txId ?? '');
      setStatus('done');
      setAmount('');
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Bridge failed');
      setStatus('error');
    }
  }

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

          {/* Connect prompt */}
          {!isConnected && (
            <div className="bg-zinc-950 border border-orange-500/20 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
              <Wallet className="w-10 h-10 text-orange-500 opacity-60" />
              <div>
                <p className="text-sm font-semibold text-zinc-300 mb-1">Connect your Sphere wallet to bridge</p>
                <p className="text-xs text-zinc-500">
                  The Sphere wallet at <span className="text-orange-400">sphere.unicity.network</span> will open to approve the connection.
                </p>
              </div>
              <button
                onClick={connect}
                disabled={isConnecting}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                {isConnecting ? 'Connecting…' : 'Connect Sphere Wallet'}
              </button>
            </div>
          )}

          {/* Bridge form — only shown when connected */}
          {isConnected && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">

              {/* Identity row */}
              {identity && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  <span className="text-zinc-400 font-mono">
                    {identity.nametag ? `@${identity.nametag}` : `${identity.chainPubkey.slice(0, 20)}…`}
                  </span>
                  <span className="ml-auto text-orange-500 font-medium">Unicity Testnet</span>
                </div>
              )}

              {/* From */}
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">From · Unicity Testnet</label>
                <div className="flex gap-3">
                  {tokens.length > 0 ? (
                    <select
                      value={coinId}
                      onChange={e => setCoinId(e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 w-40"
                    >
                      {tokens.map(t => (
                        <option key={t.coinId} value={t.coinId}>{t.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-500 w-40">
                      UCT
                    </div>
                  )}
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
                  Available:{' '}
                  <span className="text-zinc-400 font-mono">{isNaN(available) ? '—' : available.toLocaleString()}</span>
                  {' '}{selectedToken?.label ?? coinId}
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
              {amt > 0 && !isNaN(amt) && (
                <div className="bg-zinc-900 rounded-xl p-4 text-xs space-y-1.5 text-zinc-500">
                  <div className="flex justify-between">
                    <span>You send</span>
                    <span className="text-zinc-300 font-mono">{amt} {selectedToken?.label ?? coinId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bridge fee (0.1%)</span>
                    <span className="text-zinc-300 font-mono">{(amt * 0.001).toFixed(6)} {selectedToken?.coinId ?? coinId}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-1.5">
                    <span>You receive on {destNet.label}</span>
                    <span className="text-orange-400 font-mono font-semibold">
                      {(amt * 0.999).toFixed(6)} w{selectedToken?.coinId ?? coinId}
                    </span>
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
                  Bridge {amount || '0'} {selectedToken?.coinId ?? coinId} → {destNet.label}
                </button>
              ) : status === 'pending' ? (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center gap-3 text-sm">
                  <Loader2 className="w-5 h-5 text-orange-500 animate-spin shrink-0" />
                  <div>
                    <p className="text-orange-400 font-medium">Waiting for wallet approval…</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Confirm the bridge in your Sphere wallet. The wallet will lock the tokens on Unicity and relay the proof to {destNet.label}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-sm">
                  <p className="text-green-400 font-semibold mb-1">Bridge initiated!</p>
                  {txId && (
                    <p className="text-zinc-500 text-xs font-mono break-all mb-2">Tx: {txId}</p>
                  )}
                  <p className="text-xs text-zinc-500 mb-3">
                    The Unicity oracle is processing the proof. Wrapped tokens will appear on {destNet.label} shortly.
                  </p>
                  <button
                    onClick={() => { setStatus('idle'); setTxId(''); setError(''); }}
                    className="text-xs text-orange-500 hover:text-orange-400"
                  >
                    Bridge another →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* How it works */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">How UniBridge works</h3>
            <div className="grid grid-cols-3 gap-4 text-xs text-center text-zinc-500">
              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-orange-500 font-mono font-semibold mb-2 text-base">1</p>
                <p className="text-zinc-300 font-medium mb-1">Connect Sphere</p>
                <p>Your real Unicity testnet wallet connects via the Sphere SDK — no browser extension needed</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-orange-500 font-mono font-semibold mb-2 text-base">2</p>
                <p className="text-zinc-300 font-medium mb-1">Approve in Wallet</p>
                <p>The Sphere wallet confirms the bridge intent — locking tokens and generating the Oracle proof</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-orange-500 font-mono font-semibold mb-2 text-base">3</p>
                <p className="text-zinc-300 font-medium mb-1">Mint on Destination</p>
                <p>A relayer submits the proof to the destination chain to mint wrapped tokens at your address</p>
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