/**
 * Isolated council preview. MOCK DATA ONLY: this page never imports the World,
 * saves, wallet or live adapter, so nothing here can restore a real site.
 */
import { assertCouncilResult, COUNCIL_ROLES } from '../genlayer/council/types';
import type { CouncilPresentation, CouncilResult, MockCouncilPresentation, VillagePumpDesignId } from '../genlayer/council/types';
import { VILLAGE_PUMP_COUNCIL_MOCKS } from '../genlayer/council/mock-fixtures';
import { CouncilScene } from '../render/council/council-scene';
import { CouncilOverlay, button } from '../ui/council/council-overlay';
import { STATUS_COPY } from '../ui/council/council-copy';

const host = document.getElementById('council-world')!;
const scene = await CouncilScene.create(host);
const ui = new CouncilOverlay(document.getElementById('council-interface')!);
document.body.classList.add('ready');

let design: VillagePumpDesignId | null = null;
let thinking = false;
let thinkTimer = 0;
let thinker = 0;
let run = 0; // invalidates an in-flight reveal when the state changes
let skip: (() => void) | null = null;

const wait = (ms: number, token: number) => new Promise<boolean>(resolve => {
  const id = window.setTimeout(() => { skip = null; resolve(token === run); }, ms);
  skip = () => { window.clearTimeout(id); skip = null; resolve(token === run); };
});
ui.onSkip = () => skip?.();
window.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { if (skip) { e.preventDefault(); skip(); } } });

scene.onFrame = dt => {
  thinkTimer -= dt;
  if (thinking && thinkTimer <= 0) { thinker = (thinker + 1 + Math.floor(Math.random() * 2)) % 4; thinkTimer = 1.6 + Math.random() * 1.2; }
  COUNCIL_ROLES.forEach((role, i) => ui.setBubble(i, scene.bubblePosition(role), thinking && i === thinker));
};

function seatCouncil(): void { for (const a of scene.actors.values()) a.sit(); }

function choose(): void {
  run++;
  thinking = false;
  ui.setCinematic(false);
  ui.setMock(null);
  seatCouncil();
  scene.setFire('steady');
  scene.showSite(design, null);
  scene.setShot('site');
  ui.showChoice(design, id => { design = id; choose(); }, () => present({ ...VILLAGE_PUMP_COUNCIL_MOCKS.pending, chosenDesignId: design! }));
}

/** Render one display-only presentation. Mock and live share this path later. */
function present(p: CouncilPresentation): void {
  run++;
  const token = run;
  design = p.chosenDesignId;
  ui.setMock(p.source === 'mock' ? p.message : null);
  ui.setCinematic(false);
  scene.showSite(design, null);
  switch (p.status) {
    case 'pending':
    case 'accepted': {
      seatCouncil();
      thinking = true;
      scene.setFire(p.status === 'accepted' ? 'bright' : 'steady');
      scene.setShot('council');
      const copy = p.status === 'pending' ? STATUS_COPY.deliberating : STATUS_COPY.provisional;
      ui.showStatus(p.status === 'pending' ? 'deliberating' : 'provisional', copy.title, copy.line, [button('Visit the pump site', 'secondary', () => scene.setShot('site'))]);
      return;
    }
    case 'timed_out': {
      seatCouncil();
      thinking = false;
      scene.setFire('low');
      scene.setShot('council');
      const check = button('Check on my plan', 'primary', () => {
        ui.showStatus('timeout', STATUS_COPY.timedOut.title, 'Mock preview: the live game re-reads your existing transaction here. It never sends the plan again.', [button('Back to the plan', 'secondary', choose)]);
      });
      ui.showStatus('timeout', STATUS_COPY.timedOut.title, STATUS_COPY.timedOut.line, [button('Keep exploring', 'secondary', () => scene.setShot('wide')), check]);
      return;
    }
    case 'failed': {
      seatCouncil();
      thinking = false;
      scene.setFire('low');
      scene.setShot('council');
      ui.showStatus('failed', STATUS_COPY.failed.title, STATUS_COPY.failed.line, [button('Back to the plan', 'primary', choose)]);
      return;
    }
    case 'finalized':
      void reveal(p.result, token);
  }
}

async function reveal(result: CouncilResult, token: number): Promise<void> {
  assertCouncilResult(result);
  thinking = false;
  ui.setCinematic(true);
  ui.hidePanel();
  scene.setFire('bright');
  scene.setShot('council');
  if (!await wait(900, token)) return;
  for (const [i, perspective] of result.perspectives.entries()) {
    const actor = scene.actors.get(perspective.role)!;
    scene.setShot({ speaker: perspective.role });
    actor.stand();
    if (!await wait(900, token)) return;
    actor.react(perspective.stance);
    ui.showSpeaker(perspective, i);
    if (!await wait(3600, token)) return;
    actor.settle();
  }
  ui.setCinematic(false);
  scene.setShot('site');
  const approved = result.decision === 'approve';
  scene.showSite(result.chosenDesignId, approved ? result.consequences : null);
  scene.setFire(approved ? 'bright' : 'steady');
  const actions = approved
    ? [button('Replay reveal', 'secondary', () => present(VILLAGE_PUMP_COUNCIL_MOCKS[mockKeyFor(result)])), button('Look around', 'primary', () => scene.setShot('wide'))]
    : [button('Back to the plan', 'primary', () => { design = result.chosenDesignId; choose(); })];
  ui.showVerdict(result, actions, 'mock');
}

function mockKeyFor(result: CouncilResult): keyof typeof VILLAGE_PUMP_COUNCIL_MOCKS {
  const entry = Object.entries(VILLAGE_PUMP_COUNCIL_MOCKS).find(([, m]) => m.status === 'finalized' && m.result === result);
  return (entry?.[0] ?? 'approveGood') as keyof typeof VILLAGE_PUMP_COUNCIL_MOCKS;
}

// Demo-only switcher, clearly labelled. It feeds the same present() path.
const dev = document.createElement('details');
dev.className = 'dev-panel';
dev.open = window.innerWidth > 760;
const summary = document.createElement('summary');
summary.textContent = 'Mock states';
dev.append(summary);
const group = (label: string, items: [string, () => void][]) => {
  const g = document.createElement('div');
  g.className = 'dev-group';
  const l = document.createElement('span');
  l.className = 'dev-label'; l.textContent = label;
  g.append(l, ...items.map(([text, fn]) => button(text, '', fn)));
  dev.append(g);
};
const withDesign = (m: MockCouncilPresentation): MockCouncilPresentation => (m.status === 'finalized' ? m : { ...m, chosenDesignId: design ?? m.chosenDesignId });
group('Flow', [['Choose a design', choose]]);
group('Waiting', [
  ['Deliberating', () => present(withDesign(VILLAGE_PUMP_COUNCIL_MOCKS.pending))],
  ['Provisional', () => present(withDesign(VILLAGE_PUMP_COUNCIL_MOCKS.accepted))],
  ['Timed out', () => present(withDesign(VILLAGE_PUMP_COUNCIL_MOCKS.timeout))],
  ['Failed', () => present(withDesign(VILLAGE_PUMP_COUNCIL_MOCKS.failed))],
]);
group('Simulated final result', [
  ['Approve · acceptable', () => present(VILLAGE_PUMP_COUNCIL_MOCKS.approveAcceptable)],
  ['Approve · good', () => present(VILLAGE_PUMP_COUNCIL_MOCKS.approveGood)],
  ['Approve · excellent', () => present(VILLAGE_PUMP_COUNCIL_MOCKS.approveExcellent)],
  ['Revise', () => present(VILLAGE_PUMP_COUNCIL_MOCKS.revise)],
]);
document.getElementById('council-interface')!.append(dev);

// Deep links for capture: ?state=approveGood etc.
const requested = new URLSearchParams(location.search).get('state') as keyof typeof VILLAGE_PUMP_COUNCIL_MOCKS | null;
for (const a of scene.actors.values()) a.sit(true);
scene.showSite(null, null, true);
if (requested && requested in VILLAGE_PUMP_COUNCIL_MOCKS) present(VILLAGE_PUMP_COUNCIL_MOCKS[requested]);
else choose();

if (import.meta.env.DEV) Object.assign(window, { __council: { scene, present, mocks: VILLAGE_PUMP_COUNCIL_MOCKS } });
