import { REGLAGES_DEFAUT, sauverReglages, type Reglages } from './ambiance';
import { ICON_CSS, iconHtml } from './icons';
import { MANIFESTE, Son } from './son';
import { APPARATS, BOUTIQUES, FAMILIERS, GAME_DATA, ITEMS, QUETES, RECOLTES } from '../sim/data';
import { v } from './assetUrl';
import { BUTIN_CSS, butinMonstre, dessinerPortraits, esc as escB, groupesBestiaire, nomObjet, iconeObjet, sourcesHtml } from './butinVue';
import { PALIERS } from './carnet';
import { FORGE_CSS, etatForge, forgeHtml, texteForge } from './forgeVue';
import { RUNES } from '../sim/forgemagie';
import { LOOKS } from './looks';
import { niveauHorsPartie, rangDe } from '../sim/butin';
import { DOSSIER, PALETTES, ZONES, apparenceValide, assemblagePour, fiches, objetsPortes, type Apparence, type Assemblage, type FichePerso } from './squelette';
import {
  BASE_STATS, REDUCTION_RECHARGES_MAX, FAMILIER_MAX, FAMILIER_XP, LEGENDARY, METIER_XP, PEPITE, RARITY_COLORS, RARITY_NAMES, STATS, STAT_NAMES, metierXpNeeded, recycleResource, recycleValue,
  type EquipSlot, type Item, type Rarity, type ResourceDef, type Stat,
} from '../sim/items';
import { Player } from '../sim/player';
import { dmgMoyen, gradeAuNiveau, type SortOfficiel } from '../sim/sorts';
import { n1, spellDetail } from './spellTip';
import { World } from '../sim/world';
import { prochainPalier, recettesAvec, recettesDe, sourcesDe } from '../sim/metiers';
import { chrono } from '../sim/quests';
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
.dw .tip .up{color:#7be07b}.dw .tip .down{color:#e0625a}.dw .tip .ex{color:#6fb2e8}.dw .tip .leg{color:#f08a2c;margin-top:4px}
.dw .tip .set{color:#9ad15a;margin-top:6px;font-size:12px}.dw .tip .hint{color:#7f7a64;font-size:11px;margin-top:6px}
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

type Mode = 'inv' | 'car' | 'job' | 'art' | 'opt' | 'sorts' | 'quetes' | 'succes' | 'guide' | 'emp' | 'garde' | 'zaap' | 'bestiaire' | 'forge';

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
  private succesCat = '';
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
  onChange: () => void = () => {};
  /** Bestiaire (maquette « Drops » 1A) : monstres vaincus par le compte (lus par la scène) ; partie de test : tout est visible. */
  vaincus: () => Record<string, number> = () => ({});
  toutVoir = false;
  private bestType = '';
  private bestObjet: string | null = null;
  private bestOnglet: 'butin' | 'sorts' | 'res' = 'butin';
  private bestRecherche = '';
  /** Fenêtre du forgemage (maquette « Forgemagie ») : onglet, objet choisi, journal des essais, mode « viser ». */
  private forge = etatForge();

  constructor(private world: World) {
    const style = document.createElement('style'); style.textContent = CSS + ICON_CSS + BUTIN_CSS + FORGE_CSS; document.head.appendChild(style);
    this.root = document.createElement('div'); this.root.className = 'dw'; document.body.appendChild(this.root);
    this.tip = document.createElement('div'); this.tip.className = 'tip'; this.tip.style.display = 'none'; this.root.appendChild(this.tip);
  }
  get open() { return !!this.win; }
  /** Fenêtre ouverte (ou null). */
  get ouverte(): Mode | null { return this.win ? this.mode : null; }
  /** Ouvre la fenêtre demandée, ou la ferme si c'est déjà elle. */
  toggle(mode: Mode = 'inv') { if (this.win && this.mode === mode) this.close(); else this.show(mode); }
  close(son = true) {
    if (this.win && son) Son.jouer(MANIFESTE.ui.fermer, 'interface', { cle: 'fenetre', ecart: 0.1 });   // 6B
    this.win?.remove(); this.win = null; this.tip.style.display = 'none';
  }
  destroy() { this.root.remove(); }

  show(mode: Mode = 'inv') {
    this.close(false);
    Son.jouer(MANIFESTE.ui.ouvrir, 'interface', { cle: 'fenetre', ecart: 0.1 });   // 6B : ouverture, puis clic sur les boutons

    this.mode = mode;
    if (mode === 'garde') {
      this.garde = this.perso ? { tete: this.perso.app.tete, couleurs: [...this.perso.app.couleurs] } : null;
      if (this.perso && !this.fiche) fiches().then(f => { this.fiche = f[this.perso!.cle] ?? null; this.refresh(); }, () => {});
    }
    const w = document.createElement('div'); w.className = mode === 'guide' ? 'win opt guide' : `win ${mode}`;   // le Guide reprend la mise en page des Options
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
    else if (this.mode === 'garde') this.renderGarde(); else if (this.mode === 'bestiaire') this.renderBestiaire(); else if (this.mode === 'forge') this.renderForge(); else this.renderInv();
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
            <div class="stage"><div class="lv">${p.cls.name} · niveau ${p.level}</div><img class="socle" src="assets/ui/socle.png" alt="">${this.perso ? this.canevas('who', objetsPortes(p.equipment, p.apparat)) : `<img class="who" src="${this.portrait}" alt="">`}</div>
            <div class="slots">${RIGHT.map(slot).join('')}</div>
          </div>
          <div class="appa"><span title="Apparat : change seulement l'apparence. Clic : choisir ; clic droit : retirer, ou cacher l'objet porté">Apparence</span>${VISIBLES.map(([k, n]) => {
            const a = p.apparat[k], ic = a && a !== '0' ? apparatHtml(a) : '';
            return `<div class="slot ${a === '0' ? 'cache' : ''}" data-appa="${k}" title="${n} : ${a === '0' ? 'cachée' : a ? APPARATS.objets[a]?.name ?? '' : 'objet porté'}" style="${ic ? '' : `background-image:url(${D3}/tx_slot_${SLOT_D3[k]}.png)`}">${ic}</div>`; }).join('')}</div>
          <div class="sets">${this.setsHtml()}</div>
          <div class="dofus">${Array.from({ length: 6 }, () => `<div class="slot" title="Dofus (plus tard)" style="background-image:url(${D3}/tx_slot_dofus.png)"></div>`).join('')}</div>
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
            <div class="foot"><span>Visible(s) : <b>${n}</b> · sac <b>${p.bag.length} / ${Player.BAG_SIZE}</b><br><span class="hint">Clic droit : équiper / retirer · Maj + clic : recycler · Ctrl + clic : cadenas${p.equipment.familier ? ' · Alt + clic : nourrir le familier' : ''}</span></span>
              <span class="k">${p.kamas.toLocaleString('fr-FR')} <img src="${INV}/kamas.png" alt="" title="Kamas"></span></div>
            <div class="foot"><span>Butin affiché au sol</span>
              <select data-filter style="width:auto">${['Tout', 'Rare et plus', 'Épique et plus'].map((n, i) => `<option value="${i}" ${p.lootFilter === i ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          </div>
        </div>
      </div>`;
    w.querySelectorAll<HTMLElement>('[data-tab]').forEach(e => e.addEventListener('click', () => { this.tab = e.dataset.tab!; this.render(); }));
    w.querySelector<HTMLSelectElement>('[data-sort]')!.addEventListener('change', e => { this.sort = (e.target as HTMLSelectElement).value; this.render(); });
    w.querySelector<HTMLSelectElement>('[data-kind]')!.addEventListener('change', e => { this.kind = (e.target as HTMLSelectElement).value; this.render(); });
    w.querySelector<HTMLSelectElement>('[data-filter]')!.addEventListener('change', e => { p.lootFilter = +(e.target as HTMLSelectElement).value; this.render(); });
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
    // Case Apparence (5A) : clic = les apparats de cet emplacement ; clic droit = retirer l'apparat, sinon cacher / montrer l'objet porté
    w.querySelectorAll<HTMLElement>('[data-appa]').forEach(e => {
      const k = e.dataset.appa as Visible;
      e.addEventListener('click', () => { this.tab = 'apparat'; this.kind = k === 'bouclier' ? '' : k; this.render(); });
      e.addEventListener('contextmenu', () => { this.world.porterApparat(k, p.apparat[k] ? null : '0'); this.changed(); });
    });
    w.querySelectorAll<HTMLElement>('[data-app]').forEach(e => {
      const id = e.dataset.app!, d = APPARATS.objets[id];
      const porter = () => { this.world.porterApparat(d.slot, p.apparat[d.slot] === id ? null : id); this.changed(); };
      e.addEventListener('mouseenter', ev => { this.tip.innerHTML = `<h4>${d.name}</h4><div class="sub">${d.slot === 'chapeau' ? 'Coiffe' : d.slot === 'cape' ? 'Cape' : 'Familier'} d'apparat</div><div class="hint">Change seulement l'apparence. Clic droit : porter / retirer</div>`; this.tip.style.display = 'block'; this.moveTip(ev); });
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
        else if (ev.ctrlKey || ev.metaKey) { this.world.cadenas(uid); this.changed(); } else if (ev.shiftKey) { this.world.recycle(uid); this.changed(); } });
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
    if (s.boutique) l.push(`<b>Boutique</b> · ${QUETES.pnj[s.boutique]?.nom ?? s.boutique}, au Bastion des Douze`);
    const sert = recettesAvec(ITEMS, id).map(x => ITEMS.resources[x.result]?.name).filter(Boolean);
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
    const cles = Object.keys(M);
    if (!M[this.jobSel]) this.jobSel = cles.slice().sort((a, b) => p.metierLevel(b) - p.metierLevel(a))[0] ?? '';
    const k = this.jobSel, m = M[k];
    const liste = cles.map(c => {
      const st = p.metiers[c] ?? { level: 1, xp: 0 };
      return `<div class="jm ${c === k ? 'on' : ''}" data-met="${c}"><img src="assets/ui/metier_${c}.png" alt=""><div><b>${M[c].name}<small>${Math.max(1, st.level)}</small></b><div class="xpb"><i style="width:${Math.round(st.xp / metierXpNeeded(Math.max(1, st.level)) * 100)}%"></i></div></div></div>`;
    }).join('') + '<div class="jm lock" title="Fabrication d\'équipement : version 0.3"><img src="assets/ui/menu/job.png" alt=""><div><b>Forgeron, Tailleur…</b><small class="hint">en 0.3</small></div></div>';
    if (!m) { w.innerHTML = `${this.title('Métiers', 'job')}<div class="in"><div class="hint">Aucun métier.</div></div>`; return; }
    const st = p.metiers[k] ?? { level: 1, xp: 0 }, lv = Math.max(1, st.level), need = metierXpNeeded(lv);
    const recolte = Object.entries(RECOLTES.ressources).filter(([, r]) => r.metier === k).sort((a, b) => a[1].niveau - b[1].niveau);
    const pal = prochainPalier(ITEMS, k, lv);
    const gain = k === 'chasseur' ? 'une viande ramassée ou un plat cuisiné' : recolte.length ? 'chaque récolte et chaque objet fabriqué' : 'chaque objet fabriqué';
    const ateliers = [...new Set(this.world.ateliersDe(k).map(a => a.nom))];
    const tete = `<div class="jt"><img src="assets/ui/metier_${k}.png" alt=""><div><h3>${m.name} <span>niveau ${lv}</span></h3>
        <div class="xpb big"><i style="width:${Math.round(st.xp / need * 100)}%"></i></div><div class="hint">${st.xp} / ${need} XP · ${gain} fait monter le métier</div></div>
        ${pal ? `<div class="pal"><b>Prochain palier : ${pal.niveau}</b>${pal.recettes.map(r => ITEMS.resources[r.result]?.name).join(', ')}</div>` : ''}</div>`;
    const onglets = `<div class="otabs"><span class="${this.jobOnglet === 'recettes' ? 'on' : ''}" data-jo="recettes">Recettes (${recettesDe(ITEMS, k).length})</span><span class="${this.jobOnglet === 'recoltes' ? 'on' : ''}" data-jo="recoltes">Récoltes (${recolte.length})</span></div>`;
    let corps = '';
    if (this.jobOnglet === 'recettes') {
      const q = this.jobRecherche.trim().toLowerCase();
      let l = recettesDe(ITEMS, k).filter(({ r }) => !q || ITEMS.resources[r.result]?.name.toLowerCase().includes(q) || r.ingredients.some(([id]) => ITEMS.resources[id]?.name.toLowerCase().includes(q)));
      if (this.jobMonNiveau) l = l.filter(({ r }) => r.level <= lv);
      if (this.jobFaisables) l = [...l.filter(({ i }) => this.world.craftMax(i) > 0), ...l.filter(({ i }) => this.world.craftMax(i) <= 0)];
      const filtres = `<div class="jf"><input placeholder="Chercher une recette ou un ingrédient…" value="${this.jobRecherche.replace(/"/g, '&quot;')}" data-jr>
        <label class="ck"><input type="checkbox" data-jfa ${this.jobFaisables ? 'checked' : ''}>Faisables d'abord</label><label class="ck"><input type="checkbox" data-jmn ${this.jobMonNiveau ? 'checked' : ''}>Mon niveau</label></div>`;
      const ou = ateliers.length ? `<div class="note">On fabrique en cliquant une machine : ${ateliers.join(', ')}.</div>` : `<div class="note">Pas d'atelier de ${m.name.toLowerCase()} dans cette zone.</div>`;
      corps = filtres + ou + `<div class="recs">${l.map(({ r, i }) => {
        const out = ITEMS.resources[r.result], ok = lv >= r.level, max = this.world.craftMax(i), suivie = p.recetteSuivie === r.result;
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
      const r = ITEMS.resources[e.dataset.rtip!];
      e.addEventListener('mouseenter', ev => { if (!r) return; this.tip.innerHTML = this.resTip(r, e.dataset.rtip!); this.tip.style.display = 'block'; this.moveTip(ev); });
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
    let l = toutes.filter(({ r }) => !q || ITEMS.resources[r.result]?.name.toLowerCase().includes(q) || r.ingredients.some(([id]) => ITEMS.resources[id]?.name.toLowerCase().includes(q)));
    if (this.artSeulement) l = l.filter(({ i }) => this.world.craftMax(i) > 0);
    if (!toutes.some(x => x.i === this.artRecette)) this.artRecette = (toutes.find(({ i }) => this.world.craftMax(i) > 0) ?? toutes[0])?.i ?? -1;
    const rec = this.artRecette >= 0 ? ITEMS.recipes![this.artRecette] : null, max = rec ? this.world.craftMax(this.artRecette) : 0;
    this.artQte = Math.max(1, Math.min(this.artQte, Math.max(1, max)));
    const f = this.world.enFabrication, out = rec && ITEMS.resources[rec.result];
    const livre = l.map(({ r, i }) => {
      const o = ITEMS.resources[r.result], mx = this.world.craftMax(i), ok = lv >= r.level;
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
        ${rec && out ? `<div class="ares"><span class="ac big" data-rtip="${rec.result}">${iconHtml(out.icon)}</span><b>${out.name}</b><small>${out.soin ? `Rend ${out.soin} PV · ` : ''}niveau ${rec.level}</small></div>
        <div class="acs"><span class="lab">Ingrédients</span>${cases}</div>
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
    w.querySelector<HTMLElement>('[data-fab]')?.addEventListener('click', () => { if (this.world.lancerFabrication(this.artRecette, this.artQte)) this.render(); });
    w.querySelectorAll<HTMLElement>('[data-rtip]').forEach(e => {
      const r = ITEMS.resources[e.dataset.rtip!];
      e.addEventListener('mouseenter', ev => { if (!r) return; this.tip.innerHTML = this.resTip(r, e.dataset.rtip!); this.tip.style.display = 'block'; this.moveTip(ev); });
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

  /** Succès (fenêtre Succès de Dofus 3, 12A) : catégories officielles à gauche, points du compte (15A), objectifs et récompenses. */
  private renderSucces() {
    const w = this.win!, Q = this.world.quetes!, all = Object.entries(Q.data.succes);
    const cats = [...new Set(all.map(([, s]) => s.categorie))];
    if (!cats.includes(this.succesCat)) this.succesCat = cats[0] ?? '';
    const total = all.reduce((n, [, s]) => n + s.points, 0);
    const catList = cats.map(c => {
      const ss = all.filter(([, s]) => s.categorie === c), ok = ss.filter(([id]) => Q.succes.has(id)).length;
      return `<div class="qi ${c === this.succesCat ? 'on' : ''}" data-c="${c}"><img src="assets/ui/menu/success.png" alt=""><div>${c}<br><small>${ok} / ${ss.length}</small></div><span></span></div>`;
    }).join('');
    const subs = [...new Set(all.filter(([, s]) => s.categorie === this.succesCat).map(([, s]) => s.sousCategorie))];
    const list = subs.map(sc => `<div class="qh">${sc}</div>` + all.filter(([, s]) => s.categorie === this.succesCat && s.sousCategorie === sc).map(([id, s]) => {
      const ok = Q.succes.has(id), done = s.objectifs.filter(o => ok || Q.objectifSuccesFait(o)).length;
      const r = s.recompense, it = r?.objet ? ITEMS.resources[r.objet] ?? ITEMS.equipment[r.objet] : null;
      const rw = [r?.xp ? `<span><b>${r.xp}</b> XP</span>` : '', it ? `<span>${iconHtml(it.icon)}${it.name}</span>` : ''].filter(Boolean).join('');
      return `<div class="su ${ok ? 'ok' : ''}"><div class="hd"><b>${ok ? '✓ ' : ''}${s.nom}</b><span class="pt">${s.points} pt${s.points > 1 ? 's' : ''}</span></div>
        <div class="sub">${s.description}</div>
        ${s.objectifs.length > 1 ? s.objectifs.map(o => { const f = ok || Q.objectifSuccesFait(o); return `<div class="ob ${f ? 'ok' : ''}"><span>${f ? '✓' : '•'} ${o.nom}</span></div>`; }).join('') : ''}
        <div class="sp2"><i style="width:${Math.round(done / Math.max(1, s.objectifs.length) * 100)}%"></i></div>
        ${rw ? `<div class="rw">${rw}</div>` : ''}</div>`;
    }).join('')).join('');
    w.innerHTML = `${this.title('Succès', 'success')}<div class="qb"><div class="ql">
      <div class="qh">Points de succès : ${Q.points} / ${total}</div>${catList}</div><div class="qd">${list}</div></div>`;
    w.querySelectorAll<HTMLElement>('[data-c]').forEach(e => e.addEventListener('click', () => { this.succesCat = e.dataset.c!; this.render(); }));
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
    const PAGES: { id: string; titre: string; html: string }[] = [
      { id: 'bienvenue', titre: 'Bienvenue', html: `<p class="chapo">Explore le Monde des Douze, rencontre ses habitants et combats en temps réel : tes déplacements et tes sorts se jouent sans attendre.</p>
        <h3>Un monde à parcourir</h3><p>Passe d'une carte à l'autre sans chargement, entre dans les maisons par leurs portes et parle aux PNJ en cliquant dessus. La mini-carte en haut à droite montre les monstres (points rouges), les PNJ qui ont une quête (points verts) et ta destination (point doré).</p>
        <h3>Ton but</h3><p>Suis la quête affichée en bas à gauche. Une flèche dorée au bord de l'écran indique où aller quand c'est loin.</p>` },
      { id: 'combat', titre: 'Se déplacer et combattre', html: `<h3>À la souris</h3><p>${k('Clic gauche')} sur le sol : y aller (maintenu : suivre le curseur). Sur un monstre : s'approcher et l'attaquer.</p>
        <p>${k('Maj + clic')} : attaquer sur place, sans bouger.</p><p>${k('Clic droit')} : lancer le sort de la case libre de la barre. Sur un PNJ : ses actions.</p>
        <h3>Esquiver</h3><p>${k('Espace')} : ${mob}. Il a des charges qui se rechargent toutes seules.</p>
        <h3>Se soigner</h3><p>${k('E')} : boire une potion. Chaque groupe de monstres vaincu en rend une.</p>
        <h3>Mourir</h3><p>Tu reviens au dernier point de retour. En mode Hardcore, la mort est définitive.</p>` },
      { id: 'sorts', titre: `Sorts et ${jauge}`, html: `<h3>La barre de sorts</h3><p>${k('&')} ${k('é')} ${k('"')} ${k("'")} ${k('(')} ${k('-')} lancent les 6 sorts de la barre (1 à 6 sur un clavier QWERTY). Chaque sort coûte des PA, qui remontent tout seuls, et a sa recharge.</p>
        <p>${k('S')} ouvre la fenêtre des sorts : de nouveaux sorts arrivent aux niveaux officiels de Dofus. Glisse-les dans la barre.</p>
        <h3>${jauge}</h3><p>${iop ? 'La Rage monte quand tu frappes, surtout au corps à corps, et quand tu es touché.' : 'La Précision monte quand tu touches, surtout de loin (plus de 4 cases).'} Pleine, elle renforce ton prochain sort.</p>
        <p>Dans ${k('O')} Options, tu peux choisir comment lancer un sort : relâcher la touche, tout de suite, ou comme dans Dofus (touche puis clic).</p>` },
      { id: 'butin', titre: 'Inventaire et butin', html: `<h3>Ramasser</h3><p>Clique sur un objet au sol pour le ramasser. Les objets Épiques et mieux apparaissent aussi sur la mini-carte.</p>
        <h3>Raretés</h3><p>${(['commun', 'rare', 'epique', 'legendaire', 'mythique'] as const).map(r => `<span style="color:${RARITY_COLORS[r]}">${RARITY_NAMES[r]}</span>`).join(' · ')}</p>
        <h3>S'équiper</h3><p>${k('I')} ouvre l'inventaire. Clic droit sur un objet : l'équiper ou le retirer. ${k('Maj + clic')} : le recycler.</p>
        <p>${k('C')} ouvre les caractéristiques : chaque niveau donne 5 points à placer.</p>` },
      { id: 'havresac', titre: 'Le Havre-Sac', html: `<p>${k('H')} (ou l'icône du sac dans la colonne de menus) : 1,5 s d'incantation et tu entres dans ton Havre-Sac, ton monde de poche. Bouger ou être touché coupe l'incantation. Impossible dans un donjon ou poursuivi par des monstres.</p>
        <p>Le Poutch Ingball compte tes dégâts par seconde, et Kerubim Crépin y garde un guichet de recyclage. ${k('H')} à nouveau te ramène là où tu étais ; l'arche est un Zaap vers le Bastion des Douze et tous ceux que tu as découverts.</p>` },
      { id: 'zaaps', titre: 'Les Zaaps', html: `<p>Clique sur l'arche d'un Zaap : ton perso s'en approche et la liste s'ouvre. Le voyage est gratuit, vers le Bastion des Douze et tous les Zaaps que tu as découverts, rangés par zone.</p>
        <p>Il suffit de passer sur la carte d'un Zaap pour le découvrir : il devient aussi ton point de retour si tu tombes. Ceux que tu n'as pas encore vus sont grisés dans la liste et éteints sur la carte (${k('M')}).</p>` },
      { id: 'bastion', titre: 'Le Bastion des Douze', html: `<p>Notre ville, en archipel au-dessus du Monde des Douze. On y va par n'importe quel Zaap (il est en tête de liste), par l'arche du Havre-Sac, ou avec une Potion de Rappel. Son Zaap te ramène ensuite là où tu étais.</p>
        <p>Les PNJ de service y vivent : Kerubim Crépin recycle tes objets en Pépites, Tissebelle vend les apparats et tient le miroir, Otomaï ses potions, Mère Bouillotte ses plats, Goultard les clés de donjon. Certains emménagent au fil de ton aventure. Chaque nation libérée y ajoutera son île.</p>` },
      { id: 'metiers', titre: 'Métiers', html: `<p>${k('J')} ouvre les métiers. Le Chasseur récupère de la viande sur les monstres quand tu portes une arme de chasse, et cuisine des plats qui soignent.</p>` },
      { id: 'quetes', titre: 'Quêtes et succès', html: `<p>Un PNJ qui a une quête porte une icône au-dessus de la tête. Le suivi en bas à gauche montre l'étape en cours.</p>
        <p>Le journal des quêtes et les succès s'ouvrent depuis la colonne de menus, à droite de l'écran.</p>` },
      { id: 'touches', titre: 'Toutes les touches', html: `<div class="keys">${[['Clic gauche', 'aller / attaquer (maintenu : continuer)'], ['Maj + clic', 'attaquer sur place'], ['Clic droit', 'sort de la barre (case libre)'],
          ['& é " \' ( -', 'barre de sorts'], ['Espace', mob], ['E', 'potion'], ['S', 'sorts'], ['I', 'inventaire'], ['C', 'caractéristiques'], ['J', 'métiers'], ['B', 'bestiaire'],
          ['O', 'options'], ['G', 'ce guide'], ['H', 'Havre-Sac'], ['M', 'carte du monde (bientôt)'], ['Ctrl+M', 'couper ou remettre le son'], ['Molette', 'zoom'], ['F', 'effets d\'impact'], ['Échap', 'fermer']]
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
  private renderOpt() {
    const w = this.win!, r = this.reglages;
    const heures: [string, string][] = [['auto', 'Heure du PC'], ['jour', 'Jour'], ['soir', 'Soir'], ['nuit', 'Nuit']];
    type Opt = { k: string; nom: string; aide?: string } & ({ t: 'range'; min: number; max: number; unite?: string } | { t: 'check' } | { t: 'select'; choix: [string, string][] });
    type Sec = { id: string; titre: string; opts: Opt[]; html?: string };
    const GROUPES: { nom: string; desc: string; secs: Sec[] }[] = [
      { nom: 'Interface', desc: 'Ces options règlent la façon de lancer les sorts et les effets de jeu.', secs: [
        { id: 'general', titre: 'Général', opts: [
          { k: 'lancer', nom: 'Lancer un sort', t: 'select', choix: [['relache', 'Maintenir pour voir, relâcher pour lancer'], ['immediat', 'Tout de suite (aperçu avec Alt)'], ['dofus', 'Comme Dofus : touche puis clic']] },
          { k: 'approche', nom: 'Monstre hors de portée : s\'approcher avant de lancer', t: 'check' },
          { k: 'juice', nom: 'Effets d\'impact (tremblement, gel d\'image)', aide: 'Touche F', t: 'check' },
        ] },
        { id: 'touches', titre: 'Touches', opts: [], html: `<div class="keys">${[['Clic gauche', 'aller / attaquer (maintenu : continuer)'], ['Maj + clic', 'attaquer sur place'], ['Clic droit', 'sort de la barre (case libre)'],
          ['& é " \' ( -', 'barre de sorts'], ['Espace', 'déplacement'], ['E', 'potion'], ['S', 'sorts'], ['I', 'inventaire'], ['C', 'caractéristiques'], ['J', 'métiers'], ['B', 'bestiaire'],
          ['O', 'options'], ['M', 'carte du monde (0.2a)'], ['Ctrl+M', 'couper ou remettre le son'], ['Molette', 'zoom'], ['F', 'effets d\'impact'], ['G', 'guide'], ['H', 'Havre-Sac'], ['Échap', 'fermer']]
          .map(([k, d]) => `<b>${k}</b><span>${d}</span>`).join('')}</div>` },
      ] },
      { nom: 'Affichage', desc: 'Ces options règlent l\'ambiance et l\'image du monde.', secs: [
        { id: 'ambiance', titre: 'Ambiance du monde', opts: [
          { k: 'heure', nom: 'Heure', aide: `En ce moment : ${this.heureNom()}`, t: 'select', choix: heures },
          { k: 'lumieres', nom: 'Lumières (halos, feux)', t: 'range', min: 0, max: 200 },
          { k: 'saturation', nom: 'Couleurs (moins = adouci)', t: 'range', min: 50, max: 120 },
          { k: 'chaleur', nom: 'Chaleur de la lumière', t: 'range', min: -100, max: 100, unite: '' },
        ] },
        { id: 'graphismes', titre: 'Graphismes', opts: [
          { k: 'zoom', nom: 'Zoom de départ', t: 'range', min: 55, max: 120 },
          { k: 'vent', nom: 'Arbres au vent', t: 'check' },
          { k: 'eau', nom: 'Eau animée', t: 'check' },
          { k: 'transparence', nom: 'Voir à travers le décor', aide: 'Le décor devant ton perso s\'efface, les monstres cachés ont une silhouette rouge.', t: 'check' },
          { k: 'particules', nom: 'Particules (spores, braises…)', t: 'check' },
        ] },
      ] },
      { nom: 'Son', desc: 'Ces options règlent la musique et les sons du jeu. Ctrl+M coupe ou remet tout le son.', secs: [
        { id: 'son', titre: 'Général', opts: [
          { k: 'muet', nom: 'Couper tout le son', aide: 'Ctrl+M', t: 'check' },
          { k: 'volume', nom: 'Volume général', t: 'range', min: 0, max: 100 },
          { k: 'volMusique', nom: 'Musique', t: 'range', min: 0, max: 100 },
          { k: 'volEffets', nom: 'Effets (sorts, coups)', t: 'range', min: 0, max: 100 },
          { k: 'volMonstres', nom: 'Monstres (cris)', t: 'range', min: 0, max: 100 },
          { k: 'volAmbiance', nom: 'Ambiance (vent, eau, feu, Zaap)', t: 'range', min: 0, max: 100 },
          { k: 'volInterface', nom: 'Interface (fenêtres, niveau, quêtes)', t: 'range', min: 0, max: 100 },
        ] },
      ] },
    ];
    const val = (k: string) => k === 'juice' ? this.juice.get() : (r as unknown as Record<string, unknown>)[k];
    const q = this.optRecherche.trim().toLowerCase();
    const garde = (o: Opt) => !q || `${o.nom} ${o.aide ?? ''}`.toLowerCase().includes(q);
    const ligne = (o: Opt) => {
      const aide = o.aide ? `<small>${o.aide}</small>` : '';
      if (o.t === 'check') return `<label class="row ck ${val(o.k) ? 'on' : ''}"><input type="checkbox" data-ck="${o.k}" ${val(o.k) ? 'checked' : ''}><span>${o.nom}${aide}</span></label>`;
      if (o.t === 'select') return `<label class="row"><span>${o.nom}${aide}</span><select data-sel="${o.k}">${o.choix.map(([k, n]) => `<option value="${k}" ${val(o.k) === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
      const n = Math.round((val(o.k) as number) * 100);
      return `<label class="row"><span>${o.nom}${aide}</span><input type="range" data-rg="${o.k}" min="${o.min}" max="${o.max}" value="${n}" style="--v:${(n - o.min) / (o.max - o.min) * 100}%"><output data-o="${o.k}">${n}${o.unite ?? '%'}</output></label>`;
    };
    const RESET = '<i class="rs"></i>';
    const main = GROUPES.map(g => {
      const secs = g.secs.map(s => {
        const lignes = s.opts.filter(garde);
        if (q && !lignes.length && !(s.html && s.titre.toLowerCase().includes(q))) return '';
        return `<div class="sec" id="opt-${s.id}"><div class="sh"><b>${s.titre}</b>${s.opts.length ? `<span class="lien" data-reset="${s.id}">${RESET} Réinitialiser</span>` : ''}</div>${lignes.map(ligne).join('')}${s.html ?? ''}</div>`;
      }).join('');
      return secs ? `<div class="grp"><h2>${g.nom}</h2><div class="desc">${g.desc}</div>${secs}</div>` : '';
    }).join('') || '<div class="vide">Aucune option ne correspond à la recherche.</div>';
    const nav = GROUPES.map(g => `<div class="cat">${g.nom}</div>${g.secs.map(s => `<div class="it" data-va="${s.id}">${s.titre}</div>`).join('')}`).join('');
    w.innerHTML = `${this.title('Options', 'options')}<div class="ob">
      <div class="nav"><input type="search" placeholder="Rechercher" value="${this.optRecherche.replace(/"/g, '&quot;')}" data-cherche><div class="cats">${nav}</div>
        <div class="bas"><span class="lien" data-tout>${RESET} Tout réinitialiser</span>${this.onAccueil ? '<span class="lien" data-accueil>Sauvegarder et revenir à l\'accueil</span>' : ''}</div></div>
      <div class="main"><div class="otabs"><span class="on">Options générales</span></div>${main}</div></div>`;
    const apply = () => { sauverReglages(r); this.onReglages(r); };
    const R = r as unknown as Record<string, unknown>;
    w.querySelectorAll<HTMLInputElement>('[data-rg]').forEach(e => {
      const k = e.dataset.rg!;
      e.addEventListener('input', () => { R[k] = +e.value / 100; e.style.setProperty('--v', `${(+e.value - +e.min) / (+e.max - +e.min) * 100}%`); w.querySelector(`[data-o="${k}"]`)!.textContent = `${e.value}${k === 'chaleur' ? '' : '%'}`; apply(); });
      // 8A : aperçu sonore quand on lâche le curseur
      e.addEventListener('change', () => { if (k === 'volEffets') Son.jouer(MANIFESTE.impacts[0], 'effets'); else if (k === 'volMonstres') { const l = Object.values(MANIFESTE.monstres)[0]?.attaque; Son.jouer(Son.auHasard(l), 'monstres'); } else if (k === 'volInterface' || k === 'volume') Son.jouer(MANIFESTE.ui.ok, 'interface'); });
    });
    w.querySelectorAll<HTMLSelectElement>('[data-sel]').forEach(e => e.addEventListener('change', () => { R[e.dataset.sel!] = e.value; apply(); if (e.dataset.sel === 'heure') this.render(); }));
    w.querySelectorAll<HTMLInputElement>('[data-ck]').forEach(e => e.addEventListener('change', () => {
      const k = e.dataset.ck!;
      if (k === 'juice') this.juice.set(e.checked); else { R[k] = e.checked; apply(); }
      e.closest('.row')!.classList.toggle('on', e.checked);
    }));
    const defaut = REGLAGES_DEFAUT as unknown as Record<string, unknown>;
    const reset = (s: Sec) => { for (const o of s.opts) { if (o.k === 'juice') this.juice.set(true); else R[o.k] = defaut[o.k]; } };
    w.querySelectorAll<HTMLElement>('[data-reset]').forEach(e => e.addEventListener('click', () => {
      const s = GROUPES.flatMap(g => g.secs).find(x => x.id === e.dataset.reset); if (s) reset(s);
      apply(); this.render();
    }));
    w.querySelector('[data-tout]')!.addEventListener('click', () => { GROUPES.forEach(g => g.secs.forEach(reset)); apply(); this.render(); });
    w.querySelectorAll<HTMLElement>('[data-va]').forEach(e => e.addEventListener('click', () => {
      w.querySelectorAll('.nav .it').forEach(x => x.classList.toggle('on', x === e));
      w.querySelector(`#opt-${e.dataset.va}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    const ch = w.querySelector<HTMLInputElement>('[data-cherche]')!;
    ch.addEventListener('input', () => { this.optRecherche = ch.value; this.render(); const n = this.win?.querySelector<HTMLInputElement>('[data-cherche]'); n?.focus(); n?.setSelectionRange(n.value.length, n.value.length); });
    ch.addEventListener('keydown', e => e.stopPropagation());
    w.querySelector('[data-accueil]')?.addEventListener('click', () => { this.close(); this.onAccueil?.(); });
  }

  /** Sort affiché dans la fiche de l'onglet Sorts, et grade montré. */
  private vu: number | null = null;
  private vuGrade = -1;
  /** Onglet Sorts (choix 8A, comme Dofus 3) : les 22 paires officielles (sort ⇄ variante) triées par niveau, la fiche
   *  du sort avec ses grades, et la barre où l'on glisse les sorts. Clic sur l'autre sort d'une paire : on l'échange. */
  private renderSorts() {
    const w = this.win!, p = this.world.player, pairs = p.pairs;
    const ico = (s: SortOfficiel) => `assets/ui/sorts/sort_${s.icon}.png`;
    const all = pairs.flat();
    const vu = all.find(s => s.id === this.vu) ?? pairs[0]?.[0];
    const row = (pr: SortOfficiel[], i: number) => pr.map((s, j) => {
      const lock = p.level < p.requiredLevel(s), key = p.keyOf(s.id), chosen = (p.variants[i] ?? 0) === j;
      const drag = !lock && chosen && key ? `draggable="true" data-drag="${key}"` : '';
      return `<div class="sp ${lock ? 'lock' : ''} ${chosen && !lock ? 'on' : ''} ${vu?.id === s.id ? 'vu' : ''}" data-s="${s.id}" data-p="${i}" data-v="${j}" ${drag}>
        <img src="${ico(s)}" alt=""><span>${s.name}<small>niv ${p.requiredLevel(s)}${key ? '' : ' · <span class="soon">bientôt jouable</span>'}</small></span></div>`;
    }).join('<span class="x">⇄</span>');
    let fiche = '';
    if (vu) {
      const cur = gradeAuNiveau(vu, p.level), gi = this.vuGrade >= 0 && this.vuGrade < vu.grades.length ? this.vuGrade : vu.grades.indexOf(cur), g = vu.grades[gi];
      const key = p.keyOf(vu.id), mob = key === p.cls.mobility;
      const el = (e?: string) => e ? e[0].toUpperCase() + e.slice(1) : '';
      let rows: [string, string][], effets = '';
      if (key) {
        const x = spellDetail(p, key, mob ? undefined : g);
        rows = [['Coût', mob ? `${x.cost} (déplacement)` : x.cost], ['Recharge', mob ? 'charges de PM' : x.cdS >= 1 ? `${n1(x.cdS)} s` : x.nCh >= 2 ? `${x.nCh} charges (1 toutes les ${n1(p.retourCharge)} s)` : 'aucune'],
          ['Zone', x.zone.replace(/^Zone : /, '')], ['Dommages', x.dmg ? x.dmg.replace(/^Dommages : /, '') : '—']];
        effets = `${x.extra.length ? `<ul class="ef">${x.extra.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}${x.rage ? `<div class="rg">${x.rage}</div>` : ''}`;
      } else {
        rows = [['Coût', `${g.pa} PA`], ['Recharge', g.relance ? `${g.relance * 3} s` : 'aucune'],
          ['Portée', g.po[1] === 0 ? 'sur soi' : `${g.po[1]} case${g.po[1] > 1 ? 's' : ''}`],
          ['Dommages', g.dmg ? `<b>${Math.round(p.damage(dmgMoyen(g) * 1.5, g.element ?? 'neutre'))}</b> ${el(g.element)}${g.vol ? ' (vol de vie)' : ''}` : '—']];
        if (g.parTour) rows.push(['Cadence', `${g.parTour} lancer${g.parTour > 1 ? 's' : ''} toutes les 3 s au plus`]);
      }
      fiche = `<div class="fh"><img src="${ico(vu)}" alt=""><div><b>${vu.name}</b>
        <div class="gr">${vu.grades.map((x, k) => `<span data-g="${k}" class="${k === gi ? 'on' : ''}">Grade ${k + 1} · niv ${x.niv}</span>`).join('')}</div></div></div>
        ${p.level < p.requiredLevel(vu) ? `<div class="note">Se débloque au niveau ${p.requiredLevel(vu)}.</div>` : ''}
        ${key ? '' : '<div class="note">Pas encore jouable : il arrivera avec les zones de son niveau.</div>'}
        <dl>${rows.map(([t, v]) => `<dt>${t}</dt><dd>${v}</dd>`).join('')}</dl>
        ${effets}
        <div class="ds">${vu.desc}</div>
        <div class="hint">Glisse un sort débloqué dans la barre, ou clique-le puis clique une case. Clic sur l'autre sort d'une paire pour l'échanger (un seul des deux, comme dans Dofus). Clic droit sur une case de la barre : la vider.</div>`;
    }
    const KEYS = ['&', 'é', '"', "'", '(', '-', 'Clic D', 'Espace'];
    const slot = (i: number) => {
      const id = p.bar[i], d = id ? p.cls.spells[id] : null;
      return `<div class="bs ${i === 6 || i === 7 ? 'gap' : ''}"><i data-slot="${i}" title="${d?.name ?? 'vide'}" style="${d ? `background-image:url(assets/ui/sorts/sort_${d.icon}.png)` : ''}"></i>${KEYS[i]}</div>`;
    };
    w.innerHTML = `${this.title('Sorts', 'spells')}<div class="sb">
      <div class="ls">${pairs.map((pr, i) => `<div class="pr">${row(pr, i)}</div>`).join('')}</div>
      <div class="fi">${fiche}</div>
      <div class="bb">${p.bar.map((_, i) => slot(i)).join('')}<span class="hint">${p.cls.name} niveau ${p.level} · ${all.filter(s => p.level >= p.requiredLevel(s)).length} sorts débloqués sur ${all.length}</span></div>
    </div>`;
    w.querySelectorAll<HTMLElement>('.sp').forEach(e => e.addEventListener('click', () => {
      const id = +e.dataset.s!, i = +e.dataset.p!, v = +e.dataset.v! as 0 | 1;
      if (this.vu === id && (p.variants[i] ?? 0) !== v) p.setVariant(i, v);
      else if ((p.variants[i] ?? 0) !== v && p.level >= p.requiredLevel(pairs[i][v])) p.setVariant(i, v);
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
  private resTip(r: ResourceDef, id: string) {
    const sorte = r.soin || r.rappel ? 'Consommable' : r.cle ? 'Clé de donjon' : r.pepite ? 'Monnaie du Bastion' : r.rune ? 'Rune de forgemagie' : 'Ressource';
    const effet = r.soin ? `<div class="up">+${r.soin} PV</div><div class="hint">Clic droit : manger</div>`
      : r.rappel ? `<div class="up">Retour au dernier Zaap (${this.world.checkpointName})</div><div class="hint">Clic droit : boire</div>`
      : r.cle ? `<div class="up">Ouvre l'entrée : ${r.cle}</div><div class="hint">Prise en entrant dans le donjon</div>`
      : r.pepite ? '<div class="hint">Recycle tes objets chez Kerubim Crépin (au Bastion des Douze, ou à son guichet du Havre-Sac) et dépense-les chez ses voisins du Bastion.</div>'
      : r.rune && RUNES[id] ? `<div class="up">+${RUNES[id].val} ${STAT_NAMES[RUNES[id].stat]} · poids ${String(RUNES[id].poids).replace('.', ',')}</div><div class="hint">Se pose chez le forgemage du Bastion des Douze ; s'obtient en brisant des objets chez lui.</div>` : '';
    const sert = recettesAvec(ITEMS, id).map(x => ITEMS.resources[x.result]?.name).filter(Boolean);
    const sertA = sert.length ? `<div class="ou"><div class="hd">Sert à</div><div>${sert.slice(0, 5).join(', ')}${sert.length > 5 ? '…' : ''}</div></div>${!r.soin && !r.rappel ? '<div class="hint">Clic droit : recettes qui l\'utilisent</div>' : ''}` : '';
    return `<h4>${r.name}</h4><div class="sub">${sorte} · niveau ${r.level}</div>${effet}${sertA}${sourcesHtml(id, 3)}`;   // 1B : où le trouver
  }

  /** Emp, le Méryde du Recyclage (maquette 0.2, 7A 8A+8B+8C 9A+9B) : recyclage contre des Pépites, en lot ou objet par objet,
   *  cadenas, et sa boutique payée en Pépites. S'ouvre par la réponse « service » de son dialogue. */
  private renderEmp() {
    const w = this.win!, p = this.world.player, pep = p.resources[PEPITE] ?? 0;
    // les onglets du PNJ ouvert : ses services (Kerubim recycle, Tissebelle a les apparats et le miroir, les autres une boutique)
    const def = QUETES.pnj[this.empPnj], sv = new Set((def?.services ?? []).map(x => x.service)), boutique = BOUTIQUES[this.empPnj] ?? [];
    if (!sv.has(this.empOnglet)) this.empOnglet = sv.has('boutique') ? 'boutique' : sv.has('apparat') ? 'apparat' : 'recycler';
    const onglet = (k: string, n: string) => sv.has(k) ? `<span class="eo ${this.empOnglet === k ? 'on' : ''}" data-eo="${k}">${n}</span>` : '';
    const tete = `<div class="eh"><div class="eos">${onglet('recycler', 'Recycler')}${onglet('boutique', 'Boutique')}${onglet('apparat', 'Apparats')}${sv.has('garde-robe') ? '<span class="eo" data-garde>Garde-robe</span>' : ''}</div>
      <span class="k" title="Pépites">${pep.toLocaleString('fr-FR')} ${iconHtml(ITEMS.resources[PEPITE].icon)}</span></div>`;
    let corps = '';
    if (this.empOnglet === 'recycler') {
      const lots: [Rarity, string][] = [['commun', 'Tout le Commun'], ['rare', 'Commun et Rare'], ['epique', 'Tout sauf Légendaire']];
      const lotsHtml = lots.map(([r, n]) => { const a = this.world.apercuLot(r);
        return `<span class="btn ${a.n ? '' : 'off'}" data-lot="${r}">${n}<small>${a.n} objet${a.n > 1 ? 's' : ''} · +${a.pepites} Pépites</small></span>`; }).join('');
      const objets = p.bag.filter(it => ITEMS.equipment[it.id]).map(it => { const d = ITEMS.equipment[it.id];
        return `<div class="cell ${it.cadenas ? 'verrou' : ''}" data-ruid="${it.uid}">${iconHtml(d.icon)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i>${it.cadenas ? CADENAS : `<span class="pv">+${recycleValue(d, it)}</span>`}</div>`; }).join('');
      const res = Object.entries(p.resources).filter(([id]) => { const r = ITEMS.resources[id]; return r && !r.pepite && !r.cle && !r.soin && !r.rappel; })
        .map(([id, n]) => `<div class="cell" data-rres="${id}" title="${ITEMS.resources[id].name} : ${n} × ${recycleResource(ITEMS.resources[id])} Pépites">${iconHtml(ITEMS.resources[id].icon)}<span class="n">${n}</span></div>`).join('');
      corps = `<div class="lots">${lotsHtml}</div>
        <div class="hint">Clic : recycler l'objet · Ctrl + clic (ou clic droit) : cadenas, l'objet n'est jamais recyclé. Les objets sous cadenas restent hors des lots.</div>
        <div class="grid eg">${objets || '<div class="hint">Ton sac est vide.</div>'}</div>
        ${res ? `<div class="sub2">Ressources (la pile entière)</div><div class="grid eg">${res}</div>` : ''}`;
    } else if (this.empOnglet === 'apparat') {
      // Apparats officiels (5A) : tout le catalogue, payé en Pépites ; le survol habille le perso de l'aperçu
      const q = this.apparatRecherche.toLowerCase();
      const l = Object.entries(APPARATS.objets).filter(([, d]) => (!this.apparatSlot || d.slot === this.apparatSlot) && (!q || d.name.toLowerCase().includes(q)))
        .sort((a, b) => a[1].name.localeCompare(b[1].name, 'fr'));
      const essai = this.essaiApparat && APPARATS.objets[this.essaiApparat];
      const objets = objetsPortes(p.equipment, { ...p.apparat, ...(essai ? { [essai.slot]: this.essaiApparat! } : {}) });
      corps = `<div class="filtre"><input placeholder="Rechercher un apparat..." value="${this.apparatRecherche.replace(/"/g, '&quot;')}" data-arech>
          <select data-aslot style="width:auto">${[['', 'Tous les apparats'], ['chapeau', 'Coiffes'], ['cape', 'Capes'], ['familier', 'Familiers']].map(([k, n]) => `<option value="${k}" ${this.apparatSlot === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <span class="hint">${l.length} apparat${l.length > 1 ? 's' : ''}</span></div>
        <div class="cata"><div class="apercu">${this.perso ? this.canevas('', objets) : ''}<div class="hint" style="text-align:center">${essai ? essai.name : 'Survole un apparat pour l\'essayer'}</div></div>
        <div class="shop">${l.slice(0, 120).map(([id, d]) => { const a = p.apparats.includes(id), prix = APPARATS.prix[d.slot] ?? 0;
          return `<div class="rec" data-essai="${id}">${apparatHtml(id)}<div><b>${d.name}</b> <span class="hint">${d.slot === 'chapeau' ? 'Coiffe' : d.slot === 'cape' ? 'Cape' : 'Familier'} d'apparat</span></div>
            ${a ? '<span class="hint">Déjà à toi</span>' : `<span class="btn ${pep >= prix ? '' : 'off'}" data-aachat="${id}">${prix} ${iconHtml(ITEMS.resources[PEPITE].icon)}</span>`}</div>`; }).join('')}
          ${l.length > 120 ? `<div class="hint">… et ${l.length - 120} autres : affine la recherche.</div>` : ''}</div></div>`;
    } else {
      corps = `<div class="shop">${boutique.map(a => { const r = ITEMS.resources[a.id]; if (!r) return '';
        const effet = r.soin ? `+${r.soin} PV` : r.rappel ? 'Retour au dernier Zaap' : r.cle ? `Entrée : ${r.cle}` : '';
        return `<div class="rec" data-rid="${a.id}">${iconHtml(r.icon)}<div><b>${r.name}</b> <span class="hint">niveau ${r.level}${(p.resources[a.id] ?? 0) ? ` · tu en as ${p.resources[a.id]}` : ''}</span><div style="font-size:12px;color:#c9c4ab">${effet}</div></div>
          <span class="btn ${pep >= a.prix ? '' : 'off'}" data-achat="${a.id}">${a.prix} ${iconHtml(ITEMS.resources[PEPITE].icon)}</span></div>`; }).join('')}</div>
        <div class="hint">Les Pépites se gagnent en recyclant tes objets chez Kerubim Crépin.</div>`;
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
  /** Forgemage (maquette « Forgemagie ») : forgemagie, brisage et fusion ; la partie de test l'ouvre aussi (F1, 10C). */
  ouvrirForge(uid?: number) { if (uid != null) this.forge.uid = uid; this.forge.onglet = 'forge'; this.show('forge'); }
  /** Résultats renvoyés par la partie (événements forge, brisage, fusion, viser) : le journal de la fenêtre. */
  noteForge(l: { t: string; c: string }) { this.forge.log = [l, ...this.forge.log].slice(0, 12); if (this.mode === 'forge' && this.win) this.render(); }
  noteForgeEvt(e: Parameters<typeof texteForge>[0]) { this.noteForge(texteForge(e)); }
  private renderForge() {
    const w = this.win!, f = this.forge, p = this.world.player;
    w.innerHTML = `${this.title('Forgemage', 'job')}<div class="in emp fm">${forgeHtml(this.world, f)}</div>`;
    w.querySelectorAll<HTMLElement>('[data-fo]').forEach(e => e.addEventListener('click', () => { f.onglet = e.dataset.fo as typeof f.onglet; this.render(); }));
    w.querySelectorAll<HTMLElement>('[data-fuid]').forEach(e => {
      const it = this.world.objetForgeable(+e.dataset.fuid!)!;
      e.addEventListener('click', () => { f.uid = it.uid; this.render(); });
      e.addEventListener('mouseenter', ev => this.showTip(it, ev, false));
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
    });
    w.querySelectorAll<HTMLElement>('[data-frune]').forEach(e => e.addEventListener('click', () => {
      if (f.uid != null && this.world.forgemager(f.uid, e.dataset.frune!)) this.changed();
    }));
    w.querySelector<HTMLSelectElement>('[data-vstat]')?.addEventListener('change', ev => { f.vstat = (ev.target as HTMLSelectElement).value as Stat; f.vcible = 0; this.render(); });
    const vc = w.querySelector<HTMLInputElement>('[data-vcible]');
    vc?.addEventListener('keydown', ev => ev.stopPropagation());
    vc?.addEventListener('change', () => { f.vcible = +vc.value; });
    w.querySelector<HTMLElement>('[data-viser]')?.addEventListener('click', () => {
      if (f.uid != null && f.vstat) { if (vc) f.vcible = +vc.value; this.world.viserForge(f.uid, f.vstat, f.vcible); this.changed(); }
    });
    w.querySelectorAll<HTMLElement>('[data-blot]').forEach(e => e.addEventListener('click', () => { this.world.briserLot(e.dataset.blot as Rarity); this.changed(); }));
    w.querySelectorAll<HTMLElement>('[data-buid]').forEach(e => {
      const uid = +e.dataset.buid!, it = p.bag.find(b => b.uid === uid)!;
      const cad = () => { this.world.cadenas(uid); this.changed(); };
      e.addEventListener('mouseenter', ev => this.showTip(it, ev, false));
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', cad);
      e.addEventListener('click', ev => { if (ev.ctrlKey || ev.metaKey) cad(); else { this.world.briserObjet(uid); this.changed(); } });
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
        const terr = sub?.name ?? c.name, co = c.map.join(',');
        const l = lui ? ligne({ nom: terr, region: z.name, co, niv: String(niv), nc: couleur(niv), cls: 'ici', marque: 'Tu es ici' })
          : i >= 0 ? ligne({ i, nom: terr, region: z.name, co, niv: String(niv), nc: couleur(niv), titre: 'Voyager (gratuit)' })
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
    if (this.tab === 'apparat' && !p.apparats.length) cells.push('<div class="hint" style="grid-column:1/-1">Les apparats s\'achètent chez Tissebelle, au Bastion des Douze. Ils changent seulement l\'apparence.</div>');
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
    const leg = [it.legendary, it.legendary2].map(l => l ? `<div class="leg"><b>${LEGENDARY[l.id].name}</b> : ${LEGENDARY[l.id].text(l.value, l.sort && this.world.player.cls.spells[l.sort]?.name)}</div>` : '').join('');
    const set = d.set && ITEMS.sets[d.set] ? `<div class="set">${ITEMS.sets[d.set].name}</div>` : '';
    let cmp = '';
    if (cur) {
      const ks = STATS.filter(k => (it.stats[k] ?? 0) !== (cur.stats[k] ?? 0));
      cmp = `<div class="cmp">Par rapport à ${ITEMS.equipment[cur.id]?.name ?? 'l\'objet porté'} :<br>${ks.map(k => {
        const dv = (it.stats[k] ?? 0) - (cur.stats[k] ?? 0);
        return `<span class="${dv > 0 ? 'up' : 'down'}">${dv > 0 ? '+' : ''}${dv} ${STAT_NAMES[k]}</span>`;
      }).join('<br>') || 'identique'}</div>`;
    }
    const lvl = d.level > p.level ? `<div class="down">Niveau ${d.level} requis</div>` : '';
    let fam = '';
    if (d.familier) {   // familier : son niveau, son XP, et ses bonus au niveau 100
      const n = it.niv ?? 1, c = FAMILIERS.xp, a = c[n - 1] ?? 0, b = c[n] ?? a, x = it.xpF ?? 0;
      const max = STATS.filter(k => d.stats[k]).map(k => `${d.stats[k]![1]} ${STAT_NAMES[k]}`).join(' · ');
      fam = `<div class="ex">Familier niveau ${n} / ${FAMILIER_MAX}</div>${n < FAMILIER_MAX ? `<div class="xpf"><i style="width:${Math.round(100 * Math.min(1, (x - a) / Math.max(1, b - a)))}%"></i></div>` : ''}
        ${max ? `<div class="hint">Au niveau 100 : ${max}</div>` : ''}
        <div class="hint">Il gagne de l'XP quand tu chasses, et quand tu le nourris (Alt + clic sur un objet ou une ressource du sac).</div>`;
    } else if (p.equipment.familier && !worn) fam = `<div class="hint">Alt + clic : le donner à manger au familier (+${FAMILIER_XP.objet(d.level, it.rarity)} XP)</div>`;
    this.tip.innerHTML = `<h4 style="color:${RARITY_COLORS[it.rarity]}">${d.name}</h4>
      <div class="sub">${d.familier ? 'Familier' : `${RARITY_NAMES[it.rarity]} · ${d.weapon?.type ?? SLOT_NAMES[(slot ?? 'amulette') as EquipSlot]}`} · niveau ${d.level}</div>
      ${weapon}${stats}${fam}${leg}${set}${lvl}${cmp}${sourcesHtml(it.id, 3)}
      <div class="hint">${worn ? 'Clic droit : retirer' : it.cadenas ? 'Sous cadenas : jamais recyclé · Ctrl + clic : l\'ôter' : `Clic droit : équiper · Maj + clic : recycler (${recycleValue(d, it)} Pépites) · Ctrl + clic : cadenas`}</div>`;
    this.tip.style.display = 'block'; this.moveTip(ev);
  }
  private moveTip(ev: MouseEvent) {
    const t = this.tip, w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = `${Math.min(innerWidth - w - 8, ev.clientX + 16)}px`;
    t.style.top = `${Math.min(innerHeight - h - 8, ev.clientY + 12)}px`;
  }
  hideTip() { this.tip.style.display = 'none'; }
  /** Infobulle libre (sorts de la barre), au-dessus du point (x, y) de l'écran. */
  showHtmlTip(html: string, x: number, y: number) {
    const t = this.tip; t.innerHTML = html; t.style.display = 'block';
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x - w / 2))}px`;
    t.style.top = `${Math.max(8, y - h - 12)}px`;
  }
}
