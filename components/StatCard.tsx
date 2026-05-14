interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'yellow' | 'green' | 'blue' | 'purple';
}

const ACCENT_MAP = {
  yellow: 'text-yellow-400',
  green:  'text-green-400',
  blue:   'text-blue-400',
  purple: 'text-purple-400',
};

export default function StatCard({ label, value, sub, accent = 'yellow' }: StatCardProps) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${ACCENT_MAP[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}
