import {expect,it} from 'vitest';
import type {HitAnchor,RepairRenderLayout} from '../../src/render/contract';
import {projectedHit} from '../../src/render/hit-test';
it('uses the caller-provided actual inset position, not reserved panel bounds',()=>{
  const layout:RepairRenderLayout={inset:{x:1392,y:744,width:504,height:312},protectedScene:{x:560,y:140,width:820,height:720},keyboardOpen:false};
  const anchors:HitAnchor[]=[{kind:'socket',siteId:'coast_windmill',slotId:'driver',label:'driver',endpoint:null,view:'inset',x:layout.inset.x+252,y:layout.inset.y+156,visible:true}];
  expect(projectedHit(anchors,1644,900,'inset',false)?.slotId).toBe('driver');expect(projectedHit(anchors,1644,768,'inset',false)).toBeNull();expect(projectedHit(anchors,1644,900,'world',false)).toBeNull();
});
it('does not click hidden or wrong-channel-mode projections',()=>{
  const anchor:HitAnchor={kind:'socket',siteId:'coast_windmill',slotId:'driver',label:'driver',endpoint:null,view:'world',x:300,y:200,visible:false};
  expect(projectedHit([anchor],300,200,'world',false)).toBeNull();expect(projectedHit([{...anchor,visible:true}],300,200,'world',true)).toBeNull();
});
