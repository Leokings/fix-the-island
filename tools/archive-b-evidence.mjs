import{cp,mkdir,readFile,readdir,stat,writeFile}from'node:fs/promises';import{join,dirname}from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),base=join(root,'artifacts/stage-b');
const report=JSON.parse(await readFile(join(base,'journey-report.json'),'utf8'));
const destination=join(base,'failures',`${report.commit.slice(0,12)}-${report.finished.replaceAll(':','-').replaceAll('.','-')}`);await mkdir(destination,{recursive:true});
const originals=[];
async function preserve(name,classification){
  const source=join(base,name),target=join(destination,name);await mkdir(dirname(target),{recursive:true});await cp(source,target,{recursive:true,errorOnExist:true,force:false});
  const walk=async(dir,prefix)=>{for(const entry of await readdir(dir,{withFileTypes:true})){const relative=join(prefix,entry.name);if(entry.isDirectory())await walk(join(dir,entry.name),relative);else originals.push({file:relative,sha256:createHash('sha256').update(await readFile(join(dir,entry.name))).digest('hex'),classification});}};
  if((await stat(source)).isDirectory())await walk(source,name);else originals.push({file:name,sha256:createHash('sha256').update(await readFile(source)).digest('hex'),classification});
}
for(const name of ['journey-report.json','composition','loop-frames','failure.png']){
  try{await preserve(name,name==='journey-report.json'?'Original report; listed captures have its declared source identity.':'Mixed historical directory. ONLY entries listed in the original report inherit that report identity; unlisted media retains unknown/unmapped lineage.');}catch(error){if(error.code!=='ENOENT')throw error;}
}
await writeFile(join(destination,'archive.json'),JSON.stringify({scope:'Unmodified failure evidence copies; originals preserved; no game/save/progress mutation',reportCommit:report.commit,runtimeCommit:report.runtimeCommit,reportResult:report.result,listedFrames:report.frames.map(f=>f.file),listedCompositions:report.composition.map(f=>f.file),files:originals},null,2)+'\n');console.log(destination);
