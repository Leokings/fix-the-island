import { COUNCIL_ROLES, DESIGN_CONSEQUENCES, VILLAGE_PUMP_DESIGN_IDS } from '../../genlayer/council/types';
import type { CouncilPerspective, CouncilResult, CouncilRole, Consequences, VillagePumpDesignId } from '../../genlayer/council/types';
import { CONSEQUENCE_COPY, DESIGN_COPY, LEVEL_COPY, LEVEL_PIPS, QUALITY_COPY, ROLE_COPY, SCENARIO_COPY, STANCE_COPY } from './council-copy';
import { ROLE_LOOK } from '../../render/council/council-actor';
import './council.css';

type Child = Node | string | null | false | undefined;
/** Build DOM from plain text only; result text is never parsed as HTML. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  for (const c of children) if (c) node.append(c);
  return node;
}
function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

function consequenceRows(c: Consequences, compact = false): HTMLElement {
  const list = el('ul', compact ? 'cq cq-compact' : 'cq');
  for (const key of ['water', 'habitat', 'maintenance'] as const) {
    const level = c[key], pips = LEVEL_PIPS[level];
    const meter = el('span', 'cq-meter');
    meter.setAttribute('aria-hidden', 'true');
    for (let i = -1; i <= 2; i++) {
      if (i === 0) { meter.append(el('span', 'cq-zero')); continue; }
      const on = i < 0 ? pips <= i : pips >= i;
      meter.append(el('span', `cq-pip ${on ? (i < 0 ? 'on bad' : 'on good') : ''}`));
    }
    const row = el('li', `cq-row lvl-${level}`,
      el('span', 'cq-icon', CONSEQUENCE_COPY[key].icon),
      el('span', 'cq-label', CONSEQUENCE_COPY[key].label),
      meter,
      el('span', 'cq-value', LEVEL_COPY[key][level]));
    list.append(row);
  }
  return list;
}

function avatar(role: CouncilRole): HTMLElement {
  const a = el('span', `avatar avatar-${role}`);
  a.style.setProperty('--body', hex(ROLE_LOOK[role].body));
  a.style.setProperty('--accent', hex(ROLE_LOOK[role].accent));
  a.append(el('span', 'avatar-eyes'));
  return a;
}

export class CouncilOverlay {
  readonly root = el('div', 'council-ui');
  private readonly badge = el('div', 'mock-badge');
  private readonly panel = el('div', 'council-panel');
  private readonly bubbles: HTMLElement[] = [];
  private readonly bars = el('div', 'letterbox');
  private readonly skip = button('Skip ›', 'skip', () => this.onSkip?.());
  onSkip: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.root.append(this.bars, this.badge, this.panel, this.skip);
    // One thinking bubble per council seat (five per site council).
    for (let i = 0; i < 5; i++) {
      const b = el('div', 'bubble', el('span', 'dot'), el('span', 'dot'), el('span', 'dot'));
      b.setAttribute('aria-hidden', 'true');
      this.bubbles.push(b);
      this.root.append(b);
    }
    this.skip.hidden = true;
    host.append(this.root);
  }

  setMock(message: string | null): void {
    this.badge.hidden = !message;
    this.badge.replaceChildren(el('strong', '', 'MOCK PREVIEW'), el('span', '', message?.replace(/^MOCK PREVIEW\s*[—-]\s*/, '') ?? ''));
  }

  setCinematic(on: boolean): void {
    this.root.classList.toggle('cinematic', on);
    this.skip.hidden = !on;
  }

  /** Thinking bubbles only; they never hint at a stance before the verified result. */
  setBubble(seat: number, pos: { x: number; y: number } | null, visible: boolean): void {
    const b = this.bubbles[seat];
    if (!b) return;
    b.classList.toggle('show', visible && !!pos);
    if (pos) b.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%)`;
  }

  private show(...children: Child[]): void {
    this.panel.className = 'council-panel';
    this.panel.replaceChildren(...children.filter(Boolean) as Node[]);
    this.panel.classList.remove('enter');
    void this.panel.offsetWidth;
    this.panel.classList.add('enter');
  }

  showChoice(selected: VillagePumpDesignId | null, onPick: (id: VillagePumpDesignId) => void, onSend: () => void): void {
    const cards = el('div', 'design-cards');
    for (const id of VILLAGE_PUMP_DESIGN_IDS) {
      const copy = DESIGN_COPY[id];
      const card = el('button', `design-card ${selected === id ? 'selected' : ''}`,
        el('span', 'design-icon', copy.icon),
        el('span', 'design-name', copy.name),
        el('span', 'design-pitch', copy.pitch),
        el('span', 'design-if', 'If the council approves'),
        consequenceRows(DESIGN_CONSEQUENCES[id], true));
      card.type = 'button';
      card.setAttribute('aria-pressed', String(selected === id));
      card.addEventListener('click', () => onPick(id));
      cards.append(card);
    }
    const send = button('Send plan to the council', 'primary', onSend);
    send.disabled = !selected;
    this.show(
      el('header', 'panel-head', el('span', 'kicker', 'Repair plan'), el('h2', '', SCENARIO_COPY.title), el('p', 'lede', SCENARIO_COPY.brief)),
      el('p', 'legend', el('span', 'cq-pip on good'), ' better  ', el('span', 'cq-pip on bad'), ' worse, if the council approves'),
      cards,
      el('footer', 'panel-foot', el('span', 'hint', selected ? 'Built on site. It will not run until the council approves.' : 'Pick a design to build it on site.'), send),
    );
    this.panel.classList.add('choice');
  }

  showStatus(kind: 'deliberating' | 'provisional' | 'timeout' | 'failed', title: string, line: string, actions: HTMLButtonElement[] = []): void {
    const spinner = kind === 'deliberating' || kind === 'provisional' ? el('span', 'ember-spinner', el('i'), el('i'), el('i')) : el('span', `status-icon status-${kind}`, kind === 'timeout' ? '⌛' : '!');
    this.show(el('div', 'status-row', spinner, el('div', '', el('h3', '', title), el('p', '', line))), actions.length ? el('div', 'actions', ...actions) : null);
    this.panel.classList.add('status', `status-${kind}`);
  }

  showSpeaker(p: CouncilPerspective, index: number): void {
    const look = ROLE_LOOK[p.role];
    const head = el('div', 'speaker-head', avatar(p.role),
      el('div', '', el('h3', '', ROLE_COPY[p.role].name), el('span', 'cares', ROLE_COPY[p.role].cares)),
      el('span', `stance stance-${p.stance}`, STANCE_COPY[p.stance]));
    const quote = el('p', 'speaker-text', p.text);
    const steps = el('div', 'steps', ...COUNCIL_ROLES.map((_, i) => el('span', i <= index ? 'step on' : 'step')));
    this.show(head, quote, steps);
    this.panel.classList.add('speaker');
    this.panel.style.setProperty('--role', hex(look.body));
  }

  showVerdict(result: CouncilResult, actions: HTMLButtonElement[], source: 'mock' | 'genlayer' = 'mock'): void {
    // Only a verified live result may say "verified"; a mock always says what it is.
    const kicker = source === 'genlayer' ? 'Council decision · verified' : 'Simulated decision · mock preview';
    const stances = el('div', 'verdict-stances', ...result.perspectives.map(p => el('span', `mini stance-${p.stance}`, avatar(p.role), el('span', '', `${ROLE_COPY[p.role].name}: ${STANCE_COPY[p.stance]}`))));
    if (result.decision === 'approve') {
      const q = QUALITY_COPY[result.quality];
      this.show(
        el('header', 'panel-head', el('span', 'kicker', kicker), el('h2', '', `${source === 'genlayer' ? 'Approved' : 'Approval preview'}: ${q.title}`), el('p', 'lede', q.line)),
        el('div', `quality-band q-${result.quality}`, ...(['acceptable', 'good', 'excellent'] as const).map(b => el('span', b === result.quality ? 'on' : '', QUALITY_COPY[b].title))),
        el('p', 'design-line', source === 'genlayer' ? `${DESIGN_COPY[result.chosenDesignId].name} is now running.` : `This is how an approval of the ${DESIGN_COPY[result.chosenDesignId].name} would read.`),
        consequenceRows(result.consequences),
        stances,
        el('div', 'actions', ...actions),
      );
      this.panel.classList.add('verdict', 'approve');
    } else {
      const concerns = result.perspectives.filter(p => p.stance !== 'supports');
      this.show(
        el('header', 'panel-head', el('span', 'kicker', kicker), el('h2', '', 'Revise the plan'), el('p', 'lede', 'Nothing on the island changes yet. Address these points and send it again.')),
        el('ul', 'concerns', ...concerns.map(p => el('li', '', avatar(p.role), el('span', '', p.text)))),
        stances,
        el('div', 'actions', ...actions),
      );
      this.panel.classList.add('verdict', 'revise');
    }
  }

  /** One council member during the reveal: the leader with the stored sentence, or a validator's vote. */
  showMember(seat: number, total: number, title: string, tag: string, tagKind: 'leader' | VoteKind, line: string, quote: boolean): void {
    const head = el('div', 'speaker-head', el('span', `vote-icon vote-${tagKind}`, VOTE_ICON[tagKind]),
      el('div', '', el('h3', '', title), el('span', 'cares', seat === 0 ? 'Leader · reviewed first' : `Validator ${seat}`)),
      el('span', `stance vote-tag vote-${tagKind}`, tag));
    const text = el('p', quote ? 'speaker-text' : 'speaker-text plain', line);
    const steps = el('div', 'steps', ...Array.from({ length: total }, (_, i) => el('span', i <= seat ? 'step on' : 'step')));
    this.show(head, text, steps);
    this.panel.classList.add('speaker', `member-${tagKind}`);
  }

  /** The site council's verdict with every seat's real vote. */
  showSiteVerdict(v: SiteVerdictView, actions: HTMLButtonElement[]): void {
    const title = v.status === 'split' ? 'The council was split' : v.status === 'failed' ? 'The review could not finish'
      : v.decision === 'approve' ? (v.source === 'genlayer' ? 'Approved' : 'Approval preview') : 'Revise your plan';
    const lede = v.status === 'split' ? 'The validators did not reach a majority. Make your plan more specific and submit again.'
      : v.status === 'failed' ? 'Something went wrong while processing. This is not the council rejecting your plan.'
      : v.decision === 'approve' ? 'The repair can go ahead.' : 'Nothing changes yet. Address the point below and submit again.';
    const seats = el('ul', 'council-seats', ...v.seats.map(seat => el('li', `seat vote-${seat.kind}`,
      el('span', `vote-icon vote-${seat.kind}`, VOTE_ICON[seat.kind]), el('span', 'seat-name', seat.name), el('span', 'seat-vote', seat.label))));
    this.show(
      el('header', 'panel-head', el('span', 'kicker', v.kicker), el('h2', '', title), el('p', 'lede', lede)),
      v.feedback ? el('blockquote', 'leader-quote', el('span', 'who', 'The leader wrote'), v.feedback) : null,
      v.consequences ? consequenceRows(v.consequences) : null,
      seats,
      el('p', 'council-note', 'Each validator ran its own AI model and checked the leader’s decision on its own. GenLayer records every vote; only the leader’s reasoning is stored.'),
      el('div', 'actions', ...actions),
    );
    this.panel.classList.add('verdict', v.status !== 'decided' ? 'revise' : v.decision === 'approve' ? 'approve' : 'revise');
  }

  hidePanel(): void { this.panel.replaceChildren(); this.panel.className = 'council-panel hidden'; }
}

export type VoteKind = 'agree' | 'disagree' | 'idle' | 'timeout';
const VOTE_ICON: Record<'leader' | VoteKind, string> = { leader: '★', agree: '✓', disagree: '✗', idle: '·', timeout: '⌛' };
export interface SiteVerdictView {
  readonly kicker: string;
  readonly source: 'genlayer' | 'mock';
  readonly status: 'decided' | 'split' | 'failed';
  readonly decision: 'approve' | 'revise' | null;
  readonly feedback: string;
  readonly consequences: Consequences | null;
  readonly seats: readonly Readonly<{ name: string; label: string; kind: 'leader' | VoteKind }>[];
}

export { button };
