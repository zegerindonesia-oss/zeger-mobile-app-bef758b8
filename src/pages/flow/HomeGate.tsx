import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import FlowLanding from './FlowLanding';

/** Signed-out visitors see the FlowF&B marketing site; signed-in staff get the app as before. */
export const HomeGate = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <FlowLanding />;
  return <>{children}</>;
};
