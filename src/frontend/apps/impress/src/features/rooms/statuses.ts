import { Status } from './types';

export const STATUS_ORDER: Status[] = ['available', 'busy', 'away'];

/** The emoji that goes with each status. */
export const STATUS_EMOJI: Record<Status, string> = {
  available: '🟢',
  busy: '🔴',
  away: '🕒',
};
