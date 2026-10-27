import bankJson from '../data/questionBank.json';
import { validateQuestions } from './questionSchema';
import type { Question } from './types';

function load(items: unknown[]): Question[] {
  const { valid, rejected } = validateQuestions(items, 'bank');
  if (rejected.length) console.warn('Question bank entries rejected', rejected);
  return valid;
}

export const BANK: Question[] = load(bankJson.game);
export const BANK_TIEBREAK: Question[] = load(bankJson.tiebreak);
export const ALL_BANK: Question[] = [...BANK, ...BANK_TIEBREAK];
