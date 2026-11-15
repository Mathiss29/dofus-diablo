import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

// PNJ pixelisés (Mathis, 15 nov. 2026) : les planches des PNJ et des habitants sont dessinées en 2x (HD=2) et le jeu les réduit
// d'autant grâce à `meta.hd` (EntityView.hd). Phaser ne lit que le `meta` du haut du JSON (texture.customData).
describe('planches des PNJ et des habitants en 2x', () => {
  const dir = 'public/assets/sprites';
  const planches = readdirSync(dir).filter(f => /^(pnj|hab)_.+\.json$/.test(f));
  it('il y a des planches', () => expect(planches.length).toBeGreaterThan(50));
  for (const f of planches) it(f, () => {
    const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as { meta?: { hd?: number } };
    expect(j.meta?.hd, `${f} : refaire avec HD=2 (tools/extraction/LISEZMOI.md, PNJ et habitants en 2x)`).toBe(2);
  });
});
