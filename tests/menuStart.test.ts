import { describe, expect, it } from 'vitest';

// Menu Start au Bastion (Mathis, 2026-11-17) : pas de carte du monde, l'onglet Carte fermait tout le menu.
describe('menu Start', () => {
  it('saute les onglets sans contenu, dans les deux sens, et ne rouvre pas dessus', async () => {
    Object.assign(globalThis, { innerWidth: 854, innerHeight: 480 });
    const { MenuStart } = await import('../src/render/manetteJeu');
    const vus: string[] = [];
    const m = new MenuStart(o => vus.push(o), () => {}, o => o !== 'carte');
    (m as unknown as { dessiner: () => void }).dessiner = () => {};
    m.montrer();
    for (let i = 0; i < 6; i++) m.tourner(1);
    for (let i = 0; i < 3; i++) m.tourner(-1);
    expect(vus).not.toContain('carte');
    expect(vus.slice(0, 6)).toEqual(['inv', 'sorts', 'car', 'quetes', 'opt', 'inv']);
    expect(m.ouvert).toBe(true);
  });
});
