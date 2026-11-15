import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import CLASSES from '../src/data/classes.json';
import SPELL_FX from '../src/data/spellfx.json';
import LOURDS from '../src/data/fichiers-lourds.json';
import { LOOKS } from '../src/render/looks';

/** Garde « plus jamais de sort sans animation » (demande de Mathis, 2026-11-15).
 *  Chaque sort de chaque classe doit avoir :
 *   1. le geste du personnage (animation officielle casterAnimation dans looks.ts), sinon il reste immobile ;
 *   2. son effet visuel officiel (spellfx.json, rendu par tools/extraction/spell_fx.py), sinon on ne voit qu'un rond dessiné ;
 *   3. pour chaque effet : la planche fx_<gfx>.json dans git et fx_<gfx>.webp envoyé sur R2 (fichiers-lourds.json).
 *  Un nouveau sort qui n'a pas tout ça fait échouer npm test, donc la PR ne passe pas. */

/** Sorts qui n'ont AUCUN effet visuel dans Dofus 3 (spellscripts vides ou faits de masques seulement), ou créés par nous.
 *  N'ajouter un sort ici qu'après avoir vérifié ses spellscripts (voir tools/extraction/LISEZMOI.md, « Effets visuels »). */
const SANS_EFFET_OFFICIEL: Record<string, string> = {
  bond: 'Iop : aucun gfx dans ses spellscripts (le saut est dans le geste)',
  balise_survie: 'Crâ : aucun gfx officiel',
  discipline: 'Osamodas : gfx 8708/8709 faits uniquement de masques, non rendables',
  attirance: 'Sacrieur : gfx 8355/8356 faits uniquement de masques, non rendables',
  mutilation: 'Sacrieur : aucun gfx officiel',
  epee_vorace: 'Sacrieur : aucun gfx officiel',
  effondrement: 'Forgelance : aucun gfx officiel',
  phalange: 'Forgelance : aucun gfx officiel',
  muspel: 'Forgelance : aucun gfx officiel',
  prelude_fer: 'Forgelance : aucun gfx officiel',
  terre_milieu: 'Forgelance : aucun gfx officiel',
  noa: 'Forgelance : aucun gfx officiel',
  eclipse: 'Forgelance : aucun gfx officiel',
  estoc: 'Forgelance : attaque de base, le geste de la Lance suffit (pas un sort officiel)',
  saut: 'Forgelance : sort maison (tiré de Lance-cyclone), atterrissage dessiné',
  sac_anime: 'Enutrof : invocation, aucun gfx officiel (la créature apparaît)',
  pelle_animee: 'Enutrof : invocation, aucun gfx officiel',
  coffre_anime: 'Enutrof : invocation, aucun gfx officiel',
  malle_animee: 'Enutrof : invocation, aucun gfx officiel',
  passage: 'Sadida : sort maison (pas de sort officiel), atterrissage dessiné',
  lance_roquet: 'Ouginak : invocation, aucun gfx officiel (le Roquet apparaît)',
  bond_bete: 'Ouginak : sort maison (17A), la ruée officielle AnimDash est dans le geste',
};

type Ref = { gfx: number };
type Def = { target?: Ref[]; caster?: Ref[]; projectile?: Ref };
const FX = SPELL_FX as unknown as { spells: Record<string, Def>; gfx: Record<string, unknown> };
const gfxDe = (d?: Def) => d ? [...(d.target ?? []), ...(d.caster ?? []), ...(d.projectile ? [d.projectile] : [])].map(r => r.gfx) : [];
const lourds = LOURDS as Record<string, string>;
type Sort = { name: string; anim?: string; charge?: unknown };

const classes = Object.entries(CLASSES as unknown as Record<string, { spells: Record<string, Sort> }>);

describe('chaque sort a son animation et son effet visuel', () => {
  for (const [cls, c] of classes) {
    it(`${cls} : geste du personnage pour chaque sort`, () => {
      const map = LOOKS[cls]?.map;
      expect(map, `pas d'apparence pour la classe ${cls} dans looks.ts`).toBeTruthy();
      // même nom que Player.cast : `${id}_charge`, def.anim, sinon l'id du sort
      const sans = Object.entries(c.spells).filter(([id, s]) => !map[s.charge ? `${id}_charge` : s.anim ?? id])
        .map(([id, s]) => `${id} (${s.name})`);
      expect(sans, `sorts sans geste dans looks.ts (ajouter l'AnimAttaque officielle) : ${sans.join(', ')}`).toEqual([]);
    });

    it(`${cls} : effet visuel officiel pour chaque sort`, () => {
      const sans = Object.entries(c.spells)
        .filter(([id]) => !SANS_EFFET_OFFICIEL[id] && gfxDe(FX.spells[id]).length === 0)
        .map(([id, s]) => `${id} (${s.name})`);
      expect(sans, `sorts sans effet visuel dans spellfx.json (rendre les gfx avec spell_fx.py) : ${sans.join(', ')}`).toEqual([]);
    });
  }

  it('la liste des sorts sans effet officiel ne contient que de vrais sorts sans effet', () => {
    const tous = new Set(classes.flatMap(([, c]) => Object.keys(c.spells)));
    for (const id of Object.keys(SANS_EFFET_OFFICIEL)) {
      expect(tous.has(id), `${id} n'existe plus`).toBe(true);
      expect(gfxDe(FX.spells[id]), `${id} a maintenant un effet : le retirer de SANS_EFFET_OFFICIEL`).toEqual([]);
    }
  });

  it('chaque effet utilisé est rendu, dans git et envoyé sur R2', () => {
    const manque: string[] = [];
    for (const [id, d] of Object.entries(FX.spells)) {
      for (const g of gfxDe(d)) {
        if (!FX.gfx[g]) manque.push(`${id} : gfx ${g} absent de spellfx.json (gfx)`);
        else {
          if (!existsSync(`public/assets/fx/fx_${g}.json`)) manque.push(`${id} : public/assets/fx/fx_${g}.json oublié dans git`);
          if (!lourds[`fx/fx_${g}.webp`]) manque.push(`${id} : fx_${g}.webp pas envoyé sur R2 (node tools/hebergement/envoi.mjs)`);
        }
      }
    }
    expect([...new Set(manque)]).toEqual([]);
  });
});
