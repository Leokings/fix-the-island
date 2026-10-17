import type { WorldSnapshot } from '../domain/world';
import './tutorial.css';

// First-visit tutorial. It walks a new player through one practice repair at the
// Landing Hoist, then offers to play for real on GenLayer. It only reads the
// world snapshot and shows coach cards: it never changes the world, saves,
// wallets or reviews. Finished or skipped is remembered per browser.

const DONE_KEY = 'fix-island:tutorial-done';
const SITE = 'pier_hoist';

type Step = 'intro' | 'walk' | 'open' | 'fix' | 'answer' | 'finish' | 'council' | 'live';
const ORDER: readonly Step[] = ['intro', 'walk', 'open', 'fix', 'answer', 'finish', 'council', 'live'];

interface Card { readonly title: string; readonly body: string; readonly hint?: string }
const CARDS: Record<Step, Card> = {
  intro: {
    title: 'A storm hit the island in the night',
    body: 'Eight machines are broken. You fix each one in two parts: you build the repair, and the island council judges your plan. In the real game that council is a set of AI validators on GenLayer, voting on chain.',
    hint: 'This short practice run uses the Landing Hoist. Nothing here is sent anywhere.',
  },
  walk: { title: 'Walk to the Landing Hoist', body: 'Use WASD or the arrow keys (on a phone, drag the stick). Follow the marker to the hoist by the pier.' },
  open: { title: 'Open the repair', body: 'Press E, or tap Interact, to open the Landing Hoist.' },
  fix: {
    title: 'Find the fault and fix it',
    body: 'The counterweights are out of balance. Use the checklist on the left: pick a weight, slide it along its rail, then press Test.',
    hint: 'A weight farther out turns harder. Test as often as you like.',
  },
  answer: {
    title: 'Answer the council',
    body: 'Press Answer. The council asks one question about this site; reply in one line, in your own words (what will you do, and why?), then press Review.',
    hint: 'A short, concrete plan is enough. Vague answers get “revise”.',
  },
  finish: { title: 'Finish the repair', body: 'Check your build and answer, then press Finish local repair. When you play for real, this button sends them to GenLayer instead.' },
  council: {
    title: 'Meet the council',
    body: 'Every site has a council of five, one per GenLayer validator seat. Walk up to them and press “Hear the Landing Hoist council”.',
    hint: 'In practice their votes are a labelled mock. When you play for real, they show each validator’s real vote and AI model.',
  },
  live: {
    title: 'You’ve got it',
    body: 'Ready to play for real? Your repairs will be judged by GenLayer validators on StudioNet, a free test network: no real money. You need a browser wallet such as MetaMask; the game adds the network for you.',
  },
};

function done(): boolean { try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return false; } }
function markDone(): void { try { localStorage.setItem(DONE_KEY, '1'); } catch { /* Remembering is only a convenience. */ } }

export class Tutorial {
  private readonly root = document.createElement('aside');
  private step: Step | null = null;
  private heardCouncil = false;
  private shown = '';

  constructor(host: HTMLElement, private readonly actions: { connect: () => void }) {
    this.root.className = 'coach';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-live', 'polite');
    this.root.hidden = true;
    host.append(this.root);
    // The council reveal adds this class while it holds the screen; closing it completes that step.
    new MutationObserver(() => { if (this.step === 'council' && document.body.classList.contains('council-open')) this.heardCouncil = true; })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /** Start on a first visit (or on request), only for a practice game. */
  maybeStart(snapshot: WorldSnapshot, force = false): void {
    if (snapshot.mode !== 'practice' || (!force && done())) return;
    this.heardCouncil = false;
    this.go('intro');
  }

  get active(): boolean { return this.step !== null; }

  private go(step: Step | null): void {
    this.step = step;
    this.shown = '';
    if (!step) this.root.hidden = true;
  }

  private finish(): void { markDone(); this.go(null); }

  /** Per frame: advance on what the player actually did. */
  update(snapshot: WorldSnapshot, started: boolean): void {
    if (!this.step) return;
    if (!started || snapshot.mode !== 'practice') { this.root.hidden = true; return; }
    const site = snapshot.sites.find(s => s.id === SITE);
    const editing = snapshot.inspectionId === SITE;
    const stage = snapshot.editor?.stage;
    const installed = site?.phase === 'restoring' || site?.phase === 'restored';
    // A player who has moved on to other sites has learned the loop: offer the last card instead of nagging.
    const elsewhere = snapshot.sites.some(s => s.id !== SITE && (s.phase === 'restoring' || s.phase === 'restored'));
    // Jump ahead whenever the player is already further along than the card says.
    if (elsewhere && this.step !== 'live') this.go('live');
    else if (installed && ORDER.indexOf(this.step) < ORDER.indexOf('council')) this.go('council');
    else if (this.step === 'walk' && snapshot.focusId === SITE) this.go(editing ? 'fix' : 'open');
    else if (this.step === 'open' && editing) this.go('fix');
    else if (this.step === 'fix' && editing && site?.advice?.valid) this.go('answer');
    else if (this.step === 'answer' && editing && stage === 'review') this.go('finish');
    else if (this.step === 'council' && this.heardCouncil && !document.body.classList.contains('council-open')) this.go('live');
    if (!this.step) return;
    // While building, the card sits clear of the build view; elsewhere, near the top.
    this.root.classList.toggle('building', editing);
    this.root.hidden = document.body.classList.contains('council-open');
    if (this.shown !== this.step) { this.shown = this.step; this.render(this.step); }
  }

  private render(step: Step): void {
    const card = CARDS[step], index = ORDER.indexOf(step);
    const title = document.createElement('h2'); title.textContent = card.title;
    const body = document.createElement('p'); body.textContent = card.body;
    const parts: Node[] = [title, body];
    if (card.hint) { const hint = document.createElement('p'); hint.className = 'coach-hint'; hint.textContent = card.hint; parts.push(hint); }
    const dots = document.createElement('div'); dots.className = 'coach-dots'; dots.setAttribute('aria-label', `Step ${index + 1} of ${ORDER.length}`);
    for (let i = 0; i < ORDER.length; i++) { const d = document.createElement('span'); if (i <= index) d.className = 'on'; dots.append(d); }
    const row = document.createElement('div'); row.className = 'coach-actions';
    const button = (label: string, cls: string, key: string, onClick: () => void) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.className = cls; b.dataset.key = key; b.addEventListener('click', onClick); return b;
    };
    if (step === 'intro') row.append(button('Show me', 'primary', 'coach-next', () => this.go('walk')), button('Skip tutorial', 'quiet', 'coach-skip', () => this.finish()));
    else if (step === 'live') row.append(button('Connect wallet', 'primary', 'coach-connect', () => { this.finish(); this.actions.connect(); }), button('Keep practising', 'quiet', 'coach-practise', () => this.finish()));
    else row.append(button('Skip tutorial', 'quiet', 'coach-skip', () => this.finish()));
    this.root.replaceChildren(...parts, dots, row);
    this.root.hidden = false;
  }
}
