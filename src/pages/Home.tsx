import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center gap-8 p-4 text-center">
      <div className="anim-pop">
        <Logo size="lg" />
      </div>
      <p className="max-w-xl text-xl font-semibold sm:text-2xl">
        The couples party quiz. Four couples, one TV, eight phones — and a lot of “you said WHAT?!”
      </p>
      <div className="grid w-full max-w-md gap-4">
        <Link to="/create" className="btn btn-hot text-2xl">
          📺 Host a game
        </Link>
        <Link to="/join" className="btn btn-go text-2xl">
          📱 Join a game
        </Link>
        <Link to="/demo" className="btn btn-ghost">
          Try it on one screen (demo)
        </Link>
      </div>
      <div className="grid w-full gap-3 text-left sm:grid-cols-3">
        {[
          ['🔮', 'Guess', 'Predict what your partner will say.'],
          ['🤝', 'Match', 'Answer together and hope you agree.'],
          ['💬', 'Debate', 'Every reveal ends in a story.'],
        ].map(([e, t, b]) => (
          <div key={t} className="card bg-white p-4">
            <p className="text-3xl" aria-hidden>{e}</p>
            <p className="font-display text-xl font-extrabold">{t}</p>
            <p>{b}</p>
          </div>
        ))}
      </div>
      <p className="text-sm">No accounts. Answers are for fun, not a judgement of anyone’s relationship.</p>
    </main>
  );
}
