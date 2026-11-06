import { describe, expect, it } from 'vitest';
import { noter, nouvelleSession, statsVides } from '../src/render/carnet';
import type { Item } from '../src/sim/items';

describe('carnet de l\'accueil (Bestiaire, résumé, dernière partie)', () => {
  it('compte les monstres, garde le meilleur objet et les élites', () => {
    const st = statsVides(), se = nouvelleSession(3), b: Record<string, number> = {};
    const M = { tofu: { name: 'Tofu' }, milimilou: { name: 'Milimilou', elite: true } }, O = { a: { name: 'Coiffe' }, c: { name: 'Cape' } };
    noter({ k: 'kill', x: 0, y: 0, radius: 1, monster: 'tofu' }, st, se, b, M, O);
    noter({ k: 'kill', x: 0, y: 0, radius: 1, monster: 'tofu' }, st, se, b, M, O);
    noter({ k: 'kill', x: 0, y: 0, radius: 1, monster: 'milimilou' }, st, se, b, M, O);
    noter({ k: 'loot', item: { id: 'a', rarity: 'rare' } as Item }, st, se, b, M, O);
    noter({ k: 'loot', item: { id: 'c', rarity: 'commun' } as Item }, st, se, b, M, O);
    noter({ k: 'lootKamas', n: 40 }, st, se, b, M, O);
    noter({ k: 'levelUp', level: 5 }, st, se, b, M, O);
    noter({ k: 'queteFin', id: 'x', sautee: true }, st, se, b, M, O);
    expect(b).toEqual({ tofu: 2, milimilou: 1 });
    expect([st.vaincus, st.kamas, st.quetes, se.niveau - se.niveau0]).toEqual([3, 40, 0, 2]);
    expect(se.elites).toEqual(['Milimilou']);
    expect(st.meilleur).toEqual({ nom: 'Coiffe', rarete: 'rare' });
  });
});
