import type { Config } from '@netlify/functions';
import { db } from '../lib/store';

// Hourly: delete expired rooms (public snapshots cascade).
export default async (): Promise<void> => {
  const { error, count } = await db().from('games').delete({ count: 'exact' }).lt('expires_at', new Date().toISOString());
  if (error) console.error('cleanup failed', error);
  else console.log(`cleanup removed ${count ?? 0} games`);
};

export const config: Config = { schedule: '@hourly' };
