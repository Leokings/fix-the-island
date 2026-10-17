import {describe,it,expect} from 'vitest';
import {groundValueColor,lightingProfile} from '../../src/render/lighting-rig';
import {WARM_STYLE,COOL_STYLE,WALK_CAMERA,INSPECT_CAMERA} from '../../src/render/presets';

describe('renderer-only C1 lighting',()=>{
  it('preserves the locked cameras and one sun direction',()=>{
    expect([WALK_CAMERA.yawDegrees,WALK_CAMERA.pitchDegrees,WALK_CAMERA.span]).toEqual([35,52,8.4]);
    expect([INSPECT_CAMERA.yawDegrees,INSPECT_CAMERA.pitchDegrees,INSPECT_CAMERA.span]).toEqual([35,58,5.8]);
    expect(WARM_STYLE.keyOffset).toEqual(COOL_STYLE.keyOffset);
  });
  it('blends by genuine height, not style id, and retains explicit caller lights',()=>{
    expect(lightingProfile(COOL_STYLE,2).upland).toBe(0);
    expect(lightingProfile(WARM_STYLE,17).upland).toBe(1);
    const custom={...WARM_STYLE,keyColor:'#bbccdd',keyIntensity:1.25,fillSky:'#778899',fillGround:'#998877',exposure:.8};
    const coast=lightingProfile(custom,2),upper=lightingProfile(custom,17);
    expect(coast.keyColor.getHexString()).toBe('bbccdd');expect(coast.sky.getHexString()).toBe('778899');expect(coast.bounce.getHexString()).toBe('998877');
    expect(coast.keyIntensity).toBe(1.25);expect(upper.keyIntensity).toBeCloseTo(1.125);expect(upper.exposure).toBe(.8);
    expect(lightingProfile(WARM_STYLE,17).keyIntensity).not.toBe(lightingProfile(COOL_STYLE,17).keyIntensity);
  });
  it('makes continuous transitions without changing its immutable preset',()=>{
    const before=JSON.stringify(WARM_STYLE),a=lightingProfile(WARM_STYLE,14.499),b=lightingProfile(WARM_STYLE,14.501);
    expect(Math.abs(a.upland-b.upland)).toBeLessThan(.001);expect(JSON.stringify(WARM_STYLE)).toBe(before);
  });
  it('value-blocks the existing route separately from adjacent land',()=>{
    expect(groundValueColor(-38,2,44).getHexString()).not.toBe(groundValueColor(-43,2,44).getHexString());
    expect(groundValueColor(-45,2,0).getHexString()).not.toBe(groundValueColor(-45,17,0).getHexString());
  });
});
