import type { SiteSnapshot } from '../domain/world';

/** Render-only response to authoritative domain phases. Pending never lifts cargo. */
export function restorationPresentation(site: Pick<SiteSnapshot,'phase'|'restorationSeconds'|'crew'>) {
  const installing=site.phase==='restoring',working=site.phase==='restored';
  const progress=installing?Math.max(0,Math.min(1,site.restorationSeconds/3)):working?1:0;
  return {progress,working,lift:progress*progress*(3-2*progress),spark:installing?Math.sin(progress*Math.PI):0,
    inspection:site.crew==='working',revision:site.crew==='paused'};
}

/** Display only. Amber review is not a completion, green requires restored. */
export function repairStateAppearance(site:Pick<SiteSnapshot,'phase'|'crew'>) {
  return site.phase==='restored'?{color:'#70b696',label:'Working',glow:.16}:
    site.phase==='restoring'?{color:'#f6df9e',label:'Installing',glow:.35}:
    site.phase==='pending'?{color:'#dca653',label:'In review',glow:.04}:
    site.phase==='revision'?{color:'#dca653',label:'Revise',glow:0}:
    {color:'#bb7659',label:'Needs repair',glow:0};
}
