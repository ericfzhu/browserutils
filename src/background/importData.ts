import { validateImportData } from '../shared/backup';

interface ImportStorageArea {
  get(keys?: null | string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  clear(): Promise<void>;
}

export async function replaceImportedData(
  data: unknown,
  afterWrite: () => Promise<void>,
  storage: ImportStorageArea = chrome.storage.local
): Promise<void> {
  const validationError = validateImportData(data);
  if (validationError) throw new Error(validationError);

  const durableData = { ...(data as Record<string, unknown>) };
  delete durableData.activeSessions;
  delete durableData.activeYouTubeSessions;
  const previousData = await storage.get(null);

  try {
    await storage.clear();
    await storage.set(durableData);
    const verification = await storage.get(Object.keys(durableData));
    const complete = Object.keys(durableData).every(key => verification[key] !== undefined);
    if (!complete) throw new Error('Imported data could not be verified');
    await afterWrite();
  } catch (error) {
    await storage.clear();
    await storage.set(previousData);
    throw error;
  }
}
