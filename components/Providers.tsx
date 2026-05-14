'use client';

import { SphereWalletContext, useSphereWalletState } from '@/hooks/useSphereWallet';

function SphereWalletProvider({ children }: { children: React.ReactNode }) {
  const value = useSphereWalletState();
  return (
    <SphereWalletContext.Provider value={value}>
      {children}
    </SphereWalletContext.Provider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SphereWalletProvider>{children}</SphereWalletProvider>;
}
