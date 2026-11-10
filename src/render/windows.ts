import { QUALITES, REGLAGES_DEFAUT, sauverReglages, type Reglages } from './ambiance';
import * as Touches from './touches';
import { ICON_CSS, iconHtml } from './icons';
import { MANIFESTE, Son } from './son';
import { APPARATS, BOUTIQUES, FAMILIERS, GAME_DATA, ITEMS, QUETES, RECOLTES } from '../sim/data';
import { v } from './assetUrl';
import { BUTIN_CSS, butinMonstre, dessinerPortraits, esc as escB, groupesBestiaire, nomObjet, iconeObjet, sourcesHtml } from './butinVue';
import { PALIERS } from './carnet';
import { CODEX_CSS, codexPageHtml } from './codexVue';
import { nouveauPourCodex } from '../sim/codex';
import { ALMANAX, effetTexte } from '../sim/almanax';
import { DOFUS, PORTABLE, TROPHEES } from '../sim/dofus';
/** Source d'un trophée (0.4 suite 3A+3B) : son boss, ou le Façonneur. */
function sourceTrophee(id: string): string {
  const t = TROPHEES[id], b = t?.boss ? GAME_DATA.monsters[t.boss]?.name : null;
  const r = ITEMS.recipes?.some(x => x.result === id);
  return [b ? `Butin rare : ${b}` : '', r ? 'Façonneur (niveau 50 de métier)' : ''].filter(Boolean).join(' · ') || 'Façonneur, avec les ressources d\'Amakna (plus tard)';
}
/** Fiche d'un Dofus (0.3) ou d'un trophée (0.4) : stats, passif traduit, source. */
function dofusTip(id: string, porte = false): string {
  if (TROPHEES[id]) {
    const t = TROPHEES[id], st = Object.entries(t.stats).map(([k, v]) => `<div>${v > 0 ? '+' : ''}${v} ${STAT_NAMES[k as Stat] ?? k}</div>`).join('');
    return `<h4 style="color:#e8c76b">${t.nom}</h4><div class="sub">Trophée · niveau ${t.niveau}</div>${st}<div class="hint">${porte ? 'Glisse-le vers le sac pour le retirer' : sourceTrophee(id)}</div>`;
  }
  const d = DOFUS[id]; if (!d) return '';
  const st = Object.entries(d.stats).map(([k, v]) => `<div>+${v} ${STAT_NAMES[k as Stat] ?? k}</div>`).join('');
  return `<h4 style="color:#e8c76b">${d.nom}</h4><div class="sub">Dofus · niveau ${d.niveau}</div>${st}${d.passif ? `<div style="margin-top:6px"><b style="color:#e8c76b">${d.passif.nom}</b> : ${d.passif.texte}</div>` : ''}<div class="hint">${porte ? 'Glisse-le vers le sac pour le retirer' : d.source}</div>`;
}
/** Fenêtre des Dofus (touche D, ligne « Onglet Dofus : 1B 2A 3A 4A 5A 6B 7A+7C »). */
const DOF_CSS = `.dw .win.dofw{width:640px}.dw .dof-c .ic{width:70%;height:70%}.dw .dof{padding:8px 14px 14px;display:flex;flex-direction:column;gap:8px}
.dw .dof-t{display:flex;gap:6px;align-items:center}.dw .dof-t .eo{padding:3px 12px;border-radius:12px;background:rgba(255,255,255,.06);cursor:pointer}.dw .dof-t .eo.on{background:rgba(255,210,122,.2);color:#ffd27a}.dw .dof-t .eo.off{opacity:.4;cursor:default}.dw .dof-t .k{margin-left:auto;font-family:Rowdies,serif;color:#ffd27a}
.dw .dof-row{display:flex;justify-content:center;gap:8px}.dw .dof-row .slot{width:50px;height:50px;opacity:1;background-size:100%}
.dw .dof-g{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;max-height:330px;overflow:auto}
.dw .dof-c{position:relative;aspect-ratio:1;border:1px solid rgba(255,210,122,.25);border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);cursor:pointer}
.dw .dof-c.non{filter:grayscale(1) brightness(.45)}.dw .dof-c.porte{border-color:#ffd27a;box-shadow:0 0 8px rgba(255,210,122,.5)}.dw .dof-c.on{outline:2px solid #fff}
.dw .dof-c small{position:absolute;bottom:1px;right:4px;font-size:10px;opacity:.8}.dw .dof-c .fr{position:absolute;top:2px;left:4px;font-size:10px;color:#b9e54b;filter:none}
.dw .dof-d{background:rgba(255,210,122,.06);border:1px solid rgba(255,210,122,.2);border-radius:6px;padding:8px 10px;font-size:13px;min-height:92px}
.dw .dof-d h4{margin:0 0 2px;color:#e8c76b}.dw .dof-s{display:flex;gap:6px;flex-wrap:wrap}.dw .dof-s span{background:rgba(255,255,255,.06);border-radius:10px;padding:2px 8px;font-size:12px}
.dw .dof-s span.ok{background:rgba(185,229,75,.18);color:#d7f59a}`;
/** Fenêtre de l'Almanax (15C). */
const MENU_CSS = `.dw .win.menu{width:330px;grid-template-rows:46px auto}
.dw .mp{display:flex;flex-direction:column;padding:4px 0 14px}
.dw .mp .grp{display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 26px;border-bottom:1px solid #0d0c0a;box-shadow:0 1px 0 #ffffff12}
.dw .mp .grp:last-child{border:0;box-shadow:none;padding-bottom:4px}
.dw .mp .mb{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;box-sizing:border-box;height:34px;border:6px solid transparent;border-image:url(assets/ui/d3/btn_grey_small_normal.png) 8 fill/6px;font:14px Rowdies,Lexend,sans-serif;color:#f4efe0;text-shadow:0 1px 2px #000;text-transform:uppercase;cursor:pointer;user-select:none}
.dw .mp .mb:hover{border-image-source:url(assets/ui/d3/btn_grey_small_over.png)}
.dw .mp .mb:active{filter:brightness(.85)}
.dw .mp .mb.off{opacity:.4;cursor:default;pointer-events:none}
.dw .mp .mb.jeu{width:70%}
.dw .mp .mb img{width:20px;height:20px;object-fit:contain;filter:brightness(0) invert(1)}
.dw .mp .mb svg{width:18px;height:18px}
`;
const ALM_CSS = `.dw .win.almanax{width:420px}.dw .alm{padding:10px 14px 14px;display:flex;flex-direction:column;gap:6px}
.dw .alm-d{font-family:Rowdies,serif;font-size:18px;color:#ffd27a;text-transform:capitalize;text-align:center}
.dw .alm-b{background:rgba(255,210,122,.07);border:1px solid rgba(255,210,122,.25);border-radius:6px;padding:8px 10px}
.dw .alm-b b{color:#ffe7b0}.dw .alm-b p{margin:4px 0 0;font-size:12px;opacity:.75;font-style:italic}
.dw .alm-e{color:#b9e54b;font-weight:bold}.dw .alm-o{display:flex;gap:10px;align-items:center}.dw .alm-o small{display:block}
.dw .alm-r{font-size:13px}.dw .alm-f{color:#b9e54b;text-align:center;padding:6px}.dw .alm .btn{align-self:center}`;
import { SOCIAL_CSS, rendreSocial, tickSocial } from './social';
import { EnLigne } from './presence';
import { Coop } from './coop';
import { FORGE_CSS, etatForge, forgeHtml, lotConcasseur, mmss, texteForge, type LigneLog } from './forgeVue';
import { RUNES } from '../sim/forgemagie';
import { LOOKS } from './looks';
import { niveauHorsPartie, rangDe } from '../sim/butin';
import { DOSSIER, PALETTES, ZONES, apparenceValide, assemblagePour, fiches, objetsPortes, type Apparence, type Assemblage, type FichePerso } from './squelette';
import {
  BASE_STATS, REDUCTION_RECHARGES_MAX, FAMILIER_MAX, FAMILIER_XP, METIER_XP, lignePouvoir, PEPITE, RARITY_COLORS, RARITY_NAMES, STATS, STAT_NAMES, metierXpNeeded, recycleResource, recycleValue,
  type EquipSlot, type Item, type Rarity, type ResourceDef, type Stat,
} from '../sim/items';
import { Player } from '../sim/player';
import { POUVOIR_PAR_ID } from '../sim/pouvoirs';
import { PC_PAR_ID } from '../sim/pouvoirsClasse';
import { dmgMoyen, gradeAuNiveau, type SortOfficiel } from '../sim/sorts';
import { n1, spellDetail } from './spellTip';
import { ROLES_SORTS, avecMotsCles, texteSort } from './sortsTextes';
import type { Element, SkillId, SpellDef } from '../sim/defs';
import type { SortGrade } from '../sim/sorts';

/** Menu sorts 7A : schéma vu de dessus (ton perso au centre, portée en gris, zone en couleur), tiré des données du sort. */
function schemaZone(d: SpellDef | null, g: SortGrade, col: string): string {
  const k = 120 / 2 / 7.5, cx = 60, cy = 60, cases = (px: number) => px / 48 * k;
  const c = (x: number, y: number, r: number, f: string, st: string, dash = '') => `<circle cx="${x}" cy="${y}" r="${Math.max(0, r).toFixed(1)}" fill="${f}" stroke="${st}" stroke-width="1.4"${dash}/>`;
  const trait = (y: number) => `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${y.toFixed(1)}" stroke="#e8e2d4" stroke-dasharray="3 3"/>`;
  let s = '';
  const h = d?.hit;
  if (!d || !h) {
    const r = Math.min(7, g.po[1]) * k;
    if (r) s += c(cx, cy, r, 'none', '#57554c') + trait(cy - r * 0.85) + c(cx, cy - r * 0.85, 6, `${col}55`, col);
  } else {
    const portee = 'range' in h ? h.range : d.move?.maxRange ?? 0;
    if (portee) s += c(cx, cy, cases(portee), 'none', '#57554c');
    if (h.shape === 'circle') { const y = d.move ? cy - cases(d.move.maxRange) : cy; s += c(cx, y, cases(h.radius), `${col}55`, col); if (d.move) s += trait(y); }
    else if (h.shape === 'line') s += `<rect x="${(cx - cases(h.width) / 2 - 3).toFixed(1)}" y="${(cy - cases(h.length)).toFixed(1)}" width="${(cases(h.width) + 6).toFixed(1)}" height="${cases(h.length).toFixed(1)}" fill="${col}55" stroke="${col}"/>`;
    else if (h.shape === 'cone') { const r = cases(h.range), a = (h.arc / 2) * Math.PI / 180; s += `<path d="M${cx} ${cy} L${(cx - r * Math.sin(a)).toFixed(1)} ${(cy - r * Math.cos(a)).toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(cx + r * Math.sin(a)).toFixed(1)} ${(cy - r * Math.cos(a)).toFixed(1)} Z" fill="${col}55" stroke="${col}"/>`; }
    else { const y = cy - cases(h.range) * 0.85, z = 'explode' in h && h.explode ? cases(h.explode) : Math.max(5, cases(h.shape === 'point' ? h.radius : 10)); s += trait(y) + c(cx, y, z, `${col}55`, col); }
  }
  return `<svg class="zo" viewBox="0 0 120 120" role="img" aria-label="Zone du sort">${s}<circle cx="${cx}" cy="${cy}" r="4.5" fill="#f4efe0"/></svg>`;
}
import { ELEMENT_COLORS } from './fx';
import { World } from '../sim/world';
import { COFFRE } from '../sim/coffre';
import { METIERS_FAB, chanceRare, prochainPalier, recettesAvec, recettesDe, sourcesDe } from '../sim/metiers';
/** Produit d'une recette : ressource, ou équipement (métiers de fabrication, 0.3). */
const produit = (id: string): { name: string; icon: number; soin?: number } | undefined => ITEMS.resources[id] ?? ITEMS.equipment[id];
import { chrono, type SuccesDef } from '../sim/quests';
/** Catégories officielles de la fenêtre Succès de Dofus 3 (achievementcategories : nom, bannière cat_N, couleur), dans l'ordre du jeu ;
 *  celles sans succès chez nous restent cachées (Élevage avant les montures, Événements, 2D). */
export const SUCCES_CATS = [
  { nom: 'Général', banniere: 1, couleur: '#fee034' }, { nom: 'Exploration', banniere: 4, couleur: '#a6ca36' },
  { nom: 'Donjons', banniere: 2, couleur: '#3376d2' }, { nom: 'Monstres', banniere: 8, couleur: '#bc130e' },
  { nom: 'Quêtes', banniere: 6, couleur: '#4dd5ae' }, { nom: 'Métiers', banniere: 5, couleur: '#ee437d' },
  { nom: 'Élevage', banniere: 3, couleur: '#ff7e26' }, { nom: 'Événements', banniere: 7, couleur: '#cb35fd' },
];
import { LADDER_CSS, VueLadder, chargerLadder, idDuPerso, ladderCharge } from './ladder';
import type { MarqueCarte } from './carteMonde';

const SLOT_NAMES: Record<EquipSlot, string> = {
  chapeau: 'Coiffe', cape: 'Cape', amulette: 'Amulette', anneau1: 'Anneau', anneau2: 'Anneau', ceinture: 'Ceinture',
  bottes: 'Bottes', arme: 'Arme', bouclier: 'Bouclier', familier: 'Familier',
};
/** Place des emplacements autour du perso, comme l'inventaire de Dofus 3 (null = case vide de l'interface). */
const LEFT: (EquipSlot | null)[] = ['chapeau', 'cape', 'familier', 'arme', 'bouclier'];
const RIGHT: (EquipSlot | null)[] = ['amulette', 'anneau1', 'anneau2', 'ceinture', 'bottes'];
/** Onglets verticaux de l'inventaire de Dofus 3 : tout, équipements, consommables, ressources, objets de quête, apparats. */
const TABS: [string, string, string][] = [['tout', 'all', 'Tout'], ['equip', 'equipments', 'Équipements'], ['conso', 'consumables', 'Consommables'],
  ['ressource', 'resources', 'Ressources'], ['quete', 'key', 'Objets de quête'], ['apparat', 'cosmetics', 'Apparats']];
const KINDS: [string, string][] = [['', 'Toutes les catégories'], ['arme', 'Armes'], ['amulette', 'Amulettes'], ['anneau', 'Anneaux'],
  ['chapeau', 'Coiffes'], ['cape', 'Capes'], ['ceinture', 'Ceintures'], ['bottes', 'Bottes'], ['bouclier', 'Boucliers'], ['familier', 'Familiers']];
const SORTS: [string, string][] = [['', 'Aucun tri'], ['niveau', 'Niveau'], ['rarete', 'Rareté'], ['nom', 'Nom']];
const RARITY_ORDER: Record<string, number> = { commun: 0, rare: 1, epique: 2, legendaire: 3, mythique: 4 };
const INV = 'assets/ui/inv';
/** Cadenas officiel (icons_assets_1x/lockShadowOutline) posé sur un objet protégé du recyclage. */
const CADENAS = '<img class="cad" src="assets/ui/emp/cadenas.png" alt="" title="Sous cadenas">';
/** Vraies pièces de l'interface de Dofus 3 (uidarkstone / uielements) : cadre des fenêtres, cases, onglets, cases à cocher. */
const D3 = 'assets/ui/d3';
/** Fond officiel des emplacements d'équipement (silhouette comprise). */
const SLOT_D3: Record<EquipSlot, string> = {
  chapeau: 'helmet', cape: 'cape', amulette: 'collar', anneau1: 'ring', anneau2: 'ring', ceinture: 'belt',
  bottes: 'shoe', arme: 'weapon', bouclier: 'shield', familier: 'pet',
};
const TAB_D3: Record<string, string> = { all: 'all', equipments: 'equipment', consumables: 'consumable', resources: 'resources', key: 'quest', cosmetics: 'cosmetics' };

/** Icône d'un objet d'apparat (planche à part ui/apparat.webp, apparat_export.py). */
function apparatHtml(id: string) {
  const d = APPARATS.objets[id]; if (!d) return '<i class="ic"></i>';
  if (d.case < 0) return iconHtml(d.icon);   // familier d'apparat : planche des objets
  const x = (d.case % APPARATS.cols) / (APPARATS.cols - 1) * 100, y = Math.floor(d.case / APPARATS.cols) / Math.max(1, APPARATS.rows - 1) * 100;
  return `<i class="ic" style="background-image:url(assets/ui/apparat.webp);background-size:${APPARATS.cols * 100}% ${APPARATS.rows * 100}%;background-position:${x.toFixed(3)}% ${y.toFixed(3)}%"></i>`;
}
const hexa = (c: number) => '#' + c.toString(16).padStart(6, '0');
/** Familier « aux couleurs du porteur » (comme dans Dofus 3) : mention dans sa fiche. */
const porteur = (id: string) => FAMILIERS.familiers[id]?.porteur ? '<div class="hint" style="color:#e8c46a">Prend les couleurs de son porteur</div>' : '';
type Visible = 'chapeau' | 'cape' | 'bouclier' | 'familier';
const VISIBLES: [Visible, string][] = [['chapeau', 'Coiffe'], ['cape', 'Cape'], ['bouclier', 'Bouclier'], ['familier', 'Familier']];

const CSS = `
.dw canvas.vivant{display:block}
.dw .stage canvas.who{position:relative;bottom:118px;height:min(270px,40vh);width:200px;max-width:100%}
.dw .appa{display:flex;justify-content:center;align-items:center;gap:10px;padding:8px 14px 0;z-index:1;position:relative}
.dw .appa > span{font-weight:bold;color:#f4efe0;text-shadow:0 1px 2px #000;font-size:12px}
.dw .appa .slot{width:50px;height:50px;background-size:100%}
.dw .appa .slot.cache::after{content:'';position:absolute;inset:8px;background:linear-gradient(45deg,transparent 46%,#e0625a 46%,#e0625a 54%,transparent 54%)}
.dw .cell.porte{outline:2px solid #b9e54b;outline-offset:-2px}
.dw .cell.pas{opacity:.45}
.dw .emp .cata{display:grid;grid-template-columns:200px 1fr;gap:12px;min-height:0}
.dw .emp .apercu{position:sticky;top:0;align-self:start;display:grid;justify-items:center;gap:6px;background:radial-gradient(ellipse at 50% 70%,#4f8a58,#1b231c 70%);border:1px solid #34322b;border-radius:4px;padding:8px}
.dw .emp .apercu canvas{width:180px;height:260px}
.dw .emp .filtre{display:flex;gap:6px;align-items:center}
.dw .emp .filtre input{flex:1}
.dw .win.garde{width:min(820px,96vw);height:min(640px,92vh)}
.dw .in.garde{display:grid;grid-template-columns:280px 1fr;gap:16px;padding:14px 16px;min-height:0;overflow:auto}
.dw .garde .apercu{display:grid;justify-items:center;align-content:start;gap:8px;background:radial-gradient(ellipse at 50% 70%,#4f8a58,#1b231c 70%);border:1px solid #34322b;border-radius:4px;padding:10px}
.dw .garde .apercu canvas{width:250px;height:360px}
.dw .garde .tetes{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.dw .garde .tetes button{all:unset;cursor:pointer;aspect-ratio:1;border-radius:4px;background-color:#2a2b1f;background-repeat:no-repeat;border:1px solid #45452f}
.dw .garde .tetes button.on{border-color:#b9e54b;box-shadow:0 0 0 2px #b9e54b;background-color:#3a4a1c}
.dw .garde .coul{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.dw .garde .coul label{display:flex;gap:6px;align-items:center;font-size:12px;color:#c9c4ab}
.dw .garde .coul input{width:34px;height:26px;border:1px solid #57554c;padding:0;border-radius:3px;cursor:pointer}
.dw .garde .pals{display:flex;flex-wrap:wrap;gap:6px}
.dw .garde .pals button{all:unset;cursor:pointer;display:flex;gap:2px;align-items:center;padding:4px 8px;border:1px solid #45433b;border-radius:3px;background:#2e2d28;font-size:12px}
.dw .garde .pals i{width:10px;height:14px;border-radius:2px;display:inline-block}
.dw .garde h5{margin:6px 0 2px;font-size:13px;color:#f4efe0}
.dw{position:fixed;inset:0;pointer-events:none;font:13px Lexend,Verdana,sans-serif;color:#e8e2d4;z-index:10}
.dw .win{pointer-events:auto;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#24231f;border:1px solid #0d0c0a;
 box-shadow:inset 0 0 0 1px #4a4840,0 12px 40px #000c;border-radius:4px;display:grid;grid-template-rows:38px 1fr;overflow:hidden}
.dw .win.inv{width:min(910px,96vw);height:min(720px,92vh)}
.dw .win.car{width:min(470px,96vw);height:auto;max-height:min(700px,94vh);grid-template-rows:46px minmax(0,1fr) auto}
.dw .carac2{padding:8px 12px 10px;overflow:auto;display:grid;gap:6px;align-content:start}
.dw .clv{display:flex;gap:10px;align-items:center;font-weight:600;font-size:14px;color:#f4efe0;padding:2px 4px}
.dw .clv .cxp{flex:1;height:8px;background:#111;border:1px solid #000;border-radius:4px;overflow:hidden}.dw .clv .cxp i{display:block;height:100%;background:linear-gradient(#c9f04c,#7fb81e)}
.dw .clv small{font-weight:400;color:#c9c4ab;font-size:12px}
.dw .chead,.dw .crow{display:grid;grid-template-columns:1.25fr .6fr 1fr .8fr;align-items:center}
.dw .chead{font-size:12px;color:#c9c4ab;padding:2px 8px}.dw .chead span:nth-child(2),.dw .chead span:nth-child(3){text-align:center}.dw .chead span:last-child{text-align:right}
.dw .crows{display:grid;gap:4px}
.dw .crow{background:#4a4334b8;border:1px solid #0006;border-radius:5px;padding:2px 8px;position:relative}
.dw .crow:hover{background:#5a503dc8}
.dw .cnom{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;font-weight:600;font-size:12.5px;color:#f4efe0}
.dw .cnom .blason{grid-row:1/3;width:30px;height:34px;display:grid;place-items:center;background:#2a201b;clip-path:polygon(0 0,100% 0,100% 72%,50% 100%,0 72%);border-top:2px solid #6b4b3a}
.dw .cnom .blason img{width:20px;height:20px}
.dw .cnom b{font-size:15px;line-height:1.1}
.dw .ccout{display:flex;gap:4px;justify-content:center;align-items:center;color:#b9e54b;font-weight:bold;font-size:14px}.dw .ccout img{width:15px}
.dw .cdist{display:flex;gap:4px;justify-content:center}
.dw .cdist button{width:24px;height:24px;padding:0;border:1px solid #000;border-radius:3px;background:#e8e2d2;cursor:pointer;display:grid;place-items:center}
.dw .cdist button:hover{background:#fff}.dw .cdist button:disabled{opacity:.3;cursor:default}
.dw .cdist img{width:18px;filter:brightness(0)}
.dw .cmod{display:grid;justify-items:end;font-size:11.5px;line-height:1.25;color:#f4efe0}.dw .cmod span{display:flex;gap:5px;align-items:center}.dw .cmod .z{color:#8f8a73}
.dw .cmod img{width:13px;filter:brightness(0) invert(1);opacity:.85}
.dw .crow .pp{grid-column:1/-1;display:flex;gap:6px;justify-content:center;padding:6px 0 2px}
.dw .crow .pp input{width:70px;background:#14130f;border:1px solid #57554c;color:#f4efe0;border-radius:3px;padding:3px 6px;font:inherit}
.dw .crow .pp button{background:#3a3428;border:1px solid #000;color:#f4efe0;border-radius:3px;padding:3px 10px;cursor:pointer;font:inherit;font-size:12px}
.dw .crow .pp button.ok{background:#5d7a1e}
.dw .cder{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;padding:8px 6px 2px;font-size:13px}
.dw .cder span{display:flex;gap:6px;align-items:center}.dw .cder img{width:18px;height:18px;object-fit:contain}.dw .cder b{color:#f4efe0}
.dw .cdet{display:grid;gap:6px;padding:0 4px}
.dw .cpied{display:flex;align-items:center;gap:8px;padding:8px 14px 12px;border-top:1px solid #0006;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#c9c4ab}
.dw .cpied b{color:#b9e54b;font-size:16px;letter-spacing:0}.dw .cpied img{width:18px}
.dw .cpied .rst{width:26px;height:26px;padding:0;border:1px solid #000;border-radius:3px;background:#3a3428;display:grid;place-items:center;cursor:pointer}.dw .cpied .rst img{filter:brightness(0) invert(1)}
.dw .cpied .det{margin-left:auto;font:13px Rowdies,sans-serif;color:#fff;background:#57513f;border:1px solid #000;border-radius:4px;padding:6px 12px;cursor:pointer;text-transform:uppercase}
.dw .cpied .det.on,.dw .cpied .det:hover{background:#6d6650}
.dw .ttl{position:relative;display:grid;place-items:center;background:linear-gradient(#34322b,#26241f);border-bottom:1px solid #0d0c0a;box-shadow:inset 0 -1px 0 #4a4840}
.dw .ttl b{font:bold 17px Lexend,sans-serif;color:#f4efe0;text-shadow:0 1px 2px #000;letter-spacing:.3px}
.dw .ttl img{position:absolute;left:8px;top:5px;width:28px;height:28px}
.dw .ttl .x{position:absolute;right:10px;top:4px;cursor:pointer;color:#f4efe0;font-size:22px;line-height:28px}
.dw .ttl .x:hover{color:#b9e54b}
.dw .body{display:grid;grid-template-columns:minmax(0,465px) minmax(0,1fr);min-height:0}
.dw .left{position:relative;display:grid;grid-template-rows:1fr auto;background:radial-gradient(ellipse 30% 48% at 50% 50%,#e4f59a 0%,#9fd27a 18%,#4f8a58 42%,#2b4632 68%,#1b231c 100%);border-right:1px solid #0d0c0a;min-height:0}
.dw .left::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#0004,transparent 18%,transparent 82%,#0004);pointer-events:none}
.dw .perso{position:relative;display:grid;grid-template-columns:64px 1fr 64px;gap:8px;padding:14px 14px 0;min-height:0}
.dw .slots{display:grid;grid-auto-rows:64px;gap:10px;align-content:start;z-index:1}
.dw .slot{width:62px;height:62px;border-radius:4px;background:linear-gradient(#4a4943,#383732);border:1px solid #6a675c;box-shadow:inset 0 0 0 1px #0007,0 2px 4px #0006;position:relative;display:grid;place-items:center;cursor:pointer}
.dw .slot.none{visibility:hidden}
.dw .slot .sil{width:34px;height:34px;opacity:.9}
.dw .slot .ic{width:52px;height:52px}
.dw .slot:hover{border-color:#b9e54b}
.dw .stage{position:relative;display:grid;place-items:end center;min-height:0}
.dw .stage .socle{position:absolute;bottom:40px;width:250px;max-width:100%;filter:drop-shadow(0 8px 10px #0008)}
.dw .stage .who{position:relative;bottom:118px;height:min(270px,40vh);max-width:100%;object-fit:contain}
.dw .stage .lv{position:absolute;top:2px;left:0;right:0;text-align:center;font-weight:bold;color:#f4efe0;text-shadow:0 1px 3px #000}
.dw .dofus{display:flex;justify-content:center;gap:10px;padding:12px 14px 16px;z-index:1}
.dw .dofus .slot{width:54px;height:54px;opacity:.85}
.dw .sets{position:absolute;left:90px;right:90px;bottom:92px;text-align:center;font-size:12px;color:#d6f57a;text-shadow:0 1px 2px #000}
.dw .right{display:grid;grid-template-columns:44px minmax(0,1fr);min-height:0;background:#292824}
.dw .tabs{display:flex;flex-direction:column;gap:6px;padding:14px 4px 0 6px;border-right:1px solid #0d0c0a;background:#1d1c19}
.dw .tab{width:32px;height:32px;border-radius:4px;display:grid;place-items:center;cursor:pointer;background:#2e2d28;border:1px solid #45433b}
.dw .tab img{width:24px;height:24px}
.dw .tab.on{background:linear-gradient(#6f9a2a,#4c6e17);border-color:#b9e54b}
.dw .tab:hover{border-color:#b9e54b}
.dw .list{display:grid;grid-template-rows:auto auto 1fr auto auto;gap:8px;padding:12px 12px 10px;min-height:0}
.dw input,.dw select{width:100%;box-sizing:border-box;background:#141310;border:1px solid #45433b;color:#e8e2d4;padding:7px 9px;border-radius:3px;font:13px Lexend,sans-serif}
.dw select{cursor:pointer}
.dw .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dw .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));grid-auto-rows:62px;gap:6px;overflow:auto;align-content:start;padding-right:2px}
.dw .cell{border-radius:3px;background:linear-gradient(#3e3d37,#33322d);border:1px solid #57554c;box-shadow:inset 0 0 0 1px #0005;position:relative;cursor:pointer;display:grid;place-items:center}
.dw .cell.empty{cursor:default;background:#2e2d29;border-color:#46443d}
.dw .cell:not(.empty):hover{border-color:#b9e54b}
.dw .cell .ic{width:52px;height:52px}
.dw .cell .n{position:absolute;left:4px;top:2px;font-size:13px;font-weight:bold;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000}
.dw .cell .r{position:absolute;left:4px;right:4px;bottom:3px;height:3px;border-radius:2px}
.dw .cell.up::after{content:'';position:absolute;right:4px;top:4px;border:5px solid transparent;border-bottom:7px solid #7be07b;border-top:0}
.dw .cell.low{opacity:.5}
.dw .cell .cad{position:absolute;right:3px;top:3px;width:16px;height:19px;filter:drop-shadow(0 1px 1px #000)}
.dw .win.emp{width:min(760px,96vw);height:min(640px,92vh)}
.dw .prer{position:absolute;top:30px;left:0;right:0;z-index:2;display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;font-size:12px;color:#c9c2ad;text-shadow:0 1px 2px #000}.dw .prer .btn{min-width:30px;padding:3px 8px;text-align:center}.dw .prer .btn.vide{opacity:.55}.dw .prer small{color:#d6cfb8;flex-basis:100%;text-align:center}
.dw .win.coffre{width:min(760px,96vw);height:min(680px,92vh)}
/* Zaap (maquette « Zaap : » 5A+5D) : la vraie fenêtre de Dofus 3 (Territoire / Région / Coordonnées / Niveau), groupée par zone */
.dw .win.zaap{width:min(860px,96vw);height:min(620px,92vh)}
.dw .in.zaap{display:grid;grid-template-rows:auto auto 1fr;gap:6px;padding:12px 16px 14px;min-height:0}
.dw .zaap .zt,.dw .zaap .zl{display:grid;grid-template-columns:2.2fr 1.6fr 1.1fr .6fr;gap:8px;align-items:center}
.dw .zaap .zt{padding:6px 16px 2px 46px;color:#c9bfa8;font-size:14px}
.dw .zaap .zt span:last-child,.dw .zaap .zl span:last-child{text-align:right}
.dw .zaap .zls{overflow:auto;display:grid;gap:5px;align-content:start;padding-right:2px}
.dw .zaap .zg{margin:8px 2px 0;font:bold 11px Lexend,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#e6b85c}
.dw .zaap .zl{padding:9px 16px 9px 12px;background:#3b342b;border-radius:5px;font-size:14px;font-weight:600;cursor:pointer;border:1px solid transparent}
.dw .zaap .zl:hover{background:#4a4237;border-color:#b9e54b55}
.dw .zaap .zl .t{display:flex;gap:10px;align-items:center;min-width:0}.dw .zaap .zl .t b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dw .zaap .zl .t img{width:22px;height:22px;flex:none}
.dw .zaap .zl.ici{cursor:default;border-color:#b9e54b44}.dw .zaap .zl.ici .t b{color:#b9e54b}.dw .zaap .zl.ici:hover{background:#3b342b}
.dw .zaap .zl.nd{opacity:.42;cursor:default}.dw .zaap .zl.nd:hover{background:#3b342b;border-color:transparent}
.dw .zaap .zl .ici-m{font-size:11px;color:#b9e54b;font-weight:600;margin-left:6px;white-space:nowrap}
.dw .zaap .zl.cons{border-color:#e6b85c88;background:#463b28}.dw .zaap .zl.cons .ici-m{color:#f2c94c}
.dw .zaap .n1{color:#7fd34e}.dw .zaap .n2{color:#e8c33a}.dw .zaap .n3{color:#ef8a3a}.dw .zaap .n4{color:#e0503e}
.dw .zaap .zp{font-size:12px;color:#9a8f7c;margin-top:6px}
.dw .in.emp{display:grid;gap:10px;align-content:start;overflow:auto;padding:14px 16px}
.dw .emp .eh{display:flex;justify-content:space-between;align-items:center}
.dw .emp .eos{display:flex;gap:6px}
.dw .emp .eo{cursor:pointer;padding:6px 16px;border-radius:3px;background:#2e2d28;border:1px solid #45433b;font-weight:bold;color:#d8d2bf}
.dw .emp .eo.on{background:linear-gradient(#6f9a2a,#4c6e17);border-color:#b9e54b;color:#fff}
.dw .emp .k{display:flex;gap:4px;align-items:center;font-weight:bold;color:#b9e54b;font-size:16px}.dw .emp .k .ic{width:30px;height:30px}
.dw .emp .lots{display:flex;gap:8px;flex-wrap:wrap}.dw .emp .lots .btn{display:grid;text-align:center}.dw .emp .lots small{font-weight:normal;font-size:11px;opacity:.85}
.dw .emp .eg{max-height:none;overflow:visible}
.dw .emp .cell .pv{position:absolute;right:3px;top:1px;font-size:11px;font-weight:bold;color:#b9e54b;text-shadow:0 0 3px #000}
.dw .emp .cell.verrou{opacity:.75}
.dw .emp .sub2{color:#c9a55a;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.dw .emp .shop{display:grid;gap:6px}.dw .emp .shop .btn{display:flex;gap:4px;align-items:center}.dw .emp .shop .btn .ic{width:22px;height:22px}
.dw .foot{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#c9c4ab}
.dw .foot b{color:#f4efe0}
.dw .foot .k{display:flex;gap:5px;align-items:center;font-weight:bold;color:#b9e54b;font-size:15px}
.dw .foot .k img{width:18px;height:18px}
.dw .hint{color:#8f8a73;font-size:11px}
.dw .carac{padding:16px 18px;overflow:auto;display:grid;gap:10px;align-content:start}
.dw .who2{display:flex;gap:12px;align-items:center}
.dw .who2 img{width:54px;height:54px;border-radius:50%;background:#1d1c19;border:1px solid #57554c;object-fit:cover;object-position:top}
.dw .who2 b{font-size:16px;color:#f4efe0}
.dw .carac .sub{color:#c9a55a;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-top:4px}.dw .stats{display:grid;gap:3px}.dw .stats div{display:flex;justify-content:space-between;align-items:center;padding:4px 2px;border-bottom:1px solid #34322b}
.dw .plus{cursor:pointer;background:#2c3a12;border:1px solid #6f8f2a;color:#d6f57a;border-radius:3px;padding:0 6px;margin-left:6px;font-weight:bold}
.dw .plus.off{opacity:.3;pointer-events:none}
.dw .pts{color:#b9e54b;font-weight:bold}
.dw .tip{position:fixed;pointer-events:none;z-index:11;min-width:240px;max-width:320px;background:#14130ff4;border:1px solid #57554c;border-radius:4px;padding:10px 12px;box-shadow:0 6px 20px #000a;line-height:1.45}
.dw .tip h4{margin:0 0 2px;font-size:15px}.dw .tip .sub{color:#a9a48b;font-size:12px;margin-bottom:6px}
.dw .tip .up{color:#7be07b}.dw .tip .down{color:#e0625a}.dw .tip .ex{color:#6fb2e8}.dw .tip .leg{color:#f08a2c;margin-top:4px}.dw .tip .leg.off{color:#8a7f70}.dw .tip .leg.off i{font-style:normal;color:#a89c88}
.dw .tip .set{color:#9ad15a;margin-top:6px;font-size:12px}.dw .tip .sig{color:#e6b85c;margin-top:6px;font-style:italic;font-size:12px}.dw .tip .hint{color:#7f7a64;font-size:11px;margin-top:6px}
.dw .win.opt{width:min(1000px,96vw);height:min(720px,92vh)}
.dw .opt .ob{display:grid;grid-template-columns:270px minmax(0,1fr);min-height:0}
.dw .opt .nav{background:#2a2823;border-right:1px solid #0d0c0a;display:grid;grid-template-rows:auto 1fr auto;min-height:0}
.dw .opt .nav input{margin:10px;width:calc(100% - 20px);box-sizing:border-box;padding:7px 9px;background:#1d1c19;border:1px solid #4a4840;border-radius:3px;color:#e8e2cc;font:inherit}
.dw .opt .nav .cats{overflow:auto;padding:0 0 10px}
.dw .opt .nav .cat{font-weight:bold;font-size:14px;color:#f4efe0;padding:9px 14px 4px}
.dw .opt .nav .it{padding:6px 14px 6px 30px;color:#d8d2bf;cursor:pointer;font-size:13.5px}
.dw .opt .nav .it:hover,.dw .opt .nav .it.on{color:#b9e54b}
.dw .opt .nav .bas{display:grid;gap:4px;padding:10px 14px;border-top:1px solid #3a3830}
.dw .opt .lien{display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;color:#e8e2cc;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:.04em;padding:5px}
.dw .opt .lien:hover{color:#b9e54b}
.dw .opt .main{overflow:auto;padding:16px 22px 26px;display:grid;gap:16px;align-content:start;background:#24231f}
.dw .opt .grp{display:grid;gap:12px}
.dw .opt .grp>h2{margin:6px 0 0;font:bold 21px Lexend,sans-serif;color:#f4efe0}
.dw .opt .grp>.desc{background:#1d1c19;border-radius:3px;padding:8px 10px;font-style:italic;color:#d8d2bf;font-size:12.5px}
.dw .opt .sec{background:#36332c;border-radius:5px;padding:12px 16px 14px;display:grid;gap:4px}
.dw .opt .sec .sh{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.dw .opt .sec .sh b{font-size:15px;color:#f4efe0}
.dw .opt .sec .sh .lien{font-size:11.5px}
.dw .opt .row{display:grid;grid-template-columns:minmax(0,1fr) minmax(140px,240px) 46px;gap:10px;align-items:center;min-height:32px;font-size:13.5px;color:#e8e2cc}
.dw .opt .row.ck{grid-template-columns:22px minmax(0,1fr);cursor:pointer}
.dw .opt .row.ck.on>span{color:#b9e54b}
.dw .opt .row input[type=checkbox]{appearance:none;width:18px;height:18px;margin:0;border:1px solid #6a675c;border-radius:2px;background:#1d1c19;display:grid;place-items:center;cursor:pointer}
.dw .opt .row input[type=checkbox]:checked{border-color:#b9e54b}
.dw .opt .row input[type=checkbox]:checked::after{content:'';width:9px;height:5px;border:solid #b9e54b;border-width:0 0 2px 2px;transform:translate(0,-2px) rotate(-45deg)}
.dw .opt .row input[type=range]{width:100%;accent-color:#b9e54b}
.dw .opt .row select{background:#57534a;color:#f4efe0;border:1px solid #2a2823;border-radius:3px;padding:5px 8px;font:inherit;grid-column:2/4}
.dw .opt .row output{text-align:right;color:#c9c4ab;font-variant-numeric:tabular-nums}
.dw .opt .row small{display:block;color:#a9a390;font-size:11.5px}
.dw .opt .keys{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;font-size:13px;color:#d8d2bf}
.dw .opt .keys b{color:#f4efe0;font-family:monospace;font-size:12.5px;background:#1d1c19;border:1px solid #4a4840;border-radius:3px;padding:1px 6px;justify-self:start}
.dw .opt .vide{color:#a9a390;font-style:italic;padding:20px}
.dw .win.sorts{width:min(900px,96vw);height:min(680px,92vh)}
.dw .sorts .sb{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;min-height:0}
.dw .sorts .ls{overflow:auto;padding:10px;border-right:1px solid #0d0c0a;background:#292824;display:grid;gap:5px;align-content:start}
.dw .sorts .pr{display:grid;grid-template-columns:1fr 16px 1fr;gap:4px;align-items:center}
.dw .sorts .pr .x{color:#8f8a73;text-align:center;font-size:12px}
.dw .sorts .sp{display:grid;grid-template-columns:40px 1fr;gap:8px;align-items:center;padding:4px 6px;border-radius:3px;background:linear-gradient(#3e3d37,#33322d);border:1px solid #57554c;cursor:pointer;min-width:0;line-height:1.2}
.dw .sorts .sp img{width:40px;height:40px;border-radius:4px}
.dw .sorts .sp small{display:block;color:#a9a48b;font-size:11px}
.dw .sorts .sp.lock{opacity:.4;filter:grayscale(1)}
.dw .sorts .sp.on{border-color:#b9e54b;box-shadow:inset 0 0 0 1px #b9e54b}
.dw .sorts .sp.vu{outline:2px solid #f2d36b;outline-offset:1px}
.dw .sorts .sp .soon{color:#c9a55a}
.dw .sorts .fi{padding:14px 16px;overflow:auto;display:grid;gap:10px;align-content:start}
.dw .sorts .fh{display:grid;grid-template-columns:64px 1fr;gap:12px;align-items:center}
.dw .sorts .fh img{width:64px;height:64px;border-radius:6px;border:1px solid #6a675c}
.dw .sorts .fh b{font-size:18px;color:#f4efe0}
.dw .sorts .gr{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.dw .sorts .gr span{font-size:11px;padding:3px 7px;border-radius:3px;border:1px solid #45433b;color:#a9a48b;cursor:pointer}
.dw .sorts .gr span.on{border-color:#b9e54b;color:#e8e2d4}
.dw .sorts dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0}
.dw .sorts dt{color:#a9a48b}.dw .sorts dd{margin:0}
.dw .sorts .ds{background:#1d1c19;border:1px solid #34322b;border-radius:3px;padding:8px 10px;white-space:pre-line;font-size:12.5px}
.dw .sorts .ef{margin:8px 0 0;padding-left:18px;font-size:12.5px;color:#d8d2bc}.dw .sorts .ef li{margin:2px 0}
.dw .sorts .rg{color:#f08a2c;font-size:12.5px;margin:6px 0 8px}
.dw .sorts .bb{grid-column:1/-1;display:flex;gap:6px;align-items:end;padding:10px 12px;border-top:1px solid #0d0c0a;background:#1d1c19;flex-wrap:wrap}
.dw .sorts .bs{width:52px;display:grid;gap:2px;justify-items:center;font-size:11px;color:#a9a48b;font-weight:bold}
.dw .sorts .bs i{width:50px;height:50px;border-radius:4px;border:1px solid #57554c;background:#2e2d29 center/44px no-repeat;display:block;cursor:pointer}
.dw .sorts .bs i.drop{border-color:#b9e54b;box-shadow:0 0 8px #b9e54b88}
.dw .sorts .bs.gap{margin-left:12px}
.dw .sorts .bb .hint{flex-basis:100%}
.dw .sorts .ls{gap:4px}
.dw .sorts .flt{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:2px}
.dw .sorts .flt span{font-size:11px;padding:2px 8px;border-radius:99px;border:1px solid #45433b;color:#a9a48b;cursor:pointer;background:#1d1c19}
.dw .sorts .flt span.on{border-color:#b9e54b;color:#e8e2d4}
.dw .sorts .gh{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#a9a48b;padding:8px 2px 1px}
.dw .sorts .gh.av{cursor:pointer;color:#c9a55a}
.dw .sorts .sp{grid-template-columns:40px 1fr 24px}
.dw .sorts .sp small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dw .sorts .sp img.vv{width:24px;height:24px;border-radius:3px;opacity:.45;filter:grayscale(1);cursor:pointer}
.dw .sorts .sp img.vv:hover,.dw .sorts .sp img.vv.vu{opacity:1;filter:none;outline:1px solid #f2d36b}
.dw .sorts .tg{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.dw .sorts .tg span{font-size:11px;padding:1px 6px;border-radius:3px;background:#1d1c19;border:1px solid #45433b;color:#a9a48b}
.dw .sorts .chips{display:flex;gap:6px;flex-wrap:wrap}
.dw .sorts .chips span{background:#1d1c19;border:1px solid #34322b;border-radius:3px;padding:3px 8px;font-size:12px;color:#a9a48b}
.dw .sorts .chips b{color:#e8e2d4}
.dw .sorts .acc{font-weight:600;font-size:15px;color:#f4efe0}
.dw .sorts .txt{font-size:13.5px;line-height:1.5;color:#ddd7c6}
.dw k{color:#f2d36b;border-bottom:1px dotted #f2d36b;cursor:help;position:relative}
.dw k:hover::after,.dw k:focus::after{content:attr(data-def);position:absolute;left:0;top:1.5em;z-index:20;width:240px;background:#11100e;border:1px solid #6a675c;color:#e8e2d4;font-size:12px;line-height:1.4;padding:6px 8px;border-radius:4px;white-space:normal;font-weight:400}
.dw .sorts .zr{display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:start}
.dw .sorts svg.zo{width:120px;height:120px;background:#151411;border:1px solid #34322b;border-radius:4px}
.dw .sorts .zr .ef{margin:0}
.dw .sorts .lg{border:1px solid #6a5427;background:#2a2410;border-radius:4px;padding:6px 10px;font-size:12.5px;color:#f2d36b;display:grid;gap:3px}
.dw .sorts .lg .hd{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#c9a55a}
.dw .sorts .lg .off{opacity:.55}
.dw .sorts .amb{font-style:italic;color:#a9a48b;font-size:12.5px}
.dw .sorts .var{display:flex;gap:8px;align-items:center;border-top:1px solid #34322b;padding-top:8px;font-size:12px;color:#a9a48b;flex-wrap:wrap}
.dw .sorts .var img{width:30px;height:30px;border-radius:4px}
.dw .sorts .var b{color:#e8e2d4}.dw .sorts .var>span:nth-child(2){flex:1;min-width:140px}
.dw .sorts .cmpv{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}
.dw .sorts .cmpv>div{background:#1d1c19;border:1px solid #34322b;border-radius:3px;padding:8px;display:grid;gap:2px}
.dw .sorts .cmpv small{color:#a9a48b;margin-bottom:4px}.dw .sorts .cmpv i{font-style:normal}
.dw .sorts .up,.dw .sorts .cmpv .up{color:#7be07b}.dw .sorts .cmpv .down{color:#e0625a}
.dw .tip .acc{display:block;color:#f4efe0;margin-bottom:2px}
.dw .tip .court{color:#d8d2bc;font-size:12.5px}
.dw .tip .long{display:none}.dw.maj-tip .tip .long{display:block;margin-top:5px}.dw.maj-tip .tip .court-seul{display:none}
.dw .win.job{width:min(940px,96vw);height:min(680px,92vh)}
/* Métiers UI (2026-11-07) : fenêtre Métiers (J) et fenêtre Artisanat, pièces officielles de Dofus 3 */
.dw .jb{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:0}
.dw .jl{background:#0000002e;border-right:1px solid #0b0a07;padding:10px 8px;display:grid;gap:4px;align-content:start;overflow:auto}
.dw .jm{display:grid;grid-template-columns:40px 1fr;gap:8px;align-items:center;padding:6px 8px;border-radius:3px;cursor:pointer;position:relative}
.dw .jm img{width:40px;height:40px;object-fit:contain}
.dw .jm b{font-size:13.5px;display:flex;justify-content:space-between;color:#f4efe0}.dw .jm b small{font-weight:normal;color:#b9e54b}
.dw .jm:hover{background:#ffffff0d}
.dw .jm.on{background:#b9e54b1f;box-shadow:inset 3px 0 0 #b9e54b}
.dw .jm.on::before{content:'';position:absolute;inset:0;background:#b9e54b;-webkit-mask:url(${'assets/ui/d3'}/sectionHeaderSelection.png) left/100% 100%;mask:url(${'assets/ui/d3'}/sectionHeaderSelection.png) left/100% 100%;opacity:.2;pointer-events:none}
.dw .jm.lock{opacity:.45;cursor:default}
.dw .xpb{height:5px;margin-top:4px;border-radius:3px;background:#15140f;box-shadow:inset 0 1px 2px #000,0 0 0 1px #3d3b33;overflow:hidden}
.dw .xpb i{display:block;height:100%;background:linear-gradient(90deg,#8fae3a,#b9e54b)}
.dw .xpb.big{height:10px;margin:6px 0 3px}
.dw .jd{padding:12px 18px 14px;display:grid;gap:10px;align-content:start;overflow:auto;min-height:0}
.dw .jt{display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:center}
.dw .jt img{width:64px;height:64px;object-fit:contain}
.dw .jt h3{margin:0;font-size:20px;color:#f4efe0}.dw .jt h3 span{font-size:15px;color:#b9e54b}
.dw .jt .pal{text-align:right;font-size:12px;color:#cfc9b6;max-width:240px}.dw .jt .pal b{display:block;font-size:14px;color:#f4efe0}
.dw .otabs{display:flex;justify-content:center;gap:34px}
.dw .otabs span{position:relative;padding:8px 22px 10px;font-weight:bold;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#cfc9b6;cursor:pointer}
.dw .otabs span.on{color:#b9e54b}
.dw .otabs span.on::after{content:'';position:absolute;left:-26px;right:-26px;bottom:0;height:40px;background:#b9e54b;-webkit-mask:url(assets/ui/d3/headerHighlight.png) center/100% 100%;mask:url(assets/ui/d3/headerHighlight.png) center/100% 100%;opacity:.35;pointer-events:none}
.dw .jf{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center}
.dw .jf input[data-jr],.dw .livre input[data-asr]{background:#1a1915 url(assets/ui/d3/btnIcon_magnifierSearch.png) right 8px center/16px no-repeat;padding-right:30px}
.dw label.ck{display:flex;gap:6px;align-items:center;font-size:12.5px;color:#d9d3c2;cursor:pointer;white-space:nowrap}
.dw label.ck input{width:24px;height:20px;margin:0;padding:0;appearance:none;-webkit-appearance:none;border:0;border-radius:0;background:url(assets/ui/d3/btn_checkbox_normal.png) center/100% no-repeat;box-shadow:none;cursor:pointer}
.dw label.ck input:checked{background-image:url(assets/ui/d3/btn_checkbox_selected.png)}
.dw .recs{display:grid;gap:4px}
.dw .jd .rec{background:#0000003a;border:1px solid #0000;padding:4px 10px 4px 4px}
.dw .jd .rec.ok{background:#3a4a1a44;border-color:#5b6f2a66}
.dw .jd .rec.lock{opacity:.55}
.dw .rec .rs{width:52px;height:52px;background:url(assets/ui/d3/slot_dark_background_full.png) center/100% no-repeat;display:grid;place-items:center}
.dw .rec .rs .ic{width:40px;height:40px}
.dw .rec .ing{cursor:help}.dw .rec .ing:hover b{text-decoration:underline}
.dw .rec .cb{flex-direction:row;align-items:center;gap:8px}
.dw .rec .nb{border:6px solid transparent;border-image:url(assets/ui/d3/btn_green_normal.png) 8 fill/6px;color:#1e2a05;font-weight:bold;padding:0 6px}
.dw .rec .pin{width:24px;height:24px;cursor:pointer;opacity:.4;filter:saturate(.3)}
.dw .rec .pin:hover{opacity:.8}.dw .rec .pin.on{opacity:1;filter:drop-shadow(0 0 4px #f2d36b)}
.dw .tip .ou{border-top:1px solid #3a3a2c;margin-top:6px;padding-top:6px;font-size:12px;display:grid;gap:2px}
.dw .tip .ou .hd{color:#a9a48b;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.dw .tip .ok{color:#9ad15a}.dw .tip .ko{color:#e0625a}
.dw .win.art{width:min(980px,96vw);height:min(700px,92vh)}
.dw .ab{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:0}
.dw .livre{background:#0000002e;border-right:1px solid #0b0a07;padding:10px;display:grid;grid-template-rows:auto auto 1fr;gap:6px;min-height:0}
.dw .als{overflow:auto;display:grid;gap:2px;align-content:start}
.dw .al{display:grid;grid-template-columns:40px 1fr auto;gap:8px;align-items:center;padding:3px 6px;border-radius:3px;font-size:12.5px;cursor:pointer;position:relative}
.dw .al .ic{width:36px;height:36px}.dw .al small{color:#9b9585}.dw .al.non{opacity:.5}
.dw .al:hover{background:#ffffff0d}
.dw .al.on{opacity:1;background:#b9e54b1f;box-shadow:inset 3px 0 0 #b9e54b}.dw .al.on::before{content:'';position:absolute;inset:0;background:#b9e54b;-webkit-mask:url(assets/ui/d3/sectionHeaderSelection.png) left/100% 100%;mask:url(assets/ui/d3/sectionHeaderSelection.png) left/100% 100%;opacity:.22;pointer-events:none}
.dw .plan{padding:14px 22px 20px;display:grid;gap:14px;justify-items:center;align-content:start;position:relative;overflow:auto}
.dw .plan::before{content:'';position:absolute;left:50%;top:150px;width:420px;height:420px;transform:translate(-50%,-50%);background:#a6e35a;-webkit-mask:url(assets/ui/d3/light_bg_inventory.png) center/contain no-repeat;mask:url(assets/ui/d3/light_bg_inventory.png) center/contain no-repeat;opacity:.16;pointer-events:none}
.dw .plan>*{position:relative}
.dw .am{font-size:12px;color:#cfc9b6;display:flex;gap:6px;align-items:center}.dw .am img{width:26px;height:26px}
.dw .ares{display:grid;justify-items:center;gap:4px;text-align:center}.dw .ares b{font-size:17px;color:#f4efe0}.dw .ares small{color:#b9e54b}
.dw .ac{width:52px;height:52px;background:url(assets/ui/d3/slot_dark_background_full.png) center/100% no-repeat;display:grid;place-items:center;position:relative;cursor:help}
.dw .ac.vide{background-image:url(assets/ui/d3/slot_dark_background_empty.png);cursor:default}
.dw .ac .ic{width:40px;height:40px}
.dw .ac b{position:absolute;right:4px;bottom:2px;font-size:11px;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000}.dw .ac b.lack{color:#ff7a6b}
.dw .ac.manque .ic{filter:grayscale(1) brightness(.55)}.dw .ac.manque{outline:1px solid #d9534f88;outline-offset:-4px}
.dw .ac.on{outline:2px solid #6fb2e8;outline-offset:-4px;cursor:pointer}.dw .ac[data-arare]{cursor:pointer}
.dw .ac.big{width:84px;height:84px}.dw .ac.big .ic{width:64px;height:64px}
.dw .acs{display:grid;grid-template-columns:repeat(4,52px);gap:8px 14px}
.dw .acs .lab{grid-column:1/-1;text-align:center;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9b9585}
.dw .aq{display:flex;gap:8px;align-items:center}
.dw .aq .pm{width:34px;height:34px;display:grid;place-items:center;border:6px solid transparent;border-image:url(assets/ui/d3/btn_grey_small_normal.png) 8 fill/6px;cursor:pointer;box-sizing:border-box}
.dw .aq .pm:hover{border-image-source:url(assets/ui/d3/btn_grey_small_over.png)}
.dw .aq .pm img{width:14px;height:14px;object-fit:contain;filter:brightness(0) invert(.95)}
.dw .aq input{width:70px;height:34px;text-align:center;font-weight:bold;font-size:16px}
.dw .gros{display:grid;place-items:center;width:220px;height:66px;background:url(assets/ui/d3/btn_greenLargeBorder_normal.png) center/100% 100% no-repeat;font:20px Rowdies,Lexend,sans-serif;color:#1e2a05;text-shadow:0 1px 0 #e8ff7a;text-transform:uppercase;cursor:pointer;user-select:none}
.dw .gros:hover{background-image:url(assets/ui/d3/btn_greenLargeBorder_over.png)}
.dw .gros:active{background-image:url(assets/ui/d3/btn_greenLargeBorder_pressed.png)}
.dw .gros.off{background-image:url(assets/ui/d3/btn_greenLargeBorder_disabled.png);color:#3b3b33;text-shadow:none;cursor:default}
.dw .abar{width:330px;max-width:100%;height:12px;border-radius:6px;background:#15140f;box-shadow:inset 0 1px 2px #000,0 0 0 1px #3d3b33;overflow:hidden}
.dw .abar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#8fae3a,#d6ff6b)}
.dw .abar i.run{animation:fabbar linear forwards}
@keyframes fabbar{to{width:100%}}
.dw .axp{font-size:12px;color:#cfc9b6;display:flex;gap:6px;align-items:center}.dw .axp img{width:20px;height:17px}.dw .axp .lack{color:#ff7a6b}
.dw .job .in{padding:14px 16px;overflow:auto;display:grid;gap:12px;align-content:start}
.dw .mh{display:flex;gap:12px;align-items:center}.dw .mh img{width:56px;height:56px}
.dw .mh b{font-size:17px;color:#f4efe0}.dw .bar{height:8px;border-radius:4px;background:#2c281f;overflow:hidden;margin-top:5px;width:260px;max-width:100%}
.dw .bar i{display:block;height:100%;background:#b9e54b}
.dw .note{font-size:12px;color:#c9c4ab;background:#1d1c19;border:1px solid #34322b;border-radius:3px;padding:8px 10px}
.dw .note.ok{border-color:#4c6e17;color:#d6f57a}
.dw .job .ings{display:flex;gap:8px;flex-wrap:wrap;font-size:12px}.dw .job .ing{display:flex;align-items:center;gap:3px}.dw .job .ing .ic{width:26px;height:26px}.dw .job .ing.lack{opacity:.45}
.dw .rec{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;padding:8px;border:1px solid #34322b;border-radius:4px;background:#26251f}
.dw .rec .cb{display:flex;flex-direction:column;gap:4px;align-items:stretch;text-align:center}.dw .rec .ic{width:48px;height:48px}.dw .rec .ings{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:12px}
.dw .rec .ing{display:flex;align-items:center;gap:3px}.dw .rec .ing .ic{width:26px;height:26px}
.dw .rec .lack{color:#e0625a}.dw .rec .have{color:#9ad15a}
.dw .btn{cursor:pointer;background:linear-gradient(#6f9a2a,#4c6e17);border:1px solid #b9e54b;color:#fff;border-radius:3px;padding:6px 12px;font-weight:bold}
.dw .btn.off{opacity:.35;pointer-events:none;filter:grayscale(1)}
.dw .tip .cmp{border-top:1px solid #3a3a2c;margin-top:6px;padding-top:6px;font-size:12px}
.dw .tip .xpf{height:5px;background:#2a2620;border-radius:3px;margin:3px 0 5px;overflow:hidden}.dw .tip .xpf i{display:block;height:100%;background:#6fb2e8}

.dw .win.quetes,.dw .win.succes{width:min(900px,96vw);height:min(660px,92vh)}
.dw .carnet{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:8px;margin-bottom:10px}
.dw .carnet .pg{background:#e9dcbc;color:#3b2b14;border-radius:4px;padding:9px 7px 7px;display:grid;gap:3px;justify-items:center;text-align:center;min-height:132px;box-shadow:inset 0 0 0 1px #c9b386}
.dw .carnet .pg b{font-size:12.5px;line-height:1.2}
.dw .carnet .pg small{font-size:10.5px;color:#6b5530;line-height:1.25}
.dw .carnet .tp{width:58px;height:58px;border-radius:50%;border:3px solid #9b2d24;color:#9b2d24;display:grid;place-items:center;font-weight:800;font-size:10px;letter-spacing:.04em;text-transform:uppercase;transform:rotate(-14deg);margin:2px 0}
.dw .carnet .pg.vide .tp{border:2px dashed #b9a57c;color:#b9a57c;transform:none}
.dw .carnet .pg.bientot{opacity:.55}
.dw .carnet .pg.bientot .tp{border:2px dashed #a0937a;color:#8a7d62;transform:none;font-size:9px}
.dw .win.bestiaire{width:min(980px,96vw);height:min(700px,92vh)}
.dw .bes{display:grid;grid-template-columns:minmax(0,250px) minmax(0,1fr);min-height:0}
.dw .bes .bl{overflow:auto;padding:10px;border-right:1px solid #0d0c0a;background:#292824;display:grid;gap:3px;align-content:start}
.dw .bes .bh{color:#c9a55a;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:8px 2px 2px;line-height:1.3}
.dw .bes .bm{display:grid;grid-template-columns:34px 1fr auto;gap:6px;align-items:center;padding:3px 6px;border-radius:3px;cursor:pointer;line-height:1.2;font-size:12.5px;border:1px solid transparent}
.dw .bes .bm canvas{width:34px;height:34px}
.dw .bes .bm small{color:#a9a48b;font-size:11px;font-variant-numeric:tabular-nums}
.dw .bes .bm:hover{border-color:#57554c}.dw .bes .bm.on{border-color:#b9e54b;background:#2c3a16}
.dw .bes .bm.inc{color:#8a8672}.dw .bes .bm.boss span{color:#f08a7a}.dw .bes .bm.elite span{color:#f2d36b}
.dw .bes .bm .ic{width:30px;height:30px}
.dw .bes .bd{padding:14px 16px;overflow:auto;display:grid;gap:10px;align-content:start;background:linear-gradient(#2b2a25,#24231f);min-width:0}
.dw .bes .tete{display:flex;gap:14px;align-items:center}
.dw .bes .tete canvas{width:110px;height:110px;background:radial-gradient(circle at 50% 75%,#3a4a1c,transparent 70%);border-radius:6px}
.dw .bes .tete .ic{width:64px;height:64px;background-color:#1d1c19;border:1px solid #45433b;border-radius:6px}
.dw .bes h3{margin:0;font-size:20px;color:#f4efe0}.dw .bes .sub{color:#a9a48b;font-size:12px}
.dw .bes .ongl{display:flex;gap:4px;margin-top:6px}
.dw .bes .ongl button{all:unset;cursor:pointer;font-size:12px;padding:3px 10px;border:1px solid #45433b;border-radius:3px;color:#c9c4ab}
.dw .bes .ongl button.on{background:#b9e54b;border-color:#b9e54b;color:#15140f;font-weight:bold}
.dw .bes .lock{color:#8a8672;font-style:italic}
.dw .bes .kv{display:grid;gap:4px;font-size:13px}.dw .bes .kv div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #3a383055;padding:3px 0}
.dw .tip .bu-src{font-size:12px}.dw .tip .bu-ou{margin-top:8px}
.dw .qb{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);min-height:0}
.dw .qb .ql{overflow:auto;padding:10px;border-right:1px solid #0d0c0a;background:#292824;display:grid;gap:4px;align-content:start}
.dw .qb .qh{color:#c9a55a;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:8px 2px 2px}
.dw .qb .qi{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;padding:6px 8px;border-radius:3px;background:linear-gradient(#3e3d37,#33322d);border:1px solid #57554c;cursor:pointer;line-height:1.2}
.dw .qb .qi img{width:20px;height:20px;object-fit:contain}
.dw .qb .qi small{color:#a9a48b;font-size:11px}
.dw .qb .qi.on{border-color:#b9e54b;box-shadow:inset 0 0 0 1px #b9e54b}
.dw .qb .qi.fin{opacity:.6}
.dw .qb .qi .pin{color:#f2d36b;font-size:12px}
.dw .qb .qd{padding:16px 18px;overflow:auto;display:grid;gap:10px;align-content:start;background:linear-gradient(#2b2a25,#24231f)}
.dw .qb .qd h3{margin:0;font-size:18px;color:#f4efe0}.dw .qb .qd .sub{color:#a9a48b;font-size:12px}
.dw .qb .qd p{margin:0;line-height:1.5;color:#d8d2bf}
.dw .qb .et{border:1px solid #45433b;border-radius:4px;padding:8px 10px;background:#1f1e1a}
.dw .qb .et b{color:#e8e2cc}.dw .qb .et.done{opacity:.55}.dw .qb .et.cur{border-color:#8fae3a}
.dw .qb .ob{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:3px 0 0 6px;color:#c9c4ab}
.dw .qb .ob.ok{color:#7be07b}
.dw .qb .rw{display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:12px}
.dw .qb .rw .ic{width:30px;height:30px}.dw .qb .rw span{display:flex;align-items:center;gap:4px}
.dw .qb .btn{justify-self:start}
.dw .btn{cursor:pointer;background:linear-gradient(#6f9a2a,#4c6e17);border:1px solid #b9e54b;color:#f4efe0;border-radius:3px;padding:5px 12px;font-weight:bold}
.dw .btn.off{opacity:.35;pointer-events:none}
.dw .sp2{height:6px;border-radius:3px;background:#14130f;border:1px solid #45433b;overflow:hidden}.dw .sp2 i{display:block;height:100%;background:linear-gradient(90deg,#8fae3a,#b9e54b)}
.dw .sx{display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0}
.dw .sx .sxh{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #0d0c0a;background:#23221e}
.dw .sx .pts{display:grid;gap:4px;flex:1;min-width:200px;font-size:12px;color:#d8d2bf}.dw .sx .pts b{color:#f2d36b}
.dw .sx input[type=search]{background:#14130f;border:1px solid #57554c;border-radius:3px;color:#f4efe0;font:inherit;font-size:12px;padding:5px 8px;width:180px}
.dw .sx .chips{display:flex;gap:3px}.dw .sx .chips span{border:1px solid #57554c;border-radius:3px;padding:3px 8px;font-size:12px;color:#a9a48b;cursor:pointer}
.dw .sx .chips span.on{border-color:#b9e54b;color:#f4efe0;background:#2c3a16}
.dw .sx .btn.off{opacity:.45;pointer-events:none}
.dw .sxb{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:0}
.dw .sxb .cats{overflow:auto;padding:8px;display:grid;gap:6px;align-content:start;border-right:1px solid #0d0c0a;background:#292824}
.dw .sxb .cat{position:relative;height:60px;border-radius:4px;overflow:hidden;cursor:pointer;border:1px solid #57554c;background-size:cover;background-position:right center}
.dw .sxb .cat::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#000d 0,#0009 45%,#0000 85%)}
.dw .sxb .cat.res{height:40px;background:linear-gradient(90deg,#3e3a2c,#292824)}
.dw .sxb .cat .n{position:absolute;left:10px;top:7px;font:15px Rowdies,Lexend,sans-serif;color:#fff;text-shadow:0 1px 3px #000}
.dw .sxb .cat.res .n{top:9px}
.dw .sxb .cat .c{position:absolute;left:10px;top:31px;font-size:11px;color:#e6e0c8}
.dw .sxb .cat .pb{position:absolute;left:0;right:0;bottom:0;height:4px;background:#000a}.dw .sxb .cat .pb i{display:block;height:100%}
.dw .sxb .cat.on{border-color:#f2d36b;box-shadow:inset 0 0 0 1px #f2d36b}
.dw .sxb .badge{position:absolute;right:7px;top:7px;background:#c0392b;color:#fff;font-size:11px;font-weight:bold;border-radius:99px;padding:0 6px}
.dw .sxl{overflow:auto;padding:10px 14px;display:grid;gap:8px;align-content:start;background:linear-gradient(#2b2a25,#24231f)}
.dw .sxl .qh{color:#c9a55a;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:6px 2px 0}
.dw .sxl .vide{color:#a9a48b;padding:20px 4px}
.dw .su2{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:10px;align-items:start;border:1px solid #45433b;border-radius:4px;padding:8px 10px;background:#1f1e1a}
.dw .su2.ok{opacity:.7}.dw .su2.rec{opacity:1;border-color:#8f7a3a;background:linear-gradient(#2e2a1c,#24211a)}
.dw .su2.vu{box-shadow:0 0 0 2px #b9e54b}
.dw .su2 .ic{width:52px;height:52px;object-fit:contain}
.dw .su2 .co{display:grid;gap:4px;min-width:0}.dw .su2 .hd b{color:#f4efe0}.dw .su2 .sub{color:#a9a48b;font-size:12px}
.dw .su2 .obs{display:grid;gap:1px}.dw .su2 .ob{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#c9c4ab}
.dw .su2 .ob.ok{color:#7be07b}.dw .su2 .ob a{color:inherit;text-decoration:underline dotted;cursor:pointer}
.dw .su2 .rw{display:flex;flex-wrap:wrap;gap:6px;font-size:12px}.dw .su2 .rw span{display:flex;align-items:center;gap:4px;background:#0006;border:1px solid #45433b;border-radius:3px;padding:1px 7px;color:#e5dcb5}
.dw .su2 .rw .ic{width:20px;height:20px}.dw .su2 .rw .oi{width:18px;height:18px}
.dw .su2 .side{display:grid;gap:6px;justify-items:end;text-align:right}
.dw .su2 .pt{color:#f2d36b;font-weight:bold;white-space:nowrap}.dw .su2 .eta{color:#7be07b;font-size:12px;white-space:nowrap}
.dw .su2 .lien{font-size:12px;color:#c9c4ab;cursor:pointer;white-space:nowrap}.dw .su2 .lien:hover{color:#f4efe0}.dw .su2 .lien.on{color:#f2d36b}
.dw .sxr{display:grid;gap:8px}
.dw .sxr .rg{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px}
.dw .sxr .rc{border:1px solid #45433b;border-radius:4px;background:#1f1e1a;padding:7px 9px;display:grid;gap:5px;cursor:pointer}
.dw .sxr .rc .l{display:flex;justify-content:space-between;font-size:12px;color:#d8d2bf}
.dw .sxr .mini{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid #45433b;border-radius:4px;background:#1f1e1a;padding:4px 8px;font-size:13px;color:#e8e2cc;cursor:pointer}
.dw .sxr .mini img{width:36px;height:36px;object-fit:contain}.dw .sxr .mini small{display:block;color:#a9a48b;font-size:11px}.dw .sxr .mini .p{color:#f2d36b}
.dw .sxr .to{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;color:#d8d2bf}.dw .sxr .to small{color:#a9a48b}
.dw .sxr select{background:#14130f;border:1px solid #57554c;color:#f4efe0;font:inherit;border-radius:3px;padding:3px 6px;margin-left:6px}
.dw .sxr .orn{width:34px;height:34px;border-radius:4px;border:1px solid #45433b;cursor:pointer;display:inline-grid;place-items:center;color:#a9a48b}
.dw .sxr .orn.on{border-color:#f2d36b;box-shadow:0 0 0 1px #f2d36b}
.dw .su{border:1px solid #45433b;border-radius:4px;padding:8px 10px;background:#1f1e1a;display:grid;gap:4px}
.dw .su.ok{border-color:#8f7a3a;background:linear-gradient(#2e2a1c,#24211a)}
.dw .su .hd{display:flex;justify-content:space-between;gap:10px}.dw .su .hd b{color:#f4efe0}.dw .su .pt{color:#f2d36b;font-weight:bold;white-space:nowrap}

/* ——— Vraie interface de Dofus 3 : cadre, titre, fond, cases, onglets (assets/ui/d3) ——— */
.dw .win{background:#262520 url(assets/ui/d3/block_background_second.jpg) center/cover;border:0;border-radius:3px;box-shadow:0 16px 50px #000d;grid-template-rows:46px 1fr;overflow:visible}
.dw .win::after{content:'';position:absolute;inset:0 -9px -20px;pointer-events:none;z-index:4;border:40px solid transparent;border-image:url(assets/ui/d3/window_border_bottom.png) 40}
.dw .win>*{min-height:0}
.dw .ttl{background:linear-gradient(#4d4535,#332e23 70%,#2a261d);border-bottom:1px solid #0b0a07;box-shadow:inset 0 1px 0 #6b6150,0 2px 6px #0008;border-radius:3px 3px 0 0;overflow:hidden}
.dw .ttl::before,.dw .ttl::after{content:'';position:absolute;top:0;bottom:0;width:150px;background:url(assets/ui/d3/slideCornerBgHeader.png) left top/150px 100% no-repeat;opacity:.9;pointer-events:none}
.dw .ttl::before{left:0}.dw .ttl::after{right:0;transform:scaleX(-1)}
.dw .ttl b{font:bold 19px Lexend,sans-serif;color:#fff;text-shadow:0 1px 3px #000;position:relative;z-index:1}
.dw .ttl img{z-index:1;top:8px;left:10px}
.dw .ttl .x{z-index:1;top:10px;right:12px;width:30px;height:25px;background:url(assets/ui/d3/btn_close_normal.png) center/contain no-repeat;filter:brightness(0) invert(1)}
.dw .ttl .x:hover{filter:brightness(0) invert(1) sepia(1) saturate(6) hue-rotate(28deg)}
.dw .btn{border:6px solid transparent;border-image:url(assets/ui/d3/btn_green_normal.png) 8 fill/6px;background:none;color:#1e2a05;text-shadow:0 1px 0 #e8ff7a;padding:0 10px;border-radius:0;text-transform:uppercase;font-size:12px;letter-spacing:.03em}
.dw .btn:hover{border-image-source:url(assets/ui/d3/btn_green_over.png)}
.dw .btn:active{border-image-source:url(assets/ui/d3/btn_green_pressed.png)}
.dw input,.dw select{background-color:#1a1915;border:1px solid #3d3b33;box-shadow:inset 0 1px 3px #000a}
.dw select{appearance:none;-webkit-appearance:none;background:#57514a url(assets/ui/d3/contextMenuDownArrow.png) right 10px center/12px no-repeat;border:1px solid #23211b;box-shadow:inset 0 1px 0 #77705f;padding-right:30px;color:#f4efe0}
.dw select option{background:#2a2823;color:#f4efe0}
/* inventaire */
.dw .left{background:transparent}
.dw .left::after{content:'';position:absolute;left:50%;top:44%;width:440px;height:440px;transform:translate(-50%,-50%);background:#a6e35a;-webkit-mask:url(assets/ui/d3/light_bg_inventory.png) center/contain no-repeat;mask:url(assets/ui/d3/light_bg_inventory.png) center/contain no-repeat;opacity:.55;pointer-events:none}
.dw .perso,.dw .dofus,.dw .sets{position:relative;z-index:1}
.dw .slot{width:64px;height:64px;border:0;border-radius:0;background:url(assets/ui/d3/slot_dark_background_empty.png) center/100% no-repeat;box-shadow:none}
.dw .slot.plein{background-image:url(assets/ui/d3/slot_dark_background_full.png)}
.dw .slot:hover{outline:1px solid #b9e54b;outline-offset:-3px}
.dw .dofus .slot{width:56px;height:56px;opacity:1;background-size:100%}
.dw .right{background:#0003;border-left:1px solid #0b0a07}
.dw .left{border-right:0}
.dw .tabs{width:auto;padding:12px 0 0 4px;gap:2px;background:#0003;border-right:1px solid #0b0a07}
.dw .right{grid-template-columns:52px minmax(0,1fr)}
.dw .tab{width:46px;height:52px;border:0;border-radius:0;background:url(assets/ui/d3/tab_right_normal.png) center/100% 100% no-repeat}
.dw .tab:hover{border:0;background-image:url(assets/ui/d3/tab_right_over.png)}
.dw .tab.on{border:0;background:url(assets/ui/d3/tab_right_selected.png) center/100% 100% no-repeat}
.dw .tab img{width:28px;height:28px;object-fit:contain}
.dw .list input[data-search]{background:#1a1915 url(assets/ui/d3/btnIcon_magnifierSearch.png) right 8px center/18px no-repeat;padding-right:32px}
.dw .cell{border:0;border-radius:0;background:url(assets/ui/d3/slot_dark_background_full.png) center/100% no-repeat;box-shadow:none}
.dw .cell.empty{background:url(assets/ui/d3/slot_dark_background_empty.png) center/100% no-repeat}
.dw .cell:not(.empty):hover{outline:1px solid #b9e54b;outline-offset:-3px}
/* options */
.dw .opt .ob{background:none}
.dw .opt .nav{background:#0000002e;border-right:1px solid #0b0a07;border-radius:0 0 0 3px}
.dw .opt .nav input{background:#15140f;border-color:#3d3b33}
.dw .opt .nav .it{position:relative}
.dw .opt .nav .it.on::before{content:'';position:absolute;inset:2px 0;background:#b9e54b;-webkit-mask:url(assets/ui/d3/sectionHeaderSelection.png) left/100% 100%;mask:url(assets/ui/d3/sectionHeaderSelection.png) left/100% 100%;opacity:.18}
.dw .opt .main{background:none;padding-top:6px}
.dw .opt .otabs{display:flex;justify-content:center;gap:40px;margin-bottom:-4px}
.dw .opt .otabs span{position:relative;padding:8px 26px 10px;font-weight:bold;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#cfc9b6}
.dw .opt .otabs span.on{color:#b9e54b}
.dw .opt .otabs span.on::after{content:'';position:absolute;left:-30px;right:-30px;bottom:0;height:42px;background:#b9e54b;-webkit-mask:url(assets/ui/d3/headerHighlight.png) center/100% 100%;mask:url(assets/ui/d3/headerHighlight.png) center/100% 100%;opacity:.8;pointer-events:none}
.dw .opt .grp>.desc{background:#0000004d}
.dw .opt .sec{background:#4a443a99;box-shadow:inset 0 1px 0 #ffffff10,0 1px 3px #0006;border-radius:6px}
.dw .opt .row input[type=checkbox]{width:26px;height:22px;border:0;border-radius:0;background:url(assets/ui/d3/btn_checkbox_normal.png) center/100% no-repeat}
.dw .opt .row input[type=checkbox]:checked{background-image:url(assets/ui/d3/btn_checkbox_selected.png)}
.dw .opt .row input[type=checkbox]:checked::after{display:none}
.dw .opt .row.ck{grid-template-columns:28px minmax(0,1fr)}
.dw .opt .rs{display:inline-block;width:18px;height:18px;background:url(assets/ui/d3/btnIcon_reset.png) center/contain no-repeat;filter:brightness(0) invert(.92)}
.dw .opt .lien:hover .rs{filter:brightness(0) invert(1) sepia(1) saturate(6) hue-rotate(28deg)}
.dw .opt .nav .bas .lien[data-accueil]{border:6px solid transparent;border-image:url(assets/ui/d3/btn_grey_small_normal.png) 8 fill/6px;padding:2px 6px;color:#f4efe0;text-shadow:0 1px 2px #000}
.dw .opt .nav .bas .lien[data-accueil]:hover{border-image-source:url(assets/ui/d3/btn_grey_small_over.png)}
.dw .opt .row input[type=range]{-webkit-appearance:none;appearance:none;height:8px;border-radius:4px;background:linear-gradient(90deg,#8fae3a,#b9e54b) 0/var(--v,50%) 100% no-repeat,#15140f;box-shadow:inset 0 1px 2px #000,0 0 0 1px #3d3b33;cursor:pointer}
.dw .opt .row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:20px;border-radius:3px;background:linear-gradient(#e8ff8a,#9cc62a);border:1px solid #1e2a05;box-shadow:0 1px 3px #000}
.dw .opt .row input[type=range]::-moz-range-thumb{width:12px;height:20px;border-radius:3px;background:linear-gradient(#e8ff8a,#9cc62a);border:1px solid #1e2a05}
.dw .win{transform:translate(-50%,-50%) scale(var(--echelle,1))}
.dw .opt .main{grid-template-columns:minmax(0,1fr);scroll-behavior:smooth}
.dw .opt .row{grid-template-columns:minmax(0,1fr) minmax(140px,240px) 46px 18px}
.dw .opt .row.ck{grid-template-columns:28px minmax(0,1fr) 18px}
.dw .opt .row>span{min-width:0;overflow-wrap:anywhere}
.dw .opt .row small{margin-top:3px;line-height:1.35}
.dw .opt .fl{width:18px;height:18px;cursor:pointer;justify-self:end;opacity:.75;background:currentColor;color:#e8e2cc;-webkit-mask:url(assets/ui/d3/contextMenuDownArrow.png) center/12px no-repeat;mask:url(assets/ui/d3/contextMenuDownArrow.png) center/12px no-repeat;transition:transform .15s}
.dw .opt .fl:hover{opacity:1;color:#b9e54b}.dw .opt .fl.on{transform:rotate(180deg);color:#b9e54b}
.dw .opt .obtns{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:6px 0 2px}
.dw .opt .obtns .btn,.dw .opt .tw .btn{border-image-source:url(assets/ui/d3/btn_grey_small_normal.png);color:#f4efe0;text-shadow:0 1px 2px #000;padding:3px 12px;font-size:12px}
.dw .opt .obtns .btn:hover,.dw .opt .tw .btn:hover{border-image-source:url(assets/ui/d3/btn_grey_small_over.png)}
.dw .opt .tw .btn.vert{border-image-source:url(assets/ui/d3/btn_green_normal.png);color:#1e2a05;text-shadow:0 1px 0 #e8ff7a}
.dw .opt .tw .btn.vert:hover{border-image-source:url(assets/ui/d3/btn_green_over.png)}
.dw .opt .keys{margin-top:8px}
.dw .opt .tw{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:min(720px,92%);max-height:84%;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto;background:#2e2b25 url(assets/ui/d3/block_background_second.jpg) center/cover;border:1px solid #5a5446;border-radius:6px;box-shadow:0 14px 60px #000,0 0 0 9999px #0007;z-index:5}
.dw .opt .twt{position:relative;text-align:center;padding:11px;border-bottom:1px solid #403b31;font-size:16px;color:#f4efe0}
.dw .opt .twt .x{position:absolute;right:10px;top:7px;width:28px;height:24px;cursor:pointer;background:url(assets/ui/d3/btn_close_normal.png) center/contain no-repeat;filter:brightness(0) invert(1)}
.dw .opt .tw p{margin:0;padding:10px 16px 4px;font-size:12.5px;color:#d8d2bf}
.dw .opt .tg{overflow:auto;padding:4px 16px 8px;display:grid;grid-template-columns:1fr 1fr;gap:4px 22px;align-content:start}
.dw .opt .tg h4{grid-column:1/-1;margin:8px 0 2px;font-size:13px;color:#b9e54b;font-weight:bold}
.dw .opt .tl{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px;color:#e8e2cc}
.dw .opt .tk{flex:none;width:150px;background:#0f0e0c;border:1px solid #47423a;color:#f4efe0;font:12.5px Lexend,sans-serif;padding:4px 8px;cursor:pointer;border-radius:2px}
.dw .opt .tk:hover{border-color:#9b9484}.dw .opt .tk.perso{color:#e6d38a}
.dw .opt .tk.ecoute{border-color:#b9e54b;color:#b9e54b}.dw .opt .tk.dbl{border-color:#e0605a;color:#ff9a90}
.dw .opt .tmsg{min-height:18px;padding:2px 16px;font-size:12.5px;color:#ff9a90}
.dw .opt .tb{display:flex;justify-content:center;gap:12px;padding:10px;border-top:1px solid #403b31}
@media (max-width:640px){.dw .opt .tg{grid-template-columns:1fr}}
.dw .guide .ob{grid-template-columns:240px minmax(0,1fr)}
.dw .guide .nav{grid-template-rows:auto 1fr}
.dw .guide .nav .it{padding:9px 14px;font-size:14px;color:#e8e2cc}
.dw .guide .page{display:grid;gap:8px;font-size:14px;line-height:1.55;color:#e8e2cc;max-width:62ch}
.dw .guide .page h3{margin:10px 0 0;font:bold 15px Lexend,sans-serif;color:#f4efe0}
.dw .guide .page p{margin:0}
.dw .guide .page .chapo{font-weight:bold;color:#f4efe0}
.dw .guide .page .k,.dw .guide .keys b{color:#f4efe0;font-family:monospace;font-size:12.5px;background:#15140f;border:1px solid #4a4840;border-radius:3px;padding:1px 6px;white-space:nowrap}
.dw .guide .keys{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13.5px;color:#d8d2bf}
.dw .guide .keys b{justify-self:start}
.dw .btn,.dw .opt .nav .bas .lien[data-accueil]{font-family:Rowdies,Lexend,sans-serif;font-weight:400;letter-spacing:.02em}
.dw .ttl b{font-weight:700}
`;

type Mode = 'inv' | 'car' | 'job' | 'art' | 'opt' | 'sorts' | 'quetes' | 'succes' | 'guide' | 'emp' | 'garde' | 'zaap' | 'bestiaire' | 'forge' | 'coffre' | 'almanax' | 'dofus' | 'menu' | 'social' | 'ladder';

/** Fenêtres façon Dofus 3 : « Inventaire » (le perso sur son socle, ses emplacements autour, le sac à onglets)
 *  et « Caractéristiques » (les points à placer). Le jeu continue derrière (pas de pause : multijoueur prévu).
 *  Les clics appellent l'API de la partie (World / Player). */
export class Windows {
  private root: HTMLDivElement;
  private win: HTMLDivElement | null = null;
  private mode: Mode = 'inv';
  private tip: HTMLDivElement;
  private tab = 'tout';
  /** Journal des quêtes (5C) : quête affichée ; Succès : catégorie affichée. */
  private queteVue: string | null = null;
  /** Carnet de route du tour du monde ouvert à la place du détail de la quête (Tour 8B). */
  private carnetVu = false;
  private succesCat = '';   // '' = Résumé
  /** Fenêtre des services d'un PNJ du Havre-Sac (maquette Hub 4A) : le PNJ, et l'onglet Recycler, Boutique ou Apparats (Apparence 5A). */
  empPnj = 'kerubim';
  empOnglet: 'recycler' | 'boutique' | 'apparat' = 'recycler';
  /** Zaap du Havre-Sac (2C) : choix fait dans sa fenêtre (-1 = là où l'on était), lu par la scène. */
  onZaap: (i: number) => void = () => {};
  /** Apparat survolé dans la boutique d'Emp : le perso de l'aperçu le porte. */
  private essaiApparat: string | null = null;
  private apparatRecherche = '';
  private apparatSlot: '' | 'chapeau' | 'cape' | 'familier' = '';
  /** Perso du joueur dessiné en direct (classe et sexe, tête et couleurs) : inventaire, aperçu des apparats, garde-robe. */
  perso: { cle: string; app: Apparence } | null = null;
  /** Garde-robe (Apparence 6B) : nouvelle tête et nouvelles couleurs, enregistrées par l'affichage du jeu. */
  onApparence: (app: Apparence) => void = () => {};
  private garde: Apparence | null = null;
  private fiche: FichePerso | null = null;
  private kind = '';
  private sort = '';
  private search = '';
  private rechercheZaap = '';
  /** Image du perso (frame de repos de sa planche). */
  portrait = '';
  /** Réglages (render/ambiance.ts), modifiés en direct par la fenêtre Réglages. */
  reglages: Reglages = { ...REGLAGES_DEFAUT };
  onReglages: (r: Reglages) => void = () => {};
  /** Effets d'impact (touche F), et l'étape d'ambiance du moment pour l'affichage. */
  juice = { get: () => true, set: (_on: boolean) => {} };
  heureNom = () => '';
  /** Bouton « Retour à l'accueil » de la fenêtre Réglages (sauvegarde puis écran d'accueil). */
  onAccueil: (() => void) | null = null;
  /** Menu principal (Échap) : changer de personnage ou se déconnecter (retour à l'accueil, partie sauvegardée). */
  onMenu: ((choix: 'persos' | 'accueil') => void) | null = null;
  onChange: () => void = () => {};
  /** Bestiaire (maquette « Drops » 1A) : monstres vaincus par le compte (lus par la scène) ; partie de test : tout est visible. */
  vaincus: () => Record<string, number> = () => ({});
  toutVoir = false;
  private dofusOnglet: 'dofus' | 'trophees' | 'prysma' = 'dofus';
  private dofusSel = '';
  private bestType = '';
  private bestObjet: string | null = null;
  private bestOnglet: 'butin' | 'sorts' | 'res' = 'butin';
  private bestRecherche = '';
  /** Fenêtre du forgemage (maquette « Forgemagie ») : onglet, objet choisi, journal des essais, mode « viser ». */
  private forge = etatForge();

  constructor(private world: World) {
    const style = document.createElement('style'); style.textContent = DOF_CSS + MENU_CSS + ALM_CSS + SOCIAL_CSS + CSS + ICON_CSS + BUTIN_CSS + FORGE_CSS + CODEX_CSS + LADDER_CSS; document.head.appendChild(style);
    this.root = document.createElement('div'); this.root.className = 'dw'; document.body.appendChild(this.root);
    this.tip = document.createElement('div'); this.tip.className = 'tip'; this.tip.style.display = 'none'; this.root.appendChild(this.tip);
    window.addEventListener('keydown', this.captureTouche, true);
    window.addEventListener('keydown', this.majTip); window.addEventListener('keyup', this.majTip); window.addEventListener('blur', this.majTip);
    // fenêtre Social : suit le groupe (arrivées, départs, vie des membres)
    this.finCoop = Coop.ecouter(() => { if (this.ouverte === 'social') this.refresh(); });
    // (pas pendant qu'on tape un nom dans la fenêtre : le champ garderait sinon ni le texte ni le curseur)
    this.finEnLigne = EnLigne.ecouter(() => { const a = document.activeElement; if (this.ouverte === 'social' && !(a instanceof HTMLInputElement && a.type === 'text' && this.win?.contains(a))) this.refresh(); });
    this.minuteSocial = window.setInterval(() => { if (this.ouverte === 'social') tickSocial(this.win!, this.ctxSocial()); }, 1000);
  }
  private finCoop: () => void;
  private finEnLigne: () => void;
  private minuteSocial: number;
  /** Fenêtre Social : emplacement du perso joué (-1 : aucun) et partie de test, posés par la scène. */
  socialSlot = -1;
  socialTest = false;
  private ctxSocial() { return { world: this.world, slot: this.socialSlot, test: this.socialTest, fermer: () => this.close(), refaire: () => this.refresh() }; }
  private renderSocial() { rendreSocial(this.win!, this.title('Social', 'social'), this.ctxSocial()); }
  /** Classement (maquette « Ladder : » 1B) : centré sur le perso joué, ouvert sur « Autour de moi ». */
  private ladder = new VueLadder(true);
  private renderLadder() {
    const w = this.win!;
    w.innerHTML = `${this.title('Classement', 'ladder')}<div class="lad" data-ladder></div>`;
    const el = w.querySelector<HTMLElement>('[data-ladder]')!;
    this.ladder.monId = this.socialSlot >= 0 ? idDuPerso(this.socialSlot) : '';
    el.innerHTML = this.ladder.html();
    this.ladder.brancher(el, () => { if (this.ouverte === 'ladder') this.refresh(); });
    if (!ladderCharge() || this.ladderVieux()) void chargerLadder(true).then(() => { if (this.ouverte === 'ladder') this.refresh(); });
  }
  private ladderLu = 0;
  /** Relu au plus une fois par minute pendant que la fenêtre est ouverte. */
  private ladderVieux() { const t = Date.now(); if (t - this.ladderLu < 60_000) return false; this.ladderLu = t; return true; }
  get open() { return !!this.win; }
  /** Fenêtre ouverte (ou null). */
  get ouverte(): Mode | null { return this.win ? this.mode : null; }
  /** Ouvre la fenêtre demandée, ou la ferme si c'est déjà elle. */
  toggle(mode: Mode = 'inv') { if (this.win && this.mode === mode) this.close(); else this.show(mode); }
  close(son = true) {
    if (this.win && son) Son.jouer(MANIFESTE.ui.fermer, 'interface', { cle: 'fenetre', ecart: 0.1 });   // 6B
    this.win?.remove(); this.win = null; this.tip.style.display = 'none'; this.touchesVue = false; this.touchesEcoute = null;
    this.root.style.zIndex = '';
  }
  destroy() { this.root.remove(); window.removeEventListener('keydown', this.captureTouche, true);
    window.removeEventListener('keydown', this.majTip); window.removeEventListener('keyup', this.majTip); window.removeEventListener('blur', this.majTip); this.finCoop(); this.finEnLigne(); clearInterval(this.minuteSocial); }

  show(mode: Mode = 'inv') {
    this.close(false);
    Son.jouer(MANIFESTE.ui.ouvrir, 'interface', { cle: 'fenetre', ecart: 0.1 });   // 6B : ouverture, puis clic sur les boutons

    this.mode = mode;
    if (mode === 'garde') {
      this.garde = this.perso ? { tete: this.perso.app.tete, couleurs: [...this.perso.app.couleurs] } : null;
      if (this.perso && !this.fiche) fiches().then(f => { this.fiche = f[this.perso!.cle] ?? null; this.refresh(); }, () => {});
    }
    const w = document.createElement('div'); w.className = mode === 'guide' ? 'win opt guide' : `win ${mode === 'dofus' ? 'dofw' : mode}`;   // le Guide reprend la mise en page des Options
    w.addEventListener('contextmenu', e => e.preventDefault());
    w.addEventListener('pointerdown', e => e.stopPropagation());
    w.addEventListener('click', e => {
      const t = e.target as HTMLElement;
      if (t.closest('.btn,button')) Son.jouer(MANIFESTE.ui.ok, 'interface', { cle: 'clic', ecart: 0.05 });
      else if (t.closest('.it,[data-c],[data-tab],.tab,.lien')) Son.jouer(MANIFESTE.ui.onglet, 'interface', { cle: 'clic', ecart: 0.05 });
    });
    this.win = w; this.root.appendChild(w);
    this.render();
  }
  /** Redessine si la fenêtre est ouverte (après un ramassage, un niveau...). */
  refresh() { if (this.win) this.render(); }

  private render() {
    if (this.mode === 'guide') this.renderGuide();
    else if (this.mode === 'car') this.renderCarac(); else if (this.mode === 'job') this.renderJob(); else if (this.mode === 'art') this.renderArt(); else if (this.mode === 'opt') this.renderOpt();
    else if (this.mode === 'sorts') this.renderSorts(); else if (this.mode === 'quetes') this.renderQuetes();
    else if (this.mode === 'succes') this.renderSucces(); else if (this.mode === 'emp') this.renderEmp(); else if (this.mode === 'zaap') this.renderZaap();
    else if (this.mode === 'garde') this.renderGarde(); else if (this.mode === 'bestiaire') this.renderBestiaire(); else if (this.mode === 'forge') this.renderForge(); else if (this.mode === 'coffre') this.renderCoffre(); else if (this.mode === 'almanax') this.renderAlmanax(); else if (this.mode === 'dofus') this.renderDofus(); else if (this.mode === 'menu') this.renderMenu(); else if (this.mode === 'social') this.renderSocial(); else if (this.mode === 'ladder') this.renderLadder(); else this.renderInv();
    this.win!.querySelector('[data-close]')!.addEventListener('click', () => this.close());
  }
  private title(name: string, icon: string) {
    return `<div class="ttl"><img src="assets/ui/menu/${icon}.png" alt="" style="object-fit:contain"><b>${name}</b><span class="x" data-close title="Fermer (Échap)"></span></div>`;
  }

  private renderInv() {
    const w = this.win!, p = this.world.player;
    const slot = (s: EquipSlot | null) => {
      if (!s) return '<div class="slot none"></div>';
      const it = p.equipment[s], d = it && ITEMS.equipment[it.id];
      return `<div class="slot ${d ? 'plein' : ''}" data-slot="${s}" title="${d ? '' : SLOT_NAMES[s]}" style="${it ? `box-shadow:inset 0 -3px 0 ${RARITY_COLORS[it.rarity]}` : `background-image:url(${D3}/tx_slot_${SLOT_D3[s]}.png)`}">${d ? iconHtml(d.icon) : ''}</div>`;
    };
    const { html, n } = this.cells();
    w.innerHTML = `${this.title('Inventaire', 'inventory')}
      <div class="body">
        <div class="left">
          <div class="perso">
            <div class="slots">${LEFT.map(slot).join('')}</div>
            <div class="stage"><div class="lv">${p.cls.name} · niveau ${p.level}</div>${p.v03 ? `<div class="prer"><span title="Préréglages : équipement, barre de sorts et variantes. Clic : mettre ; Maj + clic : enregistrer ce que tu portes">Préréglages</span>${p.prereglages.map((r, i) =>
            `<span class="btn ${r ? '' : 'vide'}" data-prer="${i}" title="${r ? `${r.nom} : clic pour le mettre, Maj + clic pour le remplacer` : 'Vide : Maj + clic (ou clic) pour enregistrer ce que tu portes'}">${i + 1}</span>`).join('')}<small data-prerm>${this.prerMsg}</small></div>` : ''}<img class="socle" src="assets/ui/socle.png" alt="">${this.perso ? this.canevas('who', objetsPortes(p.equipment, p.apparat)) : `<img class="who" src="${this.portrait}" alt="">`}</div>
            <div class="slots">${RIGHT.map(slot).join('')}</div>
          </div>
          <div class="appa"><span title="Apparat : change seulement l'apparence. Clic : choisir ; clic droit : retirer, ou cacher l'objet porté">Apparence</span>${VISIBLES.map(([k, n]) => {
            const a = p.apparat[k], ic = a && a !== '0' ? apparatHtml(a) : '';
            return `<div class="slot ${a === '0' ? 'cache' : ''}" data-appa="${k}" title="${n} : ${a === '0' ? 'cachée' : a ? APPARATS.objets[a]?.name ?? '' : 'objet porté'}" style="${ic ? '' : `background-image:url(${D3}/tx_slot_${SLOT_D3[k]}.png)`}">${ic}</div>`; }).join('')}</div>
          <div class="sets">${this.setsHtml()}</div>
          <div class="dofus">${p.dofusPortes.map((id, i) => { const d = id && p.v03 ? PORTABLE(id) : null;
            return `<div class="slot ${d ? 'plein' : ''}" data-dofus="${i}" ${d ? '' : `title="${p.v03 ? (p.dofus.some(x => !p.dofusPortes.includes(x)) ? 'Clic : porter un de tes Dofus' : 'Dofus : gagnés par les quêtes du Gawdien du Dofus (Bastion)') : 'Dofus (plus tard)'}"`} style="${d ? '' : `background-image:url(${D3}/tx_slot_dofus.png)`}">${d ? iconHtml(d.icon) : ''}</div>`; }).join('')}</div>
        </div>
        <div class="right">
          <div class="tabs">${TABS.map(([k, ic, name]) => `<div class="tab ${this.tab === k ? 'on' : ''}" data-tab="${k}" title="${name}"><img src="${D3}/inventory_${TAB_D3[ic]}.png" alt=""></div>`).join('')}</div>
          <div class="list">
            <input placeholder="Rechercher..." value="${this.search.replace(/"/g, '&quot;')}" data-search>
            <div class="row2">
              <select data-sort>${SORTS.map(([k, v]) => `<option value="${k}" ${this.sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
              <select data-kind>${KINDS.map(([k, v]) => `<option value="${k}" ${this.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            </div>
            <div class="grid">${html}</div>
            <div class="foot"><span>Visible(s) : <b>${n}</b> · sac <b>${p.bag.length} / ${Player.BAG_SIZE}</b><br><span class="hint">Clic droit : équiper / retirer · Ctrl + clic : cadenas${p.equipment.familier ? ' · Alt + clic : nourrir le familier' : ''}${p.cls.coffre ? ' · Maj + clic : donner un Rare ou un Épique au coffre' : ''}</span></span>
              <span class="k">${p.kamas.toLocaleString('fr-FR')} <img src="${INV}/kamas.png" alt="" title="Kamas"></span></div>
            <div class="foot"><span>Butin affiché au sol</span>
              <select data-filter style="width:auto">${['Tout', 'Rare et plus', 'Épique et plus'].map((n, i) => `<option value="${i}" ${p.lootFilter === i ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            <label class="foot" title="Les objets Communs ramassés sont brisés tout de suite : leurs runes vont dans le sac, et une coiffe, cape ou bouclier inconnu rejoint ta collection d'apparences"><span>Briser les Communs au ramassage</span><input type="checkbox" style="width:auto;flex:none;margin:0" data-autobris ${p.autoBrisage ? 'checked' : ''}></label>
          </div>
        </div>
      </div>`;
    w.querySelectorAll<HTMLElement>('[data-tab]').forEach(e => e.addEventListener('click', () => { this.tab = e.dataset.tab!; this.render(); }));
    // 13A+13D : préréglages ; refusé moins de 5 s après un coup reçu
    w.querySelectorAll<HTMLElement>('[data-prer]').forEach(e => e.addEventListener('click', ev => {
      const i = +e.dataset.prer!;
      if (ev.shiftKey || !p.prereglages[i]) { p.enregistrerPrereglage(i); this.prerMsg = `Préréglage ${i + 1} enregistré`; }
      else if (p.mettrePrereglage(i)) this.prerMsg = `${p.prereglages[i]!.nom} mis`;
      else this.prerMsg = p.attentePrereglage > 0 ? `Touché il y a moins de ${Player.PREREGLAGE_DELAI} s : attends ${Math.ceil(p.attentePrereglage)} s` : 'Impossible pour l\'instant';
      this.changed();
    }));
    w.querySelector<HTMLSelectElement>('[data-sort]')!.addEventListener('change', e => { this.sort = (e.target as HTMLSelectElement).value; this.render(); });
    w.querySelector<HTMLSelectElement>('[data-kind]')!.addEventListener('change', e => { this.kind = (e.target as HTMLSelectElement).value; this.render(); });
    w.querySelector<HTMLSelectElement>('[data-filter]')!.addEventListener('change', e => { p.lootFilter = +(e.target as HTMLSelectElement).value; this.render(); });
    w.querySelector<HTMLInputElement>('[data-autobris]')!.addEventListener('change', e => { p.autoBrisage = (e.target as HTMLInputElement).checked; this.changed(); });
    w.querySelectorAll('select').forEach(s => s.addEventListener('keydown', e => e.stopPropagation()));
    const inp = w.querySelector<HTMLInputElement>('[data-search]')!;
    inp.addEventListener('input', () => { this.search = inp.value; this.render(); const m = this.win!.querySelector<HTMLInputElement>('[data-search]')!; m.focus(); m.setSelectionRange(m.value.length, m.value.length); });
    inp.addEventListener('keydown', e => e.stopPropagation());
    w.querySelectorAll<HTMLElement>('[data-slot]').forEach(e => {
      const s = e.dataset.slot as EquipSlot;
      e.addEventListener('mouseenter', ev => { const it = p.equipment[s]; if (it) this.showTip(it, ev, true); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', () => { p.unequip(s); this.changed(); });
      e.addEventListener('dblclick', () => { p.unequip(s); this.changed(); });
    });
    this.lierDofus(w);
    // Case Apparence (5A) : clic = les apparats de cet emplacement ; clic droit = retirer l'apparat, sinon cacher / montrer l'objet porté
    w.querySelectorAll<HTMLElement>('[data-appa]').forEach(e => {
      const k = e.dataset.appa as Visible;
      e.addEventListener('click', () => { this.tab = 'apparat'; this.kind = k; this.render(); });
      e.addEventListener('contextmenu', () => { this.world.porterApparat(k, p.apparat[k] ? null : '0'); this.changed(); });
    });
    w.querySelectorAll<HTMLElement>('[data-app]').forEach(e => {
      const id = e.dataset.app!, d = APPARATS.objets[id];
      const porter = () => { this.world.porterApparat(d.slot, p.apparat[d.slot] === id ? null : id); this.changed(); };
      e.addEventListener('mouseenter', ev => { this.tip.innerHTML = `<h4>${d.name}</h4><div class="sub">${d.collection ? `${SLOT_NAMES[d.slot]} · apparence de ta collection` : `${d.slot === 'chapeau' ? 'Coiffe' : d.slot === 'cape' ? 'Cape' : 'Familier'} d'apparat`}</div>${porteur(id)}<div class="hint">Change seulement l'apparence. Clic droit : porter / retirer</div>`; this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', porter); e.addEventListener('dblclick', porter);
    });
    w.querySelectorAll<HTMLElement>('[data-res]').forEach(e => {
      const id = e.dataset.res!, r = ITEMS.resources[id];
      const eat = () => { if (r.rappel ? this.world.rappel(id) : this.world.eat(id)) { if (r.rappel) this.close(); else this.changed(); } };
      e.addEventListener('mouseenter', ev => { this.tip.innerHTML = this.resTip(r, id); this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      if (r.soin || r.rappel) { e.addEventListener('contextmenu', eat); e.addEventListener('dblclick', eat); }
      else e.addEventListener('contextmenu', () => { this.hideTip(); this.recettesAvec(id); });
      e.addEventListener('click', ev => { if (ev.altKey && this.world.nourrirFamilier({ res: id, tout: ev.shiftKey })) { ev.preventDefault(); this.changed(); } });
    });
    w.querySelectorAll<HTMLElement>('[data-uid]').forEach(e => {
      const uid = +e.dataset.uid!, it = p.bag.find(b => b.uid === uid)!;
      const equip = () => { if (!p.equip(uid)) this.flash(e); this.changed(); };
      e.addEventListener('mouseenter', ev => this.showTip(it, ev, false));
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', equip);
      e.addEventListener('dblclick', equip);
      e.addEventListener('click', ev => {
        if (ev.altKey) { ev.preventDefault(); if (this.world.nourrirFamilier({ uid })) this.changed(); else this.flash(e); }
        else if (ev.shiftKey && p.cls.coffre) { ev.preventDefault(); if (this.world.donnerAuCoffre(uid)) this.changed(); else this.flash(e); }   // Enutrof 15C
        else if (ev.ctrlKey || ev.metaKey) { this.world.cadenas(uid); this.changed(); } });
    });
  }

  /** Fenêtre Caractéristiques façon Dofus 3 (maquette Caracs 7A, 2026-11-08) : Coût / Distribution (+ et ++) / Modificateur
   *  (base, objets, bonus), stats qui en découlent en bas, Détails pour le combat et les résistances, infobulle au survol (1A 2A+2C 5A). */
  private caracDetail = false;
  private caracPP: Stat | null = null;
  private renderCarac() {
    const w = this.win!, p = this.world.player, st = (k: Stat) => p.stat(k), r1 = (v: number) => Math.round(v * 10) / 10, C = `${D3}/caracs`;
    const ICONE: Record<string, string> = { vitalite: 'vitality', sagesse: 'wisdom', force: 'strength', intelligence: 'intelligence', chance: 'chance', agilite: 'agility' };
    const tips: Record<string, string> = {};
    const tipOf = (id: string, html: string) => { tips[id] = html; return `data-ctip="${id}"`; };
    const lignes = BASE_STATS.map(k => {
      const base = p.base[k] ?? 0, total = st(k), objets = (p.stats[k] ?? 0) - base, bonus = total - base - objets, cout = p.coutPoint(k), ok = p.points >= cout;
      const mod = (v: number, ic: string, t: string) => `<span class="${v ? '' : 'z'}">${v < 0 ? '-' : '+'} ${Math.abs(v)} <img src="${C}/btnIcon_${ic}.png" alt="" title="${t}"></span>`;
      const pp = this.caracPP === k ? `<div class="pp"><input type="number" min="1" max="${p.points}" value="${Math.max(1, Math.floor(p.points / cout))}" data-ppn="${k}" aria-label="Points à placer">
        <button type="button" data-ppmax="${k}">Max</button><button type="button" class="ok" data-ppok="${k}">OK</button></div>` : '';
      return `<div class="crow" ${tipOf(k, this.caracTip(k))}><div class="cnom"><span class="blason"><img src="${C}/tx_${ICONE[k]}.png" alt=""></span>${STAT_NAMES[k]}<b>${total}</b></div>
        <div class="ccout">${cout} <img src="${C}/characteristic.png" alt=""></div>
        <div class="cdist"><button type="button" data-plus="${k}" ${ok ? '' : 'disabled'} title="+1 (Maj : +10)"><img src="${C}/btnIcon_plus.png" alt=""></button><button type="button" data-pp="${k}" ${ok ? '' : 'disabled'} title="Placer plusieurs points"><img src="${C}/arrowTopDoubleLine.png" alt=""></button></div>
        <div class="cmod">${mod(base, 'character', 'Base (tes points)')}${mod(objets, 'sword', 'Objets (équipement, panoplie, familier)')}${mod(bonus, 'parchment', 'Bonus (effets passagers, Parangon plus tard)')}</div>${pp}</div>`;
    }).join('');
    const der = (ic: string, nom: string, v: string | number, tip: string) => `<span ${tipOf(`d_${nom}`, `<h4>${nom}</h4><div>${tip}</div>`)}><img src="${C}/tx_${ic}.png" alt="">${nom} <b>${v}</b></span>`;
    const chanceP = Math.floor(Math.max(0, st('chance')) / 10);
    const derivees = [
      der('lifePoints', 'Points de vie', `${Math.ceil(p.hp)} / ${p.maxHp}`, `${p.cls.hp} de base (${p.cls.name}) + 5 par niveau + Vitalité`),
      der('prospecting', 'Prospection', p.prospection, `Objets ${st('prospection')} + Chance / 10 (${chanceP}). +1 % de chances de butin par point, et un peu plus de raretés`),
      der('multiElement', 'Puissance', st('puissance'), '+1 % de dommages dans tous les éléments par point'),
      der('damage', 'Dommages', st('dommages'), 'Ajoutés à chaque coup, après les pourcentages'),
      der('heal', 'Soins', st('soins'), 'PV ajoutés à chaque soin reçu (potion, nourriture, monstre tué), après le bonus d\'Intelligence'),
      der('crit', 'Critique', `${Math.round(p.critChance * 100)} %`, `Chance de coup critique (${p.cls.name} : ${Math.round(p.cls.critChance * 100)} % de base), dommages ×${String(p.cls.critMult).replace('.', ',')}`),
      der('criticalDamage', 'Dommages critiques', st('dommagesCritiques'), 'Ajoutés à chaque coup critique'),
      der('initiative', 'Vitesse d\'attaque', `${(1 / p.attackInterval()).toFixed(2).replace('.', ',')} / s`, `Auto-attaques par seconde. % Vitesse d'attaque : ${st('vitesse')}`),
      der('actionPoints', 'PA', p.paMax, `Réserve qui paie les sorts, +${String(p.cls.pa.regen).replace('.', ',')} PA par seconde. +1 PA au niveau 100`),
      der('movementPoints', 'PM', p.pmMax, `Charges de déplacement rapide, une revient toutes les ${String(p.cls.pm.recharge).replace('.', ',')} s`),
    ].join('');
    const row = (label: string, v: number | string, tip: string) => `<div ${tipOf(`r_${label}`, `<h4>${label}</h4><div>${tip}</div>`)}><span>${label}</span><b>${v}</b></div>`;
    const detail = !this.caracDetail ? '' : `<div class="cdet">
        <div class="sub">Combat</div>
        <div class="stats">
          ${row('Initiative', p.initiative, 'Initiative + Force + Intelligence + Chance + Agilité. Le premier coup porté à un monstre fait +1 % par 10 points (jusqu\'à +50 %)')}
          ${row('Tacle', r1(p.tacle), 'Agilité / 10 + Tacle. Ralentit les monstres à ton contact (leur Fuite y résiste)')}
          ${row('Fuite', r1(p.fuite), 'Agilité / 10 + Fuite. Résiste au Tacle des monstres et réduit les ralentissements subis')}
          ${row('Retrait PA · PM', `${r1(p.retrait('PA'))} · ${r1(p.retrait('PM'))}`, 'Sagesse / 10 + Retrait. Chance que tes retraits de PA / PM passent l\'Esquive du monstre')}
          ${row('Esquive PA · PM', `${r1(p.esquive('PA'))} · ${r1(p.esquive('PM'))}`, 'Sagesse / 10 + Esquive. Chance d\'éviter les retraits de PA / PM des monstres')}
          ${row('Portée', st('portee'), '+1 case de portée par point pour les sorts à distance')}
          ${row('Réduction des recharges', `${Math.round(p.reductionRecharges * 100)} %`, `Raccourcit les recharges et le retour des charges des sorts (plafond ${REDUCTION_RECHARGES_MAX} %)`)}
          ${row('Dommages Poussée', st('dommagesPoussee'), 'S\'ajoutent aux coups qui repoussent')}
          ${row('Résistance Poussée · Critiques', `${st('resPoussee')} · ${st('resCritiques')}`, 'Sans effet pour l\'instant : les monstres ne font ni dommages de poussée ni coups critiques')}
          ${row('Invocations · Pods', `${st('invocations')} · ${st('pods')}`, 'Invocations : pour l\'Osamodas, plus tard. Pods : pas encore de limite de poids')}
        </div>
        <div class="sub">Résistances (fixe · %)</div>
        <div class="stats">
          ${(['Terre', 'Feu', 'Eau', 'Air', 'Neutre'] as const).map(e => row(e, `${st(`red${e}` as Stat)} · ${st(`res${e}` as Stat)} %`, `Les dommages ${e} reçus perdent d'abord la résistance fixe, puis le pourcentage (50 % au plus)`)).join('')}
        </div></div>`;
    const xpF = Math.min(100, Math.round(p.xp / Math.max(1, p.xpNeeded) * 100));
    w.innerHTML = `${this.title('Caractéristiques', 'characteristic')}
      <div class="carac2">
        <div class="clv">Niveau ${p.level} <div class="cxp"><i style="width:${xpF}%"></i></div><small>${Math.floor(p.xp).toLocaleString('fr-FR')} / ${p.xpNeeded.toLocaleString('fr-FR')}</small></div>
        <div class="chead"><span>Caractéristique</span><span>Coût</span><span>Distribution</span><span>Modificateur</span></div>
        <div class="crows">${lignes}</div>
        <div class="cder">${derivees}</div>
        ${detail}
      </div>
      <div class="cpied">Points de caractéristiques <b>${p.points}</b><img src="${C}/characteristic.png" alt="">
        <button type="button" class="rst" data-reset title="Rendre tous les points (gratuit, hors donjon)"><img src="${C}/btnIcon_reset.png" alt=""></button>
        <button type="button" class="det ${this.caracDetail ? 'on' : ''}" data-det>Détails</button></div>`;
    w.querySelectorAll<HTMLElement>('[data-ctip]').forEach(e => {
      e.addEventListener('mouseenter', ev => { if ((ev.target as HTMLElement).closest('.pp')) return; this.tip.innerHTML = tips[e.dataset.ctip!]; this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => { if ((ev.target as HTMLElement).closest('.pp')) { this.hideTip(); return; } this.tip.innerHTML = tips[e.dataset.ctip!]; this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mouseleave', () => this.hideTip());
    });
    w.querySelectorAll<HTMLElement>('[data-plus]').forEach(e => e.addEventListener('click', ev => {
      p.spendPoint(e.dataset.plus as Stat, ev.shiftKey ? 10 : 1); this.caracPP = null; this.changed();
    }));
    w.querySelectorAll<HTMLElement>('[data-pp]').forEach(e => e.addEventListener('click', () => {
      const k = e.dataset.pp as Stat; this.caracPP = this.caracPP === k ? null : k; this.hideTip(); this.render();
      w.querySelector<HTMLInputElement>('[data-ppn]')?.select();
    }));
    const placer = (k: Stat) => { const n = Math.floor(Number(w.querySelector<HTMLInputElement>('[data-ppn]')?.value) || 0); if (n > 0) p.spendPoint(k, n); this.caracPP = null; this.changed(); };
    w.querySelectorAll<HTMLElement>('[data-ppok]').forEach(e => e.addEventListener('click', () => placer(e.dataset.ppok as Stat)));
    w.querySelectorAll<HTMLElement>('[data-ppmax]').forEach(e => e.addEventListener('click', () => { p.spendPoint(e.dataset.ppmax as Stat, p.points); this.caracPP = null; this.changed(); }));
    w.querySelector<HTMLInputElement>('[data-ppn]')?.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') placer(this.caracPP!); else if (ev.key === 'Escape') { this.caracPP = null; this.render(); }
    });
    w.querySelector('[data-reset]')?.addEventListener('click', () => { if (this.world.reinitialiserCaracs()) { this.caracPP = null; this.changed(); } });
    w.querySelector('[data-det]')?.addEventListener('click', () => { this.caracDetail = !this.caracDetail; this.render(); });
  }
  /** Infobulle d'une caractéristique de base : ce qu'elle donne maintenant, d'où elle vient, et ce que rapporte le prochain point (2A + 2C). */
  private caracTip(k: Stat): string {
    const p = this.world.player, v = p.stat(k), cout = p.coutPoint(k), base = p.base[k] ?? 0, objets = (p.stats[k] ?? 0) - base;
    const pct = (n: number) => `${n >= 0 ? '+' : ''}${n} %`, d10 = (n: number) => Math.floor(Math.max(0, n) / 10);
    const effets: Record<string, string[]> = {
      vitalite: [`+${v} points de vie`],
      sagesse: [`${pct(v)} d'XP gagnée`, `+${d10(v)} Retrait et +${d10(v)} Esquive PA · PM`],
      force: [`${pct(v)} de dommages Terre et Neutre (auto-attaques comprises)`, `+${v} Initiative`],
      intelligence: [`${pct(v)} de dommages Feu`, `${pct(v)} aux soins reçus`, `+${v} Initiative`],
      chance: [`${pct(v)} de dommages Eau`, `+${d10(v)} Prospection`, `+${v} Initiative`],
      agilite: [`${pct(v)} de dommages Air`, `+${d10(v)} Tacle et +${d10(v)} Fuite`, `+${Math.round(Math.min(10, Math.max(0, v) / 20))} % de vitesse de course (+1 % par 20, 10 % au plus)`, `+${v} Initiative`],
    };
    const suivant: Record<string, string> = {
      vitalite: '+1 point de vie', sagesse: '+1 % d\'XP', force: '+1 % de dommages Terre et Neutre', intelligence: '+1 % de dommages Feu et de soins',
      chance: '+1 % de dommages Eau', agilite: '+1 % de dommages Air',
    };
    const sorts = Object.values(p.cls.spells).filter(s => (k === 'force' && s.element === 'terre') || (k === 'intelligence' && s.element === 'feu')
      || (k === 'chance' && s.element === 'eau') || (k === 'agilite' && s.element === 'air')).map(s => s.name);
    return `<h4>${STAT_NAMES[k]} · ${v}</h4><div class="sub">Base ${base} · objets ${objets} · coût ${cout} point${cout > 1 ? 's' : ''} pour +1</div>
      ${(effets[k] ?? []).map(t => `<div>${t}</div>`).join('')}
      ${sorts.length ? `<div class="hint">Sorts concernés : ${[...new Set(sorts)].join(', ')}</div>` : ''}
      <div class="up" style="margin-top:6px">Prochain point : ${suivant[k]}${cout > 1 ? ` (coûte ${cout})` : ''}</div>
      ${k !== 'vitalite' && k !== 'sagesse' ? '<div class="hint">Coût officiel : 1 point jusqu\'à 100, puis 2, 3 et 4 par tranche de 100.</div>' : k === 'sagesse' ? '<div class="hint">Coût officiel : 3 points pour +1 Sagesse.</div>' : ''}`;
  }

  // --- Métiers (maquette Métiers UI, 2026-11-07) -------------------------------------------------------------------
  /** Fenêtre Métiers (J, 1A) : métiers à gauche, détail à droite (niveau, XP, prochain palier 2B), onglets Recettes / Récoltes (2A),
   *  recherche par recette ou ingrédient et filtres (7A+7B), épingle de suivi (9A), « Où le trouver » au survol des ingrédients (8B). */
  jobSel = '';
  private jobOnglet: 'recettes' | 'recoltes' = 'recettes';
  private jobRecherche = '';
  private jobFaisables = true;
  private jobMonNiveau = false;
  /** Fenêtre Artisanat (3A) : métier de l'atelier, recette choisie, quantité, recherche et filtre du livre. */
  artMetier = '';
  private artRecette = -1;
  private artQte = 1;
  private artRecherche = '';
  private artSeulement = false;
  /** 10B : ingrédient rare ajouté à la fabrication d'un équipement (Rare garanti). */
  private artRare: string | null = null;
  /** « Montrer sur la carte » (8B, 11B) : ouvre la carte M avec ces cartes et points mis en évidence. */
  onCarte: (m: MarqueCarte) => void = () => {};

  /** Ouvre l'Artisanat d'un atelier (clic sur une machine). */
  artisanat(metier: string) {
    if (this.artMetier !== metier) { this.artMetier = metier; this.artRecette = -1; this.artQte = 1; this.artRecherche = ''; }
    this.show('art');
  }
  /** 12A : « Recettes qui l'utilisent » (clic droit sur une ressource du sac) : J filtré sur l'ingrédient. */
  recettesAvec(id: string) {
    const r = recettesAvec(ITEMS, id)[0], nom = ITEMS.resources[id]?.name ?? '';
    if (!r) return false;
    this.jobSel = r.metier; this.jobOnglet = 'recettes'; this.jobRecherche = nom; this.jobMonNiveau = false;
    this.show('job');
    return true;
  }

  private sources(id: string) {
    return sourcesDe(id, ITEMS, { monsterName: k => GAME_DATA.monsters[k]?.name, zones: Object.values(GAME_DATA.zones), recoltes: RECOLTES, boutiques: BOUTIQUES });
  }
  /** Bulle « Où le trouver » d'un ingrédient (8B) + « Sert à » (12B). */
  private ingTip(id: string, besoin?: number) {
    const r = ITEMS.resources[id], have = this.world.player.resources[id] ?? 0, s = this.sources(id), M = ITEMS.metiers ?? {};
    const l: string[] = [];
    if (s.recolte) l.push(`<b>Récolte</b> · ${RECOLTES.metiers[s.recolte.metier]?.nom ?? 'Puiser'}${s.recolte.metier ? ` niveau ${s.recolte.niveau}` : ''}${this.lieuxRecolte(id).length ? ` · ${this.lieuxRecolte(id).slice(0, 3).join(', ')}` : ''}`);
    for (const m of s.monstres.slice(0, 4)) l.push(`<b>Butin</b> · ${m.nom} (${n1(m.chance)} %)${m.chasse ? ', arme de chasse' : ''} · ${m.lieux.slice(0, 2).join(', ')}`);
    if (s.monstres.length > 4) l.push(`<span class="hint">+${s.monstres.length - 4} autres monstres</span>`);
    if (s.recette) l.push(`<b>Fabrication</b> · ${M[s.recette.metier]?.name ?? s.recette.metier} niveau ${s.recette.level}`);
    if (s.boutique) l.push(`<b>Boutique</b> · ${QUETES.pnj[s.boutique]?.nom ?? s.boutique}${(QUETES.pnj[s.boutique]?.zone ?? 'bastion') === 'bastion' ? ', au Bastion des Douze' : ', sur l\'île des Wabbits'}`);
    const sert = recettesAvec(ITEMS, id).map(x => produit(x.result)?.name).filter(Boolean);
    const ici = this.marquesDe(id);
    return `<h4>${r?.name ?? id}</h4><div class="sub">${besoin != null ? `<span class="${have >= besoin ? 'ok' : 'ko'}">${have} / ${besoin}</span> dans ton sac` : `${have} dans ton sac`}</div>
      <div class="ou"><div class="hd">Où le trouver</div>${l.length ? l.map(x => `<div>${x}</div>`).join('') : '<div class="hint">Pas encore dans le jeu.</div>'}</div>
      ${sert.length ? `<div class="ou"><div class="hd">Sert à</div><div>${sert.slice(0, 5).join(', ')}${sert.length > 5 ? '…' : ''}</div></div>` : ''}
      ${ici.tags.length || ici.points.length ? '<div class="hint">Clic : montrer sur la carte (M)</div>' : ''}`;
  }
  /** Sous-zones du monde actuel où pousse une ressource. */
  private lieuxRecolte(id: string) {
    const wg = this.world.worldGrid, sa = this.world.zone.open?.subareas ?? {}, n = new Set<string>();
    for (const r of this.world.recoltes) if (r.item === id) { const s = wg?.mapByTag(r.tag)?.sub; const nom = s != null ? sa[String(s)]?.name : undefined; if (nom) n.add(nom); }
    return [...n];
  }
  /** Cartes et points du monde actuel où trouver une ressource (récolte, monstres qui la lâchent, entrée des donjons). */
  private marquesDe(id: string): { tags: string[]; points: { x: number; y: number }[] } {
    const w = this.world, wg = w.worldGrid, open = w.zone.open;
    if (!wg || !open) return { tags: [], points: [] };
    const tags = new Set<string>(), points: { x: number; y: number }[] = [];
    for (const r of w.recoltes) if (r.item === id) tags.add(r.tag);
    const s = this.sources(id), subs = new Set<number>();
    for (const m of s.monstres) {
      for (const [k, sa] of Object.entries(open.subareas)) if (sa.monsters.includes(m.cle) || sa.elite === m.cle) subs.add(+k);
      for (const d of open.donjons ?? []) if (Object.values(d.salles).some(g => g.some(x => x.includes(m.cle)))) {
        const po = w.entreeDonjon(d.nom); if (po) points.push({ x: po.ends[0].x, y: po.ends[0].y });
      }
    }
    for (const m of wg.world.maps) if (!m.inside && subs.has(m.sub) && /^-?\d+_-?\d+$/.test(m.tag)) tags.add(m.tag);
    return { tags: [...tags], points };
  }
  private montrer(id: string) {
    const m = this.marquesDe(id), r = ITEMS.resources[id];
    if (!m.tags.length && !m.points.length) return;
    this.close(false); this.onCarte({ titre: r?.name ?? id, icone: r?.icon ?? 0, ...m });
  }
  /** Ligne d'ingrédient (icône, a/besoin, nom) avec sa bulle « Où le trouver ». */
  private ingHtml(id: string, q: number, fois = 1) {
    const have = this.world.player.resources[id] ?? 0, r = ITEMS.resources[id];
    return `<span class="ing" data-ing="${id}" data-q="${q * fois}">${iconHtml(r?.icon ?? 0)}<b class="${have >= q * fois ? 'have' : 'lack'}">${have}/${q * fois}</b> ${r?.name ?? ''}</span>`;
  }
  private lierIngredients(w: HTMLElement) {
    w.querySelectorAll<HTMLElement>('[data-ing]').forEach(e => {
      const id = e.dataset.ing!, q = e.dataset.q ? +e.dataset.q : undefined;
      e.addEventListener('mouseenter', ev => { this.tip.innerHTML = this.ingTip(id, q); this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('click', ev => { ev.stopPropagation(); this.hideTip(); this.montrer(id); });
    });
  }

  private renderJob() {
    const w = this.win!, p = this.world.player, M = ITEMS.metiers ?? {};
    const cles = Object.keys(M).filter(c => p.v03 || !METIERS_FAB.includes(c));
    if (!M[this.jobSel]) this.jobSel = cles.slice().sort((a, b) => p.metierLevel(b) - p.metierLevel(a))[0] ?? '';
    const k = this.jobSel, m = M[k];
    const liste = cles.map(c => {
      const st = p.metiers[c] ?? { level: 1, xp: 0 };
      return `<div class="jm ${c === k ? 'on' : ''}" data-met="${c}"><img src="assets/ui/metier_${c}.png" alt=""><div><b>${M[c].name}<small>${Math.max(1, st.level)}</small></b><div class="xpb"><i style="width:${Math.round(st.xp / metierXpNeeded(Math.max(1, st.level)) * 100)}%"></i></div></div></div>`;
    }).join('') + (p.v03 ? '' : '<div class="jm lock" title="Fabrication d\'équipement : version 0.3"><img src="assets/ui/menu/job.png" alt=""><div><b>Forgeron, Tailleur…</b><small class="hint">en 0.3</small></div></div>');
    if (!m) { w.innerHTML = `${this.title('Métiers', 'job')}<div class="in"><div class="hint">Aucun métier.</div></div>`; return; }
    const st = p.metiers[k] ?? { level: 1, xp: 0 }, lv = Math.max(1, st.level), need = metierXpNeeded(lv);
    const recolte = Object.entries(RECOLTES.ressources).filter(([, r]) => r.metier === k).sort((a, b) => a[1].niveau - b[1].niveau);
    const pal = prochainPalier(ITEMS, k, lv);
    const gain = k === 'chasseur' ? 'une viande ramassée ou un plat cuisiné' : recolte.length ? 'chaque récolte et chaque objet fabriqué' : 'chaque objet fabriqué';
    const ateliers = [...new Set(this.world.ateliersDe(k).map(a => a.nom))];
    const tete = `<div class="jt"><img src="assets/ui/metier_${k}.png" alt=""><div><h3>${m.name} <span>niveau ${lv}</span></h3>
        <div class="xpb big"><i style="width:${Math.round(st.xp / need * 100)}%"></i></div><div class="hint">${st.xp} / ${need} XP · ${gain} fait monter le métier</div></div>
        ${pal ? `<div class="pal"><b>Prochain palier : ${pal.niveau}</b>${pal.recettes.map(r => produit(r.result)?.name).join(', ')}</div>` : ''}</div>`;
    const onglets = `<div class="otabs"><span class="${this.jobOnglet === 'recettes' ? 'on' : ''}" data-jo="recettes">Recettes (${recettesDe(ITEMS, k).length})</span><span class="${this.jobOnglet === 'recoltes' ? 'on' : ''}" data-jo="recoltes">Récoltes (${recolte.length})</span></div>`;
    let corps = '';
    if (this.jobOnglet === 'recettes') {
      const q = this.jobRecherche.trim().toLowerCase();
      let l = recettesDe(ITEMS, k).filter(({ r }) => !q || produit(r.result)?.name.toLowerCase().includes(q) || r.ingredients.some(([id]) => ITEMS.resources[id]?.name.toLowerCase().includes(q)));
      if (this.jobMonNiveau) l = l.filter(({ r }) => r.level <= lv);
      if (this.jobFaisables) l = [...l.filter(({ i }) => this.world.craftMax(i) > 0), ...l.filter(({ i }) => this.world.craftMax(i) <= 0)];
      const filtres = `<div class="jf"><input placeholder="Chercher une recette ou un ingrédient…" value="${this.jobRecherche.replace(/"/g, '&quot;')}" data-jr>
        <label class="ck"><input type="checkbox" data-jfa ${this.jobFaisables ? 'checked' : ''}>Faisables d'abord</label><label class="ck"><input type="checkbox" data-jmn ${this.jobMonNiveau ? 'checked' : ''}>Mon niveau</label></div>`;
      const ou = ateliers.length ? `<div class="note">On fabrique en cliquant une machine : ${ateliers.join(', ')}.</div>` : `<div class="note">Pas d'atelier de ${m.name.toLowerCase()} dans cette zone.</div>`;
      corps = filtres + ou + `<div class="recs">${l.map(({ r, i }) => {
        const out = produit(r.result), ok = lv >= r.level, max = this.world.craftMax(i), suivie = p.recetteSuivie === r.result;
        return `<div class="rec ${max > 0 ? 'ok' : ''} ${ok ? '' : 'lock'}"><span class="rs" data-rtip="${r.result}">${iconHtml(out?.icon ?? 0)}</span>
          <div><b>${out?.name ?? r.result}</b> <span class="hint">niv. ${r.level}${out?.soin ? ` · +${out.soin} PV` : ''}</span>
          ${ok ? '' : `<div class="lack" style="font-size:12px">Niveau ${r.level} requis</div>`}<div class="ings">${r.ingredients.map(([id, n]) => this.ingHtml(id, n)).join('')}</div></div>
          <span class="cb">${max > 0 ? `<span class="nb" title="Tu peux en faire ${max}">×${max}</span>` : ''}<img class="pin ${suivie ? 'on' : ''}" data-pin="${r.result}" src="${D3}/pin_mark_yellow.png" alt="" title="${suivie ? 'Ne plus suivre' : 'Suivre cette recette à l\'écran'}"></span></div>`;
      }).join('') || '<div class="hint">Aucune recette ne correspond.</div>'}</div>`;
    } else if (recolte.length) {
      corps = `<div class="recs">${recolte.map(([id, r]) => {
        const ok = lv >= r.niveau, max = 1 + Math.floor(Math.max(0, lv - r.niveau) / 20), lieux = this.lieuxRecolte(id), voir = this.marquesDe(id).tags.length > 0;
        return `<div class="rec ${ok ? '' : 'lock'}"><span class="rs" data-ing="${id}">${iconHtml(r.icone)}</span><div><b>${r.nom}</b> <span class="hint">niv. ${r.niveau}</span>
          ${ok ? `<div style="font-size:12px">${max > 1 ? `1 à ${max}` : '1'} par récolte à ton niveau · ×5 si dorée</div>` : `<div class="lack" style="font-size:12px">Niveau ${r.niveau} requis</div>`}
          <div class="hint">${lieux.length ? lieux.join(', ') : 'Pas dans cette zone'}</div></div>
          <span class="cb">${voir ? `<span class="btn" data-voir="${id}">Carte</span>` : ''}</span></div>`;
      }).join('')}</div>`;
    } else corps = k === 'chasseur'
      ? `<div class="note ${p.huntingWeapon ? 'ok' : ''}">${p.huntingWeapon ? 'Arme de chasse en main : les monstres peuvent lâcher leurs viandes.' : 'Le Chasseur ne récolte pas : équipe une arme avec l\'effet « Arme de chasse » (Couteau de Chasse, Arc de Chasse…) et les monstres lâchent leurs viandes.'}</div>`
      : `<div class="note">${m.name} ne récolte rien : ses ingrédients viennent des autres métiers et du butin des monstres.</div>`;
    w.innerHTML = `${this.title('Métiers', 'job')}<div class="jb"><div class="jl">${liste}</div><div class="jd">${tete}${onglets}${corps}</div></div>`;
    w.querySelectorAll<HTMLElement>('[data-met]').forEach(e => e.addEventListener('click', () => { this.jobSel = e.dataset.met!; this.jobRecherche = ''; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-jo]').forEach(e => e.addEventListener('click', () => { this.jobOnglet = e.dataset.jo as 'recettes' | 'recoltes'; this.render(); }));
    const inp = w.querySelector<HTMLInputElement>('[data-jr]');
    if (inp) {
      inp.addEventListener('input', () => { this.jobRecherche = inp.value; this.render(); const i2 = this.win!.querySelector<HTMLInputElement>('[data-jr]')!; i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); });
      inp.addEventListener('keydown', e => e.stopPropagation());
    }
    w.querySelector<HTMLInputElement>('[data-jfa]')?.addEventListener('change', e => { this.jobFaisables = (e.target as HTMLInputElement).checked; this.render(); });
    w.querySelector<HTMLInputElement>('[data-jmn]')?.addEventListener('change', e => { this.jobMonNiveau = (e.target as HTMLInputElement).checked; this.render(); });
    w.querySelectorAll<HTMLElement>('[data-pin]').forEach(e => e.addEventListener('click', () => { const id = e.dataset.pin!; p.recetteSuivie = p.recetteSuivie === id ? null : id; this.changed(); }));
    w.querySelectorAll<HTMLElement>('[data-voir]').forEach(e => e.addEventListener('click', () => this.montrer(e.dataset.voir!)));
    w.querySelectorAll<HTMLElement>('[data-rtip]').forEach(e => {
      const r = ITEMS.resources[e.dataset.rtip!], eq = ITEMS.equipment[e.dataset.rtip!];
      e.addEventListener('mouseenter', ev => { if (!r && !eq) return; this.tip.innerHTML = r ? this.resTip(r, e.dataset.rtip!) : this.equipFabTip(e.dataset.rtip!); this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
    });
    this.lierIngredients(w);
  }

  /** Fenêtre Artisanat (3A, clic sur une machine d'atelier) : livre des recettes du métier, cases remplies en un clic (4A),
   *  quantité −/+/Max (6A), gros bouton Fabriquer, une barre d'une seconde pour toute la série (5B). */
  private renderArt() {
    const w = this.win!, p = this.world.player, k = this.artMetier, M = ITEMS.metiers ?? {}, m = M[k];
    const lv = Math.max(1, p.metierLevel(k)), ici = this.world.atelierIci(k);
    const toutes = recettesDe(ITEMS, k), q = this.artRecherche.trim().toLowerCase();
    let l = toutes.filter(({ r }) => !q || produit(r.result)?.name.toLowerCase().includes(q) || r.ingredients.some(([id]) => ITEMS.resources[id]?.name.toLowerCase().includes(q)));
    if (this.artSeulement) l = l.filter(({ i }) => this.world.craftMax(i) > 0);
    if (!toutes.some(x => x.i === this.artRecette)) this.artRecette = (toutes.find(({ i }) => this.world.craftMax(i) > 0) ?? toutes[0])?.i ?? -1;
    const rec = this.artRecette >= 0 ? ITEMS.recipes![this.artRecette] : null, equip = !!rec && !!ITEMS.equipment[rec.result];
    // 10B : ingrédients rares du sac (ressources de boss ou d'élite) ; un par objet, Rare garanti
    const rares = equip ? [...this.world.ingredientsRares].filter(id => (p.resources[id] ?? 0) > 0) : [];
    if (this.artRare && !rares.includes(this.artRare)) this.artRare = null;
    const max = rec ? this.world.craftMax(this.artRecette, equip ? this.artRare : null) : 0;
    this.artQte = Math.max(1, Math.min(this.artQte, Math.max(1, max)));
    const f = this.world.enFabrication, out = rec && produit(rec.result);
    const livre = l.map(({ r, i }) => {
      const o = produit(r.result), mx = this.world.craftMax(i), ok = lv >= r.level;
      return `<div class="al ${i === this.artRecette ? 'on' : ''} ${mx > 0 ? '' : 'non'}" data-ar="${i}">${iconHtml(o?.icon ?? 0)}<div>${o?.name ?? r.result}<br><small>niv. ${r.level}</small></div>${mx > 0 ? `<b class="have">×${mx}</b>` : ok ? '<small>manque</small>' : `<small class="lack">niv. ${r.level}</small>`}</div>`;
    }).join('') || '<div class="hint">Aucune recette.</div>';
    const cases = rec ? Array.from({ length: 8 }, (_, j) => {
      const g = rec.ingredients[j];
      if (!g) return '<span class="ac vide"></span>';
      const [id, n] = g, have = p.resources[id] ?? 0, besoin = n * this.artQte;
      return `<span class="ac ${have >= besoin ? '' : 'manque'}" data-ing="${id}" data-q="${besoin}">${iconHtml(ITEMS.resources[id]?.icon ?? 0)}<b class="${have >= besoin ? '' : 'lack'}">${have}/${besoin}</b></span>`;
    }).join('') : '';
    const xp = rec ? this.artQte * METIER_XP.parIngredient * rec.ingredients.reduce((s, [, n]) => s + n, 0) : 0;
    const raison = !rec ? '' : lv < rec.level ? `${m?.name ?? ''} niveau ${rec.level} requis` : ici === null ? 'Tu n\'es plus à l\'atelier' : max <= 0 ? 'Il manque des ingrédients' : '';
    const peut = !!rec && !raison && !f;
    w.innerHTML = `${this.title(ici?.nom ?? `Artisanat · ${m?.name ?? ''}`, 'job')}<div class="ab">
      <div class="livre"><input placeholder="Chercher…" value="${this.artRecherche.replace(/"/g, '&quot;')}" data-asr>
        <label class="ck"><input type="checkbox" data-aso ${this.artSeulement ? 'checked' : ''}>Seulement ce que je peux faire</label><div class="als">${livre}</div></div>
      <div class="plan"><div class="am"><img src="assets/ui/metier_${k}.png" alt="">${m?.name ?? ''} niveau ${lv}</div>
        ${rec && out ? `<div class="ares"><span class="ac big" data-rtip="${rec.result}">${iconHtml(out.icon)}</span><b>${out.name}</b><small>${out.soin ? `Rend ${out.soin} PV · ` : ''}${equip ? `${ITEMS.equipment[rec.result].slot.replace(/^./, c => c.toUpperCase())} · ` : ''}niveau ${rec.level}</small></div>
        <div class="acs"><span class="lab">Ingrédients</span>${cases}</div>
        ${equip ? `<div class="acs"><span class="lab">Ingrédient rare</span>${rares.map(id => `<span class="ac ${this.artRare === id ? 'on' : ''}" data-arare="${id}" data-ing="${id}">${iconHtml(ITEMS.resources[id]?.icon ?? 0)}<b>${p.resources[id]}</b></span>`).join('') || '<span class="hint">Aucun dans ton sac : les boss et les élites en lâchent.</span>'}</div>
        <div class="axp" style="color:${RARITY_COLORS.rare}">${this.artRare ? `Rare garanti (1 ${ITEMS.resources[this.artRare]?.name} par objet)` : `Commun ou Rare : ${Math.round(chanceRare(lv) * 100)} % de chance de Rare à ton niveau · ajoute un ingrédient rare pour le garantir`}</div>` : ''}
        <div class="aq"><span class="pm" data-aq="-1"><img src="${D3}/minus.png" alt="−"></span><input value="${this.artQte}" data-aqv inputmode="numeric"><span class="pm" data-aq="1"><img src="${D3}/plus.png" alt="+"></span><span class="btn ${max > 1 ? '' : 'off'}" data-amax>Max (${max})</span></div>
        <div class="gros ${peut ? '' : 'off'}" data-fab>${f ? 'Fabrication…' : 'Fabriquer'}</div>
        <div class="abar"><i class="${f ? 'run' : ''}" style="${f ? `animation-duration:${Math.max(0.05, 1 - f.t)}s` : ''}"></i></div>
        <div class="axp">${raison ? `<span class="lack">${raison}</span>` : `<img src="${D3}/experience.png" alt="">+${xp} XP de ${m?.name ?? ''} · une seconde pour toute la série`}</div>` : '<div class="hint">Choisis une recette dans le livre.</div>'}
      </div></div>`;
    w.querySelectorAll<HTMLElement>('[data-ar]').forEach(e => e.addEventListener('click', () => { this.artRecette = +e.dataset.ar!; this.artQte = Math.max(1, this.world.craftMax(this.artRecette)); this.render(); }));
    const inp = w.querySelector<HTMLInputElement>('[data-asr]')!;
    inp.addEventListener('input', () => { this.artRecherche = inp.value; this.render(); const i2 = this.win!.querySelector<HTMLInputElement>('[data-asr]')!; i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); });
    inp.addEventListener('keydown', e => e.stopPropagation());
    w.querySelector<HTMLInputElement>('[data-aso]')!.addEventListener('change', e => { this.artSeulement = (e.target as HTMLInputElement).checked; this.render(); });
    w.querySelectorAll<HTMLElement>('[data-aq]').forEach(e => e.addEventListener('click', () => { this.artQte = Math.max(1, Math.min(Math.max(1, max), this.artQte + +e.dataset.aq!)); this.render(); }));
    const qv = w.querySelector<HTMLInputElement>('[data-aqv]');
    qv?.addEventListener('keydown', e => e.stopPropagation());
    qv?.addEventListener('change', () => { this.artQte = Math.max(1, Math.min(Math.max(1, max), Math.floor(+qv.value || 1))); this.render(); });
    w.querySelector<HTMLElement>('[data-amax]')?.addEventListener('click', () => { this.artQte = Math.max(1, max); this.render(); });
    w.querySelector<HTMLElement>('[data-fab]')?.addEventListener('click', () => { if (this.world.lancerFabrication(this.artRecette, this.artQte, equip ? this.artRare : null)) this.render(); });
    w.querySelectorAll<HTMLElement>('[data-arare]').forEach(e => e.addEventListener('click', ev => { ev.stopPropagation(); this.hideTip(); this.artRare = this.artRare === e.dataset.arare ? null : e.dataset.arare!; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-rtip]').forEach(e => {
      const r = ITEMS.resources[e.dataset.rtip!], eq = ITEMS.equipment[e.dataset.rtip!];
      e.addEventListener('mouseenter', ev => { if (!r && !eq) return; this.tip.innerHTML = r ? this.resTip(r, e.dataset.rtip!) : this.equipFabTip(e.dataset.rtip!); this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
    });
    this.lierIngredients(w);
  }

  /** Journal des quêtes (fenêtre Quêtes de Dofus 3, 10A+10B) : en cours et terminées à gauche, détail à droite
   *  (texte complet 5C, étapes et objectifs, récompenses) ; une seule quête suivie (10C). */
  private renderQuetes() {
    const w = this.win!, Q = this.world.quetes!, QI = 'assets/ui/quetes';
    const icon = (id: string, rendre = false) => {
      const t = Q.def(id).type, m: Record<string, [string, string]> = { tutoriel: ['questInitiation', 'questObjective'], principale: ['questPrincipale', 'questPrincipaleObjective'],
        secondaire: ['quest', 'questObjective'], prime: ['questRepeatable', 'questRepeatableObjective'], evenement: ['questEvent', 'questObjective'] };
      return `${QI}/${m[t][rendre ? 1 : 0]}.png`;
    };
    const ids = Q.enCours.map(c => c.id), fin = [...Q.finies].filter(id => Q.existe(id));
    if (!this.queteVue || !Q.existe(this.queteVue)) this.queteVue = Q.suivie ?? ids[0] ?? fin[0] ?? null;
    const item = (id: string, done: boolean) => {
      const q = Q.def(id), c = Q.enCours.find(x => x.id === id);
      return `<div class="qi ${this.queteVue === id ? 'on' : ''} ${done ? 'fin' : ''}" data-q="${id}"><img src="${icon(id, !!c?.aRendre)}" alt="">
        <div>${q.nom}<br><small>${q.serie ?? ({ tutoriel: 'Tutoriel', principale: 'Quête principale', secondaire: 'Quête', prime: 'Prime', evenement: 'Événement' })[q.type]} · niv. ${q.niveau}</small></div>
        ${Q.suivie === id ? '<span class="pin" title="Quête suivie">◆</span>' : ''}</div>`;
    };
    let det = '<div class="hint">Aucune quête. Les PNJ avec une icône verte au-dessus de la tête en ont une à te confier.</div>';
    const id = this.queteVue;
    if (id && this.carnetVu) det = this.htmlCarnet();
    else if (id) {
      const q = Q.def(id), c = Q.enCours.find(x => x.id === id), done = Q.finies.has(id), et = Q.etapes(id);
      const pnj = q.pnj ? Q.data.pnj[q.pnj]?.nom : null;
      const steps = et.map((e, i) => {
        const st = done || (c && (i < c.etape || c.aRendre)) ? 'done' : c && i === c.etape ? 'cur' : '';
        const obs = st === 'cur' && c ? e.objectifs.map((o, k) => { const t = Q.total(o), n = Math.min(c.compte[k] ?? 0, t);
          return `<div class="ob ${n >= t ? 'ok' : ''}"><span>${n >= t ? '✓' : '•'} ${o.texte}</span><span>${t > 1 ? `${n}/${t}` : ''}</span></div>`; }).join('') : '';
        return `<div class="et ${st}"><b>${i + 1}. ${e.nom}</b>${st === 'done' ? ' <span class="hint">· terminée</span>' : ''}${obs}</div>`;
      }).join('') + (c?.aRendre && q.rendre ? `<div class="et cur"><b>${et.length + 1}. Retourner voir ${Q.data.pnj[q.rendre]?.nom}</b></div>` : '');
      const r = q.recompense, res = (o: string) => ITEMS.resources[o] ?? ITEMS.equipment[o];
      const rw = [r.xp ? `<span><b>${r.xp}</b> XP</span>` : '', r.kamas ? `<span><img src="${INV}/kamas.png" alt="" style="width:16px">${r.kamas} kamas</span>` : '',
        ...(r.objets ?? []).map(([o, n]) => `<span title="${res(o)?.name ?? o}">${iconHtml(res(o)?.icon ?? 0)}${n} × ${res(o)?.name ?? o}</span>`),
        r.sac ? `<span style="color:${RARITY_COLORS[r.sac]}">Sac ${RARITY_NAMES[r.sac]} garanti</span>` : '',
        r.pepites ? `<span>${iconHtml(ITEMS.resources[PEPITE]?.icon ?? 0)}${r.pepites} Pépites</span>` : '',
        r.potions ? '<span>Potions remplies</span>' : ''].filter(Boolean).join('');
      det = `<div><h3>${q.nom}</h3><div class="sub">${q.serie ? `${q.serie} · ` : ''}Niveau ${q.niveau}${pnj ? ` · ${pnj}` : ''}${done ? ' · Terminée' : ''}</div></div>
        <p>${q.texte}</p>${steps}<div class="qh">Récompenses</div><div class="rw">${rw || '<span class="hint">Aucune</span>'}</div>
        ${c ? `<span class="btn ${Q.suivie === id ? 'off' : ''}" data-suivre>${Q.suivie === id ? 'Quête suivie' : 'Suivre cette quête'}</span>` : ''}
        ${q.serie === 'Le tour du monde' ? '<span class="btn" data-carnet>Carnet de route</span>' : ''}`;
    }
    w.innerHTML = `${this.title('Quêtes', 'quest')}<div class="qb"><div class="ql">
      <div class="qh">En cours (${ids.length})</div>${ids.map(i => item(i, false)).join('') || '<div class="hint">Aucune</div>'}
      <div class="qh">Terminées (${fin.length})</div>${fin.map(i => item(i, true)).join('') || '<div class="hint">Aucune</div>'}
      </div><div class="qd">${det}</div></div>`;
    w.querySelectorAll<HTMLElement>('[data-q]').forEach(e => e.addEventListener('click', () => { this.queteVue = e.dataset.q!; this.carnetVu = false; this.render(); }));
    w.querySelector('[data-carnet]')?.addEventListener('click', () => { this.carnetVu = !this.carnetVu; this.render(); });
    w.querySelector('[data-suivre]')?.addEventListener('click', () => { if (id) { Q.suivie = id; this.render(); } });
  }

  /** Carnet de route (Tour 8B) : une page par donjon du tour du monde, tamponnée au premier passage (date, temps jusqu'au boss). */
  private htmlCarnet(): string {
    const Q = this.world.quetes!, pages = Q.carnet(), faits = pages.filter(p => p.premier).length;
    const date = (d?: string) => d ? new Date(`${d}T12:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    let html = '', ch = 0;
    for (const p of pages) {
      if (p.chapitre !== ch) { ch = p.chapitre; html += `${ch > 1 ? '</div>' : ''}<div class="qh">Chapitre ${ch} · ${p.nomChapitre}${p.bientot ? ' · bientôt' : ''}</div><div class="carnet">`; }
      const f = p.premier, cl = f ? '' : p.bientot ? 'bientot' : 'vide';
      const bas = f ? [date(f.d), f.t != null ? chrono(f.t) : '', p.victoires > 1 ? `${p.victoires} victoires` : ''].filter(Boolean).join(' · ') || 'vaincu' : p.bientot ? `${p.region}` : 'pas encore';
      html += `<div class="pg ${cl}" title="${p.donjon} · niv. ${p.niveau}"><b>${p.boss}</b><span class="tp">${f ? 'Vaincu' : p.bientot ? 'Bientôt' : '?'}</span><small>${p.donjon}</small><small>${bas}</small></div>`;
    }
    return `<div><h3>Carnet de route</h3><div class="sub">${faits} / ${pages.length} donjons · une page tamponnée par boss vaincu</div></div>${html}${pages.length ? '</div>' : ''}
      <span class="btn" data-carnet>Revenir à la quête</span>`;
  }

  /** Succès (menu des succès, ligne « Succès : 1A 2A+2B+2D 3A+3B+3C 4A-4E 5B+5C 6A+6B 7A+7B+7C … », 2026-11-10) : la fenêtre Succès
   *  de Dofus 3, bannières et couleurs officielles des catégories à gauche (catégories vides cachées), page Résumé, recherche, filtres,
   *  fiche avec icône officielle, compteurs, récompenses à récupérer, « Où ? », épingles ; titre et ornement portés dans le Résumé. */
  private renderSucces() {
    const w = this.win!, Q = this.world.quetes!;
    const rech = w.querySelector<HTMLInputElement>('#sxRech'), focus = !!rech && document.activeElement === rech, pos = rech?.selectionStart ?? 0;
    const all = Object.entries(Q.data.succes).filter(([id]) => Q.visible(id));
    const cats = SUCCES_CATS.filter(c => all.some(([, s]) => s.categorie === c.nom));
    if (this.succesCat && !cats.some(c => c.nom === this.succesCat)) this.succesCat = '';
    const total = all.reduce((n, [, s]) => n + s.points, 0), pts = all.filter(([id]) => Q.succes.has(id)).reduce((n, [, s]) => n + s.points, 0);
    const nRec = Q.nbARecuperer;
    const catList = `<div class="cat res ${this.succesCat ? '' : 'on'}" data-c=""><span class="n">Résumé</span>${nRec ? `<span class="badge">${nRec}</span>` : ''}</div>` + cats.map(c => {
      const ss = all.filter(([, s]) => s.categorie === c.nom), ok = ss.filter(([id]) => Q.succes.has(id)).length, r = ss.filter(([id]) => Q.aRecuperer(id)).length;
      return `<div class="cat ${this.succesCat === c.nom ? 'on' : ''}" data-c="${c.nom}" style="background-image:url(assets/ui/succes/cat_${c.banniere}.webp)">
        <span class="n">${c.nom}</span><span class="c">${ok} / ${ss.length}</span>${r ? `<span class="badge">${r}</span>` : ''}
        <span class="pb"><i style="width:${ss.length ? ok / ss.length * 100 : 0}%;background:${c.couleur}"></i></span></div>`;
    }).join('');
    w.innerHTML = `${this.title('Succès', 'success')}<div class="sx">
      <div class="sxh"><div class="pts"><span>Points de succès : <b>${pts} / ${total}</b> · ${total ? Math.floor(pts / total * 100) : 0} %</span>
        <div class="sp2"><i style="width:${total ? pts / total * 100 : 0}%"></i></div></div>
        <input id="sxRech" type="search" placeholder="Rechercher un succès" value="${escB(this.succesRech)}" aria-label="Rechercher un succès">
        <div class="chips">${(['tous', 'cours', 'ok'] as const).map(f => `<span class="${this.succesFiltre === f ? 'on' : ''}" data-f="${f}">${f === 'tous' ? 'Tous' : f === 'cours' ? 'En cours' : 'Terminés'}</span>`).join('')}</div>
        <span class="btn ${nRec ? '' : 'off'}" data-toutrec>${nRec ? `Tout récupérer (${nRec})` : 'Rien à récupérer'}</span></div>
      <div class="sxb"><div class="cats">${catList}</div><div class="sxl">${this.listeSucces(all)}</div></div></div>`;
    const r2 = w.querySelector<HTMLInputElement>('#sxRech')!;
    if (focus) { r2.focus(); r2.setSelectionRange(pos, pos); }
    r2.addEventListener('keydown', e => e.stopPropagation());
    r2.addEventListener('input', () => { this.succesRech = r2.value; const l = w.querySelector<HTMLElement>('.sxl')!; l.innerHTML = this.listeSucces(all); this.lierSucces(l); });
    w.querySelectorAll<HTMLElement>('.cats [data-c]').forEach(e => e.addEventListener('click', () => { this.succesCat = e.dataset.c!; this.succesVu = null; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-f]').forEach(e => e.addEventListener('click', () => {
      this.succesFiltre = e.dataset.f as 'tous' | 'cours' | 'ok'; if (!this.succesCat && !this.succesRech) this.succesCat = cats[0]?.nom ?? ''; this.render();
    }));
    w.querySelector('[data-toutrec]')?.addEventListener('click', () => { if (Q.recupererTout()) this.changed(); });
    this.lierSucces(w.querySelector<HTMLElement>('.sxl')!);
    if (this.succesVu) w.querySelector(`[data-sid="${this.succesVu}"]`)?.scrollIntoView({ block: 'center' });
  }
  private succesRech = '';
  private succesFiltre: 'tous' | 'cours' | 'ok' = 'tous';
  /** Succès mis en avant (clic sur un succès demandé par un autre, 4E ; clic sur la ligne du suivi, 8B). */
  private succesVu: string | null = null;
  /** Ouvre la fenêtre Succès sur la fiche de ce succès (8B : clic sur « Succès : … » du suivi). */
  ouvrirSucces(id?: string) {
    const s = id ? this.world.quetes?.data.succes[id] : null;
    if (s) { this.succesCat = s.categorie; this.succesVu = id!; this.succesRech = ''; this.succesFiltre = 'tous'; }
    this.show('succes');
  }
  /** Liste de droite : Résumé (3A+3B+3C, titres et ornements 6A+6B), une catégorie, ou les résultats d'une recherche (7A) filtrés (7B). */
  private listeSucces(all: [string, SuccesDef][]): string {
    const Q = this.world.quetes!, q = this.succesRech.trim().toLowerCase();
    const ok = ([id, s]: [string, SuccesDef]) => (this.succesFiltre === 'tous' || (this.succesFiltre === 'ok') === Q.succes.has(id))
      && (!q || `${s.nom} ${s.description} ${s.objectifs.map(o => o.nom).join(' ')}`.toLowerCase().includes(q));
    if (!this.succesCat && !q) {
      const cats = SUCCES_CATS.filter(c => all.some(([, s]) => s.categorie === c.nom));
      const presque = all.filter(([id]) => !Q.succes.has(id) && Q.avancement(id) > 0).sort((a, b) => Q.avancement(b[0]) - Q.avancement(a[0])).slice(0, 3);
      const derniers = [...Q.succes].filter(id => Q.visible(id)).reverse().slice(0, 5);
      const mini = (id: string, droite: string, sous: string) => { const s = Q.data.succes[id];
        return `<div class="mini" data-va="${id}"><img src="assets/ui/succes/a_${s.icone}.webp" alt=""><div>${s.nom}<small>${sous}</small></div><span class="p">${droite}</span></div>`; };
      const titres = Q.titres, orns = Q.ornements, tPorte = Q.titre, oPorte = Q.ornement;
      return `<div class="sxr">
        <div class="qh">Progression</div><div class="rg">${cats.map(c => { const ss = all.filter(([, s]) => s.categorie === c.nom), n = ss.filter(([id]) => Q.succes.has(id)).length;
          return `<div class="rc" data-c2="${c.nom}"><div class="l"><b>${c.nom}</b><span>${n} / ${ss.length}</span></div><div class="sp2"><i style="width:${ss.length ? n / ss.length * 100 : 0}%;background:${c.couleur}"></i></div></div>`; }).join('')}</div>
        ${presque.length ? `<div class="qh">Presque finis</div>${presque.map(([id, s]) => mini(id, `${Math.floor(Q.avancement(id) * 100)} %`,
          s.objectifs.filter(o => !Q.objectifSuccesFait(o)).slice(0, 2).map(o => o.nom).join(', ') || s.description)).join('')}` : ''}
        ${derniers.length ? `<div class="qh">Derniers obtenus</div>${derniers.map(id => { const s = Q.data.succes[id];
          return mini(id, `+${s.points} pt${s.points > 1 ? 's' : ''}`, Q.aRecuperer(id) ? 'Récompense à récupérer' : s.description); }).join('')}` : ''}
        <div class="qh">Titre et ornement</div>
        <div class="to"><label>Titre porté <select data-titre>${['<option value="">Aucun</option>', ...titres.map(t => `<option ${t === tPorte ? 'selected' : ''}>${escB(t)}</option>`)].join('')}</select></label>
          ${titres.length ? '' : '<small>Les gros succès donnent un titre (Le tour du monde, les Dofus…).</small>'}</div>
        <div class="to orns"><span>Ornement</span>${orns.length ? `<span class="orn ${oPorte ? '' : 'on'}" data-orn="0" title="Aucun">∅</span>${orns.map(o => `<img class="orn ${oPorte?.id === o.id ? 'on' : ''}" data-orn="${o.id}" src="assets/ui/succes/o_${o.icone}.webp" alt="${escB(o.nom)}" title="${escB(o.nom)}">`).join('')}`
          : '<small>Les ornements officiels viennent des succès de niveau (100, 160, 200).</small>'}</div></div>`;
    }
    const ss = all.filter(([, s]) => q || s.categorie === this.succesCat).filter(ok);
    const subs = [...new Set(ss.map(([, s]) => q ? `${s.categorie} · ${s.sousCategorie}` : s.sousCategorie))];
    return subs.map(sc => `<div class="qh">${sc}</div>` + ss.filter(([, s]) => (q ? `${s.categorie} · ${s.sousCategorie}` : s.sousCategorie) === sc)
      .map(([id, s]) => this.ficheSucces(id, s)).join('')).join('') || '<div class="vide">Aucun succès ne correspond.</div>';
  }
  /** Fiche d'un succès (4A icône officielle, 4B compteurs, 4C récompenses, 4D « Où ? », 4E succès demandés cliquables, 5B, 7C). */
  private ficheSucces(id: string, s: SuccesDef): string {
    const Q = this.world.quetes!, fait = Q.succes.has(id), rec = Q.aRecuperer(id), r = s.recompense;
    const it = r?.objet ? ITEMS.resources[r.objet] ?? ITEMS.equipment[r.objet] : null;
    const obs = s.objectifs.length > 1 || s.objectifs.some(o => Q.progres(o)[1] > 1) ? `<div class="obs">${s.objectifs.map(o => {
      const [n, m] = fait ? [1, 1] : Q.progres(o), f = fait || n >= m;
      const nom = 'succes' in o ? `<a data-va="${o.succes}">${o.nom}</a>` : o.nom;
      return `<div class="ob ${f ? 'ok' : ''}"><span>${f ? '✓' : '•'} ${nom}</span>${m > 1 && !fait ? `<span>${n} / ${m}</span>` : ''}</div>`; }).join('')}</div>` : '';
    const rw = [r?.xp ? `<span><b>${r.xp}</b> XP</span>` : '', it ? `<span data-rtip="${r!.objet}">${iconHtml(it.icon)}${it.name}</span>` : '',
      r?.titre ? `<span>Titre « ${escB(r.titre)} »</span>` : '', r?.ornement ? `<span><img class="oi" src="assets/ui/succes/o_${r.ornement.icone}.webp" alt="">Ornement ${escB(r.ornement.nom)}</span>` : ''].filter(Boolean).join('');
    const ou = !fait && this.marquesSucces(s).tags.length + this.marquesSucces(s).points.length > 0;
    const epingle = Q.epingles.includes(id);
    return `<div class="su2 ${fait ? 'ok' : ''} ${rec ? 'rec' : ''} ${this.succesVu === id ? 'vu' : ''}" data-sid="${id}">
      <img class="ic" src="assets/ui/succes/a_${s.icone}.webp" alt="">
      <div class="co"><div class="hd"><b>${s.nom}</b></div><div class="sub">${s.description}</div>${obs}
        ${!fait ? `<div class="sp2"><i style="width:${Math.round(Q.avancement(id) * 100)}%"></i></div>` : ''}${rw ? `<div class="rw">${rw}</div>` : ''}</div>
      <div class="side"><span class="pt">${s.points} pt${s.points > 1 ? 's' : ''}</span>
        ${rec ? `<span class="btn" data-rec="${id}">Récupérer</span>` : fait ? '<span class="eta">✓ Obtenu</span>'
          : `${ou ? `<span class="lien" data-ou="${id}">📍 Où ?</span>` : ''}<span class="lien ${epingle ? 'on' : ''}" data-epi="${id}">${epingle ? '★ Épinglé' : '☆ Épingler'}</span>`}</div></div>`;
  }
  private lierSucces(l: HTMLElement) {
    const Q = this.world.quetes!;
    l.querySelectorAll<HTMLElement>('[data-rec]').forEach(e => e.addEventListener('click', () => { if (Q.recuperer(e.dataset.rec!)) this.changed(); }));
    l.querySelectorAll<HTMLElement>('[data-epi]').forEach(e => e.addEventListener('click', () => { Q.epingler(e.dataset.epi!); this.changed(); }));
    l.querySelectorAll<HTMLElement>('[data-ou]').forEach(e => e.addEventListener('click', () => {
      const s = Q.data.succes[e.dataset.ou!], m = this.marquesSucces(s);
      this.close(false); this.onCarte({ titre: s.nom, icone: 0, img: `assets/ui/succes/a_${s.icone}.webp`, ...m });
    }));
    l.querySelectorAll<HTMLElement>('[data-va]').forEach(e => e.addEventListener('click', ev => { ev.stopPropagation(); this.ouvrirSucces(e.dataset.va!); }));
    l.querySelectorAll<HTMLElement>('[data-c2]').forEach(e => e.addEventListener('click', () => { this.succesCat = e.dataset.c2!; this.render(); }));
    l.querySelector<HTMLSelectElement>('[data-titre]')?.addEventListener('change', e => { Q.titreChoisi = (e.target as HTMLSelectElement).value; this.changed(); });
    l.querySelectorAll<HTMLElement>('[data-orn]').forEach(e => e.addEventListener('click', () => { Q.ornementChoisi = +e.dataset.orn!; this.changed(); }));
    l.querySelectorAll<HTMLElement>('[data-rtip]').forEach(e => {
      const r = ITEMS.resources[e.dataset.rtip!], eq = ITEMS.equipment[e.dataset.rtip!];
      e.addEventListener('mouseenter', ev => { if (!r && !eq) return; this.tip.innerHTML = r ? this.resTip(r, e.dataset.rtip!) : this.equipFabTip(e.dataset.rtip!); this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
    });
  }
  /** « Où ? » (4D) : cartes de la sous-zone, des monstres demandés (sous-zones où ils vivent) et entrées des donjons. */
  private marquesSucces(s: SuccesDef): { tags: string[]; points: { x: number; y: number }[] } {
    const w = this.world, wg = w.worldGrid, open = w.zone.open;
    if (!wg || !open) return { tags: [], points: [] };
    const subs = new Set<number>(), points: { x: number; y: number }[] = [], donjons = new Set<string>();
    for (const o of s.objectifs) {
      if ('sousZone' in o) subs.add(o.sousZone);
      if ('donjon' in o) donjons.add(o.donjon);
      if ('defi' in o) donjons.add(o.defi[0]);
      if ('monstre' in o && !this.world.quetes!.objectifSuccesFait(o)) {
        for (const [k, sa] of Object.entries(open.subareas)) if (sa.monsters.includes(o.monstre) || sa.elite === o.monstre) subs.add(+k);
        for (const d of open.donjons ?? []) if (Object.values(d.salles).some(g => g.some(x => x.includes(o.monstre)))) donjons.add(d.nom);
      }
    }
    for (const d of donjons) { const po = w.entreeDonjon(d); if (po) points.push({ x: po.ends[0].x, y: po.ends[0].y }); }
    const tags = wg.world.maps.filter(m => !m.inside && subs.has(m.sub) && /^-?\d+_-?\d+$/.test(m.tag)).map(m => m.tag);
    return { tags, points };
  }

  /** Réglages façon « Options » de Dofus 3 (demande de Mathis, 2026-11-06) : catégories à gauche avec recherche,
   *  sections à droite avec leur « Réinitialiser », cases vertes. Contenu : choix 10A + 10B (ambiance), maquette Aperçu (sorts),
   *  maquette Son (8A volumes, 8B touche M). Tout est gardé dans le navigateur. */
  private optRecherche = '';
  /** Guide (touche G) : rubrique affichée et recherche. */
  private guideVue = 'bienvenue';
  private guideRecherche = '';

  /** Guide façon Dofus 3 (le « Guide de Sanstour » montré par Mathis) : rubriques à gauche, une page à droite, recherche.
   *  Remplace le texte d'aide qui s'affichait sur l'écran. */
  private renderGuide() {
    const w = this.win!, cls = this.world.player.cls, jauge = cls.rage.name, mob = cls.spells[cls.mobility]?.name ?? 'déplacement';
    const iop = cls.rage.mode === 'melee';
    const k = (t: string) => `<b class="k">${t}</b>`;
    // touches choisies dans Options › Touches (Réglages 3A), écrites selon le clavier
    const T = (id: string) => k(Touches.nomAction(id) || '—'), dr = this.reglages.deplacement === 'droit';
    const cG = dr ? 'Clic droit' : 'Clic gauche', cD = dr ? 'Clic gauche' : 'Clic droit';
    const PAGES: { id: string; titre: string; html: string }[] = [
      { id: 'bienvenue', titre: 'Bienvenue', html: `<p class="chapo">Explore le Monde des Douze, rencontre ses habitants et combats en temps réel : tes déplacements et tes sorts se jouent sans attendre.</p>
        <h3>Un monde à parcourir</h3><p>Passe d'une carte à l'autre sans chargement, entre dans les maisons par leurs portes et parle aux PNJ en cliquant dessus. La mini-carte en haut à droite montre les monstres (points rouges), les PNJ qui ont une quête (points verts) et ta destination (point doré).</p>
        <h3>Ton but</h3><p>Suis la quête affichée en bas à gauche. Une flèche au bord de l'écran (verte, bleue pour les quêtes répétables) montre le chemin : la porte, le portail ou le Zaap à prendre, avec le nom du but et la distance en cartes. Clic sur le titre de la quête pour en suivre une autre, sur ses objectifs pour voir le but sur la carte. Un losange vert flotte au-dessus des monstres qui comptent pour tes quêtes, et le Zaap le plus proche du but porte une étoile.</p>` },
      { id: 'combat', titre: 'Se déplacer et combattre', html: `<h3>À la souris</h3><p>${k(cG)} sur le sol : y aller (maintenu : suivre le curseur). Sur un monstre : s'approcher et l'attaquer.</p>
        <p>${k(`Maj + ${cG.toLowerCase()}`)} : attaquer sur place, sans bouger.</p><p>${k(cD)} : lancer le sort de la case libre de la barre. ${k('Clic droit')} sur un PNJ : ses actions.</p>
        <h3>Esquiver</h3><p>${T('deplacement')} : ${mob}. Il a des charges qui se rechargent toutes seules.</p>
        <h3>Se soigner</h3><p>${T('potion')} : boire une potion. Chaque groupe de monstres vaincu en rend une.</p>
        <h3>Mourir</h3><p>Tu reviens au dernier point de retour. En mode Hardcore, la mort est définitive.</p>` },
      { id: 'sorts', titre: `Sorts et ${jauge}`, html: `<h3>La barre de sorts</h3><p>${[1, 2, 3, 4, 5, 6].map(i => T(`sort${i}`)).join(' ')} lancent les 6 sorts de la barre (Options › Touches pour les changer). Chaque sort coûte des PA, qui remontent tout seuls, et a sa recharge.</p>
        <p>${T('sorts')} ouvre la fenêtre des sorts : de nouveaux sorts arrivent aux niveaux officiels de Dofus. Glisse-les dans la barre.</p>
        <h3>${jauge}</h3><p>${iop ? 'La Rage monte quand tu frappes, surtout au corps à corps, et quand tu es touché.' : 'La Précision monte quand tu touches, surtout de loin (plus de 4 cases).'} Pleine, elle renforce ton prochain sort.</p>
        <p>Dans ${T('options')} Options, tu peux choisir comment lancer un sort : relâcher la touche, tout de suite, ou comme dans Dofus (touche puis clic).</p>` },
      { id: 'butin', titre: 'Inventaire et butin', html: `<h3>Ramasser</h3><p>Clique sur un objet au sol pour le ramasser. Les objets Épiques et mieux apparaissent aussi sur la mini-carte.</p>
        <h3>Raretés</h3><p>${(['commun', 'rare', 'epique', 'legendaire', 'mythique'] as const).map(r => `<span style="color:${RARITY_COLORS[r]}">${RARITY_NAMES[r]}</span>`).join(' · ')}</p>
        <h3>S'équiper</h3><p>${T('inventaire')} ouvre l'inventaire. Clic droit sur un objet : l'équiper ou le retirer. Les objets en trop se recyclent chez Kerubim Crépin, ou se brisent en runes chez Malek.</p>
        <p>${T('caracs')} ouvre les caractéristiques : chaque niveau donne 5 points à placer.</p>` },
      { id: 'havresac', titre: 'Le Havre-Sac', html: `<p>${T('havresac')} (ou l'icône du sac dans la colonne de menus) : 1,5 s d'incantation et tu entres dans ton Havre-Sac, ton monde de poche. Bouger ou être touché coupe l'incantation. Impossible dans un donjon ou poursuivi par des monstres.</p>
        <p>Le Poutch Ingball compte tes dégâts par seconde, et Kerubim Crépin y garde un guichet de recyclage. ${T('havresac')} à nouveau te ramène là où tu étais ; l'arche est un Zaap vers le Bastion des Douze et tous ceux que tu as découverts.</p>` },
      { id: 'zaaps', titre: 'Les Zaaps', html: `<p>Clique sur l'arche d'un Zaap : ton perso s'en approche et la liste s'ouvre. Le voyage est gratuit, vers le Bastion des Douze et tous les Zaaps que tu as découverts, rangés par zone.</p>
        <p>Il suffit de passer sur la carte d'un Zaap pour le découvrir : il devient aussi ton point de retour si tu tombes. Ceux que tu n'as pas encore vus sont grisés dans la liste et éteints sur la carte (${T('carte')}).</p>` },
      { id: 'bastion', titre: 'Le Bastion des Douze', html: `<p>Notre ville, en archipel au-dessus du Monde des Douze. On y va par n'importe quel Zaap (il est en tête de liste), par l'arche du Havre-Sac, ou avec une Potion de Rappel. Son Zaap te ramène ensuite là où tu étais.</p>
        <p>Les PNJ de service y vivent : Kerubim Crépin recycle tes objets en Pépites, Tissebelle vend les apparats et tient le miroir, Otomaï ses potions, Mère Bouillotte ses plats, Goultard les clés de donjon. Certains emménagent au fil de ton aventure. Chaque nation libérée y ajoutera son île.</p>` },
      { id: 'metiers', titre: 'Métiers', html: `<p>${T('metiers')} ouvre les métiers. Le Chasseur récupère de la viande sur les monstres quand tu portes une arme de chasse, et cuisine des plats qui soignent.</p>` },
      { id: 'quetes', titre: 'Quêtes et succès', html: `<p>Un PNJ qui a une quête porte une icône au-dessus de la tête. Le suivi en bas à gauche montre l'étape en cours.</p>
        <p>Le journal des quêtes et les succès s'ouvrent depuis la colonne de menus, à droite de l'écran.</p>` },
      { id: 'touches', titre: 'Toutes les touches', html: `<div class="keys">${[[cG, 'aller / attaquer (maintenu : continuer)'], [`Maj + ${cG.toLowerCase()}`, 'attaquer sur place'], [cD, 'sort de la barre (case libre)'],
          ...Touches.ACTIONS.filter(a => (a.id !== 'dofus' || this.world.player.v03) && Touches.nomAction(a.id)).map(a => [Touches.nomAction(a.id), a.nom.toLowerCase()]),
          ['Molette', 'zoom'], ['Échap', 'fermer, menu']]
          .map(([a, b]) => `<b>${a}</b><span>${b}</span>`).join('')}</div>` },
    ];
    const q = this.guideRecherche.trim().toLowerCase();
    const texte = (h: string) => h.replace(/<[^>]+>/g, ' ').toLowerCase();
    const vues = PAGES.filter(pg => !q || `${pg.titre} ${texte(pg.html)}`.toLowerCase().includes(q));
    const vu = vues.find(pg => pg.id === this.guideVue) ?? vues[0];
    const nav = vues.map(pg => `<div class="it ${pg === vu ? 'on' : ''}" data-page="${pg.id}">${pg.titre}</div>`).join('') || '<div class="vide">Rien ne correspond.</div>';
    w.innerHTML = `${this.title('Guide', 'guide')}<div class="ob">
      <div class="nav"><input type="search" placeholder="Rechercher dans le guide" value="${this.guideRecherche.replace(/"/g, '&quot;')}" data-cherche><div class="cats">${nav}</div></div>
      <div class="main">${vu ? `<div class="grp"><h2>${vu.titre}</h2><div class="page">${vu.html}</div></div>` : ''}</div></div>`;
    w.querySelectorAll<HTMLElement>('[data-page]').forEach(e => e.addEventListener('click', () => { this.guideVue = e.dataset.page!; this.render(); }));
    const ch = w.querySelector<HTMLInputElement>('[data-cherche]')!;
    ch.addEventListener('input', () => { this.guideRecherche = ch.value; this.render(); const n = this.win?.querySelector<HTMLInputElement>('[data-cherche]'); n?.focus(); n?.setSelectionRange(n.value.length, n.value.length); });
    ch.addEventListener('keydown', e => e.stopPropagation());
  }
  /** Menu principal façon Dofus 3 (Échap quand aucune fenêtre n'est ouverte) : le jeu continue derrière, comme les autres fenêtres. */
  private renderMenu() {
    const w = this.win!, perso = !!this.onAccueil;
    w.innerHTML = `<div class="ttl"><b>Menu principal</b><span class="x" data-close title="Fermer (Échap)"></span></div>
      <div class="mp">
        <div class="grp">${perso ? '<span class="mb" data-m="persos">Changer de personnage</span>' : '<span class="mb off" title="Partie sans personnage">Changer de personnage</span>'}</div>
        <div class="grp"><span class="mb" data-m="opt"><img src="assets/ui/menu/options.png" alt="">Options</span>
          <span class="mb" data-m="accueil" title="La partie est sauvegardée"><svg viewBox="0 0 20 20"><path d="M11 3H4v14h7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10h10m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="2"/></svg>Déconnecter</span></div>
        <div class="grp"><span class="mb jeu" data-m="jeu">Revenir au jeu</span></div>
      </div>`;
    w.querySelectorAll<HTMLElement>('[data-m]').forEach(e => e.addEventListener('click', () => {
      const m = e.dataset.m;
      if (m === 'opt') this.show('opt');
      else if (m === 'jeu') this.close();
      else { this.close(); this.onMenu?.(m as 'persos' | 'accueil'); }
    }));
  }

  /** Aides dépliées (Réglages 10A : petite flèche à droite de l'option). */
  private optAides = new Set<string>();
  /** Fenêtre des touches (Réglages 3A) ouverte, action qui attend sa nouvelle touche, message (doublon, touche réservée). */
  private touchesVue = false;
  private touchesEcoute: string | null = null;
  private touchesMsg = '';
  /** Vrai pendant qu'on choisit une touche : la scène n'y réagit pas. */
  /** Options ouvertes depuis l'écran d'accueil (11A) : les fenêtres passent devant lui jusqu'à leur fermeture. */
  devant() { this.root.style.zIndex = '30'; }
  get capteTouches() { return this.touchesVue && this.mode === 'opt' && !!this.win; }
  private renderOpt() {
    const w = this.win!, r = this.reglages;
    const vieux = w.querySelector<HTMLElement>('.main')?.scrollTop ?? 0;   // la page garde sa place quand une option la redessine
    const heures: [string, string][] = [['auto', 'Heure du PC'], ['jour', 'Jour'], ['soir', 'Soir'], ['nuit', 'Nuit']];
    type Opt = { k: string; nom: string; aide?: string } & ({ t: 'range'; min: number; max: number; unite?: string } | { t: 'check' } | { t: 'select'; choix: [string, string][] });
    type Sec = { id: string; titre: string; opts: Opt[]; html?: string; reset?: () => void };
    const T = (id: string) => Touches.nomAction(id) || 'aucune touche';
    const droit = r.deplacement === 'droit';
    const GROUPES: { nom: string; desc: string; secs: Sec[] }[] = [
      { nom: 'Interface', desc: 'Ces options règlent la façon de jouer et ce que l\'écran montre en jeu.', secs: [
        { id: 'general', titre: 'Général', opts: [
          { k: 'lancer', nom: 'Lancer un sort', t: 'select', choix: [['relache', 'Maintenir pour voir, relâcher pour lancer'], ['immediat', 'Tout de suite (aperçu avec Alt)'], ['dofus', 'Comme Dofus : touche puis clic']] },
          { k: 'approche', nom: 'Monstre hors de portée : s\'approcher avant de lancer', t: 'check' },
          { k: 'juice', nom: 'Effets d\'impact (tremblement, gel d\'image)', aide: `Touche ${T('impact')}.`, t: 'check' },
          { k: 'flecheQuete', nom: 'Aides de quête', aide: 'Flèche au bord de l\'écran et sur la mini-carte, losange sur les monstres de quête, Zaap conseillé. Clic sur le titre du suivi : changer de quête ; sur ses objectifs : la carte.', t: 'check' },
          { k: 'chiffres', nom: 'Chiffres de dégâts', aide: 'Les dégâts donnés et reçus, au-dessus des monstres et de ton perso.', t: 'check' },
          { k: 'tailleChiffres', nom: 'Taille des chiffres', t: 'select', choix: [['petite', 'Petite'], ['normale', 'Normale'], ['grande', 'Grande']] },
          { k: 'dps', nom: 'Compteur de dégâts par seconde', aide: 'Petit cadre sous la mini-carte. Il repart de zéro quand tu n\'as touché personne pendant 4 s.', t: 'check' },
          { k: 'barresVie', nom: 'Barres de vie des monstres', t: 'select', choix: [['blesses', 'Monstres blessés'], ['toujours', 'Toujours'], ['survol', 'Monstre survolé']] },
          { k: 'zoomMolette', nom: 'Zoom à la molette de la souris', t: 'check' },
          { k: 'deplacement', nom: 'Bouton de déplacement', aide: `L'autre bouton lance le sort de la case « ${droit ? 'Clic G' : 'Clic D'} » de la barre. Le clic droit sur un PNJ ouvre toujours ses actions.`, t: 'select', choix: [['gauche', 'Clic gauche'], ['droit', 'Clic droit']] },
        ], html: '<div class="obtns"><span class="btn" data-obtn="zoom">Remettre le zoom de départ</span></div>' },
        { id: 'touches', titre: 'Touches', opts: [
          { k: 'clavier', nom: 'Clavier', aide: `Détecté : ${Touches.clavier() === 'azerty' ? 'AZERTY' : 'QWERTY'}. Les touches restent à la même place sur le clavier, seul leur nom change.`, t: 'select', choix: [['auto', 'Détecté tout seul'], ['azerty', 'AZERTY'], ['qwerty', 'QWERTY']] },
        ], reset: () => { r.touches = {}; r.clavier = 'auto'; },
          html: `<div class="obtns"><span class="btn" data-obtn="touches">Configurer les touches</span><span class="btn" data-obtn="rtouches">Réinitialiser les touches</span></div>
          <div class="keys">${[[droit ? 'Clic droit' : 'Clic gauche', 'aller / attaquer (maintenu : continuer)'], [`Maj + ${droit ? 'clic droit' : 'clic'}`, 'attaquer sur place'], [droit ? 'Clic gauche' : 'Clic droit', 'sort de la case « clic » de la barre'],
            [Touches.ACTIONS.slice(0, 6).map(a => Touches.nomAction(a.id)).join(' '), 'barre de sorts'], [T('deplacement'), 'déplacement'], [T('potion'), 'potion'], ['Alt', 'aperçu des sorts, noms'], ['Molette', 'zoom'], ['Échap', 'fermer, menu']]
            .map(([k, d]) => `<b>${k}</b><span>${d}</span>`).join('')}</div>` },
        { id: 'modules', titre: 'Modules d\'interface', opts: [
          { k: 'verrou', nom: 'Verrouiller la position des modules', aide: 'Décoche pour glisser le cadre du perso, la mini-carte, le suivi de quête et le compteur de dégâts où tu veux.', t: 'check' },
          { k: 'coords', nom: 'Afficher les coordonnées de la carte', aide: 'Sous la mini-carte, comme [6,-19].', t: 'check' },
        ], reset: () => { r.verrou = true; r.coords = true; r.modules = {}; }, html: '<div class="obtns"><span class="btn" data-obtn="modules">Réinitialiser l\'affichage</span></div>' },
        { id: 'ambiance', titre: 'Ambiance du monde', opts: [
          { k: 'heure', nom: 'Heure', aide: `En ce moment : ${this.heureNom()}`, t: 'select', choix: heures },
          { k: 'lumieres', nom: 'Lumières (halos, feux)', t: 'range', min: 0, max: 200 },
          { k: 'saturation', nom: 'Couleurs (moins = adouci)', t: 'range', min: 50, max: 120 },
          { k: 'chaleur', nom: 'Chaleur de la lumière', t: 'range', min: -100, max: 100, unite: '' },
        ] },
      ] },
      { nom: 'Affichage', desc: 'Ces options règlent l\'image du jeu. Sur un petit PC, la qualité Basse ou Moyenne rend le jeu plus fluide.', secs: [
        { id: 'ecran', titre: 'Écran', opts: [
          { k: 'pleinEcran', nom: 'Mode d\'affichage', aide: 'F11 passe aussi le navigateur en plein écran.', t: 'select', choix: [['fenetre', 'Fenêtré'], ['plein', 'Plein écran']] },
          { k: 'echelle', nom: 'Échelle de l\'interface', t: 'range', min: 80, max: 150 },
        ], reset: () => { r.echelle = 1; } },
        { id: 'graphismes', titre: 'Graphismes', opts: [
          { k: 'qualite', nom: 'Qualité prédéfinie', aide: 'Basse : sans vent, eau animée ni particules, lumières douces, 30 images par seconde. Moyenne : sans particules, 60 images. Haute : tout, sans limite.', t: 'select', choix: [['basse', 'Basse'], ['moyenne', 'Moyenne'], ['haute', 'Haute'], ['perso', 'Personnalisée']] },
          { k: 'fps', nom: 'Images par seconde', t: 'select', choix: [['30', '30'], ['60', '60'], ['120', '120'], ['0', 'Sans limite']] },
          { k: 'compteurFps', nom: 'Afficher le compteur d\'images (FPS)', aide: `Dans le coin de la mini-carte.${Touches.nomAction('fps') ? ` Touche ${Touches.nomAction('fps')}.` : ''}`, t: 'check' },
          { k: 'zoom', nom: 'Zoom de départ', t: 'range', min: 55, max: 120 },
          { k: 'vent', nom: 'Arbres au vent', t: 'check' },
          { k: 'eau', nom: 'Eau animée', t: 'check' },
          { k: 'transparence', nom: 'Voir à travers le décor', aide: 'Le décor devant ton perso s\'efface, les monstres cachés ont une silhouette rouge.', t: 'check' },
          { k: 'particules', nom: 'Particules (spores, braises…)', t: 'check' },
        ] },
      ] },
      { nom: 'Son', desc: `Ces options règlent la musique et les sons du jeu. ${T('muet')} coupe ou remet tout le son.`, secs: [
        { id: 'son', titre: 'Général', opts: [
          { k: 'muet', nom: 'Couper tout le son', aide: T('muet'), t: 'check' },
          { k: 'volume', nom: 'Volume général', t: 'range', min: 0, max: 100 },
          { k: 'volMusique', nom: 'Musique', t: 'range', min: 0, max: 100 },
          { k: 'volEffets', nom: 'Effets (sorts, coups)', t: 'range', min: 0, max: 100 },
          { k: 'volMonstres', nom: 'Monstres (cris)', t: 'range', min: 0, max: 100 },
          { k: 'volAmbiance', nom: 'Ambiance (vent, eau, feu, Zaap)', t: 'range', min: 0, max: 100 },
          { k: 'volInterface', nom: 'Interface (fenêtres, niveau, quêtes)', t: 'range', min: 0, max: 100 },
          { k: 'musiqueBoss', nom: 'Musique de combat des boss', aide: 'Sinon, la musique de la zone continue pendant les combats de boss.', t: 'check' },
        ] },
      ] },
      { nom: 'Alertes', desc: 'Ces options règlent ce qui te prévient pendant que tu joues.', secs: [
        { id: 'alertes', titre: 'Alertes', opts: [
          { k: 'alerteButin', nom: 'Son quand un objet Épique ou mieux tombe', t: 'check' },
          { k: 'pulsePv', nom: 'Bords de l\'écran qui battent en rouge sous 25 % de PV', t: 'check' },
        ] },
      ] },
    ];
    const R = r as unknown as Record<string, unknown>;
    const val = (k: string): unknown => k === 'juice' ? this.juice.get() : k === 'pleinEcran' ? (document.fullscreenElement ? 'plein' : 'fenetre') : k === 'fps' ? String(r.fps ?? 0) : R[k];
    const q = this.optRecherche.trim().toLowerCase();
    const garde = (o: Opt) => !q || `${o.nom} ${o.aide ?? ''}`.toLowerCase().includes(q);
    const ligne = (o: Opt) => {
      const ouvert = this.optAides.has(o.k) || (!!q && !!o.aide);
      const fl = o.aide ? `<i class="fl ${ouvert ? 'on' : ''}" data-aide="${o.k}" title="Aide"></i>` : '<i></i>';
      const aide = o.aide && ouvert ? `<small>${o.aide}</small>` : '';
      if (o.t === 'check') return `<label class="row ck ${val(o.k) ? 'on' : ''}"><input type="checkbox" data-ck="${o.k}" ${val(o.k) ? 'checked' : ''}><span>${o.nom}${aide}</span>${fl}</label>`;
      if (o.t === 'select') return `<label class="row"><span>${o.nom}${aide}</span><select data-sel="${o.k}">${o.choix.map(([k, n]) => `<option value="${k}" ${val(o.k) === k ? 'selected' : ''}>${n}</option>`).join('')}</select>${fl}</label>`;
      const n = Math.round((val(o.k) as number) * 100);
      return `<label class="row"><span>${o.nom}${aide}</span><input type="range" data-rg="${o.k}" min="${o.min}" max="${o.max}" value="${n}" style="--v:${(n - o.min) / (o.max - o.min) * 100}%"><output data-o="${o.k}">${n}${o.unite ?? '%'}</output>${fl}</label>`;
    };
    const RESET = '<i class="rs"></i>';
    const main = GROUPES.map(g => {
      const secs = g.secs.map(s => {
        const lignes = s.opts.filter(garde);
        if (q && !lignes.length && !s.titre.toLowerCase().includes(q)) return '';
        return `<div class="sec" id="opt-${s.id}"><div class="sh"><b>${s.titre}</b>${s.opts.length || s.reset ? `<span class="lien" data-reset="${s.id}">${RESET} Réinitialiser</span>` : ''}</div>${lignes.map(ligne).join('')}${s.html ?? ''}</div>`;
      }).join('');
      return secs ? `<div class="grp"><h2>${g.nom}</h2><div class="desc">${g.desc}</div>${secs}</div>` : '';
    }).join('') || '<div class="vide">Aucune option ne correspond à la recherche.</div>';
    const nav = GROUPES.map(g => `<div class="cat">${g.nom}</div>${g.secs.map(s => `<div class="it" data-va="${s.id}">${s.titre}</div>`).join('')}`).join('');
    // Réglages 3A : la fenêtre des touches, par-dessus les Options
    const dbl = Touches.doublons();
    const tw = this.touchesVue ? `<div class="tw"><div class="twt"><b>Touches</b><span class="x" data-tfermer title="Fermer"></span></div>
      <p>Clique sur une touche, puis appuie sur la nouvelle (Alt + touche ou Ctrl + touche possibles). Échap annule, Suppr ou Retour arrière retire la touche.</p>
      <div class="tg">${[...new Set(Touches.ACTIONS.map(a => a.groupe))].map(gp => `<h4>${gp}</h4>${Touches.ACTIONS.filter(a => a.groupe === gp).map(a =>
        `<div class="tl"><span>${a.nom}</span><button class="tk ${this.touchesEcoute === a.id ? 'ecoute' : ''} ${dbl.has(a.id) ? 'dbl' : ''} ${a.id in r.touches ? 'perso' : ''}" data-tk="${a.id}">${this.touchesEcoute === a.id ? 'Appuie sur une touche…' : Touches.nomAction(a.id) || '—'}</button></div>`).join('')}`).join('')}</div>
      <div class="tmsg">${this.touchesMsg || (dbl.size ? 'Une même touche sert à deux actions (en rouge) : seule la première marche.' : '')}</div>
      <div class="tb"><span class="btn" data-obtn="rtouches">Réinitialiser</span><span class="btn vert" data-tfermer>Fermer</span></div></div>` : '';
    w.innerHTML = `${this.title('Options', 'options')}<div class="ob">
      <div class="nav"><input type="search" placeholder="Rechercher" value="${this.optRecherche.replace(/"/g, '&quot;')}" data-cherche><div class="cats">${nav}</div>
        <div class="bas"><span class="lien" data-tout>${RESET} Tout réinitialiser</span>${this.onAccueil ? '<span class="lien" data-accueil>Sauvegarder et revenir à l\'accueil</span>' : ''}</div></div>
      <div class="main"><div class="otabs"><span class="on">Options générales</span></div>${main}</div></div>${tw}`;
    const apply = () => { sauverReglages(r); this.onReglages(r); };
    const mainEl = w.querySelector<HTMLElement>('.main')!;
    // 1A : une seule page qui défile ; le menu de gauche s'allume sur la rubrique visible
    const suivre = () => {
      let cur = '';
      for (const sec of Array.from(mainEl.querySelectorAll<HTMLElement>('.sec'))) if (sec.offsetTop - mainEl.offsetTop - 40 <= mainEl.scrollTop) cur = sec.id.slice(4);
      if (!cur) cur = mainEl.querySelector<HTMLElement>('.sec')?.id.slice(4) ?? '';
      if (mainEl.scrollTop + mainEl.clientHeight >= mainEl.scrollHeight - 4) cur = Array.from(mainEl.querySelectorAll<HTMLElement>('.sec')).pop()?.id.slice(4) ?? cur;
      w.querySelectorAll<HTMLElement>('.nav .it').forEach(x => x.classList.toggle('on', x.dataset.va === cur));
    };
    mainEl.scrollTop = vieux; mainEl.addEventListener('scroll', suivre); suivre();
    // 7B : une qualité prédéfinie règle plusieurs options ; en changer une à la main passe en « Personnalisée »
    const preset = () => {
      const k = (Object.keys(QUALITES) as (keyof typeof QUALITES)[]).find(n => Object.entries(QUALITES[n]).every(([c, v]) => R[c] === v));
      r.qualite = k ?? 'perso';
    };
    const PRESET = new Set(['vent', 'eau', 'particules', 'lumieres', 'fps']);
    w.querySelectorAll<HTMLInputElement>('[data-rg]').forEach(e => {
      const k = e.dataset.rg!;
      e.addEventListener('input', () => { R[k] = +e.value / 100; e.style.setProperty('--v', `${(+e.value - +e.min) / (+e.max - +e.min) * 100}%`); w.querySelector(`[data-o="${k}"]`)!.textContent = `${e.value}${k === 'chaleur' ? '' : '%'}`; if (PRESET.has(k)) preset(); apply(); });
      // 8A : aperçu sonore quand on lâche le curseur ; l'échelle de l'interface redessine la fenêtre à sa nouvelle taille
      e.addEventListener('change', () => { if (k === 'volEffets') Son.jouer(MANIFESTE.impacts[0], 'effets'); else if (k === 'volMonstres') { const l = Object.values(MANIFESTE.monstres)[0]?.attaque; Son.jouer(Son.auHasard(l), 'monstres'); } else if (k === 'volInterface' || k === 'volume') Son.jouer(MANIFESTE.ui.ok, 'interface'); else if (k === 'lumieres') this.render(); });
    });
    w.querySelectorAll<HTMLSelectElement>('[data-sel]').forEach(e => e.addEventListener('change', () => {
      const k = e.dataset.sel!;
      if (k === 'pleinEcran') {
        const p = e.value === 'plein' ? document.documentElement.requestFullscreen?.() : document.fullscreenElement ? document.exitFullscreen?.() : undefined;
        Promise.resolve(p).catch(() => {}).finally(() => this.refresh()); return;
      }
      if (k === 'fps') { r.fps = +e.value; preset(); }
      else if (k === 'qualite') { if (e.value !== 'perso') Object.assign(r, QUALITES[e.value as keyof typeof QUALITES]); r.qualite = e.value as Reglages['qualite']; }
      else R[k] = e.value;
      if (k === 'clavier') Touches.regler(r.clavier);
      apply(); this.render();
    }));
    w.querySelectorAll<HTMLInputElement>('[data-ck]').forEach(e => e.addEventListener('change', () => {
      const k = e.dataset.ck!;
      if (k === 'juice') this.juice.set(e.checked); else { R[k] = e.checked; if (PRESET.has(k)) preset(); apply(); }
      e.closest('.row')!.classList.toggle('on', e.checked);
      if (PRESET.has(k)) this.render();
    }));
    // 10A : la petite flèche déplie l'aide de l'option
    w.querySelectorAll<HTMLElement>('[data-aide]').forEach(e => e.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      const k = e.dataset.aide!; if (this.optAides.has(k)) this.optAides.delete(k); else this.optAides.add(k);
      this.render();
    }));
    const defaut = REGLAGES_DEFAUT as unknown as Record<string, unknown>;
    const copie = (v: unknown) => v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
    const reset = (s: Sec) => { for (const o of s.opts) { if (o.k === 'juice') this.juice.set(true); else if (o.k in defaut) R[o.k] = copie(defaut[o.k]); } s.reset?.(); };
    w.querySelectorAll<HTMLElement>('[data-reset]').forEach(e => e.addEventListener('click', () => {
      const s = GROUPES.flatMap(g => g.secs).find(x => x.id === e.dataset.reset); if (s) reset(s);
      Touches.regler(r.clavier); apply(); this.render();
    }));
    w.querySelector('[data-tout]')!.addEventListener('click', () => { GROUPES.forEach(g => g.secs.forEach(reset)); Touches.regler(r.clavier); apply(); this.render(); });
    w.querySelectorAll<HTMLElement>('[data-va]').forEach(e => e.addEventListener('click', () => {
      const sec = w.querySelector<HTMLElement>(`#opt-${e.dataset.va}`); if (!sec) return;
      mainEl.scrollTo({ top: sec.offsetTop - mainEl.offsetTop - 8, behavior: 'smooth' });
    }));
    w.querySelectorAll<HTMLElement>('[data-obtn]').forEach(e => e.addEventListener('click', () => {
      const b = e.dataset.obtn;
      if (b === 'zoom') { apply(); return; }   // la scène remet le zoom de départ à chaque changement de réglages
      if (b === 'touches') { this.touchesVue = true; this.touchesEcoute = null; this.touchesMsg = ''; }
      if (b === 'rtouches') { r.touches = {}; this.touchesEcoute = null; this.touchesMsg = ''; apply(); }
      if (b === 'modules') { r.modules = {}; apply(); }
      this.render();
    }));
    w.querySelectorAll<HTMLElement>('[data-tfermer]').forEach(e => e.addEventListener('click', () => { this.touchesVue = false; this.touchesEcoute = null; this.touchesMsg = ''; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-tk]').forEach(e => e.addEventListener('click', () => { this.touchesEcoute = e.dataset.tk!; this.touchesMsg = ''; this.render(); }));
    w.querySelector('.tw')?.addEventListener('pointerdown', ev => ev.stopPropagation());
    const ch = w.querySelector<HTMLInputElement>('[data-cherche]')!;
    ch.addEventListener('input', () => { this.optRecherche = ch.value; this.render(); const n = this.win?.querySelector<HTMLInputElement>('[data-cherche]'); n?.focus(); n?.setSelectionRange(n.value.length, n.value.length); });
    ch.addEventListener('keydown', e => e.stopPropagation());
    w.querySelector('[data-accueil]')?.addEventListener('click', () => { this.close(); this.onAccueil?.(); });
  }
  /** Fenêtre des touches : la touche pressée devient celle de l'action choisie (écouteur en capture, avant le jeu). */
  private captureTouche = (e: KeyboardEvent) => {
    // Options ouvertes depuis l'écran d'accueil (la partie derrière n'écoute pas le clavier) : Échap les ferme
    if (!this.capteTouches) { if (e.code === 'Escape' && this.root.style.zIndex && this.win) { e.stopPropagation(); this.close(); } return; }
    const id = this.touchesEcoute;
    e.preventDefault(); e.stopPropagation();
    if (e.code === 'Escape') {
      if (id) { this.touchesEcoute = null; this.touchesMsg = ''; } else this.touchesVue = false;
      this.render(); return;
    }
    if (!id || e.repeat) return;
    const r = this.reglages;
    let c: string | null;
    if (e.code === 'Delete' || e.code === 'Backspace') c = '';
    else {
      c = Touches.combo(e); if (c == null) return;   // Maj, Alt ou Ctrl seuls : on attend la touche
      if (Touches.RESERVEES.has(e.code)) { this.touchesMsg = `${Touches.nomCode(e.code)} est gardée par le jeu.`; this.render(); return; }
    }
    if (c === Touches.parDefaut(id)) delete r.touches[id]; else r.touches = { ...r.touches, [id]: c };
    Touches.appliquer(r.touches);
    const autre = c ? Touches.ACTIONS.find(a => a.id !== id && Touches.touche(a.id) === c) : undefined;
    this.touchesMsg = autre ? `${Touches.nom(c)} sert aussi à « ${autre.nom} » : change l'une des deux.` : '';
    this.touchesEcoute = null;
    sauverReglages(r); this.onReglages(r); this.render();
  };

  /** Sort affiché dans la fiche de l'onglet Sorts, et grade montré. */
  private vu: number | null = null;
  private vuGrade = -1;
  /** Menu sorts (2026-11-10) : filtre d'étiquette (5B), rubrique « À venir » dépliée (1C), comparaison avec la variante (6A). */
  private sortsFiltre: string | null = null;
  private aVenirOuvert = false;
  private sortsCmp = false;
  /** Ouvre l'onglet Sorts sur un sort jouable (10D : clic sur une case de la barre). */
  ouvrirSort(id: SkillId) {
    const did = this.world.player.cls.spells[id]?.dofusId;
    if (did) { this.vu = did; this.vuGrade = -1; this.sortsCmp = false; this.sortsCodex = false; }
    if (this.win && this.mode === 'sorts') this.render(); else this.show('sorts');
  }
  /** Onglet Sorts (maquette « Menu sorts », 2026-11-10) : les paires officielles rangées par rôle (1A), celles qui ne sont pas
   *  encore à ta portée repliées dans « À venir » (1C), filtres d'étiquettes (5B) ; fiche avec le texte maison (2A, 3A, 4A),
   *  le schéma de zone (7A), le grade suivant (6B), la comparaison avec la variante (6A), les légendaires qui modifient
   *  le sort (10A) et la jauge de classe (10B). Clic sur l'autre sort d'une paire : on l'échange (un seul des deux). */
  private renderSorts() {
    const w = this.win!, p = this.world.player, pairs = p.pairs, cl = p.cls.sorts;
    const ico = (s: SortOfficiel) => `assets/ui/sorts/sort_${s.icon}.png`;
    const all = pairs.flat();
    const vu = all.find(s => s.id === this.vu) ?? pairs[0]?.[0];
    const txt = (s: SortOfficiel) => texteSort(cl, s.id);
    const ouvert = (s: SortOfficiel) => p.level >= p.requiredLevel(s);
    const montre = (i: number) => pairs[i][p.variants[i] ?? 0];
    const dispo = (i: number) => pairs[i].some(s => ouvert(s) && p.keyOf(s.id));
    // 5B : les étiquettes les plus courantes de la classe deviennent des filtres
    const compte = new Map<string, number>();
    for (const s of all) for (const e of txt(s)?.etiquettes ?? []) compte.set(e, (compte.get(e) ?? 0) + 1);
    const filtres = [...compte.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([e]) => e);
    if (this.sortsFiltre && !filtres.includes(this.sortsFiltre)) this.sortsFiltre = null;
    const garde = (i: number) => !this.sortsFiltre || pairs[i].some(s => txt(s)?.etiquettes.includes(this.sortsFiltre!));
    const ligne = (i: number) => {
      const s = montre(i), o = pairs[i].find(x => x !== s)!, t = txt(s), lock = !ouvert(s), key = p.keyOf(s.id);
      const drag = !lock && key ? `draggable="true" data-drag="${key}"` : '';
      const sous = lock ? `niveau ${p.requiredLevel(s)}` : !key ? `<span class="soon">bientôt jouable</span>` : escB(t?.accroche ?? '');
      return `<div class="sp ${lock ? 'lock' : ''} ${!lock && key ? 'on' : ''} ${vu?.id === s.id ? 'vu' : ''}" data-s="${s.id}" data-p="${i}" data-v="${pairs[i].indexOf(s)}" ${drag}>
        <img src="${ico(s)}" alt=""><span>${s.name}<small>${sous}</small></span>
        <img class="vv ${vu?.id === o.id ? 'vu' : ''}" src="${ico(o)}" alt="" title="Variante : ${o.name} (niveau ${p.requiredLevel(o)})" data-s="${o.id}" data-p="${i}" data-v="${pairs[i].indexOf(o)}"></div>`;
    };
    const idx = pairs.map((_, i) => i).filter(garde);
    const ici = idx.filter(dispo), plusTard = idx.filter(i => !dispo(i));
    const liste = `<div class="flt">${filtres.map(e => `<span data-f="${escB(e)}" class="${this.sortsFiltre === e ? 'on' : ''}">${escB(e)}</span>`).join('')}</div>`
      + ROLES_SORTS.map(([r, nom]) => { const l = ici.filter(i => (txt(montre(i))?.role ?? 'base') === r); return l.length ? `<div class="gh">${nom}</div>${l.map(ligne).join('')}` : ''; }).join('')
      + (plusTard.length ? `<div class="gh av" data-av>${this.aVenirOuvert ? '▾' : '▸'} À venir · ${plusTard.length}</div>${this.aVenirOuvert ? plusTard.map(ligne).join('') : ''}` : '');
    let fiche = '';
    if (vu) {
      const cur = gradeAuNiveau(vu, p.level), gi = this.vuGrade >= 0 && this.vuGrade < vu.grades.length ? this.vuGrade : vu.grades.indexOf(cur), g = vu.grades[gi];
      const key = p.keyOf(vu.id), mob = key === p.cls.mobility, d = key ? p.cls.spells[key] : null, t = txt(vu);
      const pi = pairs.findIndex(pr => pr.includes(vu)), autre = pairs[pi]?.find(x => x !== vu);
      const elOff = (g.element ?? d?.element ?? 'neutre') as Element;
      const col = '#' + (ELEMENT_COLORS[d?.element ?? elOff] ?? 0xe8e2d4).toString(16).padStart(6, '0');
      const el = (e?: string) => e ? e[0].toUpperCase() + e.slice(1) : '';
      let chips: [string, string][], liste2: string[] = [], jauge = '';
      if (key) {
        const x = spellDetail(p, key, mob ? undefined : g);
        chips = [['Coût', x.cost], ['Recharge', mob ? 'charges de PM' : x.cdS >= 1 ? `${n1(x.cdS)} s` : x.nCh >= 2 ? `${x.nCh} charges` : 'aucune'],
          ['Dommages', x.dmg ? x.dmg.replace(/^Dommages : /, '') : '—']];
        liste2 = [x.zone, ...x.extra.map(e => e.replace(/^(\d+) charges, chacune revient/, '$1 charges, chacune revient'))];
        jauge = x.rage;
      } else {
        chips = [['Coût', `${g.pa} PA`], ['Recharge', g.relance ? `${g.relance * 3} s` : g.parTour ? `${g.parTour} charge${g.parTour > 1 ? 's' : ''}` : 'aucune'],
          ['Dommages', g.dmg ? `<b>${Math.round(p.damage(dmgMoyen(g) * 1.5, g.element ?? 'neutre'))}</b> ${el(g.element)}` : '—']];
        liste2 = [g.po[1] === 0 ? 'Sur toi' : `Portée ${g.po[0] > 1 ? `${g.po[0]} à ` : ''}${g.po[1]} case${g.po[1] > 1 ? 's' : ''}`];
      }
      chips.push(['Niveau', String(p.requiredLevel(vu))]);
      // 6B : ce que le grade suivant apporte
      const nx = vu.grades[gi + 1];
      if (nx) {
        const dif: string[] = [];
        if (nx.dmg && g.dmg) { const k = Math.round((dmgMoyen(nx) / dmgMoyen(g) - 1) * 100); if (k) dif.push(`dommages ${k > 0 ? '+' : ''}${k} %`); }
        if (nx.po[1] !== g.po[1]) dif.push(`portée ${nx.po[1] > g.po[1] ? '+' : ''}${nx.po[1] - g.po[1]} case${Math.abs(nx.po[1] - g.po[1]) > 1 ? 's' : ''}`);
        if (nx.pa !== g.pa) dif.push(`coût ${nx.pa > g.pa ? '+' : '−'}${Math.abs(nx.pa - g.pa)} PA`);
        if (nx.relance !== g.relance) dif.push(`recharge ${nx.relance < g.relance ? '−' : '+'}${Math.abs(nx.relance - g.relance) * 3} s`);
        if (dif.length) liste2.push(`<span class="up">Grade ${gi + 2} au niveau ${nx.niv} : ${dif.join(', ')}</span>`);
      }
      // 10A : pouvoirs légendaires portés qui changent ce sort, et ceux gardés dans le Codex
      const legs: string[] = [];
      if (key) for (const it of Object.values(p.equipment)) for (const l of [it?.legendary, it?.legendary2]) {
        if (!l) continue;
        const vise = POUVOIR_PAR_ID[l.id]?.dofusId === vu.id || PC_PAR_ID[l.id]?.sort === key || (l.id === 'relance' && l.sort === key);
        if (!vise) continue;
        const { nom, texte } = lignePouvoir(l, d?.name, p.zoneSeule(key)), e = p.etatPouvoir(l.id);
        legs.push(`<div class="${e.actif ? '' : 'off'}"><b>${nom}</b> : ${texte}${e.actif ? '' : ` <i>(${e.raison})</i>`}</div>`);
      }
      const auCodex = p.v03 && p.codexOuvert ? p.codex.filter(e => POUVOIR_PAR_ID[e.id]?.dofusId === vu.id || (!!key && (PC_PAR_ID[e.id]?.sort === key || (e.id === 'relance' && e.sort === key)))).length : 0;
      // 6A : comparaison avec la variante
      const cmp = (() => {
        if (!this.sortsCmp || !autre) return '';
        const ga = gradeAuNiveau(vu, p.level), gb = gradeAuNiveau(autre, p.level);
        const lignes: [string, number, number, boolean, (v: number) => string][] = [
          ['Niveau', p.requiredLevel(vu), p.requiredLevel(autre), false, v => String(v)],
          ['Coût', ga.pa, gb.pa, false, v => `${v} PA`],
          ['Portée', ga.po[1], gb.po[1], true, v => v ? `${v} cases` : 'sur toi'],
          ['Dommages de base', dmgMoyen(ga), dmgMoyen(gb), true, v => v ? String(Math.round(v)) : '—'],
          ['Recharge', ga.relance * 3, gb.relance * 3, false, v => v ? `${v} s` : 'aucune'],
        ];
        const c = (a: number, b: number, plus: boolean) => a === b ? '' : (a > b) === plus ? 'up' : 'down';
        const col2 = (s: SortOfficiel, mien: boolean) => `<div><b>${s.name}</b><small>${escB(txt(s)?.accroche ?? '')}</small>${lignes.map(([n, a, b, plus, f]) =>
          `<span>${n} : <i class="${mien ? c(a, b, plus) : c(b, a, plus)}">${f(mien ? a : b)}</i></span>`).join('')}</div>`;
        return `<div class="cmpv">${col2(vu, true)}${col2(autre, false)}</div>`;
      })();
      fiche = `<div class="fh"><img src="${ico(vu)}" alt=""><div><b style="color:${col}">${vu.name}</b>
        ${t?.etiquettes.length ? `<div class="tg">${t.etiquettes.map(e => `<span>${escB(e)}</span>`).join('')}</div>` : ''}
        <div class="gr">${vu.grades.map((x, k) => `<span data-g="${k}" class="${k === gi ? 'on' : ''}">Grade ${k + 1} · niv ${x.niv}</span>`).join('')}</div></div></div>
        <div class="chips">${chips.map(([a, b]) => `<span>${a} <b>${b}</b></span>`).join('')}</div>
        ${p.level < p.requiredLevel(vu) ? `<div class="note">Se débloque au niveau ${p.requiredLevel(vu)}.</div>` : ''}
        ${key ? '' : '<div class="note">Pas encore jouable : il arrivera avec les zones de son niveau. Le texte dit comment il marchera.</div>'}
        ${t ? `<div class="acc">${escB(t.accroche)}</div><div class="txt">${avecMotsCles(t.texte)}</div>` : `<div class="ds">${vu.desc}</div>`}
        <div class="zr">${schemaZone(d, g, col)}<ul class="ef">${liste2.map(e => `<li>${e}</li>`).join('')}</ul></div>
        ${jauge ? `<div class="rg">${jauge}</div>` : ''}
        ${legs.length ? `<div class="lg"><div class="hd">Modifié par ton équipement</div>${legs.join('')}</div>` : ''}
        ${auCodex ? `<div class="hint">${auCodex} pouvoir${auCodex > 1 ? 's' : ''} pour ce sort dans ton Codex.</div>` : ''}
        ${t?.ambiance ? `<div class="amb">${escB(t.ambiance)}</div>` : ''}
        ${autre ? `<div class="var"><img src="${ico(autre)}" alt=""><span>Variante exclusive : <b>${autre.name}</b> · niveau ${p.requiredLevel(autre)}</span>
          <span class="btn" data-cmp>${this.sortsCmp ? 'Fermer' : 'Comparer'}</span>${ouvert(autre) && (p.variants[pi] ?? 0) === pairs[pi].indexOf(vu) ? `<span class="btn" data-prend="${autre.id}">Prendre</span>` : ''}</div>` : ''}
        ${cmp}
        <div class="hint">Glisse un sort débloqué dans la barre, ou clique-le puis clique une case. Petite icône à droite : la variante (un seul des deux, comme dans Dofus). Clic droit sur une case de la barre : la vider.</div>`;
    }
    const KEYS = [...[1, 2, 3, 4, 5, 6].map(i => Touches.nomAction(`sort${i}`)), this.reglages.deplacement === 'droit' ? 'Clic G' : 'Clic D', Touches.nomAction('deplacement')];
    const slot = (i: number) => {
      const id = p.bar[i], d = id ? p.cls.spells[id] : null;
      return `<div class="bs ${i === 6 || i === 7 ? 'gap' : ''}"><i data-slot="${i}" title="${d?.name ?? 'vide'}" style="${d ? `background-image:url(assets/ui/sorts/sort_${d.icon}.png)` : ''}"></i>${KEYS[i] ?? ""}</div>`;
    };
    // Codex (0.3, 7B) : consultable partout depuis la fenêtre des Sorts
    const codexBtn = p.v03 && p.codexOuvert ? `<span class="btn" data-vcodex>${this.sortsCodex ? 'Retour aux sorts' : `Codex · ${p.codex.length}`}</span>` : '';
    w.innerHTML = `${this.title('Sorts', 'spells')}<div class="sb">
      ${this.sortsCodex && p.v03 && p.codexOuvert ? `<div class="fi" style="grid-column:1/-1;overflow:auto">${codexPageHtml(p)}</div>` : `<div class="ls">${liste}</div>
      <div class="fi">${fiche}</div>`}
      <div class="bb">${p.bar.map((_, i) => slot(i)).join('')}<span class="hint">${p.cls.name} niveau ${p.level} · ${all.filter(s => ouvert(s) && p.keyOf(s.id)).length} sorts débloqués sur ${all.length}</span>${codexBtn}</div>
    </div>`;
    w.querySelector<HTMLElement>('[data-vcodex]')?.addEventListener('click', () => { this.sortsCodex = !this.sortsCodex; this.render(); });
    w.querySelectorAll<HTMLElement>('.flt [data-f]').forEach(e => e.addEventListener('click', () => { this.sortsFiltre = this.sortsFiltre === e.dataset.f ? null : e.dataset.f!; this.render(); }));
    w.querySelector<HTMLElement>('[data-av]')?.addEventListener('click', () => { this.aVenirOuvert = !this.aVenirOuvert; this.render(); });
    w.querySelector<HTMLElement>('[data-cmp]')?.addEventListener('click', () => { this.sortsCmp = !this.sortsCmp; this.render(); });
    w.querySelector<HTMLElement>('[data-prend]')?.addEventListener('click', e => {
      const id = +(e.currentTarget as HTMLElement).dataset.prend!, i = pairs.findIndex(pr => pr.some(s => s.id === id));
      if (i >= 0) { p.setVariant(i, pairs[i].findIndex(s => s.id === id) as 0 | 1); this.vu = id; this.render(); this.onChange(); }
    });
    w.querySelectorAll<HTMLElement>('.sp').forEach(e => e.addEventListener('click', ev => {
      const cible = (ev.target as HTMLElement).closest<HTMLElement>('[data-s]') ?? e;
      const id = +cible.dataset.s!, i = +cible.dataset.p!, v = +cible.dataset.v! as 0 | 1;
      // la petite icône : on regarde la variante ; un second clic dessus la prend (si elle est débloquée)
      if (cible !== e) { if (this.vu === id && p.level >= p.requiredLevel(pairs[i][v])) p.setVariant(i, v); }
      else if ((p.variants[i] ?? 0) !== v && p.level >= p.requiredLevel(pairs[i][v])) p.setVariant(i, v);
      if (this.vu !== id) this.sortsCmp = false;
      this.vu = id; this.vuGrade = -1; this.render(); this.onChange();
    }));
    w.querySelectorAll<HTMLElement>('.gr span').forEach(e => e.addEventListener('click', () => { this.vuGrade = +e.dataset.g!; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-drag]').forEach(e => e.addEventListener('dragstart', ev => ev.dataTransfer?.setData('text/plain', e.dataset.drag!)));
    w.querySelectorAll<HTMLElement>('[data-slot]').forEach(e => {
      const i = +e.dataset.slot!;
      e.addEventListener('dragover', ev => { ev.preventDefault(); e.classList.add('drop'); });
      e.addEventListener('dragleave', () => e.classList.remove('drop'));
      e.addEventListener('drop', ev => { ev.preventDefault(); const id = ev.dataTransfer?.getData('text/plain'); if (id && p.assign(i, id)) { this.render(); this.onChange(); } });
      e.addEventListener('click', () => { const k = vu && p.keyOf(vu.id); if (k && p.assign(i, k)) { this.render(); this.onChange(); } });
      e.addEventListener('contextmenu', ev => { ev.preventDefault(); p.assign(i, null); this.render(); this.onChange(); });
    });
  }

  /** Ouvre le Bestiaire sur un monstre ou un objet (fiche « Où le trouver »). */
  bestiaire(o: { monstre?: string; objet?: string } = {}) {
    if (o.monstre) { this.bestType = o.monstre; this.bestObjet = null; }
    if (o.objet) this.bestObjet = o.objet;
    this.show('bestiaire');
  }
  /** Bestiaire en jeu (maquette « Drops » 1A+1B, 2B+2C, 3A, 4A) : monstres par sous-zone, onglets Sorts / Résistances / Butin ;
   *  la recherche trouve aussi les objets, avec leur fiche « Où le trouver ». */
  private renderBestiaire() {
    const w = this.win!, vus = this.vaincus(), connu = (m: string) => this.toutVoir || (vus[m] ?? 0) > 0;
    const groupes = groupesBestiaire(), q = this.bestRecherche.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const va = (n: string) => !q || n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q);
    if (!this.bestType || !GAME_DATA.monsters[this.bestType]) this.bestType = groupes.flatMap(g => g.monstres).find(connu) ?? groupes[0]?.monstres[0] ?? '';
    const ligne = (m: string) => {
      const d = GAME_DATA.monsters[m], ok = connu(m), L = LOOKS[d.look];
      return `<div class="bm ${ok ? '' : 'inc'} ${d.boss ? 'boss' : d.elite ? 'elite' : ''} ${!this.bestObjet && m === this.bestType ? 'on' : ''}" data-bm="${m}"><canvas data-atlas="${ok ? L?.atlas ?? '' : ''}" width="68" height="68"></canvas><span>${ok ? escB(d.name) : '???'}</span><small>${vus[m] ?? 0}</small></div>`;
    };
    const liste = groupes.map(g => {
      const ms = g.monstres.filter(m => va(connu(m) ? GAME_DATA.monsters[m].name : ''));
      return ms.length ? `<div class="bh">${escB(g.zone)} · ${escB(g.nom)} · niv. ${g.niveau}</div>${ms.map(ligne).join('')}` : '';
    }).join('');
    // objets (1B) : ceux qui ont au moins une source dans le jeu
    const objets = q.length >= 2 ? [...Object.entries(ITEMS.resources), ...Object.entries(ITEMS.equipment)].filter(([, d]) => va(d.name)).slice(0, 30)
      .map(([id]) => `<div class="bm ${this.bestObjet === id ? 'on' : ''}" data-bo="${id}">${iconeObjet(id)}<span>${escB(nomObjet(id))}</span><small></small></div>`).join('') : '';
    let fiche = '';
    if (this.bestObjet) {
      const id = this.bestObjet, r = ITEMS.resources[id], e = ITEMS.equipment[id];
      fiche = `<div class="tete">${iconeObjet(id)}<div><h3>${escB(nomObjet(id))}</h3><div class="sub">${e ? `Équipement · ${e.slot}` : r?.soin ? 'Consommable' : 'Ressource'} · niveau ${(r ?? e)?.level ?? '?'}</div></div></div>${sourcesHtml(id)}`;
    } else if (this.bestType) {
      const m = this.bestType, d = GAME_DATA.monsters[m], n = vus[m] ?? 0, L = LOOKS[d.look];
      if (!connu(m)) fiche = `<div class="tete"><canvas width="220" height="220"></canvas><div><h3>???</h3><div class="sub">Pas encore croisé. Bats-en un pour remplir sa fiche.</div></div></div>`;
      else {
        const niv = niveauHorsPartie(m, GAME_DATA), ctx = this.world.contexteButin(m, rangDe(d), niv);
        const pal = (k: keyof typeof PALIERS, txt: string) => this.toutVoir || n >= PALIERS[k] ? txt : `<span class="lock">à ${PALIERS[k]} vaincus (${n} pour l'instant)</span>`;
        const res = Object.entries(d.res ?? {}).map(([el, v]) => `<div><span>${el[0].toUpperCase()}${el.slice(1)}</span><b>${v} %</b></div>`).join('');
        const sorts = (d.spells ?? []).map(x => `<div><span>${escB(x.name)}</span><b>${x.po[1] > 1 ? `portée ${x.po[1]}` : 'au contact'}</b></div>`).join('');
        const corps = this.bestOnglet === 'butin' ? butinMonstre(ctx)
          : this.bestOnglet === 'sorts' ? `<div class="kv">${pal('sorts', sorts || '<div><span>Aucun sort</span></div>')}</div>`
          : `<div class="kv">${pal('res', res || '<div><span>Aucune résistance</span></div>')}</div>`;
        fiche = `<div class="tete"><canvas data-atlas="${L?.atlas ?? ''}" width="220" height="220"></canvas><div><h3>${escB(d.name)}</h3>
          <div class="sub">${d.boss ? 'Boss · ' : d.elite ? 'Élite · ' : ''}niveau ${niv} · ${n} vaincu${n > 1 ? 's' : ''}${this.toutVoir ? ' · partie de test : tout est visible' : ''}</div>
          <div class="ongl">${([['sorts', 'Sorts'], ['res', 'Résistances'], ['butin', 'Butin']] as const).map(([k, t]) => `<button type="button" data-bon="${k}" class="${this.bestOnglet === k ? 'on' : ''}">${t}</button>`).join('')}</div></div></div>${corps}`;
      }
    }
    const tous = groupes.flatMap(g => g.monstres), nb = tous.filter(m => (vus[m] ?? 0) > 0).length;
    w.innerHTML = `${this.title('Bestiaire', 'bestiary')}<div class="bes">
      <div class="bl"><input placeholder="Monstre ou objet..." value="${escB(this.bestRecherche)}" data-bsearch><div class="sub" style="margin:4px 2px">${nb} / ${tous.length} monstres croisés</div>
        ${objets ? `<div class="bh">Objets</div>${objets}` : ''}${liste || (objets ? '' : '<div class="sub">Rien de ce nom.</div>')}</div>
      <div class="bd">${fiche}</div></div>`;
    dessinerPortraits(w);
    const inp = w.querySelector<HTMLInputElement>('[data-bsearch]')!;
    inp.addEventListener('input', () => { this.bestRecherche = inp.value; this.render(); const m = this.win!.querySelector<HTMLInputElement>('[data-bsearch]')!; m.focus(); m.setSelectionRange(m.value.length, m.value.length); });
    inp.addEventListener('keydown', e => e.stopPropagation());
    w.querySelectorAll<HTMLElement>('[data-bm]').forEach(e => e.addEventListener('click', () => { this.bestType = e.dataset.bm!; this.bestObjet = null; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-bo],[data-bobj]').forEach(e => e.addEventListener('click', () => { this.bestObjet = e.dataset.bo ?? e.dataset.bobj!; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-bmon]').forEach(e => e.addEventListener('click', () => { this.bestType = e.dataset.bmon!; this.bestObjet = null; this.bestOnglet = 'butin'; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-bon]').forEach(e => e.addEventListener('click', () => { this.bestOnglet = e.dataset.bon as 'butin' | 'sorts' | 'res'; this.render(); }));
  }

  private changed() { this.hideTip(); this.render(); this.onChange(); }
  /** Bulle d'une ressource : consommable, clé de donjon, Potion de Rappel ou Pépite. */
  /** Équipement fabriqué (0.3) : ses lignes officielles (min à max), Commun ou Rare. */
  private equipFabTip(id: string) {
    const d = ITEMS.equipment[id], lv = Math.max(1, this.world.player.metierLevel(ITEMS.recipes?.find(r => r.result === id)?.metier ?? ''));
    const st = (Object.entries(d.stats) as [Stat, [number, number]][]).map(([k, [a, b]]) => `<div class="${a < 0 ? 'down' : ''}">${a === b ? a : `${a} à ${b}`} ${STAT_NAMES[k]}</div>`).join('');
    return `<h4>${d.name}</h4><div class="sub">${d.slot.replace(/^./, c => c.toUpperCase())} · niveau ${d.level}</div>${st}
      <div class="hint">Fabriqué : Commun, ou Rare (${Math.round(chanceRare(lv) * 100)} % à ton niveau, garanti avec un ingrédient rare). Jamais de pouvoir légendaire.</div>`;
  }
  private resTip(r: ResourceDef, id: string) {
    const sorte = r.soin || r.rappel ? 'Consommable' : r.cle ? 'Clé de donjon' : r.pepite ? 'Monnaie du Bastion' : r.monnaie ? 'Monnaie de l\'île des Wabbits' : r.rune || r.signature ? 'Rune de forgemagie' : 'Ressource';
    const effet = r.soin ? `<div class="up">+${r.soin} PV</div><div class="hint">Clic droit : manger</div>`
      : r.rappel ? `<div class="up">Retour au dernier Zaap (${this.world.checkpointName})</div><div class="hint">Clic droit : boire</div>`
      : r.cle ? `<div class="up">Ouvre l'entrée : ${r.cle}</div><div class="hint">Prise en entrant dans le donjon</div>`
      : r.monnaie ? '<div class="hint">Gagnée en défendant les champs de l\'île des Wabbits (guerre des Cawottes) ; se dépense chez Tiwa Cawoteuw, sur l\'île de la Cawotte.</div>'
      : r.pepite ? '<div class="hint">Recycle tes objets chez Kerubim Crépin (au Bastion des Douze, ou à son guichet du Havre-Sac) et dépense-les chez ses voisins du Bastion.</div>'
      : r.signature ? '<div class="up">Grave ton nom sur un objet</div><div class="hint">Case Signature de la fenêtre du forgemage, au Bastion des Douze ; Malek en vend aussi.</div>'
      : r.rune && RUNES[id] ? `<div class="up">+${RUNES[id].val} ${STAT_NAMES[RUNES[id].stat]} · poids ${String(RUNES[id].poids).replace('.', ',')}</div><div class="hint">Se pose chez le forgemage du Bastion des Douze ; s'obtient en brisant des objets chez lui.</div>` : '';
    const sert = recettesAvec(ITEMS, id).map(x => produit(x.result)?.name).filter(Boolean);
    const sertA = sert.length ? `<div class="ou"><div class="hd">Sert à</div><div>${sert.slice(0, 5).join(', ')}${sert.length > 5 ? '…' : ''}</div></div>${!r.soin && !r.rappel ? '<div class="hint">Clic droit : recettes qui l\'utilisent</div>' : ''}` : '';
    return `<h4>${r.name}</h4><div class="sub">${sorte} · niveau ${r.level}</div>${effet}${sertA}${sourcesHtml(id, 3)}`;   // 1B : où le trouver
  }

  /** Emp, le Méryde du Recyclage (maquette 0.2, 7A 8A+8B+8C 9A+9B) : recyclage contre des Pépites, en lot ou objet par objet,
   *  cadenas, et sa boutique payée en Pépites. S'ouvre par la réponse « service » de son dialogue. */
  /** Onglet du coffre affiché, et sorte de coffre (Hardcore : le sien, 12D). */
  /** Dernier message des préréglages (sous les boutons). */
  private prerMsg = '';
  coffreOnglet = 0;
  coffreHardcore = false;
  /** Coffre partagé (0.3, 12A+12B+12D) : 5 onglets d'objets, partagés par les persos du compte. Clic : ranger ou reprendre. */
  private renderCoffre() {
    const w = this.win!, p = this.world.player, c = this.world.coffre, o = Math.min(this.coffreOnglet, c.onglets.length - 1), l = c.onglets[o] ?? [];
    const cell = (it: Item, attr: string) => { const d = ITEMS.equipment[it.id];
      return `<div class="cell" ${attr}>${iconHtml(d?.icon ?? 0)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i></div>`; };
    const onglets = c.onglets.map((x, i) => `<span class="eo ${i === o ? 'on' : ''}" data-co="${i}">${c.noms?.[i] || `Onglet ${i + 1}`} · ${x.length}</span>`).join('');
    const coffre = Array.from({ length: COFFRE.places }, (_, i) => l[i] ? cell(l[i], `data-cr="${i}"`) : '<div class="cell empty"></div>').join('');
    const sac = p.bag.filter(it => ITEMS.equipment[it.id]).map(it => cell(it, `data-cd="${it.uid}"`)).join('');
    const loin = !this.world.presCoffre ? '<div class="lack">Tu t\'es éloigné du coffre : reviens devant pour ranger ou reprendre.</div>' : '';
    w.innerHTML = `${this.title(this.coffreHardcore ? 'Coffre Hardcore' : 'Coffre partagé', 'inventory')}<div class="in emp">
      <div class="eh"><div class="eos">${onglets}</div><span class="hint">${l.length} / ${COFFRE.places}</span></div>
      <div class="hint">${this.coffreHardcore ? 'Partagé par tes persos Hardcore seulement.' : 'Partagé par tous tes persos (sauf Hardcore), au Havre-Sac et à la Banque d\'Astrub.'} Clic : reprendre l'objet.</div>${loin}
      <div class="grid eg">${coffre}</div>
      <div class="sub2">Sac (clic : ranger dans l'onglet ${o + 1})</div><div class="grid eg">${sac || '<div class="hint">Aucun équipement dans ton sac.</div>'}</div></div>`;
    const tip = (e: HTMLElement, it: Item) => {
      e.addEventListener('mouseenter', ev => this.showTip(it, ev, false));
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
    };
    w.querySelectorAll<HTMLElement>('[data-co]').forEach(e => e.addEventListener('click', () => { this.coffreOnglet = +e.dataset.co!; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-cr]').forEach(e => {
      tip(e, l[+e.dataset.cr!]);
      e.addEventListener('click', () => { this.hideTip(); if (this.world.retirer(o, +e.dataset.cr!)) this.changed(); });
    });
    w.querySelectorAll<HTMLElement>('[data-cd]').forEach(e => {
      tip(e, p.bag.find(b => b.uid === +e.dataset.cd!)!);
      e.addEventListener('click', () => { this.hideTip(); if (this.world.deposer(+e.dataset.cd!, o)) this.changed(); });
    });
  }

  /** Almanax (0.3, 15C) : le jour du calendrier officiel, son offrande et son bonus. */
  /** Rangée de 6 Dofus et Dofus du sac : survol, glisser-déposer (inventaire et fenêtre Dofus). */
  private lierDofus(w: HTMLElement) {
    const p = this.world.player;
    // Dofus (0.3, 5A) : survol = fiche ; clic sur une case vide = porter un Dofus du perso ; clic droit = retirer
    w.querySelectorAll<HTMLElement>('[data-dofus]').forEach(e => {
      const i = +e.dataset.dofus!, id = p.dofusPortes[i];
      if (id && p.v03) {
        e.addEventListener('mouseenter', ev => { this.tip.innerHTML = dofusTip(id, true); this.tip.style.display = 'block'; this.moveTip(ev); });
        e.addEventListener('mousemove', ev => this.moveTip(ev));
        e.addEventListener('mouseleave', () => this.hideTip());
        e.draggable = true;   // 6B : glisser la case vers le sac = retirer
        e.addEventListener('dragstart', ev => { this.hideTip(); ev.dataTransfer?.setData('text/dofus-case', String(i)); });
      }
      if (!p.v03) return;
      e.addEventListener('dragover', ev => ev.preventDefault());
      e.addEventListener('drop', ev => {
        ev.preventDefault();
        const id = ev.dataTransfer?.getData('text/dofus'), de = ev.dataTransfer?.getData('text/dofus-case');
        if (id) { if (p.dofusPortes[i]) p.retirerDofus(i); if (p.porterDofus(id, i)) this.changed(); }
        else if (de && +de !== i) { const a = p.dofusPortes[+de]; p.retirerDofus(+de); if (p.dofusPortes[i]) { const b = p.dofusPortes[i]!; p.retirerDofus(i); p.porterDofus(b, +de); } if (a) p.porterDofus(a, i); this.changed(); }
      });
    });
    // Dofus du sac (possédés, pas portés) : à glisser sur une case (Onglet Dofus 6B) ; la grille du sac reçoit une case qu'on retire
    w.querySelectorAll<HTMLElement>('[data-dsac]').forEach(e => {
      const id = e.dataset.dsac!;
      e.addEventListener('dragstart', ev => { this.hideTip(); ev.dataTransfer?.setData('text/dofus', id); });
      e.addEventListener('mouseenter', ev => { this.tip.innerHTML = dofusTip(id) .replace(DOFUS[id]?.source ?? (TROPHEES[id] ? sourceTrophee(id) : '§'), 'Glisse-le sur une case de Dofus'); this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
    });
    const grille = w.querySelector<HTMLElement>('[data-dof-g]') ?? w.querySelector<HTMLElement>('.right .grid, .grid');
    if (p.v03 && grille) {
      grille.addEventListener('dragover', ev => { if (ev.dataTransfer?.types.includes('text/dofus-case')) ev.preventDefault(); });
      grille.addEventListener('drop', ev => { const de = ev.dataTransfer?.getData('text/dofus-case'); if (de) { ev.preventDefault(); if (p.retirerDofus(+de)) this.changed(); } });
    }
  }

  /** Quête « œuf à reconstituer » du Dofus : fragments repris (4A), ou null si elle n'est pas en cours. */
  private oeufEnCours(id: string): { quete: string; fragments: number; coquille: boolean } | null {
    const Q = this.world.quetes; if (!Q) return null;
    const qid = Object.keys(Q.data.quetes).find(k => Q.data.quetes[k].recompense?.dofus === id); if (!qid) return null;
    const c = Q.enCours.find(x => x.id === qid); if (!c) return null;
    const fragments = c.etape >= 2 || c.aRendre ? 3 : c.etape === 1 ? c.compte.filter(n => n >= 1).length : 0;
    return { quete: Q.data.quetes[qid].nom, fragments, coquille: c.etape >= 2 || c.aRendre };
  }

  private renderDofus() {
    const w = this.win!, p = this.world.player, tro = this.dofusOnglet === 'trophees' && p.v04, eu = new Set(tro ? p.trophees : p.dofus);
    const L: Record<string, { nom: string; niveau: number; icon: number }> = tro ? TROPHEES : DOFUS;
    const ids = Object.keys(L).sort((a, b) => L[a].niveau - L[b].niveau || L[a].nom.localeCompare(L[b].nom, 'fr'));
    if (!L[this.dofusSel]) this.dofusSel = ids.find(i => eu.has(i)) ?? ids[0];
    const onglet = (k: string, n: string, ok: boolean) => `<span class="eo ${this.dofusOnglet === k ? 'on' : ''} ${ok ? '' : 'off'}" ${ok ? `data-dof-o="${k}"` : `title="Avec Amakna : rien n'est portable avant le niveau 50"`}>${n}</span>`;
    const rangee = `<div class="dof-row">${p.dofusPortes.map((id, i) => { const d = id ? PORTABLE(id) : null;
      return `<div class="slot ${d ? 'plein' : ''}" data-dofus="${i}" style="${d ? '' : `background-image:url(${D3}/tx_slot_dofus.png)`}">${d ? iconHtml(d.icon) : ''}</div>`; }).join('')}</div>`;
    const grille = ids.map(id => { const d = L[id], a = eu.has(id), oe = a || tro ? null : this.oeufEnCours(id);
      return `<div class="dof-c ${a ? '' : 'non'} ${p.dofusPortes.includes(id) ? 'porte' : ''} ${id === this.dofusSel ? 'on' : ''}" data-dof="${id}" ${a ? 'data-dsac="' + id + '" draggable="true"' : ''}>${iconHtml(d.icon)}<small>${d.niveau}</small>${oe ? `<span class="fr">${oe.fragments}/3</span>` : ''}</div>`; }).join('');
    const sel = this.dofusSel, a = eu.has(sel);
    const detail = tro ? `<div class="dof-d">${dofusTip(sel).replace('<div class="sub">', `<div class="sub">${a ? (p.dofusPortes.includes(sel) ? 'porté · ' : 'dans ton sac · ') : 'pas encore trouvé · '}`)}</div>` : (() => {
    const d = DOFUS[sel], oe = a ? null : this.oeufEnCours(sel);
    const st = Object.entries(d.stats).map(([k, v]) => `+${v} ${STAT_NAMES[k as Stat] ?? k}`).join(' · ');
    const suivi = oe ? `<div class="dof-s" style="margin-top:6px"><b>${oe.quete}</b>${[1, 2, 3].map(i => `<span class="${oe.fragments >= i ? 'ok' : ''}">Fragment ${i}</span>`).join('')}<span class="${oe.coquille ? 'ok' : ''}">Coquille</span></div>` : '';
    return `<div class="dof-d"><h4>${d.nom}</h4><div class="sub">Dofus · niveau ${d.niveau} · ${a ? (p.dofusPortes.includes(this.dofusSel) ? 'porté' : 'dans ton sac') : 'pas encore trouvé'}</div>
      <div>${st}</div>${d.passif ? `<div style="margin-top:4px"><b style="color:#e8c76b">${d.passif.nom}</b> : ${d.passif.texte}${d.jeu ? '' : ' <i class="hint">(passif à venir)</i>'}</div>` : ''}
      ${a ? '' : `<div class="hint" style="margin-top:4px">${d.source}</div>`}${suivi}</div>`;
    })();
    const paliers = [2, 6, 12, 31], prochain = paliers.find(n => n > p.dofus.length);
    const corps = this.dofusOnglet === 'dofus' || tro ? `${rangee}<div class="hint" style="text-align:center">${tro ? `Les trophées se portent dans les mêmes cases que les Dofus, à partir du niveau 50.${p.level < 50 ? ' <b>Tu es niveau ' + p.level + '.</b>' : ''}` : 'Glisse un Dofus de la grille ou du sac sur une case pour le porter, et d\'une case vers la grille pour le retirer.'}</div>
      <div class="dof-g" data-dof-g>${grille}</div>${detail}` : '<div class="hint">Avec Amakna.</div>';
    w.innerHTML = `${this.title('Dofus', 'success')}<div class="in dof">
      <div class="dof-t">${onglet('dofus', 'Dofus', true)}${onglet('trophees', 'Trophées', p.v04)}${onglet('prysma', 'Prysmaradites', false)}
        <span class="k" title="${tro ? 'Trophées trouvés' : prochain ? `Prochain succès à ${prochain} Dofus` : 'Tous les Dofus !'}">${eu.size} / ${ids.length}</span></div>${corps}</div>`;
    w.querySelectorAll<HTMLElement>('[data-dof-o]').forEach(e => e.addEventListener('click', () => { this.dofusOnglet = e.dataset.dofO as 'dofus'; this.dofusSel = ''; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-dof]').forEach(e => e.addEventListener('click', () => { this.dofusSel = e.dataset.dof!; this.render(); }));
    this.lierDofus(w);
  }

  private renderAlmanax() {
    const w = this.win!, p = this.world.player, j = this.world.almanaxDuJour, fait = !!this.world.almanax;
    const date = new Date(`${this.world.opts.aujourdhui ?? ''}T12:00`);
    const titre = isNaN(+date) ? '' : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!j) { w.innerHTML = `${this.title('Almanax', 'calendar')}<div class="in alm"><div class="hint">Pas d'Almanax aujourd'hui.</div></div>`; return; }
    const r = ITEMS.resources[j.offrande], a = p.resources[j.offrande] ?? 0, ok = a >= j.n;
    const pep = ALMANAX.pepites * (j.effet === 'pepites' ? 2 : 1);
    w.innerHTML = `${this.title('Almanax', 'calendar')}<div class="in alm">
      <div class="alm-d">${titre}</div>
      <div class="alm-b"><b>${j.bonus}</b><p>${j.texte}</p></div>
      <div class="sub2">Dans le jeu</div><div class="alm-e">${effetTexte(j.effet)}${j.effet === 'pepites' ? '' : ` · jusqu'à minuit`}</div>
      <div class="sub2">Offrande</div>
      <div class="alm-o"><div class="cell" title="${r?.name ?? ''}">${iconHtml(r?.icon ?? 0)}</div><div><b>${j.n} × ${r?.name ?? 'objet inconnu'}</b>
        <small style="color:${ok ? '#b9e54b' : '#ff8a7a'}">tu en as ${a}</small>${j.officielle === false ? '<small class="hint">(remplace une offrande pas encore dans le jeu)</small>' : ''}</div></div>
      <div class="alm-r">Récompense : ${pep} ${iconHtml(ITEMS.resources[PEPITE].icon)} + le bonus du jour</div>
      ${fait ? '<div class="alm-f">Offrande faite. Le bonus est actif jusqu\'à minuit, reviens demain.</div>'
        : `<span class="btn ${ok ? '' : 'off'}" data-offrir>Faire l'offrande</span>`}</div>`;
    w.querySelector('[data-offrir]')?.addEventListener('click', () => { if (this.world.offrirAlmanax()) this.changed(); });
  }

  private renderEmp() {
    const w = this.win!, p = this.world.player, pep = p.resources[PEPITE] ?? 0;
    // les onglets du PNJ ouvert : ses services (Kerubim recycle, Tissebelle a les apparats et le miroir, les autres une boutique)
    const def = QUETES.pnj[this.empPnj], sv = new Set((def?.services ?? []).map(x => x.service)), boutique = (BOUTIQUES[this.empPnj] ?? []).filter(a => (!a.v03 || p.v03) && (!a.v04 || p.v04));
    if (!sv.has(this.empOnglet)) this.empOnglet = sv.has('boutique') ? 'boutique' : sv.has('apparat') ? 'apparat' : 'recycler';
    const onglet = (k: string, n: string) => sv.has(k) ? `<span class="eo ${this.empOnglet === k ? 'on' : ''}" data-eo="${k}">${n}</span>` : '';
    // monnaie de la boutique : Pépites, ou celle de ses articles (Tiwa Cawoteuw : Cawottes de la guerre)
    const mon = boutique.find(a => a.monnaie)?.monnaie ?? PEPITE, solde = p.resources[mon] ?? 0, icMon = iconHtml(ITEMS.resources[mon]?.icon ?? 0);
    const tete = `<div class="eh"><div class="eos">${onglet('recycler', 'Recycler')}${onglet('boutique', 'Boutique')}${onglet('apparat', 'Apparats')}${sv.has('garde-robe') ? '<span class="eo" data-garde>Garde-robe</span>' : ''}</div>
      <span class="k" title="${ITEMS.resources[mon]?.name ?? 'Pépites'}">${solde.toLocaleString('fr-FR')} ${icMon}</span></div>`;
    let corps = '';
    if (this.empOnglet === 'recycler') {
      const lots: [Rarity, string][] = [['commun', 'Tout le Commun'], ['rare', 'Commun et Rare'], ['epique', 'Tout sauf Légendaire']];
      const lotsHtml = lots.map(([r, n]) => { const a = this.world.apercuLot(r);
        return `<span class="btn ${a.n ? '' : 'off'}" data-lot="${r}">${n}<small>${a.n} objet${a.n > 1 ? 's' : ''} · +${a.pepites} Pépites</small></span>`; }).join('');
      const objets = p.bag.filter(it => ITEMS.equipment[it.id]).map(it => { const d = ITEMS.equipment[it.id];
        return `<div class="cell ${it.cadenas ? 'verrou' : ''}" data-ruid="${it.uid}">${iconHtml(d.icon)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i>${it.cadenas ? CADENAS : `<span class="pv">+${recycleValue(d, it)}</span>`}</div>`; }).join('');
      const res = Object.entries(p.resources).filter(([id]) => { const r = ITEMS.resources[id]; return r && !r.pepite && !r.monnaie && !r.cle && !r.soin && !r.rappel; })
        .map(([id, n]) => `<div class="cell" data-rres="${id}" title="${ITEMS.resources[id].name} : ${n} × ${recycleResource(ITEMS.resources[id])} Pépites">${iconHtml(ITEMS.resources[id].icon)}<span class="n">${n}</span></div>`).join('');
      corps = `<div class="lots">${lotsHtml}</div>
        <div class="hint">Clic : recycler l'objet · Ctrl + clic (ou clic droit) : cadenas, l'objet n'est jamais recyclé. Les objets sous cadenas restent hors des lots.</div>
        <div class="grid eg">${objets || '<div class="hint">Ton sac est vide.</div>'}</div>
        ${res ? `<div class="sub2">Ressources (la pile entière)</div><div class="grid eg">${res}</div>` : ''}`;
    } else if (this.empOnglet === 'apparat') {
      // Apparats officiels (5A) : tout le catalogue, payé en Pépites ; le survol habille le perso de l'aperçu
      const q = this.apparatRecherche.toLowerCase();
      const l = Object.entries(APPARATS.objets).filter(([, d]) => !d.collection && (!this.apparatSlot || d.slot === this.apparatSlot) && (!q || d.name.toLowerCase().includes(q)))
        .sort((a, b) => a[1].name.localeCompare(b[1].name, 'fr'));
      const essai = this.essaiApparat && APPARATS.objets[this.essaiApparat];
      const objets = objetsPortes(p.equipment, { ...p.apparat, ...(essai ? { [essai.slot]: this.essaiApparat! } : {}) });
      corps = `<div class="filtre"><input placeholder="Rechercher un apparat..." value="${this.apparatRecherche.replace(/"/g, '&quot;')}" data-arech>
          <select data-aslot style="width:auto">${[['', 'Tous les apparats'], ['chapeau', 'Coiffes'], ['cape', 'Capes'], ['familier', 'Familiers']].map(([k, n]) => `<option value="${k}" ${this.apparatSlot === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <span class="hint">${l.length} apparat${l.length > 1 ? 's' : ''}</span></div>
        <div class="cata"><div class="apercu">${this.perso ? this.canevas('', objets) : ''}<div class="hint" style="text-align:center">${essai ? essai.name : 'Survole un apparat pour l\'essayer'}</div></div>
        <div class="shop">${l.slice(0, 120).map(([id, d]) => { const a = p.apparats.includes(id), prix = APPARATS.prix[d.slot] ?? 0;
          return `<div class="rec" data-essai="${id}">${apparatHtml(id)}<div><b>${d.name}</b> <span class="hint">${d.slot === 'chapeau' ? 'Coiffe' : d.slot === 'cape' ? 'Cape' : 'Familier'} d'apparat</span>${porteur(id)}</div>
            ${a ? '<span class="hint">Déjà à toi</span>' : `<span class="btn ${pep >= prix ? '' : 'off'}" data-aachat="${id}">${prix} ${iconHtml(ITEMS.resources[PEPITE].icon)}</span>`}</div>`; }).join('')}
          ${l.length > 120 ? `<div class="hint">… et ${l.length - 120} autres : affine la recherche.</div>` : ''}</div></div>`;
    } else {
      corps = `<div class="shop">${boutique.map(a => {
        const ap = a.apparat ? APPARATS.objets[a.id] : null;
        if (ap) { const eu = p.apparats.includes(a.id);
          return `<div class="rec">${apparatHtml(a.id)}<div><b>${ap.name}</b> <span class="hint">${ap.slot === 'chapeau' ? 'Coiffe' : 'Cape'} : apparence pour ta collection</span></div>
            ${eu ? '<span class="hint">Déjà à toi</span>' : `<span class="btn ${solde >= a.prix ? '' : 'off'}" data-achat="${a.id}">${a.prix.toLocaleString('fr-FR')} ${icMon}</span>`}</div>`; }
        const r = ITEMS.resources[a.id]; if (!r) return '';
        const effet = r.soin ? `+${r.soin} PV` : r.rappel ? 'Retour au dernier Zaap' : r.cle ? `Entrée : ${r.cle}` : r.pierreAme ? 'Capture un archimonstre vaincu (une pierre par capture)' : '';
        return `<div class="rec" data-rid="${a.id}">${iconHtml(r.icon)}<div><b>${r.name}</b> <span class="hint">niveau ${r.level}${(p.resources[a.id] ?? 0) ? ` · tu en as ${p.resources[a.id]}` : ''}</span><div style="font-size:12px;color:#c9c4ab">${effet}</div></div>
          <span class="btn ${solde >= a.prix ? '' : 'off'}" data-achat="${a.id}">${a.prix} ${icMon}</span></div>`; }).join('')}</div>
        <div class="hint">${mon === PEPITE ? 'Les Pépites se gagnent en recyclant tes objets chez Kerubim Crépin.' : 'Les Cawottes se gagnent en défendant les champs de l\'île contre les Wabbits (clic sur l\'épouvantail d\'un champ).'}</div>`;
    }
    w.innerHTML = `${this.title(`${def?.nom ?? 'Marchand'}${def?.titre ? ` · ${def.titre}` : ''}`, 'inventory')}<div class="in emp">${tete}${corps}</div>`;
    w.querySelectorAll<HTMLElement>('[data-eo]').forEach(e => e.addEventListener('click', () => { this.empOnglet = e.dataset.eo as 'recycler' | 'boutique' | 'apparat'; this.render(); }));
    w.querySelector<HTMLElement>('[data-garde]')?.addEventListener('click', () => this.show('garde'));
    w.querySelectorAll<HTMLElement>('[data-aachat]').forEach(e => e.addEventListener('click', () => { this.world.acheterApparat(e.dataset.aachat!); this.changed(); }));
    w.querySelectorAll<HTMLElement>('[data-essai]').forEach(e => e.addEventListener('mouseenter', () => {
      this.essaiApparat = e.dataset.essai!;
      const d = APPARATS.objets[this.essaiApparat], p2 = this.world.player, cv = w.querySelector<HTMLCanvasElement>('.apercu canvas');
      if (cv) cv.dataset.objets = objetsPortes(p2.equipment, { ...p2.apparat, [d.slot]: this.essaiApparat }).join(',');
      const t = w.querySelector('.apercu .hint'); if (t) t.textContent = d.name;
    }));
    const ar = w.querySelector<HTMLInputElement>('[data-arech]');
    if (ar) {
      ar.addEventListener('input', () => { this.apparatRecherche = ar.value; this.render(); const m = this.win!.querySelector<HTMLInputElement>('[data-arech]')!; m.focus(); m.setSelectionRange(m.value.length, m.value.length); });
      ar.addEventListener('keydown', e => e.stopPropagation());
    }
    w.querySelector<HTMLSelectElement>('[data-aslot]')?.addEventListener('change', e => { this.apparatSlot = (e.target as HTMLSelectElement).value as '' | 'chapeau' | 'cape' | 'familier'; this.render(); });
    w.querySelectorAll<HTMLElement>('[data-lot]').forEach(e => e.addEventListener('click', () => { this.world.recycleLot(e.dataset.lot as Rarity); this.changed(); }));
    w.querySelectorAll<HTMLElement>('[data-achat]').forEach(e => e.addEventListener('click', () => { this.world.acheter(this.empPnj, e.dataset.achat!); this.changed(); }));
    w.querySelectorAll<HTMLElement>('[data-rres]').forEach(e => e.addEventListener('click', () => { this.world.recycleRessource(e.dataset.rres!); this.changed(); }));
    w.querySelectorAll<HTMLElement>('[data-rid]').forEach(e => {
      const r = ITEMS.resources[e.dataset.rid!];
      e.addEventListener('mouseenter', ev => { this.tip.innerHTML = this.resTip(r, e.dataset.rid!); this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
    });
    w.querySelectorAll<HTMLElement>('[data-ruid]').forEach(e => {
      const uid = +e.dataset.ruid!, it = p.bag.find(b => b.uid === uid)!;
      const cad = () => { this.world.cadenas(uid); this.changed(); };
      e.addEventListener('mouseenter', ev => this.showTip(it, ev, false));
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', cad);
      e.addEventListener('click', ev => { if (ev.ctrlKey || ev.metaKey) cad(); else { this.world.recycle(uid); this.changed(); } });
    });
  }
  /** Forgemage (maquettes « Forgemagie » et « Forgemagie UI ») : forgemagie, commande à Malek, Concasseur et fusion ; la partie de test l'ouvre aussi (F1). */
  /** Fenêtre des Sorts : page du Codex affichée à la place des sorts (0.3). */
  private sortsCodex = false;
  ouvrirForge(uid?: number) { if (uid != null) this.forge.uid = uid; this.forge.onglet = this.world.player.commandeFM?.prete ? 'malek' : 'forge'; this.show('forge'); }
  /** Nom du perso (Rune de Signature, Forgemagie UI 6A) : donné par la scène. */
  nomPerso: () => string = () => '';
  /** Résultats renvoyés par la partie (forge, brisage, fusion, commande) : l'historique de la fenêtre (5A). */
  noteForge(l: LigneLog) { this.forge.log = [l, ...this.forge.log].slice(0, 40); if (this.mode === 'forge' && this.win) this.render(); }
  noteForgeEvt(e: Parameters<typeof texteForge>[0]) { this.noteForge(texteForge(e)); }
  /** Commande de Malek qui avance : l'onglet se met à jour (compte à rebours). */
  majForge() {
    if (this.mode !== 'forge' || !this.win) return;
    if (this.forge.onglet === 'malek') { this.render(); return; }
    const c = this.world.player.commandeFM, t = this.win.querySelector<HTMLElement>('[data-fo="malek"]');
    if (t) t.textContent = c ? (c.prete ? 'Malek ✓' : `Malek · ${mmss(c.reste)}`) : 'Commande à Malek';
  }
  private renderForge() {
    const w = this.win!, f = this.forge, p = this.world.player;
    // garder la saisie en cours (objectif, plancher, budget) quand la fenêtre se redessine
    const actif = document.activeElement as HTMLInputElement | null, cle = actif && w.contains(actif) ? Array.from(actif.attributes).find(a => a.name.startsWith('data-'))?.name : null;
    const champ = cle ? actif!.getAttribute(cle) : null;
    w.innerHTML = `${this.title('Forgemage', 'job')}<div class="in emp fm">${forgeHtml(this.world, f)}</div>`;
    if (cle) { const el = w.querySelector<HTMLInputElement>(champ ? `[${cle}="${champ}"]` : `[${cle}]`); if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch { /* champ nombre */ } } }
    const tip = (e: HTMLElement, it: Item) => {
      e.addEventListener('mouseenter', ev => this.showTip(it, ev, false));
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
    };
    w.querySelectorAll<HTMLElement>('[data-fo]').forEach(e => e.addEventListener('click', () => { f.onglet = e.dataset.fo as typeof f.onglet; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-fuid]').forEach(e => {
      const it = this.world.objetForgeable(+e.dataset.fuid!)!;
      e.addEventListener('click', () => { f.uid = it.uid; f.rune = null; this.render(); }); tip(e, it);
    });
    w.querySelectorAll<HTMLElement>('[data-frune]').forEach(e => e.addEventListener('click', () => {
      const id = e.dataset.frune!;
      if (e.classList.contains('off') || f.uid == null) return;
      if (f.avance) { if (this.world.forgemager(f.uid, id)) this.changed(); }
      else { f.rune = id; this.render(); }
    }));
    w.querySelector<HTMLElement>('[data-fusionner]')?.addEventListener('click', ev => {
      if ((ev.currentTarget as HTMLElement).classList.contains('off') || f.uid == null || !f.rune) return;
      if (this.world.forgemager(f.uid, f.rune)) this.changed();
    });
    w.querySelector<HTMLInputElement>('[data-avance]')?.addEventListener('change', ev => { f.avance = (ev.target as HTMLInputElement).checked; f.rune = null; this.render(); });
    w.querySelectorAll<HTMLElement>('[data-oeil]').forEach(e => e.addEventListener('click', () => {
      const s = e.dataset.oeil as Stat; f.caches = f.caches.includes(s) ? f.caches.filter(x => x !== s) : [...f.caches, s]; this.render();
    }));
    w.querySelector<HTMLElement>('[data-fsigne]')?.addEventListener('click', () => {
      if (f.uid != null && this.world.signer(f.uid, this.nomPerso())) this.changed();
    });
    // Codex (0.3) : objet Rare ou Épique, pouvoir du Codex, impression
    w.querySelectorAll<HTMLElement>('[data-cuid]').forEach(e => {
      const it = this.world.objetForgeable(+e.dataset.cuid!)!;
      e.addEventListener('click', () => { f.codex.uid = it.uid; f.codex.entree = null; this.render(); }); tip(e, it);
    });
    w.querySelectorAll<HTMLElement>('[data-centree]').forEach(e => e.addEventListener('click', () => { f.codex.entree = e.dataset.centree!; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-cimp]').forEach(e => e.addEventListener('click', () => {
      if (e.classList.contains('off') || f.codex.uid == null || !f.codex.entree) return;
      if (this.world.imprimerCodex(f.codex.uid, f.codex.entree, e.dataset.cimp as 'kamas' | 'pepites')) { f.codex.entree = null; this.changed(); }
    }));
    // commande à Malek (9A-9E)
    w.querySelectorAll<HTMLElement>('[data-muid]').forEach(e => {
      const it = this.world.objetForgeable(+e.dataset.muid!)!;
      e.addEventListener('click', () => { f.cmdUid = it.uid; f.estim = null; this.render(); }); tip(e, it);
    });
    const nombre = (el: HTMLInputElement) => { const n = Math.floor(+el.value); return el.value === '' || !(n > 0) ? undefined : n; };
    w.querySelectorAll<HTMLInputElement>('[data-obj],[data-plancher],[data-budget]').forEach(el => {
      el.addEventListener('keydown', ev => ev.stopPropagation());
      el.addEventListener('input', () => {
        const n = nombre(el);
        if (el.dataset.budget != null) f.cmd.budget = n ?? 0;
        else { const o = el.dataset.obj != null ? f.cmd.objectifs : f.cmd.planchers, s = (el.dataset.obj ?? el.dataset.plancher) as Stat; if (n == null) delete o[s]; else o[s] = n; }
        f.estim = null;
      });
    });
    w.querySelector<HTMLElement>('[data-estimer]')?.addEventListener('click', () => { if (f.cmdUid != null) { f.estim = this.world.estimerCommande(f.cmdUid, f.cmd); this.render(); } });
    w.querySelector<HTMLElement>('[data-confier]')?.addEventListener('click', ev => {
      if (f.cmdUid == null) return;
      if (this.world.confierCommande(f.cmdUid, f.cmd)) { f.estim = null; this.changed(); } else this.flash(ev.currentTarget as HTMLElement);
    });
    w.querySelector<HTMLElement>('[data-reprendre]')?.addEventListener('click', () => { if (this.world.retirerCommande()) this.changed(); });
    // Concasseur (8A)
    w.querySelectorAll<HTMLElement>('[data-blot]').forEach(e => e.addEventListener('click', () => { lotConcasseur(this.world, f, e.dataset.blot as Rarity); this.render(); }));
    w.querySelector<HTMLElement>('[data-briser]')?.addEventListener('click', () => { if (f.brise.length && this.world.briserChoix(f.brise)) { f.brise = []; this.changed(); } });
    w.querySelectorAll<HTMLElement>('[data-buid],[data-bout]').forEach(e => {
      const uid = +(e.dataset.buid ?? e.dataset.bout!), it = p.bag.find(b => b.uid === uid)!;
      const cad = (ev: Event) => { ev.preventDefault(); this.world.cadenas(uid); this.changed(); };
      tip(e, it);
      e.addEventListener('contextmenu', cad);
      e.addEventListener('click', ev => {
        if (ev.ctrlKey || ev.metaKey) return cad(ev);
        if (it.cadenas) return;
        f.brise = f.brise.includes(uid) ? f.brise.filter(x => x !== uid) : [...f.brise, uid]; this.hideTip(); this.render();
      });
    });
    w.querySelectorAll<HTMLElement>('[data-fus]').forEach(e => e.addEventListener('click', () => { this.world.fusionner(e.dataset.fus!); this.changed(); }));
    w.querySelectorAll<HTMLElement>('[data-fust]').forEach(e => e.addEventListener('click', () => { this.world.fusionner(e.dataset.fust!, true); this.changed(); }));
  }
  private flash(e: HTMLElement) { e.style.borderColor = '#e0625a'; }

  /** Zaap du Havre-Sac (maquette Hub 2C) ou du Bastion (Ville 7A+7B) : ressortir là où l'on était, le Bastion des Douze en tête,
   *  ou un Zaap déjà découvert. */
  /** Zaap (maquette « Zaap : » 5A+5D, 6A, 8A) : la même fenêtre au Havre-Sac, au Bastion et devant un Zaap du monde. Colonnes de la
   *  vraie fenêtre de Dofus 3, groupée par zone (le Bastion en tête), niveau coloré selon le tien, Zaaps pas encore découverts grisés. */
  private renderZaap() {
    const w = this.win!, wo = this.world, p = wo.player, r = wo.retour, bastion = wo.dansBastion, refuge = wo.dansRefuge;
    const ici = refuge ? null : wo.zaapProche();
    const zone = (z: string) => GAME_DATA.zones[z]?.name ?? z;
    const couleur = (niv: number) => { const d = niv - p.level; return d <= 0 ? 'n1' : d <= 5 ? 'n2' : d <= 15 ? 'n3' : 'n4'; };
    const ICO = `<img src="${v('assets/ui/reperes/410.webp')}" alt="">`;
    // idée 2 (2026-11-08) : étoile sur le Zaap découvert le plus proche du but de la quête suivie
    const Q = wo.quetes, conseil = this.reglages.flecheQuete ? Q?.zaapConseille() ?? null : null, quete = Q?.suivie ? Q.def(Q.suivie).nom : '';
    const ligne = (o: { i?: number; nom: string; region: string; co: string; niv: string; nc: string; cls?: string; titre?: string; marque?: string }) =>
      `<div class="zl ${o.cls ?? ''}" ${o.i != null ? `data-zaap="${o.i}"` : ''} data-q="${escB(`${o.nom} ${o.region}`.toLowerCase())}" title="${escB(o.titre ?? '')}">`
      + `<span class="t">${ICO}<b>${escB(o.nom)}</b>${o.marque ? `<span class="ici-m">${o.marque}</span>` : ''}</span><span>${escB(o.region)}</span><span>${o.co}</span><span class="${o.nc}">${o.niv}</span></div>`;
    const html: string[] = [];
    if (refuge) html.push(ligne(r ? { i: -1, nom: 'Là où j\'étais', region: zone(r.zone), co: '', niv: '', nc: '', titre: `Près de ${r.point.name}` }
      : { i: -1, nom: 'Ressortir', region: 'Dernier Zaap visité', co: '', niv: '', nc: '' }));
    if (!bastion && GAME_DATA.zones.bastion) html.push('<div class="zg">Ville</div>', ligne({ i: World.ZAAP_BASTION, nom: zone('bastion'), region: 'Notre ville', co: '', niv: 'Ville', nc: 'n1' }));
    for (const [id, z] of Object.entries(GAME_DATA.zones)) {
      const cps = z.open?.checkpoints ?? [];
      if (!cps.length) continue;
      const lignes = cps.map(c => {
        const sub = c.sub != null ? z.open!.subareas[String(c.sub)] : undefined, niv = sub?.level ?? z.level ?? 1;
        const i = p.zaaps.findIndex(o => o.zone === id && o.name === c.name), lui = !!ici && wo.opts.zone === id && ici.name === c.name;
        const terr = sub?.name ?? c.name, co = c.map.join(','), bon = !!conseil && conseil.zone === id && conseil.name === c.name;
        const l = lui ? ligne({ nom: terr, region: z.name, co, niv: String(niv), nc: couleur(niv), cls: 'ici', marque: bon ? 'Tu es ici · ★ le plus près de ta quête' : 'Tu es ici' })
          : i >= 0 ? ligne({ i, nom: terr, region: z.name, co, niv: String(niv), nc: couleur(niv), cls: bon ? 'cons' : '', marque: bon ? '★ le plus près de ta quête' : undefined,
            titre: bon ? `Voyager (gratuit) · le Zaap le plus proche de « ${quete} »` : 'Voyager (gratuit)' })
          : ligne({ nom: '???', region: z.name, co, niv: String(niv), nc: couleur(niv), cls: 'nd', titre: `À découvrir : passe sur la carte [${co}] (${terr})` });
        return { niv, l };
      }).sort((a, b) => a.niv - b.niv);
      html.push(`<div class="zg">${escB(z.name)}</div>`, ...lignes.map(o => o.l));
    }
    const titre = bastion ? 'Zaap du Bastion' : refuge ? 'Zaap du Havre-Sac' : 'Zaap';
    w.innerHTML = `${this.title(titre, 'home')}<div class="in zaap">
      <input placeholder="Rechercher une destination" value="${escB(this.rechercheZaap)}" data-rz>
      <div class="zt"><span>Territoire</span><span>Région</span><span>Coordonnées</span><span>Niveau</span></div>
      <div class="zls">${html.join('')}
        <div class="zp">Voyage gratuit · un Zaap grisé s'allume quand tu passes sur sa carte${refuge ? '' : ' · le Bastion te ramène ensuite ici'}</div></div></div>`;
    const filtrer = () => {
      const q = this.rechercheZaap.trim().toLowerCase();
      w.querySelectorAll<HTMLElement>('.zl').forEach(e => { e.style.display = !q || e.dataset.q!.includes(q) ? '' : 'none'; });
    };
    const champ = w.querySelector<HTMLInputElement>('[data-rz]')!;
    champ.addEventListener('input', () => { this.rechercheZaap = champ.value; filtrer(); });
    filtrer();
    w.querySelectorAll<HTMLElement>('[data-zaap]').forEach(e => e.addEventListener('click', () => { this.onZaap(+e.dataset.zaap!); this.close(); }));
  }

  /** Garde-robe (Apparence 6B, gratuite, en ville) : tête de création, 6 couleurs, palettes, avec l'aperçu en direct. */
  private renderGarde() {
    const w = this.win!, p = this.world.player, f = this.fiche, g = this.garde;
    const [cls, sx] = (this.perso?.cle ?? 'iop_m').split('_');
    const corps = !f || !g ? '<div class="hint">Chargement…</div>' : `<div>
      <h5>Tête</h5>
      <div class="tetes">${f.tetes.map((_, i) => `<button type="button" data-gtete="${i}" class="${g.tete === i ? 'on' : ''}" title="Tête ${i + 1}"
        style="background-image:url(${v(`${DOSSIER}/tetes_${cls}_${sx}.webp`)});background-size:${f.tetes.length * 100}% 100%;background-position:${f.tetes.length > 1 ? (i / (f.tetes.length - 1)) * 100 : 0}% 0"></button>`).join('')}</div>
      <h5>Couleurs</h5>
      <div class="coul">${g.couleurs.map((c, i) => `<label><input type="color" data-gcoul="${i}" value="${hexa(c)}">${ZONES[i]}</label>`).join('')}</div>
      <h5>Palettes</h5>
      <div class="pals">${PALETTES.map((pl, i) => `<button type="button" data-gpal="${i}">${pl.c.slice(0, 3).map(x => `<i style="background:${hexa(x)}"></i>`).join('')}${pl.nom}</button>`).join('')}
        <button type="button" data-gofficiel>Couleurs officielles</button></div>
      <div style="display:flex;gap:10px;margin-top:14px;align-items:center"><span class="btn" data-genr>Enregistrer</span><span class="hint">Gratuit, à chaque garde-robe des villes.</span></div></div>`;
    w.innerHTML = `${this.title('Garde-robe', 'inventory')}<div class="in garde"><div class="apercu">${g ? this.canevas('', objetsPortes(p.equipment, p.apparat), g) : ''}</div>${corps}</div>`;
    if (!f || !g) return;
    const apercu = () => { const cv = w.querySelector<HTMLCanvasElement>('.apercu canvas'); if (cv) cv.dataset.app = JSON.stringify(g); };
    w.querySelectorAll<HTMLElement>('[data-gtete]').forEach(e => e.addEventListener('click', () => { g.tete = +e.dataset.gtete!; this.render(); }));
    w.querySelectorAll<HTMLInputElement>('[data-gcoul]').forEach(e => e.addEventListener('input', () => { g.couleurs[+e.dataset.gcoul!] = parseInt(e.value.slice(1), 16); apercu(); }));
    w.querySelectorAll<HTMLElement>('[data-gpal]').forEach(e => e.addEventListener('click', () => { g.couleurs = [g.couleurs[0], ...PALETTES[+e.dataset.gpal!].c]; this.render(); }));
    w.querySelector('[data-gofficiel]')?.addEventListener('click', () => { g.couleurs = [...f.couleurs]; this.render(); });
    w.querySelector('[data-genr]')?.addEventListener('click', () => {
      const a = apparenceValide(f, g);
      if (this.perso) this.perso.app = a;
      this.onApparence(a); this.close();
    });
  }

  /** Canevas du perso dessiné en direct (classe `k`), avec ces objets visibles ; redessiné par majPerso(). */
  private canevas(k: string, objets: string[], app?: Apparence) {
    return `<canvas class="vivant ${k}" data-objets="${objets.join(',')}"${app ? ` data-app='${JSON.stringify(app)}'` : ''}></canvas>`;
  }
  private vivants = new Map<string, Assemblage | null>();
  private imageVivant = 0;
  /** À appeler à chaque image du jeu : anime les persos dessinés en direct des fenêtres ouvertes (25 images par seconde). */
  majPerso(t: number) {
    if (!this.win || !this.perso) return;
    const f = Math.floor(t / 40); if (f === this.imageVivant) return; this.imageVivant = f;
    this.win.querySelectorAll<HTMLCanvasElement>('canvas.vivant').forEach(cv => {
      const app = cv.dataset.app ? JSON.parse(cv.dataset.app) as Apparence : this.perso!.app, objets = cv.dataset.objets ? cv.dataset.objets.split(',') : [];
      const k = `${app.tete}|${objets}`;
      const a = this.vivants.get(k);
      if (!a) { if (!this.vivants.has(k)) { this.vivants.set(k, null); assemblagePour(this.perso!.cle, app, objets).then(x => this.vivants.set(k, x), () => this.vivants.delete(k)); } return; }
      a.recolorer(app.couleurs);
      const dpr = (devicePixelRatio || 1) * 2, W = Math.round(cv.offsetWidth * dpr), H = Math.round(cv.offsetHeight * dpr);   // 2x puis réduit : bords lisses
      if (!W || !H) return;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const anim = 'AnimStatiqueExplo0_1', n = a.compte[anim] ?? 0; if (!n) return;
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      a.dessiner(ctx, anim, Math.floor(f * 0.8) % n, W / 2, H * 0.93, H / 330);
    });
  }

  /** Contenu du sac selon l'onglet, la catégorie, le tri et la recherche ; les ressources s'empilent.
   *  La grille est complétée de cases vides, comme dans Dofus. */
  private cells(): { html: string; n: number } {
    const p = this.world.player, q = this.search.toLowerCase();
    const cells: string[] = [];
    if (this.tab === 'tout' || this.tab === 'equip') {
      const items = p.bag.filter(it => {
        const d = ITEMS.equipment[it.id];
        return d && (!this.kind || d.slot === this.kind) && (!q || d.name.toLowerCase().includes(q));
      });
      const D = (it: Item) => ITEMS.equipment[it.id];
      if (this.sort === 'niveau') items.sort((x, y) => D(y).level - D(x).level);
      if (this.sort === 'rarete') items.sort((x, y) => RARITY_ORDER[y.rarity] - RARITY_ORDER[x.rarity]);
      if (this.sort === 'nom') items.sort((x, y) => D(x).name.localeCompare(D(y).name));
      for (const it of items) {
        const d = D(it), slot = p.slotFor(it), cur = slot ? p.equipment[slot] : undefined;
        const up = d.level <= p.level && (!cur || this.score(it) > this.score(cur));
        cells.push(`<div class="cell ${up ? 'up' : ''} ${d.level > p.level ? 'low' : ''}" data-uid="${it.uid}">${iconHtml(d.icon)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i>${it.cadenas ? CADENAS : ''}</div>`);
      }
    }
    if ((this.tab === 'tout' || this.tab === 'ressource' || this.tab === 'conso') && !this.kind) for (const [id, n] of Object.entries(p.resources)) {
      const r = ITEMS.resources[id];
      if (!r || (q && !r.name.toLowerCase().includes(q))) continue;
      if (this.tab === 'conso' && !r.soin && !r.rappel) continue;
      cells.push(`<div class="cell" data-res="${id}">${iconHtml(r.icon)}<span class="n">${n}</span></div>`);
    }
    // Dofus possédés mais pas portés (6B : on les glisse du sac vers la rangée de 6 cases)
    if (this.tab === 'tout' && !this.kind && p.v03) for (const id of [...p.dofus, ...p.trophees]) {
      if (p.dofusPortes.includes(id)) continue;
      const d = PORTABLE(id); if (!d || (q && !d.nom.toLowerCase().includes(q))) continue;
      cells.push(`<div class="cell" data-dsac="${id}" draggable="true">${iconHtml(d.icon)}<i class="r" style="background:#e9c46a"></i></div>`);
    }
    // Objets de quête (pages, Sac de Bijoux...) : onglet « Objets de quête » ; ils partent à la fin de la quête
    if ((this.tab === 'tout' || this.tab === 'quete') && !this.kind) for (const [nom, k] of Object.entries(this.world.quetes?.objets ?? {})) {
      if (q && !nom.toLowerCase().includes(q)) continue;
      cells.push(`<div class="cell" title="${nom} (objet de quête)"><img src="${INV}/tab_key.png" alt="" style="width:34px;height:34px;opacity:.9"><span class="n">${k}</span></div>`);
    }
    // Apparats possédés (5A) : achetés chez Emp ; celui qui est porté est entouré
    if (this.tab === 'apparat') for (const id of p.apparats) {
      const d = APPARATS.objets[id];
      if (!d || (this.kind && d.slot !== this.kind) || (q && !d.name.toLowerCase().includes(q))) continue;
      cells.push(`<div class="cell ${p.apparat[d.slot] === id ? 'porte' : ''}" data-app="${id}">${apparatHtml(id)}</div>`);
    }
    if (this.tab === 'apparat') {   // collection d'apparences (1C) : coiffes, capes et boucliers brisés ou recyclés
      const tous = Object.values(APPARATS.objets).filter(d => d.collection), eu = p.apparats.filter(id => APPARATS.objets[id]?.collection).length;
      cells.push(`<div class="hint" style="grid-column:1/-1">${p.apparats.length ? '' : 'Les apparats s\'achètent chez Tissebelle, au Bastion des Douze. '}Collection : <b>${eu} / ${tous.length}</b> apparences. Brise ou recycle une coiffe, une cape ou un bouclier pour garder son apparence.</div>`);
    }
    const n = cells.length;
    for (let i = n; i < Math.max(35, Math.ceil(n / 5) * 5); i++) cells.push('<div class="cell empty"></div>');
    return { html: cells.join(''), n };
  }
  /** Note grossière d'un objet pour la flèche verte « meilleur que l'objet porté ». */
  private score(it: Item): number {
    let s = 0;
    for (const [k, v] of Object.entries(it.stats) as [Stat, number][]) s += v * (k === 'vitalite' ? 0.5 : k === 'critique' ? 3 : k.startsWith('dommages') ? 4 : k === 'pa' || k === 'pm' ? 40 : 1);
    return s + (it.legendary ? 30 : 0) + (it.legendary2 ? 30 : 0);
  }

  private setsHtml(): string {
    const p = this.world.player, out: string[] = [];
    for (const [id, n] of Object.entries(p.setCount)) {
      const s = ITEMS.sets[id]; if (!s || n < 2) continue;
      const b = s.bonus[String(n - 1)] ?? {};
      out.push(`<div><b>${s.name}</b> (${n} / ${s.items.length}) · <span>${Object.entries(b).map(([k, v]) => `+${v} ${STAT_NAMES[k as Stat]}`).join(' · ')}</span></div>`);
    }
    return out.join('');
  }

  // --- Fiche d'objet au survol : jets, rareté, panoplie, comparaison avec l'objet porté ---
  private showTip(it: Item, ev: MouseEvent, worn: boolean) {
    const p = this.world.player, d = ITEMS.equipment[it.id];
    if (!d) return;
    const slot = p.slotFor(it), cur = !worn && slot ? p.equipment[slot] : undefined;
    const line = (k: Stat, v: number) => `<div class="${it.extra.includes(k) ? 'ex' : v < 0 ? 'down' : ''}">${v > 0 ? '+' : ''}${v} ${STAT_NAMES[k]}</div>`;
    const stats = STATS.filter(k => it.stats[k] !== undefined).map(k => line(k, it.stats[k]!)).join('');
    const weapon = (d.weapon ? `<div>${d.weapon.dmg.map(x => `${x.min}–${x.max} dommages ${x.element}`).join(' · ')}</div>` : '')
      + (d.chasse ? '<div class="ex">Arme de chasse</div>' : '');
    const leg = [it.legendary, it.legendary2].map(l => {
      if (!l) return '';
      // Pouvoir officiel (0.3) : grisé s'il ne sert pas encore (sort à venir, autre classe)
      const o = POUVOIR_PAR_ID[l.id], k = o && Object.keys(p.cls.spells).find(x => p.cls.spells[x].dofusId === o.dofusId);
      const { nom, texte } = lignePouvoir(l, l.sort && p.cls.spells[l.sort]?.name, !!k && p.zoneSeule(k));
      const e = p.etatPouvoir(l.id);
      const pc = PC_PAR_ID[l.id] ? '<span style="color:#ff9a3c;font-size:11px">Pouvoir de classe</span><br>' : '';
      return e.actif ? `<div class="leg">${pc}<b>${nom}</b> : ${texte}</div>`
        : `<div class="leg off">${pc}<b>${nom}</b> : ${texte} <i>(${e.raison})</i></div>`;
    }).join('');
    // 14D : sceau « Nouveau pour le Codex » (0.3) sur un pouvoir pas encore enregistré
    const neuf = p.v03 && [it.legendary, it.legendary2].some(l => l && nouveauPourCodex(p.codex, p.cls.sorts, l)) ? '<div class="leg">✦ Nouveau pour le Codex : brise-le chez Malek pour le garder</div>' : '';
    const set = d.set && ITEMS.sets[d.set] ? `<div class="set">${ITEMS.sets[d.set].name}</div>` : '';
    let cmp = '';
    if (cur) {
      const ks = STATS.filter(k => (it.stats[k] ?? 0) !== (cur.stats[k] ?? 0));
      cmp = `<div class="cmp">Par rapport à ${ITEMS.equipment[cur.id]?.name ?? 'l\'objet porté'} :<br>${ks.map(k => {
        const dv = (it.stats[k] ?? 0) - (cur.stats[k] ?? 0);
        return `<span class="${dv > 0 ? 'up' : 'down'}">${p.v03 ? (dv > 0 ? '▲ ' : '▼ ') : ''}${dv > 0 ? '+' : ''}${dv} ${STAT_NAMES[k]}</span>`;
      }).join('<br>') || 'identique'}${p.v03 ? [cur.legendary, cur.legendary2].map(l => {   // 14A : le pouvoir de l'objet porté, rappelé
        if (!l) return '';
        const { nom } = lignePouvoir(l, l.sort && p.cls.spells[l.sort]?.name, false);
        return `<br><span class="leg">Tu perds : ${nom}</span>`;
      }).join('') : ''}</div>`;
    }
    const lvl = d.level > p.level ? `<div class="down">Niveau ${d.level} requis</div>` : '';
    let fam = '';
    if (d.familier) {   // familier : son niveau, son XP, et ses bonus au niveau 100
      const n = it.niv ?? 1, c = FAMILIERS.xp, a = c[n - 1] ?? 0, b = c[n] ?? a, x = it.xpF ?? 0;
      const max = STATS.filter(k => d.stats[k]).map(k => `${d.stats[k]![1]} ${STAT_NAMES[k]}`).join(' · ');
      fam = `<div class="ex">Familier niveau ${n} / ${FAMILIER_MAX}</div>${porteur(it.id)}${n < FAMILIER_MAX ? `<div class="xpf"><i style="width:${Math.round(100 * Math.min(1, (x - a) / Math.max(1, b - a)))}%"></i></div>` : ''}
        ${max ? `<div class="hint">Au niveau 100 : ${max}</div>` : ''}
        <div class="hint">Il gagne de l'XP quand tu chasses, et quand tu le nourris (Alt + clic sur un objet ou une ressource du sac).</div>`;
    } else if (p.equipment.familier && !worn) fam = `<div class="hint">Alt + clic : le donner à manger au familier (+${FAMILIER_XP.objet(d.level, it.rarity)} XP)</div>`;
    this.tip.innerHTML = `<h4 style="color:${RARITY_COLORS[it.rarity]}">${d.name}</h4>
      <div class="sub">${d.familier ? 'Familier' : `${RARITY_NAMES[it.rarity]} · ${d.weapon?.type ?? SLOT_NAMES[(slot ?? 'amulette') as EquipSlot]}`} · niveau ${d.level}</div>
      ${weapon}${stats}${fam}${leg}${neuf}${set}${it.signe ? `<div class="sig">Signé par ${it.signe.replace(/[&<>"]/g, '')}</div>` : ''}${lvl}${cmp}${sourcesHtml(it.id, 3)}
      <div class="hint">${worn ? 'Clic droit : retirer' : it.cadenas ? 'Sous cadenas : jamais recyclé · Ctrl + clic : l\'ôter' : `Clic droit : équiper · Ctrl + clic : cadenas (recyclage chez Kerubim : ${recycleValue(d, it)} Pépites)`}</div>`;
    this.tip.style.display = 'block'; this.moveTip(ev);
  }
  private moveTip(ev: MouseEvent) {
    const t = this.tip, w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = `${Math.min(innerWidth - w - 8, ev.clientX + 16)}px`;
    t.style.top = `${Math.min(innerHeight - h - 8, ev.clientY + 12)}px`;
  }
  hideTip() { this.tip.style.display = 'none'; this.ancreTip = null; }
  /** Infobulle libre (sorts de la barre), au-dessus du point (x, y) de l'écran. */
  showHtmlTip(html: string, x: number, y: number) {
    const t = this.tip; t.innerHTML = html; t.style.display = 'block';
    this.ancreTip = [x, y]; this.placerTip();
  }
  private ancreTip: [number, number] | null = null;
  private placerTip() {
    const t = this.tip, a = this.ancreTip; if (!a || t.style.display === 'none') return;
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, a[0] - w / 2))}px`;
    t.style.top = `${Math.max(8, a[1] - h - 12)}px`;
  }
  /** Menu sorts 8A : Maj maintenu = infobulle des sorts détaillée (le bas reste collé à la barre). */
  private majTip = (e: Event) => {
    const on = e instanceof KeyboardEvent ? e.shiftKey : false;
    if (this.root.classList.contains('maj-tip') === on) return;
    this.root.classList.toggle('maj-tip', on);
    this.placerTip();
  };

}
