import { Situation } from './types';

/** The longest text of a situation, as accepted by the server. */
export const SITUATION_TEXT_MAX_LENGTH = 40;

/** Emojis offered at once when writing a situation; the picker has all the others. */
export const SITUATION_QUICK_EMOJIS = [
  '🗓️',
  '🍽️',
  '🎧',
  '🏠',
  '🚶',
  '🌴',
  '☕',
  '🧠',
  '📞',
  '🚗',
];

export const NO_STATUS: Situation = { emoji: '', text: '' };

export const hasSituation = (situation?: Situation | null) =>
  !!situation && (!!situation.emoji || !!situation.text);

/** What is said on hover or to a screen reader: « 🎧 Focus ». */
export const describeSituation = (situation: Situation) =>
  [situation.emoji, situation.text].filter(Boolean).join(' ');
