import { getSlotOptions, REPAIR_LIMITS } from '../genlayer';
import type {
  IslandSiteFixture, LocalRepairAdvice, Mode, RepairArtifact, RepairConnection,
  RepairDraft, RepairEndpoint, RepairPart, RepairState, SiteFixture,
} from '../genlayer';
import './repair-panel.css';
import { PLAYER_COPY,MODE_COPY,STATUS_COPY,siteCopy,partLabel,slotLabel,configLabel,portLabel,CONFIG_FIELD_LABELS,CHANNEL_LABELS,factLabel,materialsLabel } from './player-copy';
import { repairGuidance } from './quest-guide';
import { describeRepair } from './repair-learning';
import { BuildView, type BuildStep, type DependencyStatus } from './build-view';

export type RepairPanelTab = 'parts' | 'configure' | 'connect';
export type RepairPanelView = 'closed' | 'construct' | 'rationale' | 'review' | 'feedback' | 'status';
export type RepairConfigField = keyof RepairArtifact['configuration'];
export interface RepairPanelRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface RepairPanelAnchor {
  /** CSS pixels relative to the inset render rect returned by panel.layout.inset. */
  readonly x: number;
  readonly y: number;
  readonly slotId?: string;
  readonly endpoint?: RepairEndpoint;
}
export interface RepairPanelLayout {
  readonly inset: RepairPanelRect;
  readonly protectedScene: RepairPanelRect;
  readonly keyboardOpen: boolean;
  /** Village pump build view: the chosen approach's sockets and the active step (presentation only). */
  readonly blueprint?: readonly string[];
  readonly buildStep?: BuildStep;
}

/** Immutable controller snapshot; UI never edits draft, tests it, or determines restoration.
 * Echo actions back through update(). In review, supply the frozen reviewed draft;
 * controller must invalidate review on subsequent edits and handle explicit submit.
 * Render the actual assembly into layout.inset (scissor or a live secondary view).
 * World ray picks can emit the same selectSlot/placePart/focusPort commands directly.
 * layout.protectedScene is the camera framing target, including soft keyboard mode.
 * view=status closes construction during pending exploration; view=closed hides all.
 */
export interface RepairPanelModel {
  readonly fixture: IslandSiteFixture | null;
  readonly draft: RepairDraft | null;
  readonly selectedSlot: string | null;
  readonly selectedOption: string | null;
  readonly activeTab: RepairPanelTab;
  readonly view: RepairPanelView;
  readonly mode: Mode;
  readonly diagnosis: string;
  readonly status: Readonly<{ phase: 'editing' | 'testing' | RepairState['status']; message?: string }>;
  readonly advisory: LocalRepairAdvice | null;
  readonly sourcePort?: RepairEndpoint | null;
  readonly targetPort?: RepairEndpoint | null;
  readonly anchors?: readonly RepairPanelAnchor[];
  /** Controller can block edits while a frozen submission is being prepared. */
  readonly readOnly?: boolean;
}

export type RepairPanelAction =
  | Readonly<{ type: 'selectTab'; tab: RepairPanelTab }>
  | Readonly<{ type: 'selectPart'; optionId: string }>
  | Readonly<{ type: 'placePart'; optionId: string; slotId: string }>
  | Readonly<{ type: 'selectSlot'; slotId: string }>
  | Readonly<{ type: 'removePart'; slotId: string }>
  | Readonly<{ type: 'tapPort'; endpoint: RepairEndpoint }>
  | Readonly<{ type: 'rotatePart'; partId: string; quarterTurns: 1 | -1 }>
  | Readonly<{ type: 'setSetting'; partId: string; settingId: string }>
  | Readonly<{ type: 'setConfig'; field: RepairConfigField; value: string }>
  | Readonly<{ type: 'focusPort'; role: 'source' | 'target'; endpoint: RepairEndpoint }>
  | Readonly<{ type: 'join'; connection: RepairConnection }>
  | Readonly<{ type: 'removeConnection'; connection: RepairConnection }>
  | Readonly<{ type: 'editRationale'; value: string }>
  | Readonly<{ type: 'test' | 'openRationale' | 'review' | 'submit' | 'back' | 'exit' | 'openFeedback' }>;

type PartOption = SiteFixture['options'][number];
type PortChoice = { endpoint: RepairEndpoint; channel: RepairConnection['channel']; direction: 'in' | 'out' | 'bidirectional'; label: string };

const pretty = (value: string): string => value.replace(/_/g, ' ');
const samePort = (a: RepairEndpoint | null | undefined, b: RepairEndpoint | null | undefined): boolean =>
  !!a && !!b && a.partId === b.partId && a.portId === b.portId;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};
const setText = (node: HTMLElement, text: string): void => { if (node.textContent !== text) node.textContent = text; };

/** StageB placeholder controls. No engine imports, canvas substitute, signing or network calls. */
export class RepairPanel {
  private readonly root = element('section', 'repair-panel');
  private readonly modeLabel = element('div', 'rp-mode');
  private readonly diagnosis = element('div', 'rp-diagnosis');
  private readonly goal = element('strong', 'rp-goal');
  private readonly guidance = element('span', 'rp-guidance');
  private readonly learning=element('section','rp-learning');private learningSignature='';
  private socketPicker=false;private hintOpen=false;
  private readonly side = element('div', 'rp-side');
  private readonly tabs = element('div', 'rp-tabs');
  private readonly context = element('div', 'rp-context');
  /** Optional mount for an actual live secondary renderer; never supplied with UI artwork. */
  readonly assemblyHost = element('div', 'rp-assembly');
  private readonly anchors = element('div', 'rp-anchors');
  private readonly dock = element('div', 'rp-dock');
  private readonly content = element('div', 'rp-content');
  private readonly actions = element('div', 'rp-actions');
  private readonly drawer = element('div', 'rp-drawer');
  private readonly drawerHeading = element('div', 'rp-drawer-heading');
  private readonly facts = element('div', 'rp-facts');
  // The site council's question: what the GenLayer validators judge the player's one-line answer against.
  private readonly question = element('p', 'rp-council-question');
  private readonly textarea = element('textarea', 'rp-rationale');
  private readonly counts = element('div', 'rp-counts');
  private readonly details = element('div', 'rp-details');
  private readonly drawerActions = element('div', 'rp-drawer-actions');
  private readonly pump: BuildView;
  private readonly exitButton: HTMLButtonElement;
  private readonly statusButton: HTMLButtonElement;
  private model: RepairPanelModel | null = null;
  private width = 1920;
  private height = 1080;
  private page = 0;
  private configIndex = 0;
  private portRole: 'source' | 'target' = 'source';
  private contentSignature = '';
  private anchorSignature = '';
  private detailsSignature = '';
  private composing = false;
  private disposed = false;
  private lastConstructionFocusKey: string | null = null;
  private layoutValue: RepairPanelLayout = { inset: { x: 0, y: 0, width: 0, height: 0 }, protectedScene: { x: 0, y: 0, width: 0, height: 0 }, keyboardOpen: false };
  get layout(): RepairPanelLayout { return this.layoutValue; }

  constructor(host: HTMLElement, private readonly onAction: (action: RepairPanelAction) => void) {
    this.root.setAttribute('aria-label', 'Contextual repair controls');
    this.root.hidden = true;
    this.diagnosis.setAttribute('role', 'status');
    this.diagnosis.append(this.goal,this.guidance);
    this.tabs.setAttribute('role', 'tablist');
    this.tabs.setAttribute('aria-label', 'Repair tools');
    for (const tab of ['parts', 'configure', 'connect'] as const) {
      const button = this.button(PLAYER_COPY.tabs[tab], () => this.send({ type: 'selectTab', tab }), `tab-${tab}`);
      button.setAttribute('role', 'tab');
      button.dataset.tab = tab;
      this.tabs.append(button);
    }
    this.assemblyHost.setAttribute('aria-hidden', 'true');
    this.side.append(this.tabs, this.context, this.assemblyHost, this.anchors);
    this.actions.append(
      this.button('Test', () => this.send({ type: 'test' }), 'test'),
      this.button('Answer', () => this.send({ type: 'openRationale' }), 'rationale'),
      this.button('Details', () => this.send({ type: 'openFeedback' }), 'feedback'),
      this.button('Hint',()=>{this.hintOpen=!this.hintOpen;this.learningSignature='';this.renderLearning();this.arrange();},'hint'),
    );
    this.dock.append(this.content, this.actions);
    this.textarea.rows = 2;
    this.textarea.setAttribute('aria-label', 'Your one-line answer to the council');
    this.textarea.setAttribute('aria-describedby', 'repair-council-question repair-rationale-counts');
    this.question.id = 'repair-council-question';
    // One line only: Enter goes on to Review instead of adding a line break.
    this.textarea.addEventListener('keydown', this.onAnswerKey);
    this.textarea.placeholder = PLAYER_COPY.rationalePlaceholder;
    this.counts.id = 'repair-rationale-counts';
    this.textarea.addEventListener('input', this.onRationaleInput);
    this.textarea.addEventListener('compositionstart', this.onCompositionStart);
    this.textarea.addEventListener('compositionend', this.onCompositionEnd);
    this.textarea.addEventListener('focus', this.onViewportChange);
    this.textarea.addEventListener('blur', this.onViewportChange);
    this.drawerActions.append(
      this.button('Back', () => this.send({ type: 'back' }), 'back'),
      this.button('Review', () => this.send({ type: 'review' }), 'review'),
      this.button('Submit', () => this.send({ type: 'submit' }), 'submit'),
      this.button('Done', () => { this.textarea.blur(); this.send({ type: 'back' }); this.arrange(); }, 'done'),
    );
    this.drawer.append(this.drawerHeading, this.question, this.facts, this.textarea, this.counts, this.details, this.drawerActions);
    this.exitButton = this.button('Exit', () => this.send({ type: 'exit' }), 'exit');
    this.exitButton.classList.add('rp-exit');
    this.statusButton = this.button('', () => this.send({ type: 'openFeedback' }), 'status');
    this.statusButton.classList.add('rp-status');
    this.pump = new BuildView(action => this.send(action));
    this.pump.root.hidden = true;
    // Development only: preview the prerequisite card without a deployment. Grants nothing.
    if (import.meta.env.DEV) Object.assign(window, { __dependencyPreview: (status: DependencyStatus | null) => this.pump.setDependencyStatus(status) });
    this.root.append(this.modeLabel, this.diagnosis,this.learning, this.side, this.pump.root, this.dock, this.drawer, this.statusButton, this.exitButton);
    this.root.addEventListener('keydown', this.onKeyDown);
    this.root.addEventListener('pointerdown', this.onPointerDown);
    window.visualViewport?.addEventListener('resize', this.onViewportChange);
    window.visualViewport?.addEventListener('scroll', this.onViewportChange);
    host.append(this.root);
    this.arrange();
  }

  private button(label: string, callback: () => void, key: string): HTMLButtonElement {
    const button = element('button', 'rp-button', label);
    button.type = 'button';
    button.dataset.key = key;
    button.addEventListener('click', callback);
    return button;
  }

  private send(action: RepairPanelAction): void {
    if (!this.disposed && this.model && this.model.view !== 'closed') this.onAction(action);
  }

  update(model: RepairPanelModel): void {
    if (this.disposed) return;
    const previous = this.model;
    const changedSite = previous?.fixture?.id !== model.fixture?.id;
    const changedView = previous?.view !== model.view;
    if (changedSite || previous?.selectedSlot !== model.selectedSlot || previous?.activeTab !== model.activeTab) this.page = 0;
    if (changedSite) { this.configIndex = 0; this.portRole = 'source'; this.detailsSignature = '';this.hintOpen=false;this.socketPicker=false; }
    if (changedView && model.view === 'rationale') this.lastConstructionFocusKey = document.activeElement instanceof HTMLElement && this.root.contains(document.activeElement) ? document.activeElement.dataset.key ?? null : null;
    this.model = model;
    this.root.hidden = model.view === 'closed' || !model.fixture || !model.draft;
    if (this.root.hidden) { this.arrange(); return; }
    this.root.dataset.view = model.view;
    this.root.dataset.tab = model.activeTab;
    setText(this.modeLabel, MODE_COPY[model.mode].short);
    setText(this.goal, siteCopy(model.fixture!.id)?.goal || model.fixture!.title);
    setText(this.guidance, model.readOnly ? model.status.message || STATUS_COPY[model.status.phase].detail : model.status.phase==='testing'?'Testing your construction…':repairGuidance(model.fixture!,model.draft!,model.advisory,model.mode));
    setText(this.statusButton, this.statusText(model));
    for (const button of this.tabs.querySelectorAll<HTMLButtonElement>('button')) {
      const selected = button.dataset.tab === model.activeTab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    const text = model.draft!.rationale;
    // Never replace a focused editor's value on simulation ticks (including delayed echoes).
    if (!this.composing && (changedSite || document.activeElement !== this.textarea) && this.textarea.value !== text) this.textarea.value = text;
    this.textarea.readOnly = !!model.readOnly;
    const pumpMode = this.pumpMode();
    this.root.classList.toggle('rp-pump', pumpMode);
    this.pump.root.hidden = !pumpMode;
    if (pumpMode) { this.pump.update(model); if (!model.readOnly && model.status.phase !== 'testing') setText(this.guidance, this.pump.guidance); }
    this.renderContent();
    this.renderLearning();
    this.renderDrawer();
    this.arrange();
    this.renderAnchors();
    if (changedView && model.view !== 'rationale' && document.activeElement === this.textarea) this.textarea.blur();
    if (changedView && model.view === 'rationale') this.textarea.focus({ preventScroll: true });
    if (changedView && previous?.view === 'rationale' && model.view === 'construct') {
      const focus = [...this.root.querySelectorAll<HTMLElement>('[data-key]')].find(node => node.dataset.key === this.lastConstructionFocusKey);
      (focus ?? this.tabs.querySelector<HTMLButtonElement>('[aria-selected=true]'))?.focus({ preventScroll: true });
    }
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.contentSignature = '';
    if (this.model?.fixture && this.model.draft && !this.root.hidden) this.renderContent();
    this.arrange();
    if (this.model?.fixture && this.model.draft && !this.root.hidden) this.renderAnchors();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.visualViewport?.removeEventListener('resize', this.onViewportChange);
    window.visualViewport?.removeEventListener('scroll', this.onViewportChange);
    this.root.removeEventListener('keydown', this.onKeyDown);
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.textarea.removeEventListener('input', this.onRationaleInput);
    this.textarea.removeEventListener('compositionstart', this.onCompositionStart);
    this.textarea.removeEventListener('compositionend', this.onCompositionEnd);
    this.textarea.removeEventListener('focus', this.onViewportChange);
    this.textarea.removeEventListener('blur', this.onViewportChange);
    this.root.remove();
    this.model = null;
  }

  private readonly onCompositionStart = (): void => { this.composing = true; };
  private readonly onCompositionEnd = (): void => { this.composing = false; this.onRationaleInput(); };
  private readonly onAnswerKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || this.composing) return;
    event.preventDefault();
    const review = this.drawerActions.querySelector<HTMLButtonElement>('[data-key=review]');
    if (review && !review.hidden && !review.disabled) review.click();
  };
  private readonly onRationaleInput = (): void => {
    // Pasted line breaks become spaces: the council answer is one line.
    if (!this.composing && /[\r\n\u2028\u2029]/.test(this.textarea.value)) {
      const at = this.textarea.selectionStart;
      this.textarea.value = this.textarea.value.replace(/\r\n|[\r\n\u2028\u2029]/g, ' ');
      this.textarea.setSelectionRange(at, at);
    }
    this.renderCounts();
    this.send({ type: 'editRationale', value: this.textarea.value });
  };
  private readonly onViewportChange = (): void => { this.arrange(); };
  private readonly onPointerDown = (event: PointerEvent): void => {
    if ((event.target as HTMLElement).closest('button, textarea, .rp-details')) event.stopPropagation();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      if (this.layout.keyboardOpen) { this.textarea.blur(); this.arrange(); }
      else this.send({ type: this.model?.view === 'construct' || this.model?.view === 'status' ? 'exit' : 'back' });
      return;
    }
    // Text typing never activates game shortcuts; bubble WASD to the controller,
    // which must ignore editable targets instead of moving the player.
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
    const tab = (event.target as HTMLElement).closest<HTMLButtonElement>('[role=tab]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const list = [...this.tabs.querySelectorAll<HTMLButtonElement>('button')];
      const i = list.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (i + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      list[next]?.click();
      list[next]?.focus();
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.stopPropagation();
  };

  /** Every site builds on the live machine (GAME-DESIGN §11); the old tabs and inset stay for nothing but fallback. */
  /** Connected mode: the inspected site's prerequisite-confirmation status (null clears it). */
  setDependencyStatus(status: DependencyStatus | null): void { this.pump.setDependencyStatus(status); }

  private pumpMode(): boolean { return this.model?.view === 'construct' && !this.root.hidden; }

  private selectedPart(): RepairPart | undefined {
    return this.model?.draft?.artifact.parts.find(part => part.slotId === this.model?.selectedSlot);
  }

  private slotOptions(): readonly PartOption[] {
    const model = this.model;
    if (!model?.fixture || !model.selectedSlot) return [];
    // Exported helper owns catalog membership; retain only the supplied fixture's stock.
    try {
      const allowed = new Set(getSlotOptions(model.fixture.id, model.selectedSlot).map(option => option.id));
      return model.fixture.options.filter(option => allowed.has(option.id));
    } catch { return []; }
  }

  private cycleSlot(delta: number): void {
    const slots = this.model?.fixture?.slotIds ?? [];
    if (!slots.length) return;
    const current = slots.indexOf(this.model?.selectedSlot ?? '');
    const slotId = slots[(Math.max(0, current) + delta + slots.length) % slots.length];
    if (slotId) this.send({ type: 'selectSlot', slotId });
  }

  private redraw(): void { this.contentSignature = ''; this.renderContent(); this.arrange(); this.renderAnchors(); }

  private replacePreservingFocus(host: HTMLElement, nodes: Node[]): void {
    const active = document.activeElement instanceof HTMLElement && host.contains(document.activeElement) ? document.activeElement : null;
    const key = active?.dataset.key;
    const scroll = host.scrollTop;
    host.replaceChildren(...nodes);
    host.scrollTop = scroll;
    if (key) [...host.querySelectorAll<HTMLElement>('[data-key]')].find(node => node.dataset.key === key)?.focus({ preventScroll: true });
  }

  private renderContent(): void {
    const model = this.model;
    if (!model?.fixture || !model.draft) return;
    const signature = JSON.stringify([model.fixture, model.draft.artifact, model.selectedSlot, model.selectedOption, model.activeTab, model.readOnly, model.sourcePort, model.targetPort, this.page, this.configIndex, this.portRole, this.width < 1000,this.socketPicker]);
    if (signature === this.contentSignature) return;
    this.contentSignature = signature;
    const socket = element('div', 'rp-socket-row');
    const socketButton = this.button(`${model.selectedSlot ? slotLabel(model.fixture.id,model.selectedSlot) : PLAYER_COPY.chooseSocket} ▾`, () => {this.socketPicker=!this.socketPicker;this.redraw();}, 'socket');
    socketButton.setAttribute('aria-label',model.selectedSlot?`Socket: ${slotLabel(model.fixture.id,model.selectedSlot)}`:PLAYER_COPY.chooseSocket);
    socket.append(this.button('‹', () => this.cycleSlot(-1), 'socket-prev'), socketButton, this.button('›', () => this.cycleSlot(1), 'socket-next'));
    socket.firstElementChild?.setAttribute('aria-label', 'Previous socket');
    socket.lastElementChild?.setAttribute('aria-label', 'Next socket');
    const help = element('div', 'rp-help');
    const option = model.fixture.options.find(candidate => candidate.id === (model.activeTab === 'parts' && model.selectedOption ? model.selectedOption : this.selectedPart()?.optionId));
    const budget = model.draft.artifact.parts.reduce((sum, part) => sum + Number(model.fixture!.options.find(candidate => candidate.id === part.optionId)?.facts.cost ?? 0), 0);
    help.textContent = `${materialsLabel(budget,model.fixture.budget)} · ${option?partLabel(model.fixture.id,option.id):PLAYER_COPY.emptySocket}${model.activeTab==='configure'&&this.selectedPart()?` · ${configLabel(this.selectedPart()!.settingId)}`:''}`;
    this.replacePreservingFocus(this.context, [socket, help]);
    if(this.socketPicker){const picker=element('div','rp-socket-picker');for(const id of model.fixture.slotIds){const button=this.button(slotLabel(model.fixture.id,id),()=>{this.socketPicker=false;this.send({type:'selectSlot',slotId:id});this.redraw();},`choose-slot-${id}`);button.setAttribute('aria-pressed',String(id===model.selectedSlot));picker.append(button);}this.context.append(picker);}
    const nodes: Node[] = [];
    if (model.activeTab === 'parts') nodes.push(...this.partsContent());
    if (model.activeTab === 'configure') nodes.push(...this.configureContent());
    if (model.activeTab === 'connect') nodes.push(...this.connectContent());
    this.replacePreservingFocus(this.content, nodes);
    for (const button of this.content.querySelectorAll<HTMLButtonElement>('button[data-edit]')) button.disabled ||= !!model.readOnly;
    this.anchors.hidden = model.activeTab === 'configure';
  }

  private renderLearning():void {
    const model=this.model;if(!model?.fixture||!model.draft)return;
    const learning=describeRepair(model.fixture,model.draft),signature=JSON.stringify([learning,model.readOnly,this.hintOpen,model.selectedSlot]);
    if(signature===this.learningSignature)return;this.learningSignature=signature;
    const label=element('strong','',`${model.readOnly?'Saved design':'Draft preview'} · ${learning.summary}`),meter=element('div','rp-balance-meter'),needle=element('span','rp-balance-needle'),target=element('span','rp-balance-target');
    meter.setAttribute('role','img');meter.setAttribute('aria-label',learning.summary);needle.style.left=`${Math.max(3,Math.min(97,learning.ratio*50))}%`;meter.classList.toggle('balanced',learning.balanced);meter.append(target,needle);
    const steps=element('div','rp-learning-steps');for(const [i,step]of learning.steps.entries()){
      const button=this.button(`${step.done?'✓':`${i+1}.`} ${step.label}`,()=>{this.send({type:'selectSlot',slotId:step.slot});this.send({type:'selectTab',tab:step.tab});},`task-${i}`);button.classList.toggle('complete',step.done);button.disabled=!!model.readOnly;steps.append(button);
    }
    const legends=element('div','rp-meter-legends');for(const text of model.fixture.id==='pier_hoist'?['Cargo heavy','Balanced','Weights heavy']:['Below target','Working target','Above target'])legends.append(element('span','',text));
    meter.hidden=legends.hidden=model.fixture.id!=='pier_hoist';
    const next=learning.steps.find(step=>!step.done);const note=element('p','rp-preview-note',model.readOnly?model.status.message||STATUS_COPY[model.status.phase].detail:next?'Choose a step to focus its part. Checks describe this draft, not approval.':'Construction looks ready. Test it, then explain your choices. Preview is not approval.');
    this.learning.replaceChildren(label,meter,legends,steps,note);
    if(model.fixture.id==='pier_hoist'&&!model.readOnly){const selected=this.selectedPart();this.learning.append(element('p','rp-weight-help',`Near = less pull · Farther = more pull. ${selected?.slotId.startsWith('weight_')?`${slotLabel(model.fixture.id,selected.slotId)} selected · ${configLabel(selected.settingId)}.`:'Choose Weight A or B, then Adjust.'}`));}
    if(this.hintOpen)this.learning.append(element('p','rp-learning-hint',learning.detail));
  }

  private partsContent(): Node[] {
    const options = this.slotOptions();
    const capacity = this.width < 1000 ? 3 : 6;
    const pages = Math.max(1, Math.ceil(options.length / capacity));
    this.page = Math.min(this.page, pages - 1);
    const tray = element('div', 'rp-tray');
    tray.setAttribute('aria-label', 'Parts for selected socket');
    for (const option of options.slice(this.page * capacity, (this.page + 1) * capacity)) {
      const button = this.button('', () => this.send({ type: 'selectPart', optionId: option.id }), `part-${option.id}`);
      button.classList.add('rp-part');
      button.setAttribute('aria-pressed', String(this.model?.selectedOption === option.id));
      const label=partLabel(this.model!.fixture!.id,option.id);
      button.setAttribute('aria-label', `${label}; ${Object.entries(option.facts).map(([key, value]) => factLabel(key,value)).join(', ')}`);
      const glyph = element('span', 'rp-part-glyph', this.glyph(option.kind));
      glyph.setAttribute('aria-hidden', 'true');
      button.append(glyph, element('span', 'rp-part-label', label));
      tray.append(button);
    }
    if (!options.length) tray.append(element('span', 'rp-empty', 'Select a fixture socket to see its stock.'));
    const paging = element('div', 'rp-paging');
    const previous = this.button('‹', () => { this.page = (this.page + pages - 1) % pages; this.redraw(); }, 'parts-prev');
    const next = this.button('›', () => { this.page = (this.page + 1) % pages; this.redraw(); }, 'parts-next');
    previous.setAttribute('aria-label', 'Previous parts page');
    next.setAttribute('aria-label', 'Next parts page');
    previous.disabled = next.disabled = pages <= 1;
    paging.append(previous, element('span', '', `${this.page + 1}/${pages}`), next);
    const place = this.button('Place', () => {
      const model = this.model;
      if (model?.selectedSlot && model.selectedOption && this.slotOptions().some(option => option.id === model.selectedOption)) this.send({ type: 'placePart', slotId: model.selectedSlot, optionId: model.selectedOption });
    }, 'place');
    place.dataset.edit = 'true';
    place.disabled = !this.slotOptions().some(option => option.id === this.model?.selectedOption);
    place.setAttribute('aria-label', 'Place selected part on selected socket; world socket picks also supported');
    return [paging, tray, place];
  }

  private glyph(kind: string): string {
    if (/gear|pulley|crank/.test(kind)) return '⚙';
    if (/pipe|valve|filter|screen|cistern|split/.test(kind)) return '╬';
    if (/lamp|lens|reflector/.test(kind)) return '◉';
    if (/guard|shield|fuse/.test(kind)) return '▱';
    if (/rope|cable/.test(kind)) return '∿';
    if (/weight/.test(kind)) return '▰';
    return '◇';
  }

  private configureContent(): Node[] {
    const model = this.model!;
    const part = this.selectedPart();
    const option = model.fixture!.options.find(candidate => candidate.id === part?.optionId);
    const fields: readonly (RepairConfigField | 'setting')[] = ['setting', 'mountZoneId', 'outputModeId', 'routeId'];
    const field = fields[this.configIndex % fields.length]!;
    const settings = option?.allowedSettings ?? model.fixture!.configurationOptions.settingIds;
    const lists: Record<RepairConfigField, readonly string[]> = {
      mountZoneId: model.fixture!.configurationOptions.mountZoneIds,
      outputModeId: model.fixture!.configurationOptions.outputModeIds,
      routeId: model.fixture!.configurationOptions.routeIds,
    };
    const values = field === 'setting' ? (part ? settings : []) : lists[field];
    const value = field === 'setting' ? part?.settingId ?? '' : model.draft!.artifact.configuration[field];
    const fieldRow = element('div', 'rp-field-nav');
    fieldRow.append(
      this.button('‹', () => { this.configIndex = (this.configIndex + 3) % 4; this.redraw(); }, 'field-prev'),
      element('span', '', field === 'setting' ? `${option?partLabel(model.fixture!.id,option.id):'Part'} setting` : CONFIG_FIELD_LABELS[field]),
      this.button('›', () => { this.configIndex = (this.configIndex + 1) % 4; this.redraw(); }, 'field-next'),
    );
    fieldRow.firstElementChild?.setAttribute('aria-label', 'Previous configuration field');
    fieldRow.lastElementChild?.setAttribute('aria-label', 'Next configuration field');
    const detent = element('div', 'rp-detent');
    const step = (delta: number): void => {
      if (!values.length) return;
      const next = values[(Math.max(0, values.indexOf(value)) + delta + values.length) % values.length]!;
      if (field === 'setting' && part) this.send({ type: 'setSetting', partId: part.id, settingId: next });
      else if (field !== 'setting') this.send({ type: 'setConfig', field, value: next });
    };
    const decrease = this.button('−', () => step(-1), 'detent-prev');
    const increase = this.button('+', () => step(1), 'detent-next');
    decrease.setAttribute('aria-label', 'Previous detent');
    increase.setAttribute('aria-label', 'Next detent');
    decrease.dataset.edit = increase.dataset.edit = 'true';
    decrease.disabled = increase.disabled = values.length <= 1;
    detent.append(decrease, element('span', '', value ? configLabel(value) : 'Choose a fitted part'), increase);
    const rotate = this.button(`↻ ${part ? part.orientationQuarterTurns * 90 : 0}°`, () => { if (part) this.send({ type: 'rotatePart', partId: part.id, quarterTurns: 1 }); }, 'rotate');
    rotate.setAttribute('aria-label', 'Rotate selected part clockwise by a quarter turn');
    rotate.disabled = !part;
    rotate.dataset.edit = 'true';
    const direct=element('div','rp-setting-choices');
    for(const id of values){const label=this.width<1000&&id.startsWith('rail_')?(id==='rail_1000'?'Near':'Far'):configLabel(id);const button=this.button(label,()=>{if(field==='setting'&&part)this.send({type:'setSetting',partId:part.id,settingId:id});else if(field!=='setting')this.send({type:'setConfig',field,value:id});},`setting-${id}`);button.setAttribute('aria-label',configLabel(id));button.dataset.edit='true';button.setAttribute('aria-pressed',String(id===value));button.disabled=values.length===1;direct.append(button);}
    if(this.width<1000&&field==='setting')return [direct,rotate,this.button('More settings',()=>{this.configIndex=1;this.redraw();},'field-next')];
    return [fieldRow,direct,rotate];
  }

  private ports(): PortChoice[] {
    const model = this.model;
    if (!model?.fixture || !model.draft) return [];
    return model.draft.artifact.parts.flatMap(part => {
      const option = model.fixture!.options.find(candidate => candidate.id === part.optionId);
      return (option?.ports ?? []).map(port => ({ endpoint: { partId: part.id, portId: port.id }, channel: port.channel, direction: port.direction, label: portLabel(model.fixture!.id,part.slotId,port.id) }));
    });
  }

  private connection(): RepairConnection | null {
    const source = this.ports().find(port => samePort(port.endpoint, this.model?.sourcePort));
    const target = this.ports().find(port => samePort(port.endpoint, this.model?.targetPort));
    if (!source || !target || samePort(source.endpoint, target.endpoint) || source.channel !== target.channel || source.direction === 'in' || target.direction === 'out') return null;
    return { channel: source.channel, from: source.endpoint, to: target.endpoint };
  }

  private connectContent(): Node[] {
    const model = this.model!;
    const ports = this.ports();
    const source = ports.find(port => samePort(port.endpoint, model.sourcePort));
    const target = ports.find(port => samePort(port.endpoint, model.targetPort));
    const endpoints = element('div', 'rp-endpoints');
    const from = this.button(`From: ${source?.label ?? 'choose port'}`, () => { this.portRole = 'source'; this.redraw(); }, 'source-role');
    const to = this.button(`To: ${target?.label ?? 'choose port'}`, () => { this.portRole = 'target'; this.redraw(); }, 'target-role');
    from.setAttribute('aria-pressed', String(this.portRole === 'source'));
    to.setAttribute('aria-pressed', String(this.portRole === 'target'));
    endpoints.append(from, to);
    const candidates = ports.filter(port => this.portRole === 'source' ? port.direction !== 'in' : port.direction !== 'out' && (!source || port.channel === source.channel && !samePort(port.endpoint, source.endpoint)));
    const current = this.portRole === 'source' ? source : target;
    const picker = element('div', 'rp-port-picker');
    const step = (delta: number): void => {
      if (!candidates.length) return;
      const i = candidates.findIndex(port => samePort(port.endpoint, current?.endpoint));
      const next = candidates[(i < 0 ? (delta > 0 ? 0 : candidates.length - 1) : (i + delta + candidates.length) % candidates.length)]!;
      this.send({ type: 'focusPort', role: this.portRole, endpoint: next.endpoint });
    };
    const prev = this.button('‹', () => step(-1), 'port-prev');
    const next = this.button('›', () => step(1), 'port-next');
    prev.setAttribute('aria-label', `Previous ${this.portRole} port`);
    next.setAttribute('aria-label', `Next ${this.portRole} port`);
    prev.disabled = next.disabled = !candidates.length;
    picker.append(prev, element('span', '', current?.label ?? `Choose ${this.portRole}`), next);
    const connection = this.connection();
    const existing = connection && model.draft!.artifact.connections.find(edge => edge.channel === connection.channel && samePort(edge.from, connection.from) && samePort(edge.to, connection.to));
    const join = this.button('Join', () => { const edge = this.connection(); if (edge) this.send({ type: 'join', connection: edge }); }, 'join');
    const remove = this.button('Remove', () => { if (existing) this.send({ type: 'removeConnection', connection: existing }); }, 'remove');
    join.dataset.edit = remove.dataset.edit = 'true';
    join.disabled = !connection || !!existing;
    remove.disabled = !existing;
    const selected=element('div','rp-port-choices');
    const selectedPart=this.selectedPart();for(const port of candidates.filter(port=>port.endpoint.partId===selectedPart?.id)){
      const button=this.button(port.label,()=>this.send({type:'focusPort',role:this.portRole,endpoint:port.endpoint}),`choose-port-${port.endpoint.partId}-${port.endpoint.portId}`);button.setAttribute('aria-pressed',String(samePort(current?.endpoint,port.endpoint)));selected.append(button);
    }
    return [endpoints,selected,picker,join,remove];
  }

  private renderCounts(): boolean {
    const text = this.textarea.value;
    const scalars = Array.from(text);
    const bytes = new TextEncoder().encode(text).byteLength;
    const valid = scalars.length >= REPAIR_LIMITS.rationaleMinScalars && scalars.length <= REPAIR_LIMITS.rationaleMaxScalars && bytes <= REPAIR_LIMITS.rationaleBytes && !scalars.some(char => { const code = char.codePointAt(0)!; return code >= 0xd800 && code <= 0xdfff; });
    setText(this.counts, `${scalars.length} / ${REPAIR_LIMITS.rationaleMaxScalars} characters${scalars.length<REPAIR_LIMITS.rationaleMinScalars?` · write at least ${REPAIR_LIMITS.rationaleMinScalars}`:scalars.length>REPAIR_LIMITS.rationaleMaxScalars||bytes>REPAIR_LIMITS.rationaleBytes?' · shorten your answer':''}`);
    this.textarea.setAttribute('aria-invalid', String(!valid));
    const review = this.drawerActions.querySelector<HTMLButtonElement>('[data-key=review]');
    const submit = this.drawerActions.querySelector<HTMLButtonElement>('[data-key=submit]');
    if (review) review.disabled = !valid || !!this.model?.readOnly;
    const unavailable = this.model?.mode === 'connected' && ['disabled', 'disconnected', 'wrong-network', 'queued', 'awaiting-wallet', 'submitted', 'pending', 'accepted', 'finalized', 'timed-out'].includes(this.model.status.phase);
    if (submit) submit.disabled = !valid || !!this.model?.readOnly || !!unavailable;
    return valid;
  }

  private renderDrawer(): void {
    const model = this.model!;
    const view = model.view;
    const editing = view === 'rationale';
    const reviewing = view === 'review';
    setText(this.drawerHeading, editing ? 'Answer the council' : reviewing ? 'Review your design' : 'Repair feedback');
    setText(this.question, model.fixture!.councilQuestion ? `The council asks: ${model.fixture!.councilQuestion}` : '');
    this.question.hidden = !(editing || reviewing) || !model.fixture!.councilQuestion;
    const part = this.selectedPart();
    const option = model.fixture!.options.find(candidate => candidate.id === part?.optionId);
    const facts = option ? Object.entries(option.facts).map(([key, value]) => `${pretty(key)} ${value}`).join(' · ') : '';
    setText(this.facts, `${option?partLabel(model.fixture!.id,option.id):model.fixture!.title}${facts ? `: ${facts}` : ''}\n${MODE_COPY[model.mode].test}`);
    setText(this.drawerActions.querySelector<HTMLElement>('[data-key=submit]')!,MODE_COPY[model.mode].submit);
    this.textarea.hidden = !editing;
    // While answering, the question matters more than the selected part's facts.
    this.facts.hidden = editing;
    this.counts.hidden = !editing && !reviewing;
    this.details.hidden = editing;
    for (const button of this.drawerActions.querySelectorAll<HTMLButtonElement>('button')) {
      const key = button.dataset.key;
      button.hidden = key === 'review' ? !editing : key === 'submit' ? !reviewing : key === 'done';
    }
    this.renderCounts();
    const signature = JSON.stringify([view, model.mode, model.status, model.advisory, reviewing ? model.draft : null]);
    if (signature === this.detailsSignature) return;
    this.detailsSignature = signature;
    const nodes: Node[] = [];
    if (reviewing) {
      nodes.push(element('p', '', MODE_COPY[model.mode].review));
      for (const part of model.draft!.artifact.parts) {
        const label = partLabel(model.fixture!.id,part.optionId);
        nodes.push(element('p', '', `${slotLabel(model.fixture!.id,part.slotId)}: ${label} · ${part.orientationQuarterTurns * 90}° · ${configLabel(part.settingId)}`));
      }
      for (const [key, value] of Object.entries(model.draft!.artifact.configuration)) nodes.push(element('p', '', `${CONFIG_FIELD_LABELS[key as RepairConfigField]}: ${configLabel(value)}`));
      const endpointLabel=(endpoint:RepairEndpoint)=>portLabel(model.fixture!.id,model.draft!.artifact.parts.find(part=>part.id===endpoint.partId)?.slotId??endpoint.partId,endpoint.portId);
      for (const connection of model.draft!.artifact.connections) nodes.push(element('p', '', `${CHANNEL_LABELS[connection.channel]}: ${endpointLabel(connection.from)} → ${endpointLabel(connection.to)}`));
      nodes.push(element('p', 'rp-review-label', 'Your answer to the council'), element('p', 'rp-review-text', model.draft!.rationale));
    } else {
      nodes.push(element('p', 'rp-test-result', model.advisory ? (model.advisory.valid?'Test passed':'Test needs a change') : this.statusText(model)));
      nodes.push(element('p', 'rp-next-step', repairGuidance(model.fixture!,model.draft!,model.advisory,model.mode)));
      const advice = model.advisory;
      if (advice) {
        nodes.push(element('p', '', `Advisory test: ${advice.valid ? 'technical checks satisfied' : 'revise construction'} · materials ${advice.materialCost}/${advice.budget}`));
        for(const message of describeRepair(model.fixture!,model.draft!).issues)nodes.push(element('p','rp-issue',message));
        const technical=element('details','production-hint');technical.append(element('summary','','Technical details'));
        for (const [flag, value] of Object.entries(advice.flags)) technical.append(element('p', '', `${pretty(flag)}: ${value ? 'satisfied' : 'needs attention'}`));
        for (const [metric, value] of Object.entries(advice.metrics)) technical.append(element('p', '', `${pretty(metric)}: ${value}`));
        technical.append(element('p','',`Council answer: one line of ${REPAIR_LIMITS.rationaleMinScalars}–${REPAIR_LIMITS.rationaleMaxScalars} characters, judged by GenLayer validators against the site facts and this build.`));nodes.push(technical);
      } else nodes.push(element('p', '', 'Adjust your design, then Test to see what needs attention.'));
      const copy=siteCopy(model.fixture!.id);
      if(copy){nodes.push(element('p','',copy.instruction));const hint=element('details','production-hint');hint.append(element('summary','',PLAYER_COPY.hint),element('p','',copy.hint));nodes.push(hint);const requirements=element('details','production-hint');requirements.append(element('summary','',PLAYER_COPY.requirements));for(const requirement of copy.requirements)requirements.append(element('p','',requirement));nodes.push(requirements);}
      nodes.push(element('p','production-mode-detail',MODE_COPY[model.mode].detail));
    }
    this.details.replaceChildren(...nodes);
    this.details.tabIndex = 0;
    this.details.setAttribute('aria-label', reviewing ? 'Frozen design and rationale' : 'Advisory flags, metrics and feedback');
  }

  private statusText(model: RepairPanelModel): string {
    return `${STATUS_COPY[model.status.phase].label}${model.status.message ? ` · ${model.status.message}` : ''}`;
  }

  private renderAnchors(): void {
    const model = this.model!;
    const signature = JSON.stringify([model.anchors, this.layout.inset, model.activeTab, model.readOnly, this.portRole, model.sourcePort, model.selectedSlot]);
    if (signature === this.anchorSignature) return;
    this.anchorSignature = signature;
    const nodes: Node[] = [];
    for (const anchor of model.anchors ?? []) {
      if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) continue;
      // Edge-clipped markers would lose their 44px target. The socket/port cyclers
      // remain reachable when a projected point is outside this safe inset area.
      if (anchor.x < 22 || anchor.y < 22 || anchor.x > this.layout.inset.width - 22 || anchor.y > this.layout.inset.height - 22) continue;
      const slot = anchor.slotId;
      const port = this.ports().find(candidate => samePort(candidate.endpoint, anchor.endpoint));
      if (model.activeTab === 'parts' && slot===model.selectedSlot && slot && model.fixture!.slotIds.includes(slot)) {
        const button = this.button('◇', () => this.send({ type: 'selectSlot', slotId: slot }), `anchor-slot-${slot}`);
        button.setAttribute('aria-label', `Select ${slotLabel(model.fixture!.id,slot)} socket`);
        button.setAttribute('aria-pressed', String(model.selectedSlot === slot));
        this.positionAnchor(button, anchor);
        nodes.push(button);
      } else if (model.activeTab === 'connect' && port&&port.endpoint.partId===this.selectedPart()?.id) {
        const source = this.ports().find(candidate => samePort(candidate.endpoint, model.sourcePort));
        const button = this.button('○', () => this.send({ type: 'focusPort', role: this.portRole, endpoint: port.endpoint }), `anchor-port-${port.endpoint.partId}-${port.endpoint.portId}`);
        button.setAttribute('aria-label', `${this.portRole} port ${port.label}`);
        button.disabled = this.portRole === 'source' ? port.direction === 'in' : port.direction === 'out' || !!source && (source.channel !== port.channel || samePort(source.endpoint, port.endpoint));
        if(nodes.some(node=>node instanceof HTMLElement&&Math.hypot(parseFloat(node.style.left)-anchor.x,parseFloat(node.style.top)-anchor.y)<46))continue;
        this.positionAnchor(button, anchor);
        nodes.push(button);
      }
    }
    this.replacePreservingFocus(this.anchors, nodes);
  }

  private positionAnchor(button: HTMLButtonElement, anchor: RepairPanelAnchor): void {
    button.classList.add('rp-anchor');
    button.style.left = `${anchor.x}px`;
    button.style.top = `${anchor.y}px`;
  }

  private rect(node: HTMLElement, x: number, y: number, width: number, height: number): void {
    Object.assign(node.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, width)}px`, height: `${Math.max(0, height)}px` });
  }

  private arrange(): void {
    const model = this.model;
    const phone = this.width < 1000;
    const narrow = this.width <= 700;
    const drawer = !!model && ['rationale', 'review', 'feedback'].includes(model.view);
    const status = model?.view === 'status';
    const viewport = window.visualViewport;
    const keyboardOpen = !!viewport && document.activeElement === this.textarea && this.height - viewport.height > 80 && model?.view === 'rationale';
    this.root.classList.toggle('rp-phone', phone);
    this.root.classList.toggle('rp-keyboard', !!keyboardOpen);
    this.root.classList.toggle('rp-with-drawer', drawer);
    this.rect(this.root, 0, 0, this.width, this.height);
    const margin = phone ? 8 : 24;
    const sideWidth = phone ? 196 : 504;
    const sideY = phone ? (narrow ? 60 : 64) : this.height - 468;
    const sideHeight = phone ? (narrow ? 235 : 240) : 444;
    const dockY = phone ? this.height - 72 : this.height - 192;
    const dockHeight = phone ? 64 : 168;
    const modeWidth = phone ? (narrow ? 196 : 220) : 240;
    const diagnosisX = phone ? (narrow ? 216 : 236) : 288;
    this.rect(this.modeLabel, margin, phone ? 8 : 20, modeWidth, phone ? 24 : 32);
    this.rect(this.diagnosis, diagnosisX, phone ? 8 : 20, phone ? this.width - diagnosisX - 8 : Math.max(0, this.width - 828), phone ? (narrow ? 44 : 48) : 64);
    const sideX = phone ? margin : this.width - 528;
    this.rect(this.side, sideX, sideY, sideWidth, sideHeight);
    // 44px tabs + 44px socket selector + bounded 44px budget/part facts.
    const inset: RepairPanelRect = { x: sideX, y: sideY + 132, width: sideWidth, height: sideHeight - 132 };
    this.rect(this.assemblyHost, 0, 132, sideWidth, sideHeight - 132);
    this.rect(this.anchors, 0, 132, sideWidth, sideHeight - 132);
    this.rect(this.dock, drawer && !phone ? 544 : margin, dockY, phone ? this.width - 16 : drawer ? this.width - 1096 : this.width - 576, dockHeight);
    this.rect(this.drawer, margin, phone ? sideY : this.height - 456, sideWidth, phone ? sideHeight : 432);
    this.rect(this.exitButton, phone ? this.width - 60 : this.width - 588, phone ? dockY + 10 : dockY + 112, 52, 44);
    this.rect(this.statusButton, margin, phone ? sideY : 100, phone ? 196 : 504, 44);
    const learningHeight=phone?(this.hintOpen?165:model?.fixture?.id==='pier_hoist'?130:116):(this.hintOpen?310:model?.fixture?.id==='pier_hoist'?270:220);
    this.rect(this.learning,phone?diagnosisX:margin,phone?sideY:164,phone?this.width-diagnosisX-8:340,learningHeight);
    this.learning.hidden=drawer||!!status||this.root.hidden;
    this.side.hidden = drawer || !!status;
    this.dock.hidden = !!status;
    this.drawer.hidden = !drawer;
    this.statusButton.hidden = !status;
    this.assemblyHost.hidden = drawer || !!status;
    this.content.hidden = drawer;
    for (const button of this.actions.querySelectorAll<HTMLButtonElement>('button')) {
      button.hidden = drawer;
      button.disabled = !!model?.readOnly || model?.status.phase === 'testing';
    }
    let protectedScene: RepairPanelRect = phone
      ? { x: narrow ? 216 : 220, y: sideY+learningHeight, width: narrow ? 390 : 460, height: Math.max(80,sideHeight-learningHeight) }
      : { x: 560, y: 140, width: Math.max(0, this.width - 1100), height: Math.max(0, this.height - 360) };
    if (keyboardOpen && viewport) {
      const top = viewport.offsetTop;
      const available = Math.max(140, viewport.height);
      this.modeLabel.hidden = this.diagnosis.hidden = true;
      this.learning.hidden=true;
      this.side.hidden = this.dock.hidden = this.exitButton.hidden = true;
      this.rect(this.drawer, margin, top + available - 52, this.width - margin * 2, 52);
      protectedScene = { x: margin, y: top, width: this.width - margin * 2, height: Math.max(88, available - 52) };
      for (const button of this.drawerActions.querySelectorAll<HTMLButtonElement>('button')) button.hidden = button.dataset.key !== 'done';
    } else {
      this.modeLabel.hidden = this.diagnosis.hidden = false;
      this.exitButton.hidden = !!status;
      for (const button of this.drawerActions.querySelectorAll<HTMLButtonElement>('button')) {
        const key = button.dataset.key;
        button.hidden = key === 'done' || key === 'review' && model?.view !== 'rationale' || key === 'submit' && model?.view !== 'review';
      }
    }
    const pump = this.pumpMode();
    if (pump) {
      // The live pump is the build surface: no inset; the camera frames it between the approach column and the tray.
      // Desktop: Test/Explain/Exit sit level with the hint row so the part tray gets the full width.
      const row = phone ? this.height - 52 : this.height - 178;
      this.rect(this.exitButton, this.width - margin - 64, row, 64, 44);
      this.rect(this.dock, phone ? margin : this.width - margin - 64 - 8 - 340, row, phone ? this.width - margin * 2 - 72 : 340, 44);
      protectedScene = phone ? { x: margin, y: 96, width: this.width - margin * 2, height: Math.max(80, this.height - 96 - 196) }
        : { x: 340, y: 96, width: Math.max(0, this.width - 364), height: Math.max(0, this.height - 96 - 250) };
    }
    this.layoutValue = { inset: pump || drawer || status || keyboardOpen || this.root.hidden ? { ...inset, width: 0, height: 0 } : inset, protectedScene, keyboardOpen: !!keyboardOpen,
      ...(pump ? { blueprint: this.pump.blueprint, buildStep: this.pump.currentStep } : {}) };
  }
}
