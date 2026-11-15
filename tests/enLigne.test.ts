import { describe, expect, it } from 'vitest';
import { entreeInvite, garderUneFois, type UneFois } from '../src/sim/miroir';

// « En ligne : » 4A + 4B (2026-11-15) : dans le monde du groupe, l'invité récolte, va aux ateliers et aux Zaaps, ouvre son Havre-Sac
// et le coffre de l'Enutrof comme seul : ces gestes passent dans ses entrées, une seule fois chacun.
describe('entrées de l’invité dans le monde du groupe', () => {
  it('garde récolte, atelier, Zaap, Havre-Sac, coffre et boisson, et refuse les valeurs folles', () => {
    const e = entreeInvite({ recolte: 12, recolteTenue: true, atelier: 3, versZaap: 'Zaap d’Astrub', zaap: 2, havreSac: true, coffre: true, boisson: true });
    expect([e.recolte, e.recolteTenue, e.atelier, e.versZaap, e.zaap, e.havreSac, e.coffre, e.boisson]).toEqual([12, true, 3, 'Zaap d’Astrub', 2, true, true, true]);
    const f = entreeInvite({ recolte: 'x' as unknown as number, zaap: 1e9, versZaap: 4 as unknown as string });
    expect([f.recolte, f.zaap, f.versZaap, f.havreSac]).toEqual([null, null, null, false]);
  });
  it('un geste reçu entre deux pas n’est pas perdu, puis n’est joué qu’une fois', () => {
    const u: UneFois = {};
    garderUneFois(u, entreeInvite({ recolte: 5 }));
    garderUneFois(u, entreeInvite({ move: { x: 1, y: 0 } }));   // l'entrée suivante n'a plus le clic
    garderUneFois(u, entreeInvite({ coffre: true }));
    expect(u).toMatchObject({ recolte: 5, coffre: true });
    expect(u.atelier).toBeUndefined();
  });
});
