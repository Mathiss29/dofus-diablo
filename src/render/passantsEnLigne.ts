// Joueurs en ligne qui se promènent dans le Bastion des Douze (presence.ts) : chacun dessiné en direct avec sa classe, sa tête,
// ses couleurs et ses objets visibles, son nom au-dessus. Ce sont des passants : ni combat, ni collision ; un clic droit
// sur l'un d'eux ouvre son menu (« Social : » 6A : inviter, chuchoter, ajouter en ami, ignorer).
import Phaser from 'phaser';
import { EntityView } from './entityView';
import { LOOKS } from './looks';
import { PersoVivant } from './persoVivant';
import { EnLigne, type Passant } from './presence';
import { Assemblage } from './squelette';
import { ISO } from '../sim/iso';
import type { Entity } from '../sim/entity';

interface Vue { v: EntityView | null; vv: PersoVivant | null; nom: Phaser.GameObjects.Text; orn: Phaser.GameObjects.Image | null; cle: string }
/** Au plus ce nombre de passants dessinés (chacun a ses propres images en mémoire) : les plus proches. */
const MAX = 12;

export class PassantsEnLigne {
  private vues = new Map<number, Vue>();
  constructor(private scene: Phaser.Scene) {}

  maj(actif: boolean, dt: number, px: number, py: number) {
    EnLigne.avancer(dt);
    const L = actif ? [...EnLigne.passants.values()].filter(p => p.profil)
      .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py)).slice(0, MAX) : [];
    const gardes = new Set(L.map(p => p.id));
    for (const [id, u] of this.vues) if (!gardes.has(id)) { this.oublier(u); this.vues.delete(id); }
    for (const p of L) {
      const u = this.vue(p);
      if (!u.v) continue;
      u.v.sync(this.entite(p));
      u.vv?.maj(1);
      const s = ISO.toScreen(p.x, p.y);
      u.nom.setPosition(s.x, s.y - 112).setDepth(s.y + 2).setVisible(true);
      u.orn?.setPosition(s.x - u.nom.width / 2 - 10, s.y - 112 - 9).setDepth(s.y + 2).setVisible(true);
    }
  }
  private vue(p: Passant): Vue {
    const pr = p.profil!, cle = `${pr.classe}_${pr.sexe}|${JSON.stringify(pr.apparence)}|${pr.objets.join(',')}|${pr.titre ?? ''}|${pr.ornement ?? 0}`;
    let u = this.vues.get(p.id);
    if (u && u.cle !== cle) { this.oublier(u); u = undefined; }
    if (u) return u;
    // « Succès : » 6A+6B : le titre choisi au-dessus du nom, l'ornement officiel à côté
    const nom = this.scene.add.text(0, 0, `${pr.titre ? `« ${pr.titre} »\n` : ''}${pr.nom} · niv. ${pr.niveau}`, { fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: '#f4efe0', stroke: '#000', strokeThickness: 3, align: 'center' })
      .setOrigin(0.5, 1).setVisible(false);
    const ok = pr.ornement ? `orn_${pr.ornement - 1}` : '';
    const orn = ok && this.scene.textures.exists(ok) ? this.scene.add.image(0, 0, ok).setDisplaySize(18, 18).setVisible(false) : null;
    const nu: Vue = { v: null, vv: null, nom, orn, cle };
    this.vues.set(p.id, nu);
    const look = (pr.sexe === 'f' && LOOKS[`${pr.classe}_f`]) || LOOKS[pr.classe] || LOOKS.iop;
    Assemblage.creer(`${pr.classe}_${pr.sexe}`, pr.apparence, pr.objets).then(a => {
      if (this.vues.get(p.id) !== nu || !this.scene.sys.isActive()) return;
      nu.vv = new PersoVivant(this.scene, a);
      nu.v = new EntityView(this.scene, look, nu.vv);
    }, () => { /* classe inconnue ou hors ligne : il reste invisible */ });
    return nu;
  }
  /** Le passant dessiné sous ce point de l'écran du monde (clic droit : son menu), ou null. */
  sous(sx: number, sy: number): { id: number; nom: string } | null {
    let best: { id: number; nom: string } | null = null, d = Infinity;
    for (const [id, u] of this.vues) {
      const p = EnLigne.passants.get(id);
      if (!u.v || !p?.profil) continue;
      const s = ISO.toScreen(p.x, p.y), dx = Math.abs(sx - s.x), dy = s.y - sy;
      if (dx < 26 && dy > -10 && dy < 105 && dx + Math.abs(dy - 50) < d) { d = dx + Math.abs(dy - 50); best = { id, nom: p.profil.nom }; }
    }
    return best;
  }
  /** Ce que la vue d'une entité lit, pour un passant. */
  private entite(p: Passant): Entity {
    return { id: -1000 - p.id, x: p.x, y: p.y, z: 0, facing: p.f, anim: p.a === 'idle' ? 'idle' : 'run', animT: 0, age: p.age,
      dead: false, flash: 0, radius: 14, faction: 'player', hp: 1, maxHp: 1 } as unknown as Entity;
  }
  private oublier(u: Vue) { u.v?.destroy(); u.vv?.destroy(); u.nom.destroy(); u.orn?.destroy(); }
  destroy() { for (const u of this.vues.values()) this.oublier(u); this.vues.clear(); }
}
