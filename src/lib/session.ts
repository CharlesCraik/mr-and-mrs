const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export function getItem<T>(key: string): T | null {
  return safe(() => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }, null);
}

export function setItem(key: string, value: unknown): void {
  safe(() => localStorage.setItem(key, JSON.stringify(value)), undefined);
}

export function removeItem(key: string): void {
  safe(() => localStorage.removeItem(key), undefined);
}

export const hostKey = (gameId: string) => `mm:host:${gameId}`;
export const playerKey = (gameId: string) => `mm:player:${gameId}`;

export interface PlayerSession {
  playerId: string;
  playerToken: string;
}
