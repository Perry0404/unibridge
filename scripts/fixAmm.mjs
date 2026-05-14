import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

let a = readFileSync(join(root, 'app/amm/page.tsx'), 'utf8');

const old = `['USDT','ETH','BTC','SOL','UNI'].forEach(s => mintTokens(s, ({USDT:1000,ETH:1,BTC:0.05,SOL:10,UNI:100})[s]))`;
const fix = `['USDT','ETH','BTC','SOL','UNI'].forEach(s => mintTokens(s, ({USDT:1000,ETH:1,BTC:0.05,SOL:10,UNI:100} as Record<string,number>)[s]))`;

if (a.includes(old)) {
  a = a.replace(old, fix);
  console.log('fixed type error');
} else {
  console.error('pattern not found');
}

writeFileSync(join(root, 'app/amm/page.tsx'), a, 'utf8');
