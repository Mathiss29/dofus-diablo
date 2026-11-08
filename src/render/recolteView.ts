import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { RECOLTE } from '../sim/recolte';
import type { World } from '../sim/world';
import { v as url } from './assetUrl';
import { ICON_SHEET, iconFrame } from './icons';

/** Ressources à récolter (métiers, 0.2b) : le vrai dessin de la ressource (blé, arbre, minerai, plante, remous de pêche),
 *  à son emplacement officiel, avec l'animation de coupe puis l'état « récoltée » tant qu'elle repousse ; reflet doré pour
 *  les dorées ; bulle et curseur d'outil au survol ; barre du geste au-dessus du perso.
 *  Planches : tools/extraction/recoltes_planches.py (public/assets/sprites/recoltes/<gfx>). En attendant leur chargement,
 *  l'icône de la ressource. Lecture seule. */
interface Vue { img: Phaser.GameObjects.Image; sol: Phaser.GameObjects.Ellipse | null; dessin: boolean; coupe: number; etat: 'pret' | 'recolte' | null }
const ASSETS = 'assets';
const CLE = (g: number) => `recolte_${g}`;
/** Pixels Dofus -> écran du jeu (GridMap.S). */
const S = 1.1;
/** Curseur officiel de l'outil du métier (icons_assets de Dofus 3), comme dans le jeu : faux, hache, pioche, filet. */
const OUTIL: Record<string, string> = { paysan: 'faux', alchimiste: 'faux', bucheron: 'hache', mineur: 'pioche', pecheur: 'filet' };
const CSS = `.rcbulle{position:fixed;z-index:8;pointer-events:none;transform:translate(-50%,-100%);background:#141210ee;border:1px solid #4a4436;
 border-radius:4px;padding:5px 10px;font:600 13px/1.35 Lexend,Verdana,sans-serif;color:#f4efe0;text-align:center;white-space:nowrap;box-shadow:0 2px 6px #000a}
.rcbulle b{display:block;font-size:14px}.rcbulle .ko{color:#ff6b5a}.rcbulle .dore{color:#ffd34a}.rcbulle i{font-style:normal;color:#a8a290;font-size:12px}`;
/** Les planches sont dessinées en 2x puis affichées à ~0,3 (échelle 0,55 x zoom) : sans mipmaps, une image aussi réduite scintille
 *  et « tremble » dès que la caméra glisse d'une fraction de pixel (retour de Mathis 2026-11-06). On en garde une copie réduite
 *  de moitié, lissée une fois par le navigateur ; mêmes noms d'images, échelle de la planche divisée par deux. */
function reduire(T: Phaser.Textures.TextureManager, k: string) {
  const src = T.get(k), img = src.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const c = document.createElement('canvas'); c.width = Math.ceil(img.width / 2); c.height = Math.ceil(img.height / 2);
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, img.width / 2, img.height / 2);
  const frames = src.getFrameNames().map(n => {
    const f = src.get(n), sss = (f.customData as { spriteSourceSize?: { x: number; y: number; w: number; h: number } }).spriteSourceSize;
    return { n, x: f.cutX, y: f.cutY, w: f.cutWidth, h: f.cutHeight, rw: f.realWidth, rh: f.realHeight, trim: f.trimmed ? sss : undefined };
  });
  const custom = src.customData as { meta?: { echelle?: number } };
  T.remove(k);
  const t = T.addCanvas(k, c);
  if (!t) return;
  for (const f of frames) {
    const nf = t.add(f.n, 0, f.x / 2, f.y / 2, Math.max(0.5, f.w / 2), Math.max(0.5, f.h / 2));
    if (nf && f.trim) nf.setTrim(f.rw / 2, f.rh / 2, f.trim.x / 2, f.trim.y / 2, f.trim.w / 2, f.trim.h / 2);
  }
  t.customData = { ...custom, meta: custom.meta ? { ...custom.meta, echelle: (custom.meta.echelle ?? 2) / 2 } : undefined };
}

export class RecolteView {
  private vues = new Map<number, Vue>();
  private barre: Phaser.GameObjects.Graphics;
  private bulle: HTMLDivElement;
  private demandes = new Set<number>();
  survolee: number | null = null;
  static readonly VUE = 1500;

  constructor(private scene: Phaser.Scene, private world: World) {
    this.barre = scene.add.graphics().setDepth(1e6 - 1);
    if (!document.getElementById('rcbulle-css')) { const st = document.createElement('style'); st.id = 'rcbulle-css'; st.textContent = CSS; document.head.appendChild(st); }
    this.bulle = document.createElement('div'); this.bulle.className = 'rcbulle'; this.bulle.style.display = 'none'; document.body.appendChild(this.bulle);
  }
  destroy() { for (const v of this.vues.values()) this.liberer(v); this.vues.clear(); this.barre.destroy(); this.bulle.remove(); }
  private liberer(v: Vue) { v.img.destroy(); v.sol?.destroy(); }

  /** Planche d'un gfx : chargée à la demande (une petite planche par sorte de ressource). */
  private planche(g: number) {
    const k = CLE(g), T = this.scene.textures;
    if (T.exists(k)) return true;
    if (!this.demandes.has(g)) {
      this.demandes.add(g);
      const d = `${ASSETS}/sprites/recoltes/${g}`;
      this.scene.load.once(`filecomplete-atlas-${k}`, () => reduire(this.scene.textures, k));
      this.scene.load.atlas(k, url(`${d}.avif`), url(`${d}.json`));
      if (!this.scene.load.isLoading()) this.scene.load.start();
    }
    return false;
  }

  private creer(r: World['recoltes'][number], sx: number, sy: number): Vue {
    const R = this.world.opts.recoltes!, g = r.gfx;
    if (g != null && this.planche(g)) {
      const k = CLE(g), meta = (this.scene.textures.get(k).customData as { meta?: { ancre: { x: number; y: number }; echelle: number; coupe: number } }).meta;
      const img = this.scene.add.image(sx, sy, k, r.repousse > 0 ? 'recolte' : 'pret').setOrigin(meta?.ancre.x ?? 0.5, meta?.ancre.y ?? 1)
        .setScale(S / (meta?.echelle ?? 2)).setFlipX(!!r.miroir);
      if (r.miroir) img.setOrigin(1 - (meta?.ancre.x ?? 0.5), meta?.ancre.y ?? 1);
      return { img, sol: null, dessin: true, coupe: meta?.coupe ?? 0, etat: r.repousse > 0 ? 'recolte' : 'pret' };
    }
    const def = R.ressources[r.item];
    return { sol: this.scene.add.ellipse(sx, sy, 40, 16, 0x000000, 0.28), dessin: false, coupe: 0, etat: null,
      img: this.scene.add.image(sx, sy - 20, ICON_SHEET.key, Math.max(0, iconFrame(def?.icone ?? 0))).setDisplaySize(40, 40) };
  }

  /** Curseur CSS sur la ressource survolée (outil de son métier), sinon null. */
  curseur(): string | null {
    const r = this.survolee != null ? this.world.recoltes.find(x => x.id === this.survolee) : null;
    const def = r && this.world.opts.recoltes?.ressources[r.item];
    if (!def) return null;
    return def.metier ? `url(assets/ui/curseurs/${OUTIL[def.metier] ?? 'faux'}.png) 4 4, pointer` : 'pointer';   // puits : sans outil
  }

  /** Bulle au survol, comme dans Dofus : nom de la ressource, métier et niveau requis (en rouge s'il manque des niveaux). */
  private majBulle(cam: Phaser.Cameras.Scene2D.Camera) {
    const R = this.world.opts.recoltes, id = this.survolee, v = id != null ? this.vues.get(id) : null;
    const r = id != null ? this.world.recoltes.find(x => x.id === id) : null, def = r && R?.ressources[r.item];
    if (!R || !v || !r || !def) { this.bulle.style.display = 'none'; return; }
    const lv = Math.max(1, this.world.player.metierLevel(def.metier)), metier = R.metiers[def.metier]?.nom ?? def.metier;
    const cle = `${id}:${lv}:${r.dore}`;
    if (this.bulle.dataset.cle !== cle) {
      this.bulle.dataset.cle = cle;
      const ko = !!def.metier && lv < def.niveau;   // puits : « Puiser », sans métier ni niveau
      this.bulle.innerHTML = `<b${r.dore ? ' class="dore"' : ''}>${def.nom}${r.dore ? ' dorée' : ''}</b><span${ko ? ' class="ko"' : ''}>${def.metier ? `${metier} - Niv ${def.niveau}` : 'Puiser'}</span>`
        + (ko ? `<br><i>Votre niveau : ${lv}</i>` : '');
    }
    const rect = this.scene.game.canvas.getBoundingClientRect(), k = rect.width / this.scene.scale.width;
    const haut = v.dessin ? Math.min(v.img.getBounds().top + 10, v.img.y - 40) : v.img.y - 26;
    const x = (v.img.x - cam.worldView.x) * cam.zoom, y = (haut - cam.worldView.y) * cam.zoom;
    this.bulle.style.left = `${rect.left + x * k}px`; this.bulle.style.top = `${rect.top + y * k}px`; this.bulle.style.display = '';
  }

  /** Ressource prête sous le curseur (coordonnées de la caméra). */
  sous(ptr: Phaser.Input.Pointer, cam: Phaser.Cameras.Scene2D.Camera): number | null {
    const wp = ptr.positionToCamera(cam) as Phaser.Math.Vector2;
    let best: number | null = null, bd = Infinity;
    for (const [id, v] of this.vues) {
      if (!v.img.visible || v.etat === 'recolte' || v.img.alpha < 0.5) continue;
      let d: number;
      if (v.dessin) {
        // dans le dessin (un peu resserré) ; on préfère celui dont le pied est le plus proche
        const b = v.img.getBounds(), mx = b.width * 0.15, my = b.height * 0.1;
        const dedans = wp.x > b.left + mx && wp.x < b.right - mx && wp.y > b.top + my && wp.y < v.img.y + 12;
        d = Math.hypot(v.img.x - wp.x, v.img.y - 20 - wp.y);
        if (!dedans && d > 34) continue;
      } else {
        d = Math.hypot(v.img.x - wp.x, v.img.y - wp.y);
        if (d > 30) continue;
      }
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  update(cam: Phaser.Cameras.Scene2D.Camera, ptr: Phaser.Input.Pointer, masque = false) {
    const w = this.world, R = w.opts.recoltes, cx = cam.midPoint.x, cy = cam.midPoint.y;
    if (!R) return;
    this.survolee = masque ? null : this.sous(ptr, cam);
    const vus = new Set<number>();
    for (const r of w.recoltes) {
      const s = ISO.toScreen(r.x, r.y);
      if (Math.abs(s.x - cx) > RecolteView.VUE || Math.abs(s.y - cy) > RecolteView.VUE * 0.7) continue;
      vus.add(r.id);
      const ox = (r.dessin?.x ?? 0) * S, oy = (r.dessin?.y ?? 0) * S;
      let v = this.vues.get(r.id);
      // la planche vient d'arriver : on remplace l'icône par le dessin
      if (v && !v.dessin && r.gfx != null && this.scene.textures.exists(CLE(r.gfx))) { this.liberer(v); v = undefined; }
      if (!v) { v = this.creer(r, s.x + ox, s.y + oy); this.vues.set(r.id, v); }
      const prete = r.repousse <= 0, survol = this.survolee === r.id;
      if (v.dessin) {
        const img = v.img;
        img.setPosition(s.x + ox, s.y + oy).setDepth(s.y);
        if (prete && v.etat !== 'pret') { img.setFrame('pret'); v.etat = 'pret'; }
        else if (!prete && v.etat === 'pret') {
          // coupe : l'animation officielle, puis l'état récolté jusqu'à la repousse
          const t = RECOLTE.repousse - r.repousse, i = Math.floor(t * 24);
          if (v.coupe && i < v.coupe) img.setFrame(`coupe_${i}`); else { img.setFrame('recolte'); v.etat = 'recolte'; }
        }
        if (r.dore && prete) img.setTint(0xffe7a0); else img.clearTint();
        const fx = img.preFX;
        if (fx) {
          const voulu = survol || (r.dore && prete);
          const glow = img.getData('glow') as Phaser.FX.Glow | undefined;
          if (voulu && !glow) img.setData('glow', fx.addGlow(r.dore && !survol ? 0xffd34a : 0xf2f0c8, 3, 0, false, 0.1, 8));
          else if (!voulu && glow) { fx.remove(glow); img.setData('glow', undefined); }
        }
      } else {
        const bob = prete ? Math.sin(w.time * 2 + r.id) * 2 : 0;
        v.sol!.setPosition(s.x, s.y).setDepth(s.y - 2).setFillStyle(r.dore && prete ? 0xffd34a : 0x000000, r.dore && prete ? 0.45 + Math.sin(w.time * 4 + r.id) * 0.15 : 0.28);
        v.img.setPosition(s.x, s.y - 20 - bob).setDepth(s.y).setAlpha(prete ? 1 : 0.22).setDisplaySize(survol ? 46 : 40, survol ? 46 : 40);
        v.etat = prete ? 'pret' : 'recolte';
        if (r.dore && prete) v.img.setTint(0xffe7a0); else if (survol) v.img.setTint(0xe8ffb0); else v.img.clearTint();
      }
    }
    // hors de vue : on libère (des milliers de ressources dans Astrub)
    for (const [id, v] of this.vues) if (!vus.has(id)) { this.liberer(v); this.vues.delete(id); }
    this.majBulle(cam);
    // barre du geste au-dessus du perso
    this.barre.clear();
    const g = w.enRecolte;
    if (g) {
      const p = ISO.toScreen(w.player.x, w.player.y), k = Math.min(1, g.t / RECOLTE.duree);
      this.barre.fillStyle(0x000000, 0.7).fillRoundedRect(p.x - 31, p.y - 128, 62, 9, 3)
        .fillStyle(0x9ad15a, 1).fillRoundedRect(p.x - 30, p.y - 127, 60 * k, 7, 3);
    }
  }
}
