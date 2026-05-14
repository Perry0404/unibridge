'use client';

import { SphereWalletProvider } from '@/hooks/useSphereWallet';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SphereWalletProvider>{children}</SphereWalletProvider>;
}
