/** Presentation only. No runtime imports, state mutation, validation or approval.
 * IDs stay in commands/artifacts; these labels belong only in textContent/ARIA.
 */
import type { IslandSiteId, Mode, RepairChannel, RepairState } from '../genlayer/types';

export const COPY_FIXTURE_VERSION = 'island-2026-10-13-v2';

export interface SitePlayerCopy {
  readonly title: string;
  readonly goal: string;
  /** Initial fault only: do not keep showing this after edits or restoration. */
  readonly fault: string;
  readonly instruction: string;
  readonly tasks: readonly [string, string, string];
  readonly hint: string;
  /** Optional journal detail; exact game facts, never real engineering advice. */
  readonly requirements: readonly string[];
}

export const SITE_COPY = {
  pier_hoist: {
    title: 'Landing Hoist', goal: 'Balance the landing hoist',
    fault: 'The counterweights are not balancing the load.',
    instruction: 'Choose a counterweight socket, then adjust its rail position.',
    tasks: ['Balance the weights', 'Check rope and guard', 'Test the lift'],
    hint: 'A weight farther along its rail has more turning effect. Try one change, then test again.',
    requirements: ['Stay within the material budget.', 'Balance the cargo at the centre mark. Nearer the pivot gives less pull; farther out gives more.', 'Keep the rope anchored, the pulley guarded and shoreline nests clear.'],
  },
  village_pump: {
    title: 'Spring Pump', goal: 'Bring water back to the village',
    fault: 'The starting valve settings leave too much pressure and too little trunk flow.',
    instruction: 'Select a valve socket. Adjust its setting and test the flow.',
    tasks: ['Check the water path', 'Adjust the valves', 'Test pressure and flow'],
    hint: 'The outlet supplies the trunk. The relief branch drains excess water. Watch both readings as you adjust.',
    requirements: ['Material budget: 14. Pressure: 3–5. Trunk flow: at least 6.', 'Inlet stops 2 / 3 / 4 give 6 / 9 / 12. Outlet stops 1 / 2 / 3 give 2 / 4 / 6. Bypass stops 0 / 1 / 2 give 0 / 2 / 4.', 'Keep the screen and relief in the water path; no bypass to the trunk.'],
  },
  tidal_sluice: {
    title: 'Reedbed Sluice', goal: 'Share water with the reed pools',
    fault: 'The creek is closed, the bank is exposed and debris is obstructing the flow.',
    instruction: 'Adjust the baffles and nursery gate, then store the debris.',
    tasks: ['Protect the bank', 'Share the flow', 'Clear and test the sluice'],
    hint: 'The nursery and creek share one supply. Shield the bank so water stays in those two routes.',
    requirements: ['Material budget: 14. Supply: 8.', 'Nursery flow: 2–3. Creek flow: at least 5. Erodible bank flow: 0.', 'Keep the nursery connected and debris in the rack.'],
  },
  creek_bridge: {
    title: 'Splitbank Bridge', goal: 'Brace the bridge assembly',
    fault: 'The braces need opposing directions and the rail is loose.',
    instruction: 'Select each brace to rotate it, then secure the rail and test.',
    tasks: ['Connect the deck', 'Brace both banks', 'Secure the rail and test'],
    hint: 'Follow the support path from each bank shoe to the beam. The two braces should oppose each other.',
    requirements: ['Material budget: 18. Capacity: at least 8 fixed load units.', 'Minimum rail clearance: 600 in the game’s fixed units.', 'Use both bank shoes and a continuous deck/support path. Add no riverbed supports.'],
  },
  coast_windmill: {
    title: 'Headland Windmill', goal: 'Get the windmill turning again',
    fault: 'The starting gear pair turns the output too slowly.',
    instruction: 'Choose gears for the input and output sockets, then test their speed.',
    tasks: ['Choose the gear pair', 'Check shaft and guard', 'Test output speed'],
    hint: 'A larger input gear driving a smaller output gear speeds up the output. Check the result before explaining your choice.',
    requirements: ['Material budget: 16. Input shaft: 60 rpm. Output target: 100–140 rpm.', 'Available gears: 12, 24 or 36 teeth.', 'Complete the guarded shaft path and consider the mounting position. Keep access clear of nests.'],
  },
  woodland_pathlight: {
    title: 'Fern Path Light', goal: 'Light the path, shelter the woodland',
    fault: 'The shield is turned away from its working position.',
    instruction: 'Check the shield and cable route, then test the protected circuit.',
    tasks: ['Trace power and return', 'Aim the shield', 'Protect the cable and test'],
    hint: 'Light belongs on the path. Check the shield’s orientation as well as the route the cable follows.',
    requirements: ['Material budget: 12. Source: 12 V. Lamp: 12 V / 6 W. Fuse: 1 A.', 'Power must pass through fuse and regulator, then the lamp and return. No shorts or bypasses.', 'Use the path-edge mount, downward shield and sleeved cable route.'],
  },
  upland_waterworks: {
    title: 'Ridge Cistern', goal: 'Supply the village and habitat',
    fault: 'The filter-to-splitter link is missing and both delivery valves are set too low.',
    instruction: 'Connect the filtered supply, then adjust the two delivery valves.',
    tasks: ['Reconnect the filter', 'Share the supply', 'Check overflow and test'],
    hint: 'Follow the water from the cistern through the filter before it divides. Both destinations need their share.',
    requirements: ['Material budget: 16. Supply: 6. Village minimum: 4. Habitat minimum: 2.', 'Keep the filter in the flow path and observe the fixed capacities and elevations.', 'Leave access to maintain the filter and connect the overflow.'],
  },
  ridge_beacon: {
    title: 'Lookout Beacon', goal: 'Guide the coast with the beacon',
    fault: 'The reflector points inland and the shield is turned away from its working position.',
    instruction: 'Aim the reflector toward the coast, then seat and shield the light.',
    tasks: ['Check the power path', 'Aim toward the coast', 'Seat the shield and test'],
    hint: 'Power alone is not enough: seat the lens and check its rotation with the reflector. Test the beam direction so it avoids inland and nesting areas.',
    requirements: ['Material budget: 14. Source: 12 V. Lens: 12 V / 6 W. Fuse: 1 A.', 'Use the coastal sector and safe plinth; exclude inland and nesting sectors.', 'Connect the protected power path, lens seat and shield. Keep maintenance access clear.'],
  },
} as const satisfies Readonly<Record<IslandSiteId, SitePlayerCopy>>;

/** Runtime-safe lookup for snapshot IDs, which are typed as string upstream. */
export function siteCopy(siteId: string): SitePlayerCopy | undefined {
  return Object.hasOwn(SITE_COPY, siteId) ? SITE_COPY[siteId as IslandSiteId] : undefined;
}

export const PLAYER_COPY = {
  title: 'Fix the Island',
  intro: 'A storm has scattered the island’s working parts. Explore freely, mend eight places and bring the island back to life.',
  start: 'Begin exploring', continue: 'Continue expedition', paused: 'A moment ashore',
  explore: 'Explore freely. Look for the next repair marker.',
  controls: 'WASD / arrows: walk · E: inspect · Esc: pause',
  touchControls: 'Drag the stick to walk. Tap Interact near a repair.',
  repairControls: '[ / ]: sockets · 1–6: parts · Enter: place · R: rotate · F: setting · T: test · Esc: back',
  explain: 'Tell the next restorer why this works and how to care for the site.',
  rationalePlaceholder: 'One line, in your own words: what will you do, and why?',
  hint: 'Need a hint?', requirements: 'Site requirements',
  emptySocket: 'Empty socket', chooseSocket: 'Choose a socket',
  tabs: { parts: 'Parts', configure: 'Adjust', connect: 'Connect' },
  actions: { test: 'Test', rationale: 'Answer', feedback: 'Details', place: 'Place', join: 'Join', remove: 'Remove', review: 'Review', back: 'Back', exit: 'Exit', done: 'Done' },
  practiceEnding: 'All eight sites are repaired in local practice. These repairs used local rules; they have no independent approval.',
  connectedEnding: 'All eight sites have verified final approval for this connected expedition.',
} as const;

export const GENLAYER_BETA_NOTICE = 'GenLayer testnet beta · reviews can take time; practice is instant.';

export const MODE_COPY = {
  practice: {
    label: 'Local practice', short: 'Local practice · local rules',
    detail: 'Repairs use local rules on this device. No wallet or independent review.',
    test: 'Test checks the construction locally.', submit: 'Finish local repair',
    review: 'Finish with local checks. Your answer is saved; in practice no council judges it.',
  },
  connected: {
    label: 'Connected expedition', short: 'GenLayer testnet beta · review required',
    detail: 'Your wallet submits the design for independent review. The site restores only after verified final approval.',
    test: 'Test gives local advice. It does not approve this repair.', submit: 'Submit for review',
    review: 'Submit your build and answer: GenLayer validators check the build and judge your answer. Wallet approval comes next.',
  },
} as const satisfies Readonly<Record<Mode, { label: string; short: string; detail: string; test: string; submit: string; review: string }>>;

export type PlayerRepairPhase = 'editing' | 'testing' | RepairState['status'];
export interface StatusCopy { readonly label: string; readonly detail: string }
export const STATUS_COPY = {
  editing: { label: 'Repair in progress', detail: 'Adjust your design, then test it.' },
  testing: { label: 'Testing the design', detail: 'Checking the construction locally.' },
  disabled: { label: 'Connected play unavailable', detail: 'Local practice is available. Connected play is not configured.' },
  disconnected: { label: 'Wallet disconnected', detail: 'Connect your wallet to use connected play.' },
  ready: { label: 'Connected and ready', detail: 'You can prepare a design for review.' },
  queued: { label: 'Preparing submission', detail: 'The design has not been approved.' },
  'awaiting-wallet': { label: 'Check your wallet', detail: 'Waiting for you to approve the submission.' },
  submitted: { label: 'Design submitted', detail: 'Awaiting review. The site is not restored yet.' },
  pending: { label: 'Review in progress', detail: 'Explore freely while waiting. Dependent repairs remain unavailable until this repair is approved and installed.' },
  accepted: { label: 'Waiting for final review', detail: 'The result is provisional. The site is not restored yet.' },
  finalized: { label: 'Checking the final record', detail: 'Verifying execution and the matching repair record before restoration.' },
  'finalized-success': { label: 'Final approval verified', detail: 'The matching design has a verified final approval.' },
  rejected: { label: 'This design needs revision', detail: 'Read the feedback, adjust your design and try again.' },
  failed: { label: 'Review did not complete', detail: 'Check the review details before trying again.' },
  'timed-out': { label: 'Review is taking longer', detail: 'The saved review can be resumed. No final approval has been confirmed.' },
  'wallet-rejected': { label: 'Submission declined', detail: 'The wallet request was declined. Your draft is still available.' },
  'wrong-network': { label: 'Check the wallet network', detail: 'Use the network required by this connected expedition.' },
  'network-error': { label: 'Connection interrupted', detail: 'The result is uncertain. Check saved reviews before submitting again.' },
  'recovery-needed': { label: 'Check the earlier submission', detail: 'Recover its original record before attempting a new submission.' },
} as const satisfies Readonly<Record<PlayerRepairPhase, StatusCopy>>;

export function progressLabel(restored: number, total = 8): string {
  return `${restored} / ${total} repaired`;
}

/** Unknown IDs are readable but never guessed to be valid choices. */
export function readableId(id: string): string {
  const words = id.replace(/_/g, ' ');
  return words ? words[0]!.toUpperCase() + words.slice(1) : '';
}

const SLOT_LABELS: Readonly<Record<string, string>> = {
  crank: 'Crank', pulley: 'Pulley', boom: 'Lift arm', rope: 'Anchor rope', guard: 'Guard',
  weight_a: 'Weight A', weight_b: 'Weight B', screen: 'Screen', inlet: 'Inlet valve',
  pump: 'Pump', relief: 'Relief valve', outlet: 'Outlet valve', trunk: 'Supply pipe', bypass: 'Relief drain',
  source: 'Source', bank_baffle: 'Bank baffle', creek_baffle: 'Creek baffle', nursery_gate: 'Nursery gate',
  creek: 'Creek outlet', nursery: 'Nursery pool', rack: 'Debris rack',
  shoe_left: 'Left bank shoe', shoe_right: 'Right bank shoe', deck_left: 'Left deck', deck_right: 'Right deck',
  beam: 'Support beam', brace_left: 'Left brace', brace_right: 'Right brace', rail: 'Handrail',
  shaft: 'Input shaft', driver: 'Input gear', driven: 'Output gear', coupling: 'Coupling', generator: 'Generator',
  fuse: 'Fuse', regulator: 'Regulator', lamp: 'Lamp', return: 'Return cable', shield: 'Light shield',
  cistern: 'Cistern', filter: 'Filter', splitter: 'Flow divider', village_valve: 'Village valve',
  habitat_valve: 'Habitat valve', village: 'Village outlet', habitat: 'Habitat outlet', overflow: 'Overflow',
  reflector: 'Reflector', lens: 'Lens', plinth: 'Beacon base',
};

export function slotLabel(siteId: string, slotId: string): string {
  if (slotId === 'source') return siteId === 'tidal_sluice' ? 'Water source' : 'Power source';
  if (slotId === 'guard') return siteId === 'pier_hoist' ? 'Pulley guard' : 'Gear guard';
  return Object.hasOwn(SLOT_LABELS, slotId) ? SLOT_LABELS[slotId]! : readableId(slotId);
}

export function partLabel(siteId: string, optionId: string): string {
  const gear = /^(driver|driven)_gear_(12|24|36)$/.exec(optionId);
  if (gear) return `${gear[1] === 'driver' ? 'Input' : 'Output'} gear · ${gear[2]} teeth`;
  const weight = /^weight_(a|b)_(2|3)$/.exec(optionId);
  if (weight) return `Weight ${weight[1]!.toUpperCase()} · ${weight[2]==='3'?'heavier':'lighter'}`;
  return optionId.endsWith('_standard') ? slotLabel(siteId, optionId.slice(0, -9)) : readableId(optionId);
}

export type PlayerConfigField = 'setting' | 'mountZoneId' | 'outputModeId' | 'routeId';
export const CONFIG_FIELD_LABELS = {
  setting: 'Part setting', mountZoneId: 'Mounting place', outputModeId: 'Working mode', routeId: 'Route',
} as const satisfies Readonly<Record<PlayerConfigField, string>>;

const CONFIG_LABELS: Readonly<Record<string, string>> = {
  fixed: 'Fixed', rail_1000: 'Near the pivot', rail_1500: 'Farther from the pivot',
  shore_workzone: 'Shore work area', balanced_lift: 'Balanced lift', nest_safe_access: 'Access clear of nests',
  pump_pad: 'Pump pad', relieved_delivery: 'Delivery with relief', clean_drain: 'Clear drain route',
  inlet_2: 'Low inlet', inlet_3: 'Medium inlet', inlet_4: 'High inlet',
  outlet_1: 'Low village supply', outlet_2: 'Medium village supply', outlet_3: 'High village supply',
  bypass_0: 'Relief drain closed', bypass_1: 'Some relief', bypass_2: 'More relief',
  reedbed_edge: 'Reedbed edge', retained_split: 'Shared flow', onsite_rack: 'Debris rack on site',
  bank_open: 'Bank exposed', bank_shield: 'Bank shielded', creek_closed: 'Creek closed', creek_open: 'Creek open',
  nursery_1: 'Nursery trickle', nursery_2: 'Gentle nursery flow', nursery_3: 'Steady nursery flow', nursery_4: 'Strong nursery flow',
  obstructing: 'Debris obstructing', stored: 'Debris stored', bank_shoes: 'Both bank shoes',
  opposing_truss: 'Opposing braces', clear_channel: 'Clear river channel', tensioned: 'Tensioned', loose: 'Loose',
  bluff_pad: 'Bluff pad (above the gull ledge)', service_pad: 'Service pad (back from the cliff)', guarded_generation: 'Guarded generation',
  path_edge: 'Path edge', downshield: 'Shield light downward', sleeved_route: 'Cable in sleeve', exposed_route: 'Exposed cable',
  cistern_pad: 'Cistern pad', filtered_split: 'Filter, then divide', gravity_route: 'Gravity route',
  village_3: 'Some village water', village_4: 'Full village water', habitat_1: 'Habitat trickle', habitat_2: 'Steady habitat water',
  safe_plinth: 'Safe plinth', unstable_edge: 'Unstable edge', coastal_signal: 'Coastal signal', clear_access: 'Clear access',
  inland_sector: 'Toward inland', coastal_sector: 'Toward coast', nest_sector: 'Toward nests', clear: 'Clear', closed: 'Closed',
};

export function configLabel(id: string): string {
  return Object.hasOwn(CONFIG_LABELS, id) ? CONFIG_LABELS[id]! : readableId(id);
}

const PORT_LABELS: Readonly<Record<string, string>> = {
  in: 'In', out: 'Out', return: 'Return', guard: 'Guard attachment', anchor: 'Rope anchor',
  weight_a: 'Weight A link', weight_b: 'Weight B link', cover: 'Guard link', force: 'Weight link',
  bypass: 'Relief branch', creek: 'Creek branch', nursery: 'Nursery branch', bank: 'Bank branch', rack: 'Rack attachment',
  mount: 'Mount', shoe: 'Bank link', deck: 'Deck link', join: 'Deck join', brace: 'Brace link',
  beam: 'Beam link', left: 'Left link', right: 'Right link', rail: 'Rail attachment', shade: 'Shade attachment',
  village: 'Village branch', habitat: 'Habitat branch', overflow: 'Overflow', seat: 'Seat', shield: 'Shield attachment',
};
export const CHANNEL_LABELS = { mechanical: 'Mechanical link', electrical: 'Power link', water: 'Water link' } as const satisfies Readonly<Record<RepairChannel, string>>;

export function portLabel(siteId: string, slotId: string, portId: string): string {
  const port = Object.hasOwn(PORT_LABELS, portId) ? PORT_LABELS[portId]! : readableId(portId);
  return `${slotLabel(siteId, slotId)} · ${port}`;
}

const FACT_LABELS: Readonly<Record<string, string>> = {
  cost: 'Materials', mass: 'Mass', teeth: 'Teeth', voltage: 'Voltage', watts: 'Power', amps: 'Current',
  capacity: 'Capacity', clearance: 'Clearance', elevation: 'Elevation', supply: 'Supply',
};
/** No rounding, conversion, invented units or validation. Pass authoritative facts. */
export function factLabel(key: string, value: string | number): string {
  const label = Object.hasOwn(FACT_LABELS, key) ? FACT_LABELS[key]! : readableId(key);
  const unit = key === 'voltage' ? ' V' : key === 'watts' ? ' W' : key === 'amps' ? ' A' : '';
  return `${label}: ${String(value)}${unit}`;
}

export function materialsLabel(used: number, budget: number): string {
  return `Materials ${used} / ${budget}`;
}
