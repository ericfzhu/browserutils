import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { normalizeExcludedDomains, validateHistoryRange } from '../../shared/trackingPrivacy';
import { assertRuntimeMutationSucceeded } from '../../shared/runtimeMessages';
import type { Settings } from '../../shared/types';
import { useLockdown } from '../hooks/useLockdown';

export default function TrackingPrivacySettings({ settings, onSave }: {
  settings: Settings; onSave: (patch: Partial<Settings>) => Promise<void>;
}) {
  const { withLockdownCheck } = useLockdown();
  const [domains, setDomains] = useState((settings.excludedDomains ?? []).join('\n'));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  async function saveExclusions() {
    setBusy(true); setError(''); setFeedback('');
    try {
      const excludedDomains = normalizeExcludedDomains(domains.split('\n'));
      await onSave({ excludedDomains });
      setDomains(excludedDomains.join('\n'));
      setFeedback('Tracking exclusions saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save exclusions.'); }
    finally { setBusy(false); }
  }
  async function deleteHistory() {
    setBusy(true); setError(''); setFeedback('');
    try {
      await withLockdownCheck(async () => {
        const result = await chrome.runtime.sendMessage({ type: 'DELETE_HISTORY_RANGE', payload: { startDate, endDate } });
        assertRuntimeMutationSucceeded(result, 'Could not delete history.');
        setFeedback(`Deleted browsing and YouTube history for ${result.deletedDays} recorded day(s).`);
        setConfirm(false);
      });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete history.'); }
    finally { setBusy(false); }
  }
  return <section className="mb-6 space-y-5 rounded-lg border border-border bg-card p-6">
    <div><h2 className="text-lg font-semibold">Tracking privacy</h2><p className="mt-1 text-sm text-muted-foreground">Pause all browsing tracking with the tracking toggle above, or exclude specific websites here.</p></div>
    <div className="space-y-2">
      <Label htmlFor="excluded-domains">Excluded domains</Label>
      <Textarea id="excluded-domains" rows={3} value={domains} onChange={event => setDomains(event.target.value)} placeholder={'example.com\nprivate.example.org'}/>
      <p className="text-sm text-muted-foreground">One domain per line. Includes its subdomains. Stops future browsing and YouTube tracking on matching sites; blocking rules and existing history remain.</p>
      <Button onClick={() => void saveExclusions()} disabled={busy}>Save exclusions</Button>
    </div>
    <div className="space-y-3 border-t border-border pt-5">
      <h3 className="font-medium">Delete history by date</h3>
      <p className="text-sm text-muted-foreground">Deletes browsing, YouTube and blocked-attempt history for the selected local dates, inclusive. Focus-session history and blocking settings remain. Tracking resumes from now if enabled.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="history-start">Start date</Label><Input id="history-start" type="date" value={startDate} onChange={event => setStartDate(event.target.value)}/></div>
        <div className="space-y-2"><Label htmlFor="history-end">End date</Label><Input id="history-end" type="date" value={endDate} onChange={event => setEndDate(event.target.value)}/></div>
      </div>
      <Button variant="destructive" disabled={busy || !startDate || !endDate} onClick={() => {
        try { validateHistoryRange(startDate, endDate); setError(''); setConfirm(true); }
        catch (err) { setError((err as Error).message); }
      }}>Delete selected history</Button>
    </div>
    {feedback && <p role="status" className="text-sm text-success">{feedback}</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <Dialog open={confirm} onOpenChange={open => { if (!busy) setConfirm(open); }}>
      <DialogContent><DialogTitle>Delete selected history?</DialogTitle><DialogDescription>Remove browsing and YouTube history from {startDate} through {endDate}. This cannot be undone. Deleting today’s history also resets recorded usage toward today’s daily limits.</DialogDescription>
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => void deleteHistory()}>{busy ? 'Deleting…' : 'Delete history'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
