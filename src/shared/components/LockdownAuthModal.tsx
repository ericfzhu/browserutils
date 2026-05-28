import { useEffect, useRef, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isTotp ? (
              <ShieldCheck className="text-primary" />
            ) : (
              <Lock className="text-primary" />
            )}
            <DialogTitle>
              {isTotp ? 'Enter Authenticator Code' : 'Enter Master Password'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isTotp
              ? 'Lockdown mode is enabled. Enter the 6-digit code from your authenticator app to continue.'
              : 'Lockdown mode is enabled. Enter your master password to continue.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
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
            aria-invalid={!!error}
            autoFocus
          />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!credential || loading}
            >
              {loading ? 'Verifying...' : 'Unlock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
