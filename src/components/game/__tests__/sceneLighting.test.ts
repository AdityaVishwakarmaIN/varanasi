import { describe, expect, it } from 'vitest';
import { getSceneLighting } from '../sceneLighting';

describe('scene lighting for the S4-T2 weather modes', () => {
  it('fog is a thick white wash in the morning that thins by 11', () => {
    const at8 = getSceneLighting(8, 'fog');
    const at10 = getSceneLighting(10, 'fog');
    const at12 = getSceneLighting(12, 'fog');
    expect(at8.overlayAlpha).toBeGreaterThan(0.3);
    expect(at8.ambientColor.r).toBeGreaterThan(200);
    expect(at10.overlayAlpha).toBeLessThan(at8.overlayAlpha);
    expect(at12.overlayAlpha).toBeLessThan(at10.overlayAlpha);
    expect(at12.overlayAlpha).toBeLessThan(0.1);
  });

  it('heat haze is a subtle warm tint', () => {
    const noon = getSceneLighting(13, 'heat_haze');
    expect(noon.overlayAlpha).toBeGreaterThan(0);
    expect(noon.overlayAlpha).toBeLessThanOrEqual(0.15);
    expect(noon.ambientColor.r).toBeGreaterThan(noon.ambientColor.b);
  });

  it('clear daytime is untouched', () => {
    expect(getSceneLighting(12, 'clear').overlayAlpha).toBe(0);
  });
});
