import type {HitAnchor} from './contract';
/** Visible socket/port centres have a 44px pointer target, matching touch UI.
 * A gear cover can overlap a ring's hole; face-only raycasts miss its centre. */
export function projectedHit(anchors:readonly HitAnchor[],x:number,y:number,view:'world'|'inset',ports:boolean):HitAnchor|null {
  return anchors.filter((anchor)=>anchor.view===view&&anchor.visible&&anchor.kind===(ports?'port':'socket'))
    .map((anchor)=>({anchor,distance:Math.hypot(x-anchor.x,y-anchor.y)})).filter((hit)=>hit.distance<=22).sort((a,b)=>a.distance-b.distance)[0]?.anchor??null;
}
