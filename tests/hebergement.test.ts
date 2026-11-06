import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import LOURDS from '../src/data/fichiers-lourds.json';
import { adresse, dossier, LOURD, v } from '../src/render/assetUrl';

const E = LOURDS as Record<string, string>;
const tous = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? tous(join(d, e.name)) : [join(d, e.name)]);

describe('Hébergement (maquette du 6 nov. 2026)', () => {
  it('chaque fichier lourd présent en local a son empreinte à jour (sinon : node tools/hebergement/envoi.mjs --empreintes)', () => {
    const faux: string[] = [];
    for (const p of tous('public/assets')) {
      const r = relative('public', p).split('\\').join('/'), m = LOURD.exec(r);
      if (m && E[m[1]] !== createHash('md5').update(readFileSync(p)).digest('hex').slice(0, 10)) faux.push(m[1]);
    }
    expect(faux.slice(0, 5)).toEqual([]);
  });
  it('les JSON et l\'interface ne partent jamais sur le stockage distant', () => {
    expect(LOURD.test('assets/mondes/astrub/monde.json')).toBe(false);
    expect(LOURD.test('assets/sprites/iop.json')).toBe(false);
    expect(LOURD.test('assets/ui/socle.png')).toBe(false);
    expect(LOURD.test('assets/mondes/astrub/sol_3_-25.webp')).toBe(true);
    expect(LOURD.test('assets/son/ui/clic.mp3')).toBe(true);
  });
  it('sans VITE_ASSETS_URL tout reste local, et un fichier lourd est versionné par son empreinte', () => {
    expect(adresse('assets/mondes/astrub/carte.webp')).toBe('assets/mondes/astrub/carte.webp');
    expect(dossier('assets/sprites/')).toBe('assets/sprites/');
    expect(v('assets/mondes/astrub/carte.webp')).toBe(`assets/mondes/astrub/carte.webp?v=${E['mondes/astrub/carte.webp']}`);
  });
});
