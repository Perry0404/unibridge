'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/store';
import WalletCard from '@/components/WalletCard';
import TxLog from '@/components/TxLog';
import { TrendingUp, Leaf, Gift } from 'lucide-react';
import { pendingRewards } from '@/lib/defi/yield';

export default function YieldPage() {
  const { lpPositions, yieldPositions, pools, stake, unstake, claim } = useWallet();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Refresh pending rewards every second
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [error, setError] = useState('');
  const [msg, setMsg]     = useState('');

  if (!mounted) return null;

  const lpList    = Object.values(lpPositions);
  const yieldList = Object.values(yieldPositions);

  function handleStake(lpId: string) {
    setError(''); setMsg('');
    try { stake(lpId); setMsg('LP staked!'); }
    catch (e: unknown) { setError((e as Error).message); }
  }
  function handleUnstake(ypId: string) {
    setError(''); setMsg('');
    try { unstake(ypId); setMsg('Unstaked and claimed rewards!'); }
    catch (e: unknown) { setError((e as Error).message); }
  }
  function handleClaim(ypId: string) {
    setError(''); setMsg('');
    try { claim(ypId); setMsg('Rewards claimed!'); }
    catch (e: unknown) { setError((e as Error).message); }
  }

  // Total pending rewards across all positions
  const totalPending = yieldList.reduce((s, yp) => s + pendingRewards(yp, now), 0);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-purple-400" /> Yield Farming
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Stake LP tokens to earn UNI rewards. Rewards accrue per-second.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <WalletCard />

          {/* Yield stats */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-medium">Yield Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Active stakes</span>
                <span className="text-white font-semibold">{yieldList.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Pending rewards</span>
                <span className="text-purple-400 font-semibold font-mono">
                  {totalPending.toFixed(6)} UNI
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Base reward rate</span>
                <span className="text-white">0.0000001 UNI/LP/s</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Stakeable LP positions */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Leaf className="w-5 h-5 text-green-400" /> Available LP to Stake
            </h2>

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            {msg   && <p className="text-green-400 text-xs mb-3">{msg}</p>}

            {lpList.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-8">
                No LP positions. Add liquidity to an AMM pool first.
              </p>
            ) : (
              <div className="space-y-3">
                {lpList.map(lp => {
                  const pool = pools[lp.poolId];
                  return (
                    <div key={lp.id} className="bg-zinc-900 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          {pool ? `${pool.symbolA}/${pool.symbolB}` : 'LP'} Pool
                        </p>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">
                          {lp.lpAmount.toFixed(6)} LP tokens
                        </p>
                      </div>
                      <button
                        onClick={() => handleStake(lp.id)}
                        className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
                      >
                        Stake
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active staking positions */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-yellow-400" /> Active Staking Positions
            </h2>
            {yieldList.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-8">No active stakes</p>
            ) : (
              <div className="space-y-4">
                {yieldList.map(yp => {
                  const pool = pools[yp.poolId];
                  const pending = pendingRewards(yp, now);

                  return (
                    <div key={yp.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {pool ? `${pool.symbolA}/${pool.symbolB}` : 'LP'} Pool
                          </p>
                          <p className="text-xs text-zinc-500 font-mono">{yp.stakedLp.toFixed(6)} LP staked</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zinc-500">Pending</p>
                          <p className="text-purple-400 font-mono text-sm font-bold">
                            {pending.toFixed(6)} {yp.rewardSymbol}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleClaim(yp.id)}
                          className="flex-1 border border-purple-500/50 hover:bg-purple-500/10 text-purple-400 font-semibold py-2 rounded-xl text-sm transition"
                        >
                          Claim Rewards
                        </button>
                        <button
                          onClick={() => handleUnstake(yp.id)}
                          className="flex-1 border border-zinc-700 hover:bg-zinc-800 py-2 rounded-xl text-sm transition"
                        >
                          Unstake + Claim All
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
