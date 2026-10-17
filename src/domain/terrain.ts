export interface Vec3 { readonly x: number; readonly y: number; readonly z: number }
export interface WalkTriangle { readonly id: string; readonly a: Vec3; readonly b: Vec3; readonly c: Vec3; readonly biome: string; readonly requires?: readonly string[] }
export interface Obstacle { readonly id: string; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; readonly blockedUntil?: readonly string[]; readonly requires?: readonly string[]; readonly footprint?:readonly Readonly<{x:number;z:number}>[];readonly minY?:number;readonly maxY?:number }
export interface RouteGate { readonly id: string; readonly position: Vec3; readonly requires: readonly string[]; readonly diagnosis: string; readonly kind: 'gap' | 'flood' | 'gate' }
export interface LevelData {
  readonly id: string;
  readonly spawn: Vec3;
  readonly triangles: readonly WalkTriangle[];
  readonly obstacles: readonly Obstacle[];
  readonly trees: readonly Vec3[];
  readonly visibleSiteIds: readonly string[];
  readonly banks?: readonly (readonly [Vec3, Vec3])[];
  readonly gates?: readonly RouteGate[];
  readonly sitePositions?:Readonly<Record<string,Vec3>>;
  readonly saveCompatibleLevelIds?:readonly string[];
  readonly surfaceSelection?:'highest';
  readonly bounds: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
}
export interface GroundSample { readonly y: number; readonly normal: Vec3; readonly surfaceId: string; readonly biome: string }

// Immutable LevelData permits a spatial acceleration cache. Candidate arrays
// retain source triangle order, including first-hit overlap semantics; this
// never selects a nicer height to conceal an incoherent visible floor.
const groundIndices=new WeakMap<LevelData,ReadonlyMap<string,readonly WalkTriangle[]>>();
const obstacleIndices=new WeakMap<LevelData,ReadonlyMap<string,readonly Obstacle[]>>();
const CELL=2;
function groundCandidates(level:LevelData,x:number,z:number):readonly WalkTriangle[]{
  let index=groundIndices.get(level);
  if(!index){
    const cells=new Map<string,WalkTriangle[]>();
    for(const triangle of level.triangles){
      const vertices=[triangle.a,triangle.b,triangle.c],epsilon=1e-6;
      const minX=Math.floor((Math.min(...vertices.map(v=>v.x))-epsilon)/CELL),maxX=Math.floor((Math.max(...vertices.map(v=>v.x))+epsilon)/CELL);
      const minZ=Math.floor((Math.min(...vertices.map(v=>v.z))-epsilon)/CELL),maxZ=Math.floor((Math.max(...vertices.map(v=>v.z))+epsilon)/CELL);
      for(let cx=minX;cx<=maxX;cx++)for(let cz=minZ;cz<=maxZ;cz++){
        const key=`${cx},${cz}`;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(triangle);
      }
    }
    index=cells;groundIndices.set(level,index);
  }
  return index.get(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`)??[];
}
function obstacleCandidates(level:LevelData,from:Vec3,to:Vec3,radius:number):readonly Obstacle[]{
  let index=obstacleIndices.get(level);
  if(!index){
    const cells=new Map<string,Obstacle[]>();
    for(const obstacle of level.obstacles)for(let x=Math.floor(obstacle.minX/CELL);x<=Math.floor(obstacle.maxX/CELL);x++)for(let z=Math.floor(obstacle.minZ/CELL);z<=Math.floor(obstacle.maxZ/CELL);z++){
      const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(obstacle);
    }
    index=cells;obstacleIndices.set(level,index);
  }
  const found=new Set<Obstacle>();
  for(let x=Math.floor((Math.min(from.x,to.x)-radius)/CELL);x<=Math.floor((Math.max(from.x,to.x)+radius)/CELL);x++)for(let z=Math.floor((Math.min(from.z,to.z)-radius)/CELL);z<=Math.floor((Math.max(from.z,to.z)+radius)/CELL);z++)for(const obstacle of index.get(`${x},${z}`)??[])found.add(obstacle);
  return [...found];
}
export function collidingObstacles(level:LevelData,from:Vec3,to:Vec3,restored:ReadonlySet<string>,radius=.28):readonly Obstacle[]{
  return obstacleCandidates(level,from,to,radius).filter(o=>(!o.requires||o.requires.every(id=>restored.has(id)))&&(!o.blockedUntil||o.blockedUntil.some(id=>!restored.has(id)))&&(o.maxY===undefined||o.maxY>Math.min(from.y,to.y)+.04)&&(o.minY===undefined||o.minY<Math.max(from.y,to.y)+1.65)&&hitsObstacle(from,to,o,radius));
}

export function sampleGround(level: LevelData, x: number, z: number, restored: ReadonlySet<string> = new Set()): GroundSample | null {
  let highest:GroundSample|null=null;
  for (const { a, b, c, id, biome, requires } of groundCandidates(level,x,z)) {
    if (requires?.some((site) => !restored.has(site))) continue;
    const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(denominator) < 1e-9) continue;
    const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / denominator;
    const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / denominator;
    const w = 1 - u - v;
    if (Math.min(u, v, w) < -1e-7) continue;
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const nx = ab.y * ac.z - ab.z * ac.y;
    const ny = ab.z * ac.x - ab.x * ac.z;
    const nz = ab.x * ac.y - ab.y * ac.x;
    const length = Math.hypot(nx, ny, nz);
    const sample={ y: u * a.y + v * b.y + w * c.y, normal: { x: nx / length, y: ny / length, z: nz / length }, surfaceId: id, biome };
    if(level.surfaceSelection!=='highest')return sample;
    if(!highest||sample.y>highest.y)highest=sample;
  }
  return highest;
}

// Continuous segment vs expanded footprint; high-speed input cannot tunnel.
export function hitsObstacle(from: Vec3, to: Vec3, obstacle: Obstacle, radius = 0.28): boolean {
  if(obstacle.footprint){
    const polygon=obstacle.footprint;
    const cross=(a:{x:number;z:number},b:{x:number;z:number},c:{x:number;z:number})=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
    const distance=(p:{x:number;z:number},a:{x:number;z:number},b:{x:number;z:number})=>{const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len)):0;return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);};
    const inside=(p:Vec3)=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i]!,b=polygon[j]!;if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)hit=!hit;}return hit;};
    if(inside(from)||inside(to))return true;
    for(let i=0;i<polygon.length;i++){const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!;
      const c0=cross(from,to,a),c1=cross(from,to,b),c2=cross(a,b,from),c3=cross(a,b,to);
      if(c0*c1<0&&c2*c3<0||Math.min(distance(from,a,b),distance(to,a,b),distance(a,from,to),distance(b,from,to))<=radius)return true;
    }return false;
  }
  let entry = 0;
  let exit = 1;
  for (const [origin, delta, low, high] of [
    [from.x, to.x - from.x, obstacle.minX - radius, obstacle.maxX + radius],
    [from.z, to.z - from.z, obstacle.minZ - radius, obstacle.maxZ + radius],
  ] as const) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < low || origin > high) return false;
    } else {
      const t0 = (low - origin) / delta;
      const t1 = (high - origin) / delta;
      entry = Math.max(entry, Math.min(t0, t1));
      exit = Math.min(exit, Math.max(t0, t1));
      if (entry > exit) return false;
    }
  }
  return true;
}

export function dryStandingGround(level:LevelData,position:Vec3,restored:ReadonlySet<string>=new Set()):GroundSample|null {
  const bounds=level.bounds;
  if(position.x<bounds.minX+0.28||position.x>bounds.maxX-0.28||position.z<bounds.minZ+0.28||position.z>bounds.maxZ-0.28)return null;
  const ground=sampleGround(level,position.x,position.z,restored);
  if(!ground||ground.normal.y<Math.cos(38*Math.PI/180))return null;
  for(const [dx,dz]of [[0.28,0],[-0.28,0],[0,0.28],[0,-0.28]]) {
    const support=sampleGround(level,position.x+dx!,position.z+dz!,restored);
    if(!support||support.normal.y<Math.cos(38*Math.PI/180)||Math.abs(support.y-ground.y)>0.22)return null;
  }
  const standing={x:position.x,y:ground.y,z:position.z};
  if(collidingObstacles(level,standing,standing,restored).length)return null;
  return ground;
}

export function traverse(level: LevelData, from: Vec3, dx: number, dz: number, restored: ReadonlySet<string> = new Set()): { position: Vec3; ground: GroundSample } {
  const test = (x: number, z: number) => {
    const bounds = level.bounds;
    if (x < bounds.minX + 0.28 || x > bounds.maxX - 0.28 || z < bounds.minZ + 0.28 || z > bounds.maxZ - 0.28) return null;
    const ground = sampleGround(level, x, z, restored);
    if (!ground || ground.normal.y < Math.cos(38 * Math.PI / 180) || Math.abs(ground.y - from.y) > 0.22) return null;
    // Dry support under the entire footprint, not only its centre.
    for (const [ox, oz] of [[0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]]) {
      const edge = sampleGround(level, x + ox!, z + oz!, restored);
      if (!edge || edge.normal.y < Math.cos(38 * Math.PI / 180) || Math.abs(edge.y - ground.y) > 0.22) return null;
    }
    const position = { x, y: ground.y, z };
    if (collidingObstacles(level,from,position,restored).length) return null;
    return { position, ground };
  };
  return test(from.x + dx, from.z + dz) ?? test(from.x + dx, from.z) ?? test(from.x, from.z + dz)
    ?? { position: from, ground: sampleGround(level, from.x, from.z, restored)! };
}
