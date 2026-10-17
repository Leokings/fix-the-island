import type { IslandSiteFixture, LocalRepairAdvice, RepairDraft, RepairEndpoint } from '../genlayer';
import { CONFIG_FIELD_LABELS, configLabel, partLabel, portLabel, slotLabel } from './player-copy';
import type { RepairPanelAction, RepairPanelModel } from './repair-panel';
import { describeRepair } from './repair-learning';
import { repairGuidance } from './quest-guide';
import { SITE_PLAN } from '../content/site-plan';
import './build-view.css';

/**
 * Connected mode: whether this site's contract has received the finalized approval notices from
 * the sites it depends on (from the read-only get_progress view). A missing notice is neither an
 * approval nor a rejection; it can be re-sent from an approval that already finalized.
 */
export interface DependencyStatus {
  readonly siteId: string;
  readonly ready: boolean;
  readonly required: readonly string[];
  readonly confirmed: readonly string[];
  /** Parents whose own approval is verified in this expedition (restored on the island). */
  readonly approvedParents: readonly string[];
}
const RESEND_AFTER_MS = 3 * 60_000;
const siteTitle = (id: string) => SITE_PLAN.find(site => site.id === id)?.title ?? id.replaceAll('_', ' ');

// The build view for every repair site (GAME-DESIGN §6, §11): the live machine
// is the surface. Choose an approach where a site has alternatives (the pump),
// tap a part and its glowing socket, tap port to port, turn detented dials,
// rotate or swap fitted stock, then Test. Every edit goes through the same panel
// actions as before; this view holds only which blueprint the player is viewing.

type Design = NonNullable<IslandSiteFixture['technical']['designs']>[number];
export type BuildStep = 'place' | 'connect' | 'set';
/** @deprecated use BuildStep */
export type PumpStep = BuildStep;

/** What each site is called on screen, and what its links are. */
const SITE_NOUN: Readonly<Record<string, { machine: string; links: string; running: string }>> = {
  pier_hoist: { machine: 'hoist', links: 'links', running: 'Lifting a test load…' },
  village_pump: { machine: 'pump', links: 'pipes', running: 'Water running…' },
  tidal_sluice: { machine: 'sluice', links: 'channels', running: 'Water running…' },
  creek_bridge: { machine: 'bridge', links: 'joints', running: 'Load test…' },
  coast_windmill: { machine: 'windmill', links: 'shafts', running: 'Spinning up…' },
  woodland_pathlight: { machine: 'light', links: 'wires', running: 'Power on…' },
  upland_waterworks: { machine: 'waterworks', links: 'pipes', running: 'Water running…' },
  ridge_beacon: { machine: 'beacon', links: 'links', running: 'Power on…' },
};
const noun = (siteId: string) => SITE_NOUN[siteId] ?? { machine: 'machine', links: 'links', running: 'Testing…' };

const METRIC_LABELS: Readonly<Record<string, string>> = {
  counterweightMoment: 'Counterweight pull', loadMoment: 'Cargo pull', pressure: 'Pressure', trunkFlow: 'Village gets',
  creekFlow: 'Creek gets', nurseryFlow: 'Nursery gets', rpm: 'Generator speed', villageFlow: 'Village gets', habitatFlow: 'Habitat gets',
};

const DESIGN_COPY: Readonly<Record<string, { name: string; tradeoff: string }>> = {
  direct_pump: { name: 'Direct pump', tradeoff: 'Fast and dependable. Louder, and its relief water must drain somewhere safe.' },
  quiet_pump: { name: 'Quiet pump', tradeoff: 'Same supply with less disturbance by the reeds. Housing and mount add parts to look after.' },
  rain_cistern: { name: 'Rain cistern', tradeoff: 'Takes nothing from the creek. Limited by what the tank stores; filters need care.' },
};

// Names for the quiet and rain designs' setup values (the direct pump's come from player copy).
const SETUP_LABELS: Readonly<Record<string, string>> = {
  quiet_pump_pad: 'Quiet pump pad', quiet_relieved_delivery: 'Quiet delivery with relief', quiet_clean_drain: 'Quiet clear drain route',
  roof_catchment: 'Roof catchment', stored_rain_delivery: 'Stored rain delivery', safe_soakaway: 'Safe soakaway route',
};
const setupLabel = (id: string) => SETUP_LABELS[id] ?? configLabel(id);
const SETUP_FIELDS = ['mountZoneId', 'outputModeId', 'routeId'] as const;

const ICONS: Readonly<Record<string, string>> = {
  screen: '<circle cx="16" cy="17" r="9"/><path d="M10 13h12M10 17h12M10 21h12M13 9v16M19 9v16"/>',
  valve: '<path d="M4 20h24"/><rect x="11" y="15" width="10" height="9" rx="2"/><path d="M16 15V9"/><circle cx="16" cy="7" r="4"/>',
  pump: '<rect x="5" y="11" width="15" height="12" rx="3"/><circle cx="23" cy="17" r="5"/><path d="M2 21h3M20 13h9"/>',
  relief: '<path d="M4 22h24"/><rect x="12" y="15" width="8" height="8"/><path d="M14 15v-3l2-2 2 2v3M16 8V5"/><path d="M13 12h6"/>',
  trunk: '<path d="M4 12h12a4 4 0 0 1 4 4v12"/><path d="M14 28h12"/>',
  drain: '<path d="M16 4v10"/><rect x="7" y="16" width="18" height="8" rx="1"/><path d="M11 16v8M16 16v8M21 16v8"/>',
  mount: '<rect x="5" y="12" width="22" height="5"/><circle cx="9" cy="22" r="3"/><circle cx="23" cy="22" r="3"/>',
  housing: '<path d="M4 12 16 5l12 7v14H4z"/><path d="M10 26V16h8v10"/><path d="M22 15v6"/>',
  catchment: '<path d="M3 11 26 6v4L3 15z"/><path d="M6 15v12M23 10v17"/>',
  gutter: '<path d="M4 12a12 6 0 0 0 24 0"/><path d="M24 16v10"/>',
  diverter: '<path d="M10 4v22M10 12h12v14"/><circle cx="10" cy="20" r="3"/>',
  cistern: '<path d="M8 10h16v16H8z"/><path d="M6 10l10-6 10 6M8 16h16M8 21h16"/>',
  filter: '<rect x="9" y="5" width="14" height="22" rx="3"/><path d="M9 12h14M9 18h14"/><path d="M12 22h8" stroke-dasharray="2 2"/>',
  overflow: '<path d="M3 13h18l8 6"/><path d="M3 18h18"/>',
  soakaway: '<path d="M4 22a12 5 0 0 0 24 0"/><circle cx="10" cy="20" r="2"/><circle cx="16" cy="22" r="2"/><circle cx="22" cy="20" r="2"/><path d="M16 4v10"/>',
  crank: '<circle cx="12" cy="18" r="6"/><path d="M12 18l10-8M22 10v-4"/>',
  pulley: '<circle cx="16" cy="12" r="7"/><circle cx="16" cy="12" r="2"/><path d="M9 12v14M23 12v10"/>',
  boom: '<path d="M4 26 26 8M6 26h8M26 8v8"/>',
  rope: '<path d="M16 4c-6 4 6 8 0 12s6 8 0 12"/>',
  guard: '<path d="M6 10a10 10 0 0 1 20 0v6H6z"/><path d="M10 16v8M22 16v8"/>',
  counterweight: '<path d="M10 12h12l3 14H7z"/><path d="M16 4v8"/>',
  source: '<path d="M4 20c4-6 8 2 12-4s8 2 12-4"/><path d="M4 26c4-6 8 2 12-4s8 2 12-4"/>',
  baffle: '<path d="M8 6v20M8 10h14M8 16h14M8 22h14"/>',
  gate: '<rect x="7" y="8" width="18" height="18"/><path d="M16 4v6M7 17h18"/>',
  outlet: '<path d="M4 12h14v8h10"/><path d="M24 16l4 4-4 4"/>',
  pool: '<ellipse cx="16" cy="20" rx="12" ry="5"/><path d="M10 20c2-2 4 2 6 0s4 2 6 0"/>',
  rack: '<path d="M6 8v18M26 8v18M6 12h20M6 18h20M6 24h20"/>',
  shoe: '<path d="M4 24h24l-4-8H8z"/>',
  deck: '<path d="M3 14h26v5H3z"/><path d="M9 14v5M15 14v5M21 14v5"/>',
  beam: '<path d="M3 12h26v6H3z"/>',
  brace: '<path d="M6 26 26 6M6 26h6M26 6v6"/>',
  rail: '<path d="M3 10h26M3 16h26M8 10v12M16 10v12M24 10v12"/>',
  shaft: '<path d="M3 16h26"/><circle cx="8" cy="16" r="3"/><circle cx="24" cy="16" r="3"/>',
  gear: '<circle cx="16" cy="16" r="7"/><circle cx="16" cy="16" r="2"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M7 25l3-3M22 10l3-3"/>',
  coupling: '<rect x="11" y="10" width="10" height="12" rx="2"/><path d="M3 16h8M21 16h8"/>',
  generator: '<rect x="6" y="9" width="20" height="16" rx="3"/><path d="M17 11l-4 7h5l-3 6"/>',
  fuse: '<rect x="8" y="12" width="16" height="8" rx="2"/><path d="M3 16h5M24 16h5M12 16h8"/>',
  regulator: '<rect x="8" y="8" width="16" height="16" rx="2"/><path d="M12 20l4-8 4 8"/>',
  lamp: '<path d="M10 6h12l-2 10h-8z"/><circle cx="16" cy="21" r="4"/><path d="M16 26v3"/>',
  return: '<path d="M26 12H8l5-5M8 12l5 5"/><path d="M6 22h20"/>',
  shield: '<path d="M6 12a10 6 0 0 1 20 0"/><path d="M16 12v14"/>',
  splitter: '<path d="M4 16h10l8-8M14 16l8 8"/><path d="M22 8h6M22 24h6"/>',
  reflector: '<path d="M8 6a14 14 0 0 1 0 20"/><path d="M8 16h18"/><path d="M20 10l6 6-6 6"/>',
  lens: '<circle cx="16" cy="16" r="9"/><path d="M16 7a9 9 0 0 1 0 18"/>',
  plinth: '<path d="M6 26h20l-3-8H9z"/><rect x="11" y="10" width="10" height="8"/>',
};
const icon = (kind: string): string => `<svg viewBox="0 0 32 32" aria-hidden="true">${ICONS[kind] ?? '<rect x="8" y="8" width="16" height="16" rx="3"/>'}</svg>`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
};
const sameEnd = (a: RepairEndpoint | null | undefined, b: RepairEndpoint | null | undefined) => !!a && !!b && a.partId === b.partId && a.portId === b.portId;

/** Which approach the current draft is built towards: the design holding every placed part, preferring the tightest fit. */
export function inferPumpDesign(fixture: IslandSiteFixture, draft: RepairDraft): string | null {
  const placed = draft.artifact.parts.map(part => part.slotId);
  const fits = (fixture.technical.designs ?? []).filter(design => placed.every(slot => design.slotIds.includes(slot)));
  if (!placed.length || !fits.length) return null;
  return fits.sort((a, b) => a.slotIds.length - b.slotIds.length)[0]!.id;
}

/** Plain-language local test result for the chosen approach: what is wrong and what to change. Advisory only. */
export function pumpTestReport(fixture: IslandSiteFixture, draft: RepairDraft, advice: LocalRepairAdvice, design: Design | undefined): { ok: boolean; lines: string[]; readings: string[] } {
  const lines: string[] = [], readings: string[] = [], m = advice.metrics, flags = advice.flags as Record<string, boolean | undefined>;
  const num = (key: string) => Number(design?.[key]);
  const name = (slot: string) => slotLabel(fixture.id, slot);
  if (!design) return { ok: false, lines: ['These parts do not match one approach. Choose an approach and build only its parts.'], readings };
  const placed = new Set(draft.artifact.parts.map(p => p.slotId));
  const missing = design.slotIds.filter(slot => !placed.has(slot));
  if (missing.length) lines.push(`Missing parts: ${missing.map(name).join(', ')}.`);
  if (flags.budget === false) lines.push(`Over budget: ${advice.materialCost} of ${design.budget} materials.`);
  if (flags.connections === false && !missing.length) {
    const slotOf = new Map(draft.artifact.parts.map(p => [p.id, p.slotId]));
    const have = new Set(draft.artifact.connections.map(e => [slotOf.get(e.from.partId), e.from.portId, slotOf.get(e.to.partId), e.to.portId].join(':')));
    const need = new Set(design.requiredEdges.map(e => e.join(':')));
    const absent = [...need].filter(e => !have.has(e)).map(e => e.split(':')), extra = [...have].filter(e => !need.has(e)).map(e => e.split(':'));
    if (absent.length) lines.push(`Not joined: ${absent.map(([a, , b]) => `${name(a!)} → ${name(b!)}`).join(', ')}.`);
    if (extra.length) lines.push(`Pipe going the wrong way: ${extra.map(([a, , b]) => `${name(a!)} → ${name(b!)}`).join(', ')}. Remove it.`);
  }
  if ('pressure' in m) {
    const lo = num('pressureMin'), hi = num('pressureMax'), need = num('trunkMin');
    readings.push(`Pressure ${m.pressure} (safe ${lo}–${hi})`, `Village gets ${m.trunkFlow} (needs ${need})`);
    if (m.pressure! > hi) lines.push(`Pressure is too high (${m.pressure}). Open the relief drain or the outlet a notch, or ease the inlet.`);
    else if (m.pressure! < lo) lines.push(`Pressure is too low (${m.pressure}). Open the inlet further or close the relief drain.`);
    if (m.trunkFlow! < need) lines.push(`The village gets ${m.trunkFlow}; it needs at least ${need}. Turn the outlet valve up.`);
    if ('disturbance' in m) {
      readings.push(`Disturbance ${m.disturbance} (max ${num('disturbanceMax')})`);
      if (m.disturbance! > num('disturbanceMax')) lines.push('The pump is still too loud for the reeds. Seat the acoustic housing around it.');
    }
  }
  if ('stored' in m) {
    readings.push(`Stored ${m.stored}`, `Village gets ${m.villageFlow} (needs ${num('minimumDelivery')})`, `Reserve ${m.reserve} (needs ${num('minimumReserve')})`);
    if (m.reserve! < num('minimumReserve')) lines.push('The tank keeps too little in reserve. Store more or deliver less.');
  }
  if (flags.operation === false && !lines.length) lines.push('The approach settings do not match the build. Re-pick the approach to set its mounting and route.');
  if (!advice.valid && !lines.length) lines.push(...advice.feedback);
  return { ok: advice.valid, lines, readings };
}

/** Local test result for any site: the checks that failed, named with what to change. Advisory only. */
export function siteTestReport(fixture: IslandSiteFixture, draft: RepairDraft, advice: LocalRepairAdvice): { ok: boolean; lines: string[]; readings: string[] } {
  const readings = Object.entries(advice.metrics).map(([key, value]) => `${METRIC_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase()} ${value}`);
  const lines = advice.valid ? [] : [...describeRepair(fixture, draft).issues];
  if (!advice.valid && !lines.length) lines.push(...advice.feedback);
  return { ok: advice.valid, lines, readings };
}

export class BuildView {
  readonly root = el('section', 'pb');
  private readonly designs = el('div', 'pb-designs');
  private readonly steps = el('div', 'pb-steps');
  private readonly tray = el('div', 'pb-tray');
  private readonly hint = el('p', 'pb-hint');
  private readonly trayActions = el('div', 'pb-tray-actions');
  private readonly result = el('section', 'pb-result');
  private chosen: string | null = null;
  private pendingSwitch: string | null = null;
  private step: BuildStep = 'place';
  private signature = '';
  private draftKey = '';
  private model: RepairPanelModel | null = null;
  private dependency: DependencyStatus | null = null;
  /** When each approved parent was first seen still waiting for its notice (to delay Resend). */
  private readonly noticeWaitSince = new Map<string, number>();
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  /** Connected mode only: show (or clear) this site's prerequisite-confirmation status. */
  setDependencyStatus(status: DependencyStatus | null): void {
    if (JSON.stringify(status) === JSON.stringify(this.dependency)) return;
    this.dependency = status; this.signature = '';
    if (this.model) this.update(this.model);
  }

  private dependencyCard(): HTMLElement | null {
    const d = this.dependency, fixture = this.model?.fixture;
    if (!d || !fixture || d.siteId !== fixture.id || d.ready || !d.required.length) return null;
    const card = el('section', 'pb-deps');
    card.setAttribute('role', 'status');
    card.append(el('strong', '', 'Waiting for prerequisite confirmations'),
      el('p', '', `${siteTitle(fixture.id)} can be reviewed once its contract has received each finalized approval below. Waiting is not a rejection.`));
    const list = el('ul');
    for (const parent of d.required) {
      const confirmed = d.confirmed.includes(parent), approved = d.approvedParents.includes(parent);
      // A notice normally lands a minute or two after the parent's approval finalizes; offer Resend
      // (a wallet signature) only once it has been waiting a while.
      const waitKey = `${fixture.id}:${parent}`;
      if (!approved || confirmed) this.noticeWaitSince.delete(waitKey); else if (!this.noticeWaitSince.has(waitKey)) this.noticeWaitSince.set(waitKey, Date.now());
      const waited = Date.now() - (this.noticeWaitSince.get(waitKey) ?? Date.now());
      const item = el('li', confirmed ? 'ok' : approved ? 'waiting' : 'missing');
      item.append(el('span', 'pb-deps-mark', confirmed ? '✓' : approved ? '…' : '○'), el('span', 'pb-deps-name', siteTitle(parent)),
        el('span', 'pb-deps-state', confirmed ? 'confirmed' : approved ? (waited < RESEND_AFTER_MS ? 'approved · notice on its way' : 'approved · notice not received yet') : 'not approved yet'));
      if (!confirmed && approved && waited < RESEND_AFTER_MS && !this.noticeTimer) this.noticeTimer = setTimeout(() => { this.noticeTimer = null; this.signature = ''; if (this.model) this.update(this.model); }, RESEND_AFTER_MS - waited + 50);
      if (!confirmed && approved && waited >= RESEND_AFTER_MS) {
        const retry = this.button('pb-deps-retry', () => window.dispatchEvent(new CustomEvent('island:retry-dependency-notification', { detail: { parentSiteId: parent, childSiteId: fixture.id } })), `pb-deps-retry-${parent}`);
        retry.textContent = 'Resend notice';
        retry.title = 'Ask the finalized approval to notify this site again. Needs a wallet signature; it is not a new review.';
        item.append(retry);
      }
      list.append(item);
    }
    card.append(list);
    return card;
  }

  constructor(private readonly send: (action: RepairPanelAction) => void) {
    this.root.setAttribute('aria-label', 'Build the repair');
    const bottom = el('div', 'pb-bottom'), row = el('div', 'pb-row');
    row.append(this.hint, this.trayActions);
    bottom.append(this.steps, row, this.tray);
    this.result.setAttribute('aria-live', 'polite');
    this.root.append(this.designs, this.result, bottom);
  }

  private fixture(): IslandSiteFixture { return this.model!.fixture!; }
  private hasDesigns(): boolean { return !!this.model?.fixture?.technical.designs?.length; }
  private design(): Design | undefined { return this.model?.fixture?.technical.designs?.find(d => d.id === this.chosen); }
  /** The sockets in play: the chosen approach's, or every socket on single-design sites. */
  private slots(): readonly string[] { return this.hasDesigns() ? this.design()?.slotIds ?? [] : this.model?.fixture?.slotIds ?? []; }
  private budget(): number { return this.design()?.budget ?? this.fixture().budget; }
  private requiredEdges(): readonly (readonly string[])[] { return this.design()?.requiredEdges ?? this.fixture().technical.requiredEdges; }

  /** Blueprint slots for the renderer. */
  get blueprint(): readonly string[] { return this.slots(); }
  get currentStep(): BuildStep { return this.step; }
  /** One line for the goal banner. */
  get guidance(): string {
    const model = this.model;
    if (!model?.fixture || !model.draft) return '';
    if (!this.hasDesigns()) return repairGuidance(model.fixture, model.draft, model.advisory, model.mode);
    const name = this.chosen ? DESIGN_COPY[this.chosen]?.name : null;
    return name ? `${name}: place its parts, connect the pipes, set the dials, then Test.` : 'Choose how to bring water back: a direct pump, a quiet pump, or a rain cistern.';
  }

  update(model: RepairPanelModel): void {
    this.model = model;
    const fixture = model.fixture!, draft = model.draft!;
    // Re-read the approach only on a new visit (or before any choice): edits from a switch are still in flight.
    if (fixture.id !== this.draftKey || (this.hasDesigns() && !this.chosen)) { this.draftKey = fixture.id; this.chosen = inferPumpDesign(fixture, draft); this.pendingSwitch = null; }
    this.step = model.activeTab === 'connect' ? 'connect' : model.activeTab === 'configure' ? 'set' : 'place';
    this.root.dataset.site = fixture.id;
    const signature = JSON.stringify([fixture.id, draft.artifact, model.selectedSlot, model.selectedOption, model.activeTab, model.sourcePort, model.targetPort, model.readOnly, model.status.phase, model.advisory, this.chosen, this.pendingSwitch]);
    if (signature === this.signature) return;
    this.signature = signature;
    // Redraws replace buttons; keep keyboard focus on the same control so it survives a tick.
    const focused = document.activeElement instanceof HTMLElement && this.root.contains(document.activeElement) ? document.activeElement.dataset.key : undefined;
    this.renderDesigns();
    this.renderSteps();
    this.renderTray();
    this.renderResult();
    if (focused) this.root.querySelector<HTMLElement>(`[data-key="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  }

  private renderResult(): void {
    const model = this.model!, advice = model.advisory;
    this.result.hidden = !advice && model.status.phase !== 'testing';
    if (model.status.phase === 'testing') { this.result.className = 'pb-result running'; this.result.replaceChildren(el('strong', '', noun(this.fixture().id).running)); return; }
    if (!advice) return;
    const report = this.hasDesigns() ? pumpTestReport(this.fixture(), model.draft!, advice, this.design()) : siteTestReport(this.fixture(), model.draft!, advice);
    this.result.className = `pb-result ${report.ok ? 'ok' : 'fix'}`;
    const readings = el('div', 'pb-readings');
    for (const text of report.readings) readings.append(el('span', '', text));
    const list = el('ul');
    for (const line of report.lines) list.append(el('li', '', line));
    this.result.replaceChildren(el('strong', '', report.ok ? '✓ Test passed' : 'Needs a change'), readings, ...(report.lines.length ? [list] : []),
      el('p', 'pb-note', report.ok ? 'A local check only. Now answer the council in one line, then submit.' : 'A local check only; nothing is lost.'));
  }

  private button(className: string, onClick: () => void, key: string): HTMLButtonElement {
    const button = el('button', `pb-button ${className}`);
    button.type = 'button';
    button.dataset.key = key;
    button.addEventListener('click', onClick);
    if (this.model?.readOnly && key !== 'pb-step-place' && key !== 'pb-step-connect' && key !== 'pb-step-set') button.disabled = true;
    return button;
  }

  private placedSlots(): Set<string> { return new Set(this.model!.draft!.artifact.parts.map(part => part.slotId)); }
  private placed(slot: string) { return this.model!.draft!.artifact.parts.find(part => part.slotId === slot); }
  private options(slot: string) { return this.fixture().options.filter(option => option.allowedSlots?.includes(slot)); }
  /** The fitted stock, or the first that fits an empty socket. */
  private option(slot: string) { const id = this.placed(slot)?.optionId; return this.options(slot).find(option => option.id === id) ?? this.options(slot)[0]; }
  private cost(slot: string): number { return Number(this.option(slot)?.facts.cost ?? 0); }

  private renderDesigns(): void {
    const fixture = this.fixture(), placed = this.placedSlots();
    const cards: Node[] = [];
    const deps = this.dependencyCard();
    if (deps) cards.push(deps);
    // The council's question from the start, so the player builds with it in mind (answered in one line before review).
    if (fixture.councilQuestion) { const council = el('div', 'pb-council'); council.append(el('span', 'pb-council-title', 'The council will ask'), el('p', 'pb-council-q', fixture.councilQuestion)); cards.push(council); }
    if (this.hasDesigns()) {
      cards.push(el('div', 'pb-heading', 'Choose an approach'));
      for (const design of fixture.technical.designs ?? []) {
        const copy = DESIGN_COPY[design.id] ?? { name: design.id.replaceAll('_', ' '), tradeoff: '' };
        const card = this.button('pb-design', () => this.choose(design.id), `pb-design-${design.id}`);
        card.setAttribute('aria-pressed', String(this.chosen === design.id));
        card.append(el('strong', '', copy.name), el('span', 'pb-tradeoff', copy.tradeoff), el('span', 'pb-meta', `${design.slotIds.length} parts · budget ${design.budget}`));
        cards.push(card);
        if (this.chosen === design.id) {
          // The blueprint's fixed setup, shown as what the draft actually holds. Choosing the approach set it; parts are still the player's to build.
          const setup = el('div', 'pb-setup'), config = this.model!.draft!.artifact.configuration;
          setup.setAttribute('aria-label', 'Blueprint setup');
          setup.append(el('span', 'pb-setup-title', 'Blueprint setup'));
          for (const field of SETUP_FIELDS) {
            const ok = config[field] === design[field];
            const row = el('span', `pb-setup-row${ok ? '' : ' off'}`);
            row.append(el('span', '', CONFIG_FIELD_LABELS[field]), el('b', '', `${ok ? '✓ ' : ''}${setupLabel(config[field])}`));
            setup.append(row);
          }
          if (SETUP_FIELDS.some(field => config[field] !== design[field]) && !this.model!.readOnly) {
            const fix = this.button('pb-setup-fix', () => this.apply(design.id), 'pb-setup-apply');
            fix.textContent = 'Use this blueprint setup';
            setup.append(fix);
          }
          cards.push(setup);
        }
      }
      if (this.pendingSwitch) {
        const next = fixture.technical.designs!.find(d => d.id === this.pendingSwitch)!;
        const clears = [...placed].filter(slot => !next.slotIds.includes(slot));
        const confirm = el('div', 'pb-confirm');
        confirm.setAttribute('role', 'alertdialog');
        confirm.append(el('p', '', `Switch to the ${DESIGN_COPY[next.id]?.name ?? next.id}? This clears ${clears.length} placed part${clears.length === 1 ? '' : 's'} it doesn't use and switches to its blueprint setup: ${SETUP_FIELDS.map(field => setupLabel(next[field])).join(', ')}.`));
        const row = el('div', 'pb-confirm-row');
        const yes = this.button('pb-primary', () => this.apply(next.id), 'pb-switch-confirm'); yes.textContent = 'Switch';
        const no = this.button('', () => { this.pendingSwitch = null; this.signature = ''; this.update(this.model!); }, 'pb-switch-cancel'); no.textContent = 'Keep building';
        row.append(yes, no); confirm.append(row);
        cards.push(confirm);
      }
    } else {
      // Single-design sites: what to check (the site's own checklist) and its setup.
      const learning = describeRepair(fixture, this.model!.draft!);
      cards.push(el('div', 'pb-heading', 'What to check'));
      const checklist = el('div', 'pb-checklist');
      for (const [i, step] of learning.steps.entries()) {
        const item = this.button(`pb-check${step.done ? ' done' : ''}`, () => { this.send({ type: 'selectSlot', slotId: step.slot }); this.send({ type: 'selectTab', tab: step.tab }); }, `pb-check-${i}`);
        item.append(el('span', 'pb-check-mark', step.done ? '✓' : String(i + 1)), el('span', '', step.label));
        checklist.append(item);
      }
      cards.push(checklist);
      const setup = el('div', 'pb-setup solo'), config = this.model!.draft!.artifact.configuration, lists = fixture.configurationOptions;
      setup.append(el('span', 'pb-setup-title', 'Site setup'));
      const choices = { mountZoneId: lists.mountZoneIds, outputModeId: lists.outputModeIds, routeId: lists.routeIds } as const;
      for (const field of SETUP_FIELDS) {
        const row = el('span', 'pb-setup-row');
        row.append(el('span', '', CONFIG_FIELD_LABELS[field]));
        if (choices[field].length > 1) {
          const group = el('span', 'pb-chips');
          for (const value of choices[field]) {
            const chip = this.button('pb-chip', () => this.send({ type: 'setConfig', field, value }), `pb-setup-${field}-${value}`);
            chip.textContent = setupLabel(value); chip.setAttribute('aria-pressed', String(config[field] === value));
            group.append(chip);
          }
          row.append(group);
        } else row.append(el('b', '', setupLabel(config[field])));
        setup.append(row);
      }
      cards.push(setup);
    }
    if (this.slots().length) {
      const used = [...placed].reduce((sum, slot) => sum + this.cost(slot), 0), budget = this.budget();
      const meter = el('div', 'pb-budget');
      const bar = el('span', 'pb-budget-bar'); bar.style.width = `${Math.min(100, used / budget * 100)}%`;
      bar.classList.toggle('over', used > budget);
      meter.append(el('span', 'pb-budget-label', `Materials ${used} / ${budget}`), bar);
      cards.push(meter);
    }
    this.designs.replaceChildren(...cards);
  }

  private choose(id: string): void {
    if (this.model?.readOnly || id === this.chosen) return;
    const next = this.fixture().technical.designs!.find(d => d.id === id)!;
    const clears = [...this.placedSlots()].filter(slot => !next.slotIds.includes(slot));
    if (clears.length) { this.pendingSwitch = id; this.signature = ''; this.update(this.model!); return; }
    this.apply(id);
  }

  /** Commit an approach: clear parts it does not use and declare its mounting, mode and route. Nothing is built for the player. */
  private apply(id: string): void {
    const next = this.fixture().technical.designs!.find(d => d.id === id)!;
    for (const slot of this.placedSlots()) if (!next.slotIds.includes(slot)) this.send({ type: 'removePart', slotId: slot });
    this.send({ type: 'setConfig', field: 'mountZoneId', value: next.mountZoneId });
    this.send({ type: 'setConfig', field: 'outputModeId', value: next.outputModeId });
    this.send({ type: 'setConfig', field: 'routeId', value: next.routeId });
    this.chosen = id; this.pendingSwitch = null; this.signature = '';
    this.send({ type: 'selectTab', tab: 'parts' });
    const first = next.slotIds.find(slot => !this.placedSlots().has(slot));
    if (first) this.send({ type: 'selectSlot', slotId: first });
    this.update(this.model!);
  }

  private links(): number { return this.model!.draft!.artifact.connections.length; }
  private settable(): string[] { return this.slots().filter(slot => this.placedSlots().has(slot) && (this.option(slot)?.allowedSettings?.length ?? 0) > 1); }

  private renderSteps(): void {
    const slots = this.slots(), placed = this.placedSlots(), ready = slots.length > 0;
    const done = slots.filter(slot => placed.has(slot)).length, words = noun(this.fixture().id);
    const items: [BuildStep, string, string, 'parts' | 'connect' | 'configure'][] = [
      ['place', 'Place', `${done}/${slots.length}`, 'parts'],
      ['connect', 'Connect', `${this.links()}/${this.requiredEdges().length}`, 'connect'],
      ['set', 'Set', `${this.settable().length} dial${this.settable().length === 1 ? '' : 's'}`, 'configure'],
    ];
    const nodes = items.map(([id, label, count, tab], i) => {
      const button = this.button('pb-step', () => this.send({ type: 'selectTab', tab }), `pb-step-${id}`);
      button.setAttribute('aria-pressed', String(this.step === id));
      button.disabled = !ready;
      button.title = id === 'connect' ? `Join the ${words.links}` : '';
      button.append(el('span', 'pb-step-n', String(i + 1)), el('span', '', label), el('span', 'pb-step-count', count));
      return button;
    });
    const test = el('span', 'pb-step pb-step-test');
    test.append(el('span', 'pb-step-n', '4'), el('span', '', 'Test'));
    this.steps.replaceChildren(...nodes, test);
  }

  private renderTray(): void {
    const model = this.model!;
    this.trayActions.replaceChildren();
    if (!this.slots().length) {
      this.hint.textContent = 'Pick one of the three approaches to see its parts.';
      this.tray.replaceChildren();
      return;
    }
    if (this.step === 'place') this.placeTray();
    else if (this.step === 'connect') this.connectTray();
    else this.setTray();
    this.tray.dataset.step = this.step;
    if (model.readOnly) this.hint.textContent = model.status.message ?? 'This design is saved and cannot be edited now.';
  }

  private placeTray(): void {
    const model = this.model!, fixture = this.fixture(), placed = this.placedSlots(), slots = this.slots(), machine = noun(fixture.id).machine;
    const held = model.selectedOption && !placed.has(model.selectedSlot ?? '') ? model.selectedSlot : null;
    const selectedPlaced = model.selectedSlot && placed.has(model.selectedSlot) ? model.selectedSlot : null;
    const fitted = selectedPlaced ? this.placed(selectedPlaced)! : null;
    this.hint.textContent = held ? `Now tap the glowing socket on the ${machine}, or press Place.`
      : fitted ? `${partLabel(fixture.id, fitted.optionId)} is fitted${fitted.orientationQuarterTurns ? `, turned ${fitted.orientationQuarterTurns * 90}°` : ''}. Rotate, swap or remove it.`
      : placed.size < slots.length ? `Tap a part, then its glowing socket on the ${machine}.` : `Every part is fitted. Tap one to check it, or connect the ${noun(fixture.id).links}.`;
    const cards: Node[] = [];
    for (const slot of slots) {
      const option = this.option(slot);
      if (!option) continue;
      const card = this.button('pb-part', () => {
        this.send({ type: 'selectSlot', slotId: slot });
        if (!placed.has(slot)) this.send({ type: 'selectPart', optionId: option.id });
      }, `pb-part-${slot}`);
      card.classList.toggle('placed', placed.has(slot));
      card.setAttribute('aria-pressed', String(model.selectedSlot === slot));
      const name = partLabel(fixture.id, option.id);
      card.setAttribute('aria-label', `${name}${placed.has(slot) ? ', fitted' : ''}, cost ${this.cost(slot)}`);
      const glyph = el('span', 'pb-icon'); glyph.innerHTML = icon(option.kind);
      card.append(glyph, el('span', 'pb-part-name', name), el('span', 'pb-cost', placed.has(slot) ? '✓' : String(this.cost(slot))));
      cards.push(card);
    }
    const actions: HTMLElement[] = [];
    if (held) {
      // Sockets with more than one stock (weights, gears): choose which before placing.
      for (const variant of this.options(held)) if (this.options(held).length > 1) {
        const chip = this.button('pb-variant', () => this.send({ type: 'selectPart', optionId: variant.id }), `pb-variant-${variant.id}`);
        chip.textContent = partLabel(fixture.id, variant.id); chip.setAttribute('aria-pressed', String(model.selectedOption === variant.id));
        actions.push(chip);
      }
      const place = this.button('pb-primary', () => this.send({ type: 'placePart', slotId: held, optionId: model.selectedOption! }), 'pb-place');
      place.textContent = 'Place'; actions.push(place);
    }
    if (fitted && selectedPlaced) {
      for (const variant of this.options(selectedPlaced)) if (this.options(selectedPlaced).length > 1 && variant.id !== fitted.optionId) {
        const swap = this.button('pb-variant', () => this.send({ type: 'placePart', slotId: selectedPlaced, optionId: variant.id }), `pb-swap-${variant.id}`);
        swap.textContent = `Swap: ${partLabel(fixture.id, variant.id)}`; actions.push(swap);
      }
      const rotate = this.button('', () => this.send({ type: 'rotatePart', partId: fitted.id, quarterTurns: 1 }), 'pb-rotate');
      rotate.textContent = `↻ Rotate (${fitted.orientationQuarterTurns * 90}°)`; actions.push(rotate);
      const remove = this.button('', () => this.send({ type: 'removePart', slotId: selectedPlaced }), 'pb-remove');
      remove.textContent = 'Remove'; actions.push(remove);
    }
    if (placed.size >= slots.length && !fitted) {
      const next = this.button('pb-primary', () => this.send({ type: 'selectTab', tab: 'connect' }), 'pb-next-connect');
      next.textContent = `Connect ${noun(fixture.id).links} →`; actions.push(next);
    }
    this.trayActions.replaceChildren(...actions);
    this.tray.replaceChildren(el('div', 'pb-parts'));
    this.tray.firstElementChild!.append(...cards);
  }

  private connectTray(): void {
    const model = this.model!, fixture = this.fixture(), draft = model.draft!, words = noun(fixture.id);
    const from = model.sourcePort && !model.targetPort ? model.sourcePort : null;
    const slotOf = (e: RepairEndpoint) => draft.artifact.parts.find(p => p.id === e.partId)?.slotId ?? e.partId;
    const label = (e: RepairEndpoint) => portLabel(fixture.id, slotOf(e), e.portId);
    this.hint.textContent = from ? `From ${label(from)}: now tap the port it should feed.` : `Tap an outlet ● on the ${words.machine}, then the inlet ○ it feeds.`;
    const list = el('div', 'pb-links');
    for (const edge of draft.artifact.connections) {
      const chip = el('span', 'pb-link');
      chip.dataset.channel = edge.channel;
      chip.append(el('span', '', `${label(edge.from)} → ${label(edge.to)}`));
      const remove = this.button('pb-link-remove', () => this.send({ type: 'removeConnection', connection: edge }), `pb-unlink-${edge.from.partId}-${edge.from.portId}-${edge.to.partId}-${edge.to.portId}`);
      remove.textContent = '×'; remove.setAttribute('aria-label', `Remove link ${label(edge.from)} to ${label(edge.to)}`);
      chip.append(remove);
      list.append(chip);
    }
    if (!draft.artifact.connections.length) list.append(el('span', 'pb-empty', `No ${words.links} joined yet.`));
    // Keyboard and screen-reader path: the selected part's ports as buttons.
    const ports = el('div', 'pb-ports');
    const part = draft.artifact.parts.find(p => p.slotId === model.selectedSlot);
    const option = fixture.options.find(o => o.id === part?.optionId);
    for (const port of option?.ports ?? []) {
      const endpoint = { partId: part!.id, portId: port.id };
      const button = this.button('pb-port', () => this.send({ type: 'tapPort', endpoint }), `pb-port-${part!.id}-${port.id}`);
      button.dataset.direction = port.direction;
      button.setAttribute('aria-pressed', String(sameEnd(endpoint, from)));
      button.textContent = `${port.direction === 'in' ? '○' : '●'} ${portLabel(fixture.id, part!.slotId, port.id)}`;
      ports.append(button);
    }
    // With a starting port held, every port it can feed is listed here, so joining never depends on
    // hitting a small 3D target (ports on different parts can sit close together on screen).
    const targets = el('div', 'pb-targets');
    if (from) {
      const fromPart = draft.artifact.parts.find(p => p.id === from.partId);
      const fromPort = fixture.options.find(o => o.id === fromPart?.optionId)?.ports.find(p => p.id === from.portId);
      if (fromPort) {
        targets.append(el('span', 'pb-targets-label', 'Connect to'));
        const options: { button: HTMLButtonElement; rank: number }[] = [];
        for (const other of draft.artifact.parts) {
          if (other.id === from.partId) continue;
          for (const port of fixture.options.find(o => o.id === other.optionId)?.ports ?? []) {
            const fits = port.channel === fromPort.channel && (fromPort.direction === 'in' ? port.direction !== 'in' : port.direction !== 'out');
            const linked = draft.artifact.connections.some(e => (sameEnd(e.from, from) && e.to.partId === other.id && e.to.portId === port.id) || (sameEnd(e.to, from) && e.from.partId === other.id && e.from.portId === port.id));
            if (!fits || linked) continue;
            const endpoint = { partId: other.id, portId: port.id };
            const button = this.button('pb-port pb-target', () => this.send({ type: 'tapPort', endpoint }), `pb-target-${other.id}-${port.id}`);
            button.dataset.direction = port.direction;
            button.textContent = `${port.direction === 'in' ? '○' : '●'} ${portLabel(fixture.id, other.slotId, port.id)}`;
            // Free ports first, and a matching name (anchor → anchor) before others.
            const used = draft.artifact.connections.some(e => (e.to.partId === other.id && e.to.portId === port.id) || (e.from.partId === other.id && e.from.portId === port.id));
            options.push({ button, rank: (used ? 2 : 0) + (port.id === from.portId ? 0 : 1) });
          }
        }
        targets.append(...options.sort((a, b) => a.rank - b.rank).map(o => o.button));
      }
    }
    // While a port is held, the selected part's column keeps only ports it could join (with their usual
    // keys), and the Connect-to list covers the other parts.
    if (from) for (const button of [...ports.querySelectorAll<HTMLButtonElement>('.pb-port')]) if (!targets.querySelector(`[data-key="${button.dataset.key!.replace('pb-port-', 'pb-target-')}"]`)) button.remove();
    for (const button of [...targets.querySelectorAll<HTMLButtonElement>('.pb-target')]) if (ports.querySelector(`[data-key="${button.dataset.key!.replace('pb-target-', 'pb-port-')}"]`)) button.remove();
    this.tray.replaceChildren(list, ...(ports.childElementCount ? [ports] : []), ...(targets.childElementCount > 1 ? [targets] : []));
  }

  private setTray(): void {
    const model = this.model!, fixture = this.fixture(), draft = model.draft!;
    const slots = this.settable();
    this.hint.textContent = slots.length ? 'Turn each dial to a setting, then Test.' : this.placedSlots().size ? 'Nothing here has a dial. Test when ready.' : 'Place parts first; their dials appear here.';
    const dials = slots.map(slot => {
      const part = draft.artifact.parts.find(p => p.slotId === slot)!, option = this.option(slot)!, settings = option.allowedSettings!;
      const index = Math.max(0, settings.indexOf(part.settingId));
      const card = el('div', 'pb-dial');
      card.classList.toggle('selected', model.selectedSlot === slot);
      const face = el('div', 'pb-dial-face');
      face.style.setProperty('--turn', `${(index / Math.max(1, settings.length - 1)) * 240 - 120}deg`);
      for (const [i] of settings.entries()) { const tick = el('i'); tick.style.setProperty('--at', `${(i / Math.max(1, settings.length - 1)) * 240 - 120}deg`); tick.classList.toggle('on', i === index); face.append(tick); }
      const step = (delta: number) => {
        this.send({ type: 'selectSlot', slotId: slot });
        this.send({ type: 'setSetting', partId: part.id, settingId: settings[(index + delta + settings.length) % settings.length]! });
      };
      const minus = this.button('pb-dial-step', () => step(-1), `pb-dial-${slot}-down`); minus.textContent = '−'; minus.setAttribute('aria-label', `Lower ${partLabel(fixture.id, option.id)}`);
      const plus = this.button('pb-dial-step', () => step(1), `pb-dial-${slot}-up`); plus.textContent = '+'; plus.setAttribute('aria-label', `Raise ${partLabel(fixture.id, option.id)}`);
      const row = el('div', 'pb-dial-row'); row.append(minus, face, plus);
      card.append(el('strong', '', partLabel(fixture.id, option.id)), row, el('span', 'pb-dial-value', configLabel(part.settingId)));
      return card;
    });
    this.tray.replaceChildren(...dials);
  }
}
