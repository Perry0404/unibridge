import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

let a = readFileSync(join(root, 'app/amm/page.tsx'), 'utf8');

// Add mintTokens to destructure
a = a.replace(
  'tokens, pools, lpPositions,\r\n    initPool, depositLiquidity, withdrawLiquidity, swapInPool,',
  'tokens, pools, lpPositions,\r\n    initPool, depositLiquidity, withdrawLiquidity, swapInPool, mintTokens,'
);

// Also try LF version
a = a.replace(
  'tokens, pools, lpPositions,\n    initPool, depositLiquidity, withdrawLiquidity, swapInPool,',
  'tokens, pools, lpPositions,\n    initPool, depositLiquidity, withdrawLiquidity, swapInPool, mintTokens,'
);

// Add Zap to lucide imports (CRLF)
a = a.replace(
  "import { Layers, Plus, Minus, ArrowDownUp, RefreshCw } from 'lucide-react';",
  "import { Layers, Plus, Minus, ArrowDownUp, RefreshCw, Zap } from 'lucide-react';"
);

// Find the WalletCard in sidebar and inject faucet after it
// The pattern: </WalletCard />\r\n\r\n          {/* Create pool */}
const crlfAnchor = "          {/* Create pool */}\r\n          <div";
const lfAnchor   = "          {/* Create pool */}\n          <div";

const faucetBlock = [
  '          {/* Faucet */}',
  '          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">',
  '            <p className="text-xs text-zinc-500 mb-3">Need testnet tokens to add liquidity?</p>',
  '            <button',
  "              onClick={() => { ['USDT','ETH','BTC','SOL','UNI'].forEach(s => mintTokens(s, ({USDT:1000,ETH:1,BTC:0.05,SOL:10,UNI:100})[s])); setMsg('Testnet tokens added!'); }}",
  '              className="w-full flex items-center justify-center gap-2 border border-orange-500/40 hover:bg-orange-500/10 text-orange-400 text-sm font-medium py-2.5 rounded-xl transition-colors"',
  '            >',
  '              <Zap className="w-4 h-4" /> Get Testnet Tokens',
  '            </button>',
  '          </div>',
  '',
];

if (a.includes(crlfAnchor)) {
  const insert = faucetBlock.join('\r\n') + '\r\n' + crlfAnchor;
  a = a.replace(crlfAnchor, insert);
  console.log('Patched with CRLF');
} else if (a.includes(lfAnchor)) {
  const insert = faucetBlock.join('\n') + '\n' + lfAnchor;
  a = a.replace(lfAnchor, insert);
  console.log('Patched with LF');
} else {
  console.error('ERROR: anchor not found!');
  // Show what the file looks like around "Create pool"
  const idx = a.indexOf('Create pool');
  console.log('Context around "Create pool":', JSON.stringify(a.substring(idx - 20, idx + 60)));
}

writeFileSync(join(root, 'app/amm/page.tsx'), a, 'utf8');
console.log('app/amm/page.tsx written');
