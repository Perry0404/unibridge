'use client';

import { useEffect, useState } from 'react';
import { useWallet, balanceOf, MY_PUBKEY } from '@/lib/store';
import WalletCard from '@/components/WalletCard';
import TxLog from '@/components/TxLog';
import { ArrowLeftRight, Lock, Shield, CheckCircle2 } from 'lucide-react';

const SYMBOLS = ['USDT', 'BTC', 'ETH', 'SOL', 'UNI'];

export default function SwapPage() {
  const { tokens, swapOffers, tau, createSwapOffer, fulfillSwapOffer, refundSwapOffer } = useWallet();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [wantSymbol, setWantSymbol]           = useState('USDT');
  const [wantAmount, setWantAmount]           = useState('');
  const [error, setError]                     = useState('');
  const [msg, setMsg]                         = useState('');

  if (!mounted) return null;

  // Tokens available to offer (sig predicate = owned)
  const ownedTokens = Object.values(tokens).filter(t => t.predicate.type === 'sig');
  const openOffers  = Object.values(swapOffers).filter(o => o.status === 'open');
  const doneOffers  = Object.values(swapOffers).filter(o => o.status !== 'open');

  const selectedToken = tokens[selectedTokenId];

  function handleCreate() {
    setError(''); setMsg('');
    if (!selectedTokenId) return setError('Select a token to offer.');
    const amount = parseFloat(wantAmount);
    if (isNaN(amount) || amount <= 0) return setError('Enter a valid want amount.');
    if (selectedToken.symbol === wantSymbol) return setError('Cannot swap a token for itself.');
    try {
      const offer = createSwapOffer(selectedTokenId, wantSymbol, amount);
      setMsg(`Offer created! ID: ${offer.id.slice(0, 16)}…`);
      setSelectedTokenId('');
      setWantAmount('');
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  function handleFulfill(offerId: string) {
    setError(''); setMsg('');
    // Find a token we own that matches the wanted symbol
    const offer = swapOffers[offerId];
    const matchTok = Object.values(tokens).find(
      t => t.symbol === offer.wantSymbol && t.predicate.type === 'sig' && t.amount >= offer.wantAmount
    );
    if (!matchTok) return setError(`No ${offer.wantSymbol} token with enough balance.`);
    try {
      fulfillSwapOffer(offerId, matchTok.id);
      setMsg('Swap completed successfully!');
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  function handleRefund(offerId: string) {
    setError(''); setMsg('');
    try {
      refundSwapOffer(offerId);
      setMsg('Offer refunded.');
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-yellow-400" />
          Atomic Swap
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Trustless P2P exchange using HTLC predicates over the Unicity Oracle. No intermediary needed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left sidebar */}
        <div className="space-y-6">
          <WalletCard />

          {/* Protocol explanation */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-xs text-zinc-500 space-y-3">
            <h3 className="text-zinc-300 font-medium">How It Works</h3>
            {[
              ['1', 'You lock token with HTLC(hash(secret), timeout)'],
              ['2', 'Counterparty locks their token referencing your commitment'],
              ['3', 'You reveal secret, claim their token'],
              ['4', 'They use your revealed secret to claim yours'],
            ].map(([n, t]) => (
              <div key={n} className="flex gap-2">
                <span className="text-yellow-400 font-bold">{n}.</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Create offer */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-5">
              <Lock className="w-5 h-5 text-yellow-400" /> Create Swap Offer
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Token to Offer</label>
                <select
                  value={selectedTokenId}
                  onChange={e => setSelectedTokenId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yellow-400"
                >
                  <option value="">— Select token —</option>
                  {ownedTokens.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {t.symbol}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Want Symbol</label>
                  <select
                    value={wantSymbol}
                    onChange={e => setWantSymbol(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yellow-400"
                  >
                    {SYMBOLS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Want Amount</label>
                  <input
                    type="number" min="0" step="any"
                    value={wantAmount}
                    onChange={e => setWantAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
              {msg   && <p className="text-green-400 text-xs">{msg}</p>}

              <button
                onClick={handleCreate}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-3 rounded-xl transition"
              >
                Lock & Create Offer
              </button>
            </div>
          </div>

          {/* Open offers */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-green-400" /> Open Offers
            </h2>
            {openOffers.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-8">No open offers</p>
            ) : (
              <div className="space-y-3">
                {openOffers.map(o => (
                  <div key={o.id} className="bg-zinc-900 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-zinc-500">{o.id.slice(0, 20)}…</span>
                      <span className="text-xs text-yellow-400 border border-yellow-400/30 px-2 py-0.5 rounded-full">
                        Open · τ expires {o.timeout}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex-1 bg-zinc-800 rounded-lg px-3 py-2">
                        <p className="text-xs text-zinc-500 mb-0.5">Offering</p>
                        <p className="font-semibold">{o.offerAmount} {o.offerSymbol}</p>
                      </div>
                      <ArrowLeftRight className="w-4 h-4 text-zinc-600" />
                      <div className="flex-1 bg-zinc-800 rounded-lg px-3 py-2">
                        <p className="text-xs text-zinc-500 mb-0.5">Wanting</p>
                        <p className="font-semibold">{o.wantAmount} {o.wantSymbol}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFulfill(o.id)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-black font-semibold py-2 rounded-lg text-sm transition"
                      >
                        Accept & Complete
                      </button>
                      {tau >= o.timeout && (
                        <button
                          onClick={() => handleRefund(o.id)}
                          className="flex-1 border border-zinc-700 hover:bg-zinc-800 py-2 rounded-lg text-sm transition"
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed offers */}
          {doneOffers.length > 0 && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-zinc-500" /> Completed / Refunded
              </h2>
              <div className="space-y-2">
                {doneOffers.map(o => (
                  <div key={o.id} className="flex items-center justify-between text-xs text-zinc-500 bg-zinc-900 rounded-xl px-4 py-3">
                    <span>{o.offerAmount} {o.offerSymbol} ↔ {o.wantAmount} {o.wantSymbol}</span>
                    <span className={`font-medium ${o.status === 'completed' ? 'text-green-400' : 'text-zinc-400'}`}>
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <TxLog max={6} />
        </div>
      </div>
    </div>
  );
}
