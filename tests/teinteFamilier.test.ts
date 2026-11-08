import { describe, expect, it } from 'vitest';
import { teindre, zoneDe, ZONES_RVB } from '../src/render/teinteFamilier';
import FAM from '../src/data/familiers.json';

describe('familiers aux couleurs du porteur', () => {
  it('retrouve la zone de chaque aplat, même un peu mélangé au bord', () => {
    ZONES_RVB.forEach((c, i) => expect(zoneDe(c >> 16, (c >> 8) & 255, c & 255)).toBe(i + 1));
    expect(zoneDe(0, 0, 0)).toBe(0);
    expect(zoneDe(230, 12, 8)).toBe(1);
  });
  it('teint le gris de la zone avec la couleur du perso et laisse le reste', () => {
    const px = new Uint8ClampedArray([128, 128, 128, 255, 128, 128, 128, 255]);
    const carte = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]);
    teindre(px, carte, [0xff0000]);
    expect([...px.slice(0, 3)]).toEqual([255, 1, 1]);   // gris moyen incrusté de rouge
    expect([...px.slice(4, 7)]).toEqual([128, 128, 128]);
  });
  it('chaque familier aux couleurs du porteur a sa carte des zones', () => {
    const f = Object.values((FAM as { familiers: Record<string, { porteur?: boolean; zones?: string }> }).familiers).filter(x => x.porteur);
    expect(f.length).toBeGreaterThan(30);
    for (const x of f) expect(x.zones).toMatch(/^fam_\d+_zones\.[0-9a-f]{8}\.webp$/);
  });
});
