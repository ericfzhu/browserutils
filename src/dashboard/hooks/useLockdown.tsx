import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { LockdownStatus } from '../../shared/types';

interface LockdownContextValue {
  status: LockdownStatus | null;
  loading: boolean;
  refreshStatus: () => Promise<void>;
  authenticate: (password: string) => Promise<{ success: boolean; error?: string }>;
  clearSession: () => Promise<void>;
  showPasswordModal: boolean;
  setShowPasswordModal: (show: boolean) => void;
  pendingAction: (() => Promise<void>) | null;
  withLockdownCheck: (action: () => Promise<void>) => Promise<void>;
}

const LockdownContext = createContext<LockdownContextValue | null>(null);

export function useLockdown() {
  const context = useContext(LockdownContext);
  if (!context) {
    throw new Error('useLockdown must be used within a LockdownProvider');
  }
  return context;
}

interface LockdownProviderProps {
  children: ReactNode;
}

export function LockdownProvider({ children }: LockdownProviderProps) {
  const [status, setStatus] = useState<LockdownStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'LOCKDOWN_GET_STATUS' });
      setStatus(result);
    } catch (err) {
      console.error('Failed to get lockdown status:', err);
    }
  }, []);

  useEffect(() => {
    refreshStatus().finally(() => setLoading(false));
  }, [refreshStatus]);

  const authenticate = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'LOCKDOWN_AUTHENTICATE',
        payload: { password },
      });
      if (result.success) {
        await refreshStatus();
      }
      return result;
    } catch (err) {
      console.error('Failed to authenticate:', err);
      return { success: false, error: 'Authentication failed' };
    }
  }, [refreshStatus]);

  const clearSession = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'LOCKDOWN_CLEAR_SESSION' });
      await refreshStatus();
    } catch (err) {
      console.error('Failed to clear session:', err);
    }
  }, [refreshStatus]);

  const withLockdownCheck = useCallback(async (action: () => Promise<void>) => {
    // If lockdown is not enabled, just run the action
    if (!status?.lockdownEnabled) {
      await action();
      return;
    }

    // If session is valid, run the action
    if (status.sessionValid) {
      await action();
      return;
    }

    // Session not valid - show password modal and save action for later
    setPendingAction(() => action);
    setShowPasswordModal(true);
  }, [status]);

  const value: LockdownContextValue = {
    status,
    loading,
    refreshStatus,
    authenticate,
    clearSession,
    showPasswordModal,
    setShowPasswordModal,
    pendingAction,
    withLockdownCheck,
  };

  return (
    <LockdownContext.Provider value={value}>
      {children}
    </LockdownContext.Provider>
  );
}

// Helper to create the context provider element
export { LockdownContext };
