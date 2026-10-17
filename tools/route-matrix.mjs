import{createServer}from'vite';import{mkdir,writeFile,readFile}from'node:fs/promises';
import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
import{fileURLToPath}from'node:url';import{join}from'node:path';
import{routeModel}from'./route-model.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),draft=process.argv.includes('--draft'),geometryOnly=process.argv.includes('--geometry-only');
const routeIds=process.argv.find(a=>a.startsWith('--routes='))?.slice(9).split(',');
const stamp=new Date().toISOString(),out=join(root,'artifacts/stage-b/route-matrix',stamp.replaceAll(':','-').replaceAll('.','-'));await mkdir(out,{recursive:true});
const model=await routeModel(),loader=await createServer({root,configFile:false,server:{middlewareMode:true,watch:null},appType:'custom'});
let audit;try{audit=(await loader.ssrLoadModule('/src/input/route-matrix.ts')).auditRouteMatrix;}finally{await loader.close();}
const hashes={};for(const name of ['src/content/island-level.ts','src/content/service-layout.ts','src/content/route-contract.ts','src/domain/terrain.ts','src/domain/motion.ts','src/input/corridor-steering.ts'])hashes[name]=createHash('sha256').update(await readFile(join(root,name))).digest('hex');
const report=audit(model.level,Object.values(model.routes),{geometryOnly,...(routeIds?{routeIds}:{}),...(process.argv.includes('--quick')?{profileLimit:1}:{}),onRoute:(id,counts)=>console.log(JSON.stringify({id,...counts}))});
const record={started:stamp,finished:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),draftGeometry:draft,geometryOnly,sourceHashes:hashes,...report};
await writeFile(join(out,'report.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({path:join(out,'report.json'),samples:report.samples,trials:report.trials,chainedTrials:report.chainedTrials,failures:report.failureCount,classifications:report.classifications,draftGeometry:draft},null,2));
if(report.failureCount)process.exitCode=1;
