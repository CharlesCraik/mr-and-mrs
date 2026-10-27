import type { ReactNode } from 'react';
import type { Couple, CoupleColour, CoupleResult, PublicSnapshot } from '../shared/types';

export const BG: Record<CoupleColour, string> = {
  tomato: 'bg-tomato',
  sunflower: 'bg-sunflower',
  teal: 'bg-teal',
  grape: 'bg-grape',
};

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <div className={`inline-flex items-center gap-2 font-display font-extrabold ${big ? 'text-5xl sm:text-7xl' : 'text-2xl'}`}>
      <span className={`card-flat bg-tomato px-3 ${big ? 'py-1' : ''} -rotate-3`}>Mr</span>
      <span className="text-ink">&amp;</span>
      <span className={`card-flat bg-teal px-3 ${big ? 'py-1' : ''} rotate-2`}>Mrs</span>
    </div>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md anim-pop">
      <div className="card bg-sunflower px-5 py-3 text-center font-bold">{msg}</div>
    </div>
  );
}

export function Dots() {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="dot h-2.5 w-2.5 rounded-full bg-ink" style={{ animationDelay: `${i * 0.16}s` }} />
      ))}
    </span>
  );
}

export function Confetti() {
  const colours = ['bg-tomato', 'bg-sunflower', 'bg-teal', 'bg-grape', 'bg-white'];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className={`confetti-piece ${colours[i % colours.length]}`}
          style={{ left: `${(i * 53) % 100}%`, top: -10, animationDelay: `${(i % 6) * 0.05}s` }}
        />
      ))}
    </div>
  );
}

const RESULT_UI: Record<CoupleResult['status'], { label: string; icon: string; cls: string }> = {
  match: { label: 'MATCH!', icon: '✓', cls: 'bg-mint' },
  no_match: { label: 'No match', icon: '✗', cls: 'bg-white' },
  agreed_wrong: { label: 'Agreed... wrongly', icon: '✗', cls: 'bg-white' },
  needs_confirm: { label: 'Close enough?', icon: '?', cls: 'bg-sunflower' },
  skipped: { label: 'Skipped', icon: '–', cls: 'bg-white' },
  no_score: { label: 'For fun', icon: '★', cls: 'bg-white' },
};

export function ResultBadge({ result, big }: { result: CoupleResult; big?: boolean }) {
  const ui = RESULT_UI[result.status];
  return (
    <span className={`chip ${ui.cls} ${big ? 'px-4 py-1.5 text-xl' : ''}`}>
      <span aria-hidden className="font-display">{ui.icon}</span>
      {ui.label}
      {result.points > 0 && <span className="font-display">+{result.points}</span>}
    </span>
  );
}

export function nameOf(s: PublicSnapshot, playerId: string) {
  return s.players.find((p) => p.id === playerId)?.name ?? '?';
}

export function coupleOf(s: PublicSnapshot, playerId: string): Couple | undefined {
  return s.couples.find((c) => c.playerIds.includes(playerId));
}

/** Human-readable answer ("who" answers are player ids). */
export function answerLabel(s: PublicSnapshot, value: string | null | undefined): string {
  if (value === null || value === undefined) return 'Skipped';
  if (s.question?.answerFormat === 'who') return nameOf(s, value);
  if (s.question?.answerFormat === 'scale_1_5') return `${value} / 5`;
  return value;
}

export function ScoreStrip({ s }: { s: PublicSnapshot }) {
  return (
    <div className="flex flex-wrap gap-2">
      {s.couples.map((c) => (
        <span key={c.id} className={`chip ${BG[c.colour]} text-base`}>
          {c.name}
          <span className="rounded-full bg-ink px-2 font-display text-cream">{s.scores[c.id]}</span>
        </span>
      ))}
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-4" onClick={onClose} role="dialog" aria-modal>
      <div className="card w-full max-w-md bg-cream p-6 anim-pop" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, body, yes, onYes, onClose }: { title: string; body: string; yes: string; onYes: () => void; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2 className="text-3xl font-extrabold">{title}</h2>
      <p className="mt-2 text-lg">{body}</p>
      <div className="mt-6 flex gap-3">
        <button className="btn btn-plain flex-1" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-hot flex-1"
          onClick={() => {
            onYes();
            onClose();
          }}
        >
          {yes}
        </button>
      </div>
    </Modal>
  );
}
