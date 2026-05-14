'use client';

import { useWallet } from '@/lib/store';
import { TxRecord } from '@/lib/unicity/types';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

const TX_ICONS: Record<TxRecord['type'], string> = {
  mint:           '🪙',
  transfer:       '📤',
  split:          '✂️',
  merge:          '🔗',
  swap_initiate:  '🔄',
  swap_complete:  '🎉',
  swap_refund:    '↩️',
  amm_add:        '➕',
  amm_remove:     '➖',
  amm_swap:       '⇄',
  lend_open:      '🏦',
  lend_repay:     '💳',
  lend_liquidate: '⚡',
  yield_stake:    '🌱',
  yield_unstake:  '🌾',
  yield_claim:    '🎁',
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
            <span className="text-lg leading-none mt-0.5">{TX_ICONS[t.type] ?? '📋'}</span>
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
