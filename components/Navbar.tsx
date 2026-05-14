'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield, BarChart2, ArrowLeftRight, Layers, TrendingUp, Landmark, GitMerge,
} from 'lucide-react';
import WalletConnect from './WalletConnect';

const NAV_ITEMS = [
  { href: '/',         label: 'Dashboard', icon: BarChart2 },
  { href: '/bridge',   label: 'Bridge',    icon: GitMerge },
  { href: '/swap',     label: 'Swap',      icon: ArrowLeftRight },
  { href: '/amm',      label: 'Pools',     icon: Layers },
  { href: '/lending',  label: 'Lending',   icon: Landmark },
  { href: '/yield',    label: 'Yield',     icon: TrendingUp },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-black/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Shield className="w-6 h-6 text-orange-500" />
          <span>Uni<span className="text-orange-500">Bridge</span></span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-orange-500 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500 border border-zinc-800 rounded-lg px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Oracle · Testnet
          </div>
          <WalletConnect />
        </div>
      </div>
    </nav>
  );
}
