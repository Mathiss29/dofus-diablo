import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { rollItem, type EquipSlot, type Item } from '../src/sim/items';
import { NO_INPUT } from '../src/sim/input';
import { Rng } from '../src/sim/math';
import { BOSS_PREFERES, PC_PAR_ID, POUVOIRS_CLASSE, jetPouvoirClasse } from '../src/sim/pouvoirsClasse';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const arena = (classId = 'iop', test = true) => {
  const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 7, classId, items: ITEMS, ...(test ? { test: {} as never } : {}) });
  w.waveDelay = 1e9; return w;
};
const de = (slot: string) => Object.entries(ITEMS.equipment).find(([, d]) => d.slot === slot && !d.familier && d.level <= 20)!;
/** Porte un Légendaire de cet emplacement avec ce pouvoir de classe. */
const porter = (w: World, id: string, value: number) => {
  const c = PC_PAR_ID[id], [iid] = de(c.slot), it: Item = { uid: w.newUid(), id: iid, rarity: 'legendaire', stats: {}, extra: [], legendary: { id, value } };
  w.player.equipment[(c.slot === 'anneau' ? 'anneau1' : c.slot) as EquipSlot] = it;
  w.player.recompute();
  return it;
};
const monstre = (w: World, dx: number, dy = 0, type = 'bouftou') => { const m = w.spawnMonster(type, w.player.x + dx, w.player.y + dy); m.state = 'chase'; return m; };

describe('Légendaires de classe inventés (Légendaires classe : 1A 2A+2D 3C 4A …)', () => {
  it('47 pouvoirs (+ 17 du Sacrieur), deux par emplacement, chacun sur un vrai sort de sa classe', () => {
    expect(POUVOIRS_CLASSE).toHaveLength(64);
    expect(PC_PAR_ID['pc-cra-D']).toBeUndefined();   // 6D Pas piégé refusé
    for (const p of POUVOIRS_CLASSE) {
      expect(GAME_DATA.classes[p.classe].spells[p.sort], p.id).toBeDefined();
      expect(POUVOIRS_CLASSE.filter(q => q.classe === p.classe && q.slot === p.slot)).toHaveLength(p.classe === 'cra' && p.slot === 'bottes' ? 1 : p.classe === 'sacrieur' && p.slot === 'bouclier' ? 3 : 2);
      expect(p.texte(p.jet[1])).not.toMatch(/\btours?\b/i);
    }
  });

  it('3C : jet aléatoire dans la fourchette, arrondi au pas ; le Mythique a le jet parfait', () => {
    const rng = new Rng(4);
    for (const p of POUVOIRS_CLASSE) {
      for (let i = 0; i < 50; i++) {
        const v = jetPouvoirClasse(p, rng, false);
        expect(v).toBeGreaterThanOrEqual(p.jet[0]); expect(v).toBeLessThanOrEqual(p.jet[1]);
        expect(Math.abs(v / p.pas - Math.round(v / p.pas))).toBeLessThan(1e-6);
      }
      expect(jetPouvoirClasse(p, rng, true)).toBe(p.jet[1]);
    }
  });

  it('2A : ~1 Légendaire sur 5 tire le pouvoir de classe de son emplacement ; 2D : chance triplée chez le boss qui le préfère', () => {
    const w = arena(), [id, d] = de('bottes'), rng = new Rng(11), ctx = w.player.ctxPouvoirs;
    const compte = (boss?: string) => {
      let n = 0;
      for (let i = 0; i < 1500; i++) {
        const l = rollItem(id, d, 'legendaire', rng, i, { ...ctx, boss }).legendary!;
        if (l.id === 'pc-iop-A') { n++; expect(l.value).toBeGreaterThanOrEqual(50); expect(l.value).toBeLessThanOrEqual(70); }
      }
      return n / 1500;
    };
    expect(BOSS_PREFERES.royal).toContain('pc-iop-A');
    const normal = compte(), royal = compte('royal');
    // 4A : deux pouvoirs de classe sur les bottes du Iop (Bond sismique, Sillon brûlant), une chance sur deux chacun
    expect(normal).toBeGreaterThan(0.06); expect(normal).toBeLessThan(0.15);
    expect(royal).toBeGreaterThan(0.22);
    // jamais un pouvoir d'une autre classe
    for (let i = 0; i < 500; i++) expect(rollItem(id, d, 'legendaire', rng, i, ctx).legendary!.id).not.toMatch(/^pc-(cra|osamodas)/);
  });

  it('hors partie de test (0.3 cachée) : aucun pouvoir de classe', () => {
    const w = arena('iop', false), [id, d] = de('bottes'), rng = new Rng(2);
    for (let i = 0; i < 500; i++) expect(rollItem(id, d, 'legendaire', rng, i, w.player.ctxPouvoirs).legendary!.id.startsWith('pc-')).toBe(false);
  });

  it('4A : le Codex garde le jet de l\'objet brisé, un meilleur jet le remplace, un moins bon non', () => {
    const w = arena(), p = w.player, [iid] = de('bottes');
    const leg = (value: number): Item => ({ uid: w.newUid(), id: iid, rarity: 'legendaire', stats: {}, extra: [], legendary: { id: 'pc-iop-A', value } });
    for (const [v, garde] of [[55, 55], [52, 55], [68, 68]]) {
      const it = leg(v); p.bag.push(it); w.briserObjet(it.uid);
      expect(p.codex.find(c => c.id === 'pc-iop-A')?.value).toBe(garde);
    }
    const cra = leg(60); cra.legendary = { id: 'pc-cra-A', value: 40 }; p.bag.push(cra); w.briserObjet(cra.uid);
    expect(p.codex.some(c => c.id === 'pc-cra-A')).toBe(false);
  });

  it('pas actif pour une autre classe ni hors 0.3', () => {
    const w = arena('cra'); porter(w, 'pc-iop-A', 60);
    expect(w.player.pcv('pc-iop-A')).toBe(0);
    const v = arena('iop', false); porter(v, 'pc-iop-A', 60);
    expect(v.player.pcv('pc-iop-A')).toBe(0);
    const u = arena(); porter(u, 'pc-iop-A', 60);
    expect(u.player.pcv('pc-iop-A')).toBe(60);
  });
});

describe('Légendaires de classe : effets', () => {
  it('Iop C Rage sans fond : jauge pleine = Colère de Iop rechargée, au plus une fois toutes les v s', () => {
    const w = arena(), p = w.player;
    p.level = 200; p.recompute();
    const did = p.cls.spells.colere.dofusId, i = p.pairs.findIndex(q => q.some(x => x.id === did));
    if (i >= 0) p.variants[i] = p.pairs[i].findIndex(x => x.id === did);
    expect(p.knows('colere')).toBe(true);
    porter(w, 'pc-iop-C', 15);
    p.cd.colere = 9; p.casts.colere = [p.age];
    p.addRage(1e6, w);
    expect(p.cd.colere).toBe(0);
    p.rage = 0; p.cd.colere = 9; p.addRage(1e6, w);
    expect(p.cd.colere).toBe(9);   // trop tôt
  });

  it('Iop F Couperet du bourreau : achève un monstre sous le seuil, jamais un boss, au plus une fois toutes les 4 s', () => {
    const w = arena(), p = w.player;
    const m = monstre(w, 60); m.hp = Math.floor(m.maxHp * 0.12);
    const m2 = monstre(w, 60, 30); m2.hp = Math.floor(m2.maxHp * 0.12);
    w.hitCircle(m.x, m.y, 4, { dmg: 0.01, knock: 0, execute: 0.14 });
    expect(m.dead).toBe(true);
    w.hitCircle(m2.x, m2.y, 4, { dmg: 0.01, knock: 0, execute: 0.14 });
    expect(m2.dead).toBe(false);   // recharge de 4 s
    p.couperetA = -99;
    const plein = monstre(w, -80);
    w.hitCircle(plein.x, plein.y, 4, { dmg: 0.01, knock: 0, execute: 0.14 });
    expect(plein.dead).toBe(false);   // au-dessus du seuil
    const boss = monstre(w, 0, 90, Object.keys(GAME_DATA.monsters).find(k => GAME_DATA.monsters[k].boss)!);
    boss.hp = 1; boss.maxHp = 1e6; boss.hp = Math.floor(boss.maxHp * 0.05);
    w.hitCircle(boss.x, boss.y, 4, { dmg: 0.01, knock: 0, execute: 0.14 });
    expect(boss.dead).toBe(false);
  });

  it('Iop G Cri du champion : repousse tous les monstres autour', () => {
    const w = arena(), a = monstre(w, 60), b = monstre(w, -60);
    expect(w.repousser(w.player.x, w.player.y, 96, 684)).toBe(2);
    expect(a.kx).toBeGreaterThan(0); expect(b.kx).toBeLessThan(0);
  });

  it('Crâ F Givre mordant : gelé au 3e coup en 5 s ; Crâ H Marque du chasseur : +v % aux autres coups', () => {
    const w = arena('cra'), m = monstre(w, 100);
    m.maxHp = m.hp = 1e6;
    for (let i = 0; i < 3; i++) w.hitCircle(m.x, m.y, 4, { dmg: 1, knock: 0, givre: 1 });
    expect(m.stun).toBeGreaterThanOrEqual(1);
    const n = monstre(w, -100); n.maxHp = n.hp = 1e6;
    w.hitCircle(n.x, n.y, 4, { dmg: 1, knock: 0, marque: 20 });
    expect(n.marque).toBe(20);
    expect(n.marqueJusqua).toBeGreaterThan(w.time);
  });

  it('Crâ C Flèche rebelle : la flèche rebondit sur un autre monstre', () => {
    const w = arena('cra'), p = w.player, a = monstre(w, 100), b = monstre(w, 100, 90);
    a.maxHp = a.hp = b.maxHp = b.hp = 1e6;
    w.shoot(p.x, p.y, 0, { shape: 'projectile', speed: 1100, range: 312, width: 16 }, { dmg: 30, knock: 0, rebonds: 1 }, 0, 1, 'vagabonde');
    for (let i = 0; i < 60; i++) w.step(1 / 60, NO_INPUT);
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
  });

  it('Osamodas D Tofu explosif : le Tofu explose en disparaissant', () => {
    const w = arena('osamodas'), p = w.player;
    porter(w, 'pc-osamodas-D', 30);
    const b = w.invoquer(p, 'tofu', 'tofu', p.x + 60, p.y)!, m = monstre(w, 80);
    m.maxHp = m.hp = 1e6;
    b.mourir(w);
    expect(m.hp).toBeLessThan(1e6);
  });

  it('Osamodas F Lien des âmes : le monstre dompté reste v fois plus longtemps avec tous ses PV', () => {
    const w = arena('osamodas'), p = w.player;
    porter(w, 'pc-osamodas-F', 2);
    const m = monstre(w, 60); m.hp = Math.floor(m.maxHp * 0.1);
    expect(w.dompter(p, m.x, m.y, { seuil: 0.15, duree: 20 })).toBe(true);
    const b = w.betes.find(q => q.dompteT > 0)!;
    expect(b.dompteT).toBe(40);
    expect(b.maxHp).toBe(m.maxHp);
  });

  it('Osamodas A Horde sauvage : 2 bêtes en plus qui repartent, hors du compte des Invocations', () => {
    const w = arena('osamodas'), p = w.player;
    w.horde(p, 2, 8);
    expect(w.betes.filter(b => b.finT > 0)).toHaveLength(2);
    expect(w.invocationsPrises()).toBe(0);
  });
});

describe('Légendaires de classe, suite (Légendaires classes suite : 1A-1H 2A-2H 4A 5A 6A)', () => {
  it('chaque boss préfère aussi un des nouveaux pouvoirs du Iop, du Crâ et de l\'Osamodas', () => {
    for (const l of Object.values(BOSS_PREFERES)) for (const c of ['iop', 'cra', 'osamodas'])
      expect(l.some(id => new RegExp(`^pc-${c}-[I-P]$`).test(id))).toBe(true);
  });

  it('Osamodas L Peau de l\'ours : bouclier pour l\'Osamodas et ses bêtes ; O Piqûre d\'éveil : la bête monte d\'un rang, une fois toutes les 20 s', () => {
    const w = arena('osamodas'), p = w.player;
    p.level = 200; p.recompute();
    porter(w, 'pc-osamodas-L', 10);
    const b = w.invoquer(p, 'tofu', 'tofu', p.x + 40, p.y)!;
    p.shield = 0; p.bar[0] = 'cri_ours'; p.pa = p.paMax; p.cd.cri_ours = 0;
    const m = monstre(w, 60); m.maxHp = m.hp = 1e6;
    w.step(1 / 60, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'cri_ours' as never });
    for (let k = 0; k < 40; k++) w.step(1 / 60, { ...NO_INPUT, aim: { x: m.x, y: m.y } });
    expect(p.shield).toBeGreaterThan(0); expect(b.shield).toBeGreaterThan(0);
    porter(w, 'pc-osamodas-O', 5);
    const avant = b.type;
    p.bar[0] = 'piqure'; p.pa = p.paMax; p.cd.piqure = 0; p.casts = {};
    w.step(1 / 60, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'piqure' as never });
    for (let k = 0; k < 40; k++) w.step(1 / 60, { ...NO_INPUT, aim: { x: m.x, y: m.y } });
    expect(b.type).not.toBe(avant);
    expect(b.eveilT).toBeLessThanOrEqual(5);
  });

  it('Osamodas K Festin du piranya : les dégâts du coup sont comptés pour soigner la meute', () => {
    const w = arena('osamodas'), m = monstre(w, 60); m.maxHp = m.hp = 1e6;
    w.festin = 0;
    w.hitCircle(m.x, m.y, 4, { dmg: 100, knock: 0, festin: true });
    expect(w.festin).toBe(1e6 - m.hp);
  });

  it('4A : les deux pouvoirs d\'un emplacement tombent à peu près autant', () => {
    const w = arena('cra'), [id, d] = de('chapeau'), rng = new Rng(5), n: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) { const l = rollItem(id, d, 'legendaire', rng, i, w.player.ctxPouvoirs).legendary!; n[l.id] = (n[l.id] ?? 0) + 1; }
    expect(n['pc-cra-B']).toBeGreaterThan(150); expect(n['pc-cra-K']).toBeGreaterThan(150);
    expect(Math.abs(n['pc-cra-B'] - n['pc-cra-K'])).toBeLessThan(150);
  });

  it('Iop J Coup du duelliste : plus de dégâts sur les élites et les boss seulement', () => {
    const w = arena(), a = monstre(w, 60), b = monstre(w, -60), boss = monstre(w, 0, 90, Object.keys(GAME_DATA.monsters).find(k => GAME_DATA.monsters[k].boss)!);
    for (const m of [a, b, boss]) m.maxHp = m.hp = 1e6;
    w.hitCircle(a.x, a.y, 4, { dmg: 100, knock: 0 });
    w.hitCircle(b.x, b.y, 4, { dmg: 100, knock: 0, vsGros: 70 });
    expect(Math.abs((1e6 - b.hp) / (1e6 - a.hp) - 1)).toBeLessThan(0.25);   // monstre normal : pas de bonus
    w.hitCircle(boss.x, boss.y, 4, { dmg: 100, knock: 0, vsGros: 70 });
    expect(boss.hp).toBeLessThan(1e6);
  });

  it('Iop K Ferveur bouillonnante : le bouclier de Ferveur qui casse éclate autour du Iop', () => {
    const w = arena(), p = w.player; porter(w, 'pc-iop-K', 100);
    const m = monstre(w, 50); m.maxHp = m.hp = 1e6;
    p.shield = 40; p.shieldT = 6; p.shieldSrc = 'ferveur'; p.ferveurBouclier = 40; p.invuln = 0;
    p.hurt(60, m.x, m.y, w);
    expect(m.hp).toBeLessThan(1e6);
    expect(p.shieldSrc).toBe('');
  });

  it('Iop N Déferlement sans fin : rechargé quand il tue, pas plus souvent que la fourchette ; Iop O : une charge d\'Épée Céleste en plus', () => {
    const w = arena(), p = w.player; porter(w, 'pc-iop-N', 4);
    p.cd.deferlement = 5; p.aTue('deferlement', w); expect(p.cd.deferlement).toBe(0);
    p.cd.deferlement = 5; p.aTue('deferlement', w); expect(p.cd.deferlement).toBe(5);
    p.level = 200; p.recompute();
    const avant = p.chargesMax('epee'); porter(w, 'pc-iop-O', 25);
    expect(p.chargesMax('epee')).toBe(avant + 1);
    expect(p.retourDe('epee')).toBeCloseTo(p.retourCharge * 0.75);
  });

  it('Crâ K Barrage incendiaire : un monstre repoussé brûle ; Crâ L Œil du cyclone : attiré vers le centre', () => {
    const w = arena('cra'), m = monstre(w, 120); m.maxHp = m.hp = 1e6;
    w.hitCircle(m.x, m.y, 4, { dmg: 50, knock: 342, brule: 50 });
    expect(m.saigneT).toBeGreaterThan(0);
    const n = monstre(w, -120, 40); n.maxHp = n.hp = 1e6; n.kx = n.ky = 0;
    w.hitCircle(n.x, n.y - 40, 100, { dmg: 10, knock: 0, attire: { px: 96, vers: 'centre' }, plus: 20 });
    expect(n.ky).toBeLessThan(0);
  });

  it('Crâ M Flèche perçante : la Flèche Glacée traverse et touche deux monstres en ligne', () => {
    const w = arena('cra'), p = w.player, a = monstre(w, 80), b = monstre(w, 160);
    a.maxHp = a.hp = b.maxHp = b.hp = 1e6;
    w.shoot(p.x, p.y, 0, { shape: 'projectile', speed: 1100, range: 312, width: 16 }, { dmg: 30, knock: 0, perce: 1 }, 0, 1, 'glacee');
    for (let i = 0; i < 60; i++) w.step(1 / 60, NO_INPUT);
    expect(a.hp).toBeLessThan(1e6); expect(b.hp).toBeLessThan(1e6);
  });

  it('Crâ N Sève d\'Abolition : la vie volée en trop devient un bouclier plafonné', () => {
    const w = arena('cra'), p = w.player, m = monstre(w, 60); m.maxHp = m.hp = 1e6;
    p.hp = p.maxHp; p.shield = 0;
    w.hitCircle(m.x, m.y, 4, { dmg: 5000, knock: 0, lifesteal: 0.5, surplus: 20 });
    expect(p.shield).toBe(Math.round(p.maxHp * 0.2));
    expect(p.shieldSrc).toBe('pc-cra-N');
  });

  it('Crâ O Traque sans fin : un monstre tué prolonge Tirs Éloignés, au plus du double', () => {
    const w = arena('cra'), p = w.player; porter(w, 'pc-cra-O', 1);
    p.addMod('portee', 2, 3, 'tirs_eloignes');
    for (let i = 0; i < 6; i++) { const m = monstre(w, 60 + i * 10); w.killMonster(m); }
    const md = p.mods.find(x => x.src === 'tirs_eloignes')!;
    expect(md.t).toBeCloseTo(6);
  });
});

describe('Légendaires de classe : chaque sort se lance avec son pouvoir porté', () => {
  for (const classe of ['iop', 'cra', 'osamodas']) it(classe, () => {
    const w = arena(classe), p = w.player;
    p.level = 200; p.recompute();
    for (const c of POUVOIRS_CLASSE.filter(q => q.classe === classe)) {
      porter(w, c.id, c.jet[1]);
      expect(p.pcv(c.id)).toBe(c.jet[1]);
      const did = p.cls.spells[c.sort].dofusId, i = p.pairs.findIndex(q => q.some(x => x.id === did));
      if (i >= 0) p.variants[i] = p.pairs[i].findIndex(x => x.id === did);
      expect(p.knows(c.sort), c.sort).toBe(true);
      const m = monstre(w, 90); m.maxHp = m.hp = 1e6;
      p.bar[0] = c.sort; p.cd[c.sort] = 0; p.casts = {}; p.pa = p.paMax; p.pm = p.pmMax;
      const aim = { x: m.x, y: m.y };
      w.step(1 / 60, { ...NO_INPUT, aim, pressed: c.sort as never });
      for (let k = 0; k < 90; k++) w.step(1 / 60, { ...NO_INPUT, aim });
      p.x = 400; p.y = 400;
    }
  });
});
