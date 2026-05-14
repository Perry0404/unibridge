'use client';

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
            <span className={`text-xs font-bold font-mono w-16 flex-shrink-0 mt-0.5 ${TX_COLORS[t.type] ?? 'text-zinc-400'}`}>
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
