import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { MAX_GROUPES, PLACEMENT, placementValide, type PlacementCarte, type PointGroupe } from '../sim/placement';
import type { CommandeTest } from '../sim/outilsTest';
import type { World } from '../sim/world';

/** Éditeur de placement des groupes de monstres (maquette « Monstres » : 2A, 3A, 4A+4D, 5B, 6A) : onglet Placement du panneau F1.
 *  Les cartes retouchées sont gardées dans le navigateur jusqu'à l'export, puis versées dans src/data/placements.json. */

const CLE = 'diablofus.placements';
type Retouches = Record<string, Record<string, PlacementCarte>>;
function lire(): Retouches {
  try { const r = JSON.parse(localStorage.getItem(CLE) ?? '{}'); return r && typeof r === 'object' ? r : {}; } catch { return {}; }
}
function ecrire(r: Retouches) { try { localStorage.setItem(CLE, JSON.stringify(r)); } catch { /* pas de stockage : l'export reste possible tant que la page est ouverte */ } }
/** Cartes retouchées dans l'éditeur pour ce monde (pas encore versées dans le jeu). */
export function retouchesPlacement(monde: string): Record<string, PlacementCarte> { return lire()[monde] ?? {}; }

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** Rayon (monde) sur lequel s'étale un groupe autour de son point. */
const RAYON = 150;

export class EditeurPlacement {
  /** Clic en jeu = poser un point (clic droit : retirer le plus proche). */
  pose = true;
  /** Point choisi dans la liste (mis en avant sur la carte). */
  private choisi = -1;
  private textes: Phaser.GameObjects.Text[] = [];
  private g: Phaser.GameObjects.Graphics | null = null;
  constructor(private world: World, private envoyer: (c: CommandeTest) => void, private redessiner: () => void) {}

  get monde() { return this.world.zone.open?.world ?? ''; }
  /** Carte où se trouve le joueur, si elle a des groupes de monstres. */
  carte(): string | null {
    const w = this.world, m = w.worldGrid?.mapAt(w.player.x, w.player.y);
    return m && w.placementDe(m.tag) ? m.tag : null;
  }
  private retouche(tag: string) { return retouchesPlacement(this.monde)[tag]; }
  private faite(tag: string) { return !!this.retouche(tag) || this.world.placementPoseMain(tag); }
  /** Enregistre la carte (null : on oublie la retouche) et la montre tout de suite en jeu. */
  private garder(tag: string, pl: PlacementCarte | null) {
    const r = lire(), m = (r[this.monde] ??= {});
    if (pl) m[tag] = placementValide(pl); else delete m[tag];
    ecrire(r);
    this.envoyer({ k: 'placement', tag, pl: pl ? m[tag] : null });
    this.redessiner();
  }
  private courant(tag: string): PlacementCarte { return structuredClone(this.world.placementDe(tag) ?? { g: 0, p: [] }); }
  private modifier(f: (pl: PlacementCarte) => void) {
    const tag = this.carte(); if (!tag) return;
    const pl = this.courant(tag); f(pl); this.garder(tag, pl);
  }

  /** Clic en jeu pendant l'édition : un point sur la case visée, ou (clic droit) on retire le point le plus proche. */
  clic(x: number, y: number, droit: boolean) {
    const w = this.world, wg = w.worldGrid, tag = this.carte();
    if (!wg || !tag) return;
    const pl = this.courant(tag), pts = pl.p.map(p => wg.cellToWorld(wg.cellOf(tag, p.c)));
    const proche = pts.map((q, i) => [Math.hypot(q.x - x, q.y - y), i] as const).sort((a, b) => a[0] - b[0])[0];
    if (droit) {
      if (!proche || proche[0] > 120) return;
      pl.p.splice(proche[1], 1); this.choisi = -1;
    } else {
      if (proche && proche[0] < 60) { this.choisi = proche[1]; this.redessiner(); return; }   // clic sur un point : on le choisit
      const m = wg.mapAt(x, y), c = wg.cellAtWorld(x, y);
      if (m?.tag !== tag || c < 0 || wg.mov[c] !== 1) return;
      const [X0, Y0] = wg.world.origin, loc = (Math.floor(c / wg.cols) - (m.y - Y0) * 40) * 14 + c % wg.cols - (m.x - X0) * 14;
      pl.p.push({ c: loc }); this.choisi = pl.p.length - 1;
      if (!pl.g) pl.g = 1;
    }
    this.garder(tag, pl);
  }

  /** Carte suivante pas encore faite : d'abord dans la même sous-zone, puis dans l'ordre du monde. */
  private suivante(): string | null {
    const w = this.world, wg = w.worldGrid!, ici = this.carte(), toutes = w.cartesAGroupes().filter(t => !wg.mapByTag(t)?.inside);
    const sub = ici ? wg.mapByTag(ici)!.sub : null, reste = toutes.filter(t => t !== ici && !this.faite(t));
    return reste.find(t => wg.mapByTag(t)!.sub === sub) ?? reste[0] ?? null;
  }
  private exporter() {
    const monde = this.monde, cartes: Record<string, PlacementCarte> = { ...PLACEMENT.cartes[monde], ...retouchesPlacement(monde) };
    const texte = JSON.stringify({ [monde]: cartes });
    navigator.clipboard?.writeText(texte).catch(() => { /* le fichier suffit */ });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texte], { type: 'application/json' }));
    a.download = `placements-${monde}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  html(): string {
    const w = this.world, wg = w.worldGrid, tag = this.carte();
    const toutes = w.cartesAGroupes().filter(t => !wg?.mapByTag(t)?.inside), faites = toutes.filter(t => this.faite(t)).length;
    const nRet = Object.keys(retouchesPlacement(this.monde)).length;
    const tete = `<p class="note">Maquette « Monstres » : clic au sol pour poser un point, clic sur un point pour le choisir, clic droit pour le retirer. Les groupes se posent sur des points libres (il peut y avoir plus de points que de groupes). Les cartes pas encore faites gardent le placement automatique.</p>
      <label class="inter"><span>Clic = poser un point<br><span class="note">Décoche pour marcher normalement.</span></span><input type="checkbox" id="pl-pose" ${this.pose ? 'checked' : ''}></label>`;
    const bas = `<h4>Avancement</h4><p>${faites} / ${toutes.length} cartes faites dans ${esc(w.zone.name)}${nRet ? ` · ${nRet} à envoyer` : ''}</p>
      <div class="l" style="flex-wrap:wrap;justify-content:flex-start">
        <button type="button" class="b" data-pl="suivante">Carte suivante</button>
        <button type="button" class="b g" data-pl="exporter" ${nRet ? '' : 'disabled'}>Exporter (${nRet})</button>
      </div>
      <p class="note">Exporter télécharge placements-${esc(this.monde)}.json (et le copie) : envoie-le dans le fil, il sera versé dans le jeu. Les retouches restent dans ce navigateur en attendant.</p>`;
    if (!wg || !tag) return `${tete}<div class="pose">Pas de groupes de monstres sur cette carte (ville, maison, donjon). « Carte suivante » t'emmène à une carte à faire.</div>${bas}`;
    const m = wg.mapByTag(tag)!, sub = w.zone.open!.subareas[String(m.sub)], pl = w.placementDe(tag)!, ret = !!this.retouche(tag), main = w.placementPoseMain(tag);
    const etat = ret ? 'retouchée (à envoyer)' : main ? 'posée à la main' : 'proposition automatique';
    const [a, b] = sub.groupSize;
    const ligne = (p: PointGroupe, i: number) => {
      const [x, y] = p.n ?? sub.groupSize;
      return `<div class="l" style="background:${i === this.choisi ? '#2c3a16' : '#1d1c18'};border:1px solid ${p.r ? '#e6b85c' : '#2e2c26'};border-radius:3px;padding:4px 6px">
        <span style="min-width:18px;color:${p.r ? '#e6b85c' : '#f0a83a'};font-weight:700">${i + 1}</span>
        <span style="display:flex;gap:3px;align-items:center">
          <button type="button" class="b g" data-pt="${i}" data-op="min-">−</button><span style="min-width:34px;text-align:center">${x}–${y}</span><button type="button" class="b g" data-pt="${i}" data-op="max+">+</button>
          ${p.n ? `<button type="button" class="b g" data-pt="${i}" data-op="taille0" title="Taille de la sous-zone">↺</button>` : ''}
        </span>
        <button type="button" class="b g ${p.r ? 'on' : ''}" data-pt="${i}" data-op="repaire" ${sub.elite ? '' : 'disabled title="Pas d\'élite dans cette sous-zone"'}>Repaire</button>
        <button type="button" class="b g" data-pt="${i}" data-op="suppr" aria-label="Retirer le point ${i + 1}">✕</button></div>`;
    };
    return `${tete}
      <h4>${esc(sub.name)} [${m.x},${m.y}]</h4>
      <p class="note">${etat} · groupes de ${a} à ${b} monstres${sub.elite ? ` · élite : ${esc(w.opts.data.monsters[sub.elite]?.name ?? sub.elite)}` : ''}</p>
      <div class="l"><span>Groupes sur la carte</span><span style="display:flex;gap:4px;align-items:center">
        <button type="button" class="b g" data-pl="g-">−</button><b style="min-width:20px;text-align:center">${pl.g}</b><button type="button" class="b g" data-pl="g+">+</button></span></div>
      ${pl.g > pl.p.length && pl.p.length ? `<div class="pose">${pl.g} groupes pour ${pl.p.length} point${pl.p.length > 1 ? 's' : ''} : des groupes partageront un point.</div>` : ''}
      <div style="display:grid;gap:4px">${pl.p.map(ligne).join('') || '<p class="note">Aucun point : clique au sol pour en poser.</p>'}</div>
      <p class="note">Taille : nombre de monstres de ce groupe (4A). Repaire : l'élite de la sous-zone y apparaît 1 fois sur ${Math.round(1 / PLACEMENT.elite.repaire)}, et 1 fois sur ${Math.round(1 / PLACEMENT.elite.hasard)} ailleurs (4D).</p>
      <div class="l" style="flex-wrap:wrap;justify-content:flex-start">
        ${!ret && !main ? '<button type="button" class="b g" data-pl="garder">Garder la proposition</button>' : ''}
        <button type="button" class="b g" data-pl="auto">Repartir de la proposition auto</button>
        ${ret ? '<button type="button" class="b g" data-pl="oublier">Annuler mes retouches</button>' : ''}
      </div>${bas}`;
  }

  lier(el: HTMLElement) {
    const pose = el.querySelector<HTMLInputElement>('#pl-pose');
    if (pose) pose.onchange = () => { this.pose = pose.checked; };
    el.querySelectorAll<HTMLElement>('[data-pl]').forEach(b => b.onclick = () => {
      const tag = this.carte();
      switch (b.dataset.pl) {
        case 'g-': this.modifier(pl => { pl.g = Math.max(0, pl.g - 1); }); break;
        case 'g+': this.modifier(pl => { pl.g = Math.min(MAX_GROUPES, pl.g + 1); }); break;
        case 'garder': if (tag) this.garder(tag, this.courant(tag)); break;
        case 'auto': if (tag) { this.choisi = -1; this.garder(tag, this.world.propositionAuto(tag, this.courant(tag).g || undefined)); } break;
        case 'oublier': if (tag) { this.choisi = -1; this.garder(tag, null); } break;
        case 'exporter': this.exporter(); break;
        case 'suivante': {
          const t = this.suivante();
          if (t) { this.choisi = -1; this.envoyer({ k: 'aller', tag: t, nom: this.world.zone.open!.subareas[String(this.world.worldGrid!.mapByTag(t)!.sub)]?.name ?? t }); setTimeout(() => this.redessiner(), 300); }
          break;
        }
      }
    });
    el.querySelectorAll<HTMLElement>('[data-pt]').forEach(b => b.onclick = () => {
      const i = +b.dataset.pt!, tag = this.carte(); if (!tag) return;
      const sub = this.world.zone.open!.subareas[String(this.world.worldGrid!.mapByTag(tag)!.sub)];
      this.choisi = i;
      this.modifier(pl => {
        const p = pl.p[i]; if (!p) return;
        const [x, y] = p.n ?? sub.groupSize;
        switch (b.dataset.op) {
          case 'min-': p.n = x > 1 ? [x - 1, y] : y > x ? [x, y - 1] : [x, y]; break;
          case 'max+': p.n = y < 10 ? [x, y + 1] : x < y ? [x + 1, y] : [x, y]; break;
          case 'taille0': delete p.n; break;
          case 'repaire': if (p.r) delete p.r; else { for (const o of pl.p) delete o.r; p.r = 1; } break;   // un seul repaire par carte
          case 'suppr': pl.p.splice(i, 1); this.choisi = -1; break;
        }
      });
    });
  }

  /** Dessin sur la carte : passages laissés libres (1C), lieux, et les points avec leur zone et leur numéro. */
  dessiner(scene: Phaser.Scene, actif: boolean) {
    const g = this.g ??= scene.add.graphics().setDepth(1e6 - 10);
    g.clear();
    for (const t of this.textes) t.setVisible(false);
    const w = this.world, wg = w.worldGrid, tag = actif ? this.carte() : null;
    if (!wg || !tag) return;
    const S = (c: number) => { const q = wg.cellToWorld(c); return ISO.toScreen(q.x, q.y); };
    const a = w.analyseCarte(tag);
    g.fillStyle(0xffe08a, 0.45);
    for (const c of a.passages) { const s = S(c); g.fillEllipse(s.x, s.y, 30, 15); }
    g.lineStyle(2, 0x6fcf97, 0.8);
    for (const c of [...a.lieux, ...a.sorties]) { const s = S(c); g.strokeEllipse(s.x, s.y, 40, 20); }
    const pl = w.placementDe(tag)!;
    pl.p.forEach((p, i) => {
      const s = S(wg.cellOf(tag, p.c)), col = p.r ? 0xe6b85c : 0xf0a83a, on = i === this.choisi;
      g.lineStyle(on ? 3 : 2, col, on ? 1 : 0.75); g.fillStyle(col, 0.12);
      g.fillEllipse(s.x, s.y, RAYON * 2 * Math.SQRT2, RAYON * Math.SQRT2); g.strokeEllipse(s.x, s.y, RAYON * 2 * Math.SQRT2, RAYON * Math.SQRT2);
      g.fillStyle(col, 1); g.fillCircle(s.x, s.y, 13);
      const t = this.textes[i] ??= scene.add.text(0, 0, '', { fontFamily: 'Rowdies, Lexend, sans-serif', fontSize: '15px', color: '#1b1206' }).setOrigin(0.5).setDepth(1e6 - 9);
      t.setText(String(i + 1)).setPosition(s.x, s.y).setVisible(true);
    });
  }
  destroy() { this.g?.destroy(); for (const t of this.textes) t.destroy(); }
}
