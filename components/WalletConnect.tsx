'use client';

import { useState, useEffect } from 'react';
import { Wallet, LogOut, ChevronDown } from 'lucide-react';

/** Simulates connecting to Unicity testnet wallet (no browser extension needed). */
const TESTNET_ADDRESSES = [
  'unicity1testnet_0x1a2b3c4d5e6f7a8b',
  'unicity1testnet_0x9c8d7e6f5a4b3c2d',
  'unicity1testnet_0xf1e2d3c4b5a69788',
];

const STORAGE_KEY = 'unicity_wallet_address';

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setAddress(saved);
  }, []);

  if (!mounted) return null;

  function connect() {
    // On real Unicity testnet this would call the wallet SDK;
    // for now we derive a deterministic address from the browser fingerprint.
    const addr = TESTNET_ADDRESSES[0];
    localStorage.setItem(STORAGE_KEY, addr);
    setAddress(addr);
    setShowMenu(false);
  }

  function disconnect() {
    localStorage.removeItem(STORAGE_KEY);
    setAddress(null);
    setShowMenu(false);
  }

  const short = address ? `${address.slice(0, 14)}…${address.slice(-6)}` : '';

  if (!address) {
    return (
      <button
        onClick={connect}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        <Wallet className="w-4 h-4" />
        Connect Unicity Wallet
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(v => !v)}
        className="flex items-center gap-2 border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        {short}
        <ChevronDown className="w-3 h-3" />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-4 z-50">
          <p className="text-xs text-zinc-500 mb-1">Connected · Unicity Testnet</p>
          <p className="text-xs font-mono text-orange-400 break-all mb-4">{address}</p>
          <div className="text-xs text-zinc-600 mb-4 space-y-1">
            <p>Network: <span className="text-zinc-400">Unicity Testnet</span></p>
            <p>Chain ID: <span className="text-zinc-400">unicity-testnet-1</span></p>
          </div>
          <button
            onClick={disconnect}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Disconnect
          </button>
        </div>
      )}

      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}
    </div>
  );
}
