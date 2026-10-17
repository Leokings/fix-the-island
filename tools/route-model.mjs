import {createServer}from'vite';
import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let modelPromise;
export function routeModel(){
  // An in-memory diagnostic module loader: no HTTP listener, no preview state,
  // no World instance, local storage, fixture approval or saved progression.
  return modelPromise??=(async()=>{
    const server=await createServer({root,configFile:false,server:{middlewareMode:true,watch:null},appType:'custom'});
    try{
      const[level,contract,steering,terrain,flora,planting]=await Promise.all([
        server.ssrLoadModule('/src/content/island-level.ts'),server.ssrLoadModule('/src/content/route-contract.ts'),
        server.ssrLoadModule('/src/input/corridor-steering.ts'),server.ssrLoadModule('/src/domain/terrain.ts'),
        server.ssrLoadModule('/src/render/environment/island-nature.ts'),server.ssrLoadModule('/src/content/nature-layout.ts'),
      ]);
      const nature=await flora.createIslandNature(level.ISLAND_LEVEL);
      try{return{level:planting.withPlantedTrees(level.ISLAND_LEVEL,nature.plantedTrees),routes:contract.PUBLIC_ROUTES,stances:contract.INSPECTION_STANCES,compositionStances:contract.COMPOSITION_STANCES,steering,terrain};}
      finally{nature.dispose();}
    }finally{await server.close();}
  })();
}
