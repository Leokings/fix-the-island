import { DESIGN_CONSEQUENCES } from '../../genlayer/council/types';
import type { CouncilStage } from '../../render/contract';
import type { WorldSnapshot } from '../../domain/world';
import { getRepairScenario } from '../../genlayer';
import type { VillagePumpDesignId } from '../../genlayer/council/types';
import { siteCopy } from '../player-copy';
import { inferPumpDesign } from '../build-view';
import { CouncilOverlay, button, type SiteVerdictView, type VoteKind } from './council-overlay';
import { STATUS_COPY } from './council-copy';
import { mockCouncilDecision, type SiteCouncilDecision } from './site-council-model';

// The site councils' reveal. Display only: it tells the story of a finished review
// from the transaction's real leader sentence and validator votes, and never
// touches the World, saves, wallets or restoration. Idle validators keep doing
// whatever they were doing, because they really did not take part. Mock councils
// (practice mode) are always badged.

const HEARD_KEY = 'fix-island:council-heard';
/** Decisions older than this are not announced (e.g. a finished island opened on a new browser); they can still be heard. */
const ANNOUNCE_FOR_MS = 2 * 60 * 60 * 1000;
const NEAR = 9;
const IDLE_LINE: Record<string, string> = {
  fish: 'kept fishing', sunbathe: 'stayed sunbathing', walk: 'carried on walking', sit: 'stayed sitting', tinker: 'kept working',
};

function loadHeard(): Set<string> {
  try { const raw = localStorage.getItem(HEARD_KEY); const list: unknown = raw ? JSON.parse(raw) : []; return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []); }
  catch { return new Set(); }
}

export class CouncilReveal {
  readonly overlay: CouncilOverlay;
  private run = 0;
  private skipWait: (() => void) | null = null;
  private open = false;
  private presenting: string | null = null;
  private readonly invite: HTMLButtonElement;
  private inviteAction: (() => void) | null = null;
  private readonly chip: HTMLDivElement;
  private readonly marker: HTMLDivElement;
  /** Latest council story per site. */
  private readonly decisions = new Map<string, SiteCouncilDecision>();
  private readonly heard = loadHeard();
  private readonly lastPhase = new Map<string, string>();
  private thinkTimer = 0;
  private thinker = 0;

  constructor(host: HTMLElement, private readonly stage: () => CouncilStage | null) {
    this.overlay = new CouncilOverlay(host);
    this.overlay.root.classList.add('in-game');
    this.overlay.hidePanel();
    this.overlay.onSkip = () => this.skipWait?.();
    this.invite = button('', 'council-invite', () => this.inviteAction?.());
    this.invite.hidden = true;
    this.chip = document.createElement('div'); this.chip.className = 'council-chip'; this.chip.hidden = true; this.chip.setAttribute('role', 'status');
    this.marker = document.createElement('div'); this.marker.className = 'council-marker'; this.marker.hidden = true; this.marker.setAttribute('aria-hidden', 'true');
    this.overlay.root.append(this.invite, this.chip, this.marker);
    if (import.meta.env.DEV) Object.assign(window, { __councilFlow: {
      // Development only: drive the visuals with labelled mock councils. Grants nothing.
      show: (siteId: string, status: 'reviewing' | 'decided' = 'decided') => this.setDecision(mockCouncilDecision(siteId, null, status)),
      hear: (siteId: string) => { const d = this.decisions.get(siteId); if (d) this.present(d); },
      clear: (siteId: string) => { this.decisions.delete(siteId); },
    } });
    window.addEventListener('keydown', this.onKey, true);
  }

  /** True while a council owns the screen; the game should not move the restorer. */
  get active(): boolean { return this.open; }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (!this.open) return;
    if ((e.key === ' ' || e.key === 'Enter') && this.skipWait) { e.preventDefault(); e.stopPropagation(); this.skipWait(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); }
  };

  private wait(ms: number, token: number): Promise<boolean> {
    return new Promise(resolve => {
      const id = window.setTimeout(() => { this.skipWait = null; resolve(token === this.run); }, ms);
      this.skipWait = () => { window.clearTimeout(id); this.skipWait = null; resolve(token === this.run); };
    });
  }

  /** Record a council story for its site (live from the adapter, or a practice mock). */
  setDecision(d: SiteCouncilDecision): void {
    const previous = this.decisions.get(d.siteId);
    // A newer review replaces an older one; a "reviewing" state never overwrites the result of the same review.
    if (previous && previous.key === d.key && previous.status !== 'reviewing' && d.status === 'reviewing') return;
    this.decisions.set(d.siteId, d);
    if (d.status !== 'reviewing' && d.votes?.at && Date.now() - d.votes.at > ANNOUNCE_FOR_MS) this.heard.add(d.key);
  }

  private unheard(): SiteCouncilDecision | null {
    for (const d of this.decisions.values()) if (d.status !== 'reviewing' && !this.heard.has(d.key)) return d;
    return null;
  }
  private markHeard(d: SiteCouncilDecision): void {
    this.heard.add(d.key);
    try { localStorage.setItem(HEARD_KEY, JSON.stringify([...this.heard].slice(-64))); } catch { /* Memory is only a convenience. */ }
  }

  /** Practice repairs: a labelled mock council follows each site's own crew work. Grants nothing. */
  observe(snapshot: WorldSnapshot): void {
    for (const site of snapshot.sites) {
      const was = this.lastPhase.get(site.id); this.lastPhase.set(site.id, site.phase);
      if (snapshot.mode !== 'practice' || was === undefined || was === site.phase) continue;
      const artifact = site.approvedArtifact ?? site.draft?.artifact;
      const design = site.id === 'village_pump' && artifact ? inferPumpDesign(getRepairScenario('village_pump'), { siteId: 'village_pump', artifact, rationale: '' }) as VillagePumpDesignId | null : null;
      if (site.phase === 'restoring') this.setDecision(mockCouncilDecision(site.id, design, 'reviewing'));
      else if (site.phase === 'restored') this.setDecision(mockCouncilDecision(site.id, design, 'decided'));
    }
  }

  /** Per frame: ambient chip, marker over the deciding council, invite when near, thinking bubbles. */
  frame(dt: number, player: { x: number; z: number } | null, blocked: boolean): void {
    const s = this.stage();
    if (!s) return;
    const waiting = this.unheard();
    const reviewing = [...this.decisions.values()].find(d => d.status === 'reviewing') ?? null;
    const title = (id: string) => siteCopy(id)?.title ?? 'site';
    let text = '';
    if (waiting) text = `${title(waiting.siteId)} council has decided · go hear it`;
    else if (reviewing) text = `${title(reviewing.siteId)} council is reviewing · keep exploring`;
    const mock = (waiting ?? reviewing)?.source === 'mock' ? 'MOCK PREVIEW · ' : '';
    this.chip.hidden = !text || this.open;
    if (!this.chip.hidden) { this.chip.textContent = mock + text; this.chip.classList.toggle('mock', !!mock); }
    // Marker over the leader of the council with news.
    const beacon = !this.open && waiting ? s.beacon(waiting.siteId) : null;
    this.marker.hidden = !beacon;
    if (beacon) this.marker.style.transform = `translate(${beacon.x}px, ${beacon.y}px) translate(-50%, -100%)`;
    // Invite once the restorer is near that council.
    const centre = waiting ? s.centre(waiting.siteId) : null;
    const near = !!centre && !!player && Math.hypot(player.x - centre.x, player.z - centre.z) < NEAR;
    const offer = !this.open && !blocked && near && waiting;
    this.invite.hidden = !offer;
    if (offer) { const label = `Hear the ${title(waiting.siteId)} council${waiting.source === 'mock' ? ' (mock)' : ''}`; if (this.invite.textContent !== label) this.invite.textContent = label; this.inviteAction = () => this.present(waiting); }
    else this.inviteAction = null;
    // Thinking bubbles over the reviewing council; they never hint at a vote.
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) { this.thinker = (this.thinker + 1 + Math.floor(Math.random() * 3)) % 5; this.thinkTimer = 1.4 + Math.random() * 1.2; }
    for (let i = 0; i < 5; i++) {
      const pos = !this.open && reviewing ? s.bubble(reviewing.siteId, i) : null;
      this.overlay.setBubble(i, pos, !!pos && i === this.thinker);
    }
  }

  /** Leave the council: everyone goes back to what they were doing. */
  close(): void {
    this.run++;
    this.open = false;
    document.body.classList.remove('council-open');
    this.skipWait = null;
    const s = this.stage(), siteId = this.presenting;
    if (s && siteId) for (let i = 0; i < s.size(siteId); i++) s.release(siteId, i);
    this.presenting = null;
    s?.setShot(null);
    s?.setFire('steady');
    this.overlay.setCinematic(false);
    this.overlay.setMock(null);
    this.overlay.hidePanel();
  }

  /** Play one council's story. Mock and verified live councils share this path. */
  present(d: SiteCouncilDecision): void {
    const s = this.stage();
    if (!s || !s.size(d.siteId)) return;
    if (this.open) this.close();
    this.run++;
    const token = this.run;
    this.open = true; this.presenting = d.siteId;
    this.chip.hidden = true; this.marker.hidden = true; this.invite.hidden = true;
    document.body.classList.add('council-open');
    this.overlay.setMock(d.source === 'mock' ? 'MOCK PREVIEW — practice repairs are never reviewed by GenLayer; these votes are invented.' : null);
    if (d.status === 'reviewing') {
      s.setShot({ siteId: d.siteId, member: null });
      this.overlay.showStatus('deliberating', STATUS_COPY.deliberating.title, STATUS_COPY.deliberating.line, [button('Back to the island', 'primary', () => this.close())]);
      return;
    }
    void this.reveal(d, token);
  }

  private async reveal(d: SiteCouncilDecision, token: number): Promise<void> {
    const s = this.stage()!, siteId = d.siteId, size = s.size(siteId);
    const validators = d.votes?.validators ?? [];
    // Seat 0 is the leader; seats 1-4 are the first four validators in the transaction.
    const kindOf = (seat: number): 'leader' | VoteKind => seat === 0 ? 'leader' : (validators[seat - 1]?.vote ?? 'idle');
    this.overlay.setCinematic(true);
    this.overlay.hidePanel();
    if (siteId === 'village_pump') s.setFire('bright');
    s.setShot({ siteId, member: null });
    for (let i = 0; i < size; i++) if (kindOf(i) !== 'idle' && (i > 0 || d.votes?.leader || d.source === 'mock')) s.engage(siteId, i);
    if (!await this.wait(1200, token)) return;
    for (let seat = 0; seat < size; seat++) {
      const kind = kindOf(seat);
      if (kind === 'idle') continue;
      if (seat === 0 && !d.votes?.leader && d.source !== 'mock') continue;
      s.setShot({ siteId, member: seat });
      s.gesture(siteId, seat, kind === 'leader' ? 'leader' : kind);
      if (seat === 0) {
        const model = d.votes?.leader?.model ?? 'Leader';
        const line = d.feedback || (d.status === 'split' ? 'Proposed a decision the others did not all reach.' : 'Proposed the council’s decision.');
        this.overlay.showMember(0, size, model, d.decision === 'approve' ? 'Approve' : d.decision === 'revise' ? 'Revise' : 'Proposed', 'leader', line, !!d.feedback);
      } else {
        const v = validators[seat - 1]!;
        const line = kind === 'agree' ? 'Reached the same decision with its own AI model.' : kind === 'disagree' ? 'Reached a different decision with its own AI model.' : 'Ran out of time before voting.';
        this.overlay.showMember(seat, size, v.model ?? 'Validator', kind === 'agree' ? 'Agrees' : kind === 'disagree' ? 'Disagrees' : 'Timed out', kind, `${line}${v.ms ? ` (${(v.ms / 1000).toFixed(1)} s)` : ''}`, false);
      }
      if (!await this.wait(seat === 0 ? 4200 : 2600, token)) return;
      s.settle(siteId, seat);
    }
    this.overlay.setCinematic(false);
    s.setShot({ siteId, member: null });
    this.markHeard(d);
    this.overlay.showSiteVerdict(this.verdictView(d), [button('Back to the island', 'primary', () => this.close())]);
  }

  private verdictView(d: SiteCouncilDecision): SiteVerdictView {
    const s = this.stage()!, size = s.size(d.siteId), validators = d.votes?.validators ?? [];
    const seats: SiteVerdictView['seats'][number][] = [];
    seats.push({ name: d.votes?.leader?.model ?? 'Leader', label: 'led the review', kind: 'leader' });
    for (let seat = 1; seat < size; seat++) {
      const v = validators[seat - 1];
      const kind: VoteKind = v?.vote ?? 'idle';
      const activity = s.activity(d.siteId, seat) ?? 'sit';
      const label = kind === 'agree' ? 'agreed' : kind === 'disagree' ? 'disagreed' : kind === 'timeout' ? 'timed out' : `didn’t vote · ${IDLE_LINE[activity] ?? 'stayed put'}`;
      seats.push({ name: v?.model ?? 'Validator', label, kind });
    }
    if (validators.length > size - 1) seats.push({ name: `+${validators.length - (size - 1)} more`, label: 'validators also reviewed', kind: 'idle' });
    const title = siteCopy(d.siteId)?.title ?? 'Site';
    const consequences = d.siteId === 'village_pump' && d.decision === 'approve' && d.design ? DESIGN_CONSEQUENCES[d.design] : null;
    return {
      kicker: d.source === 'genlayer' ? `${title} council · verified on GenLayer` : `${title} council · mock preview`,
      source: d.source, status: d.status === 'reviewing' ? 'decided' : d.status, decision: d.decision, feedback: d.feedback, consequences, seats,
    };
  }

  dispose(): void { window.removeEventListener('keydown', this.onKey, true); this.overlay.root.remove(); }
}
