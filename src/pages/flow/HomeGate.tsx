import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import FlowLanding from './FlowLanding';
import FlowWorkspace from './FlowWorkspace';

/** Signed-out visitors see the FlowF&B marketing site; self-serve trial tenants get their workspace; staff get the app. */
export const HomeGate = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <FlowLanding />;
  const meta = (user.user_metadata || {}) as Record<string, any>;
  if (meta.flow_tenant) return meta.onboarded ? <FlowWorkspace /> : <Navigate to="/daftar" replace />;
  return <>{children}</>;
};
