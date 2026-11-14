// A small motivational quote on the Gym's Today card, a new one each day. Martin chose the kinds he likes
// on 2026-11-14 (examples 1, 3, 4, 5 and 6 of 6): calm discipline, fighters, sayings from the Fighter's
// world, dry humour and small steps. Not the blunt "no excuses" kind. Real quotes carry the name they are
// known by; the world's sayings never name a story character (no spoilers).

export const QUOTES = [
  // calm discipline
  { text: 'Discipline is choosing what you want most over what you want now.' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', by: 'Will Durant' },
  { text: 'Motivation gets you started. Habit keeps you going.', by: 'Jim Ryun' },
  { text: 'No man is free who is not master of himself.', by: 'Epictetus' },
  { text: 'Show up on the days you do not feel like it. Those are the ones that count.' },
  // fighters
  { text: 'Everyone has a plan until they get punched in the mouth.', by: 'Mike Tyson' },
  { text: 'I hated every minute of training, but I said, don’t quit. Suffer now and live the rest of your life as a champion.', by: 'Muhammad Ali' },
  { text: 'It ain’t about how hard you hit. It’s about how hard you can get hit and keep moving forward.', by: 'Rocky Balboa' },
  { text: 'I fear not the man who has practised 10,000 kicks once, but the man who has practised one kick 10,000 times.', by: 'Bruce Lee' },
  // sayings from the Fighter's world
  { text: 'A hunter who skips training becomes the bounty.', by: 'Lilyhollow saying' },
  { text: 'Every legend starts on the boardwalk.', by: 'Guild saying' },
  { text: 'Fists are slow, until they aren’t.', by: 'Bogbrawler saying' },
  { text: 'The log bag does not care how tired you are.', by: 'Bogbrawler saying' },
  { text: 'A poster is just paper until someone answers it.', by: 'Guild saying' },
  // dry humour
  { text: 'Your muscles don’t know it’s Sunday.' },
  { text: 'The dumbbells won’t lift themselves. I checked.' },
  { text: 'Sore today, strong tomorrow, insufferable about it by Thursday.' },
  { text: 'The sofa will still be there after. It always is.' },
  // small steps
  { text: 'One more rep is still progress.' },
  { text: 'Today’s warm-up was once your hardest set.' },
  { text: 'Small plates add up.' },
  { text: 'Progress is quiet. Keep going anyway.' },
];

/** The quote for a calendar day ("YYYY-MM-DD"): the same all day, the next one tomorrow. */
export function quoteFor(date) {
  const day = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
  return QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

/** As one line: “text” — who. */
export function quoteLine(q) {
  return `💬 “${q.text}”${q.by ? ` — ${q.by}` : ''}`;
}
