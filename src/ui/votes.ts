import type { Vote } from '../types.ts';
import { extLink, h } from './dom.ts';
import { fmtDate } from './format.ts';

export const ANSWERS: Vote['answer'][] = ['yes', 'no', 'abstain', 'absent'];

export const ANSWER_LABEL: Record<Vote['answer'], string> = {
  yes: 'Ja', no: 'Nein', abstain: 'Enthalten', absent: 'Abwesend',
};

/** Neutraler Chip (Grautoene, Unterschied ueber die Form): keine Wertung des Abstimmungsverhaltens. */
export function renderChip(answer: Vote['answer']): HTMLElement {
  return h('span', `chip chip-${answer}`, ANSWER_LABEL[answer]);
}

/** Neueste zuerst. */
export const sortVotes = (votes: Vote[]) => [...votes].sort((a, b) => b.date.localeCompare(a.date));

/** Listeneintrag: Titel (Link nur bei https; mit `link: false` immer nur Text), Datum, Chip. */
export function renderVoteRow(v: Vote, opts: { link?: boolean } = {}): HTMLElement {
  const li = h('li', 'vote');
  li.dataset.answer = v.answer;
  const meta = h('div', 'vote-meta');
  const time = h('time', undefined, fmtDate(v.date));
  time.dateTime = v.date;
  meta.append(time, renderChip(v.answer));
  li.append(opts.link === false ? h('span', 'vote-title', v.title) : extLink(v.url, v.title, 'vote-title'), meta);
  return li;
}
