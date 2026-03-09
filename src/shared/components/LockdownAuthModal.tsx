import { useEffect, useRef, useState } from 'react';
import { X, Lock, ShieldCheck } from 'lucide-react';

interface LockdownAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (credential: string) => Promise<{ success: boolean; error?: string }>;
  authMethod: 'password' | 'totp';
}

export default function LockdownAuthModal({ isOpen, onClose, onSubmit, authMethod }: LockdownAuthModalProps) {
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCredential('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, authMethod]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!credential || loading) return;

    setLoading(true);
    setError('');

    try {
      const result = await onSubmit(credential);
      if (result.success) {
        onClose();
      } else {
        setError(result.error || (authMethod === 'totp' ? 'Invalid code' : 'Invalid password'));
      }
    } catch {
      setError('Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  const isTotp = authMethod === 'totp';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm mx-4 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            {isTotp ? (
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isTotp ? 'Enter Authenticator Code' : 'Enter Master Password'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {isTotp
              ? 'Lockdown mode is enabled. Enter the 6-digit code from your authenticator app to continue.'
              : 'Lockdown mode is enabled. Enter your master password to continue.'}
          </p>

          <input
            ref={inputRef}
            type={isTotp ? 'text' : 'password'}
            inputMode={isTotp ? 'numeric' : 'text'}
            pattern={isTotp ? '[0-9]*' : undefined}
            maxLength={isTotp ? 6 : undefined}
            value={credential}
            onChange={(e) => {
              const value = isTotp ? e.target.value.replace(/\D+/g, '').slice(0, 6) : e.target.value;
              setCredential(value);
              setError('');
            }}
            placeholder={isTotp ? '123456' : 'Master password'}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
            autoFocus
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!credential || loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
            >
              {loading ? 'Verifying...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
