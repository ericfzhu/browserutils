// One queue owns complete tracking transitions, not just individual storage writes.
// Enqueue only at event/message boundaries; helpers inside a transition must run
// directly, otherwise awaiting another queued transition would deadlock.
let pending: Promise<void> = Promise.resolve();

export function runTrackingTransition<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.then(() => undefined, () => undefined);
  return result;
}

export function trackingEvent<Args extends unknown[]>(
  name: string,
  operation: (...args: Args) => Promise<void>
): (...args: Args) => Promise<void> {
  return (...args) => runTrackingTransition(() => operation(...args)).catch(error => {
    console.error(`[Tracking] ${name} failed`, error);
  });
}
