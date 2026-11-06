import { REGLAGES_DEFAUT, sauverReglages, type Reglages } from './ambiance';
import { ICON_CSS, iconHtml } from './icons';
import { MANIFESTE, Son } from './son';
import { ITEMS } from '../sim/data';
import {
  BASE_STATS, LEGENDARY, RARITY_COLORS, RARITY_NAMES, STATS, STAT_NAMES, metierXpNeeded, recycleValue,
  type EquipSlot, type Item, type Stat,
} from '../sim/items';
import { Player } from '../sim/player';
import { dmgMoyen, gradeAuNiveau, type SortOfficiel } from '../sim/sorts';
import { n1, spellDetail } from './spellTip';
import type { World } from '../sim/world';

const SLOT_NAMES: Record<EquipSlot, string> = {
  chapeau: 'Coiffe', cape: 'Cape', amulette: 'Amulette', anneau1: 'Anneau', anneau2: 'Anneau', ceinture: 'Ceinture',
  bottes: 'Bottes', arme: 'Arme', bouclier: 'Bouclier',
};
/** Place des emplacements autour du perso, comme l'inventaire de Dofus 3 (null = case vide de l'interface). */
const LEFT: (EquipSlot | null)[] = ['chapeau', 'cape', null, 'arme', 'bouclier'];
const RIGHT: (EquipSlot | null)[] = ['amulette', 'anneau1', 'anneau2', 'ceinture', 'bottes'];
/** Onglets verticaux de l'inventaire de Dofus 3 : tout, équipements, consommables, ressources, objets de quête, apparats. */
const TABS: [string, string, string][] = [['tout', 'all', 'Tout'], ['equip', 'equipments', 'Équipements'], ['conso', 'consumables', 'Consommables'],
  ['ressource', 'resources', 'Ressources'], ['quete', 'key', 'Objets de quête'], ['apparat', 'cosmetics', 'Apparats']];
const KINDS: [string, string][] = [['', 'Toutes les catégories'], ['arme', 'Armes'], ['amulette', 'Amulettes'], ['anneau', 'Anneaux'],
  ['chapeau', 'Coiffes'], ['cape', 'Capes'], ['ceinture', 'Ceintures'], ['bottes', 'Bottes'], ['bouclier', 'Boucliers']];
const SORTS: [string, string][] = [['', 'Aucun tri'], ['niveau', 'Niveau'], ['rarete', 'Rareté'], ['nom', 'Nom']];
const RARITY_ORDER: Record<string, number> = { commun: 0, rare: 1, epique: 2, legendaire: 3, mythique: 4 };
const INV = 'assets/ui/inv';
/** Vraies pièces de l'interface de Dofus 3 (uidarkstone / uielements) : cadre des fenêtres, cases, onglets, cases à cocher. */
const D3 = 'assets/ui/d3';
/** Fond officiel des emplacements d'équipement (silhouette comprise). */
const SLOT_D3: Record<EquipSlot, string> = {
  chapeau: 'helmet', cape: 'cape', amulette: 'collar', anneau1: 'ring', anneau2: 'ring', ceinture: 'belt',
  bottes: 'shoe', arme: 'weapon', bouclier: 'shield',
};
const TAB_D3: Record<string, string> = { all: 'all', equipments: 'equipment', consumables: 'consumable', resources: 'resources', key: 'quest', cosmetics: 'cosmetics' };

const CSS = `
.dw{position:fixed;inset:0;pointer-events:none;font:13px Lexend,Verdana,sans-serif;color:#e8e2d4;z-index:10}
.dw .win{pointer-events:auto;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#24231f;border:1px solid #0d0c0a;
 box-shadow:inset 0 0 0 1px #4a4840,0 12px 40px #000c;border-radius:4px;display:grid;grid-template-rows:38px 1fr;overflow:hidden}
.dw .win.inv{width:min(910px,96vw);height:min(720px,92vh)}
.dw .win.car{width:min(440px,96vw);height:min(640px,92vh)}
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
.dw .win.job{width:min(560px,96vw);height:min(640px,92vh)}
.dw .job .in{padding:14px 16px;overflow:auto;display:grid;gap:12px;align-content:start}
.dw .mh{display:flex;gap:12px;align-items:center}.dw .mh img{width:56px;height:56px}
.dw .mh b{font-size:17px;color:#f4efe0}.dw .bar{height:8px;border-radius:4px;background:#2c281f;overflow:hidden;margin-top:5px;width:260px;max-width:100%}
.dw .bar i{display:block;height:100%;background:#b9e54b}
.dw .note{font-size:12px;color:#c9c4ab;background:#1d1c19;border:1px solid #34322b;border-radius:3px;padding:8px 10px}
.dw .note.ok{border-color:#4c6e17;color:#d6f57a}
.dw .rec{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;padding:8px;border:1px solid #34322b;border-radius:4px;background:#26251f}
.dw .rec .ic{width:48px;height:48px}.dw .rec .ings{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:12px}
.dw .rec .ing{display:flex;align-items:center;gap:3px}.dw .rec .ing .ic{width:26px;height:26px}
.dw .rec .lack{color:#e0625a}.dw .rec .have{color:#9ad15a}
.dw .btn{cursor:pointer;background:linear-gradient(#6f9a2a,#4c6e17);border:1px solid #b9e54b;color:#fff;border-radius:3px;padding:6px 12px;font-weight:bold}
.dw .btn.off{opacity:.35;pointer-events:none;filter:grayscale(1)}
.dw .tip .cmp{border-top:1px solid #3a3a2c;margin-top:6px;padding-top:6px;font-size:12px}

.dw .win.quetes,.dw .win.succes{width:min(900px,96vw);height:min(660px,92vh)}
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
.dw .btn,.dw .opt .nav .bas .lien[data-accueil]{font-family:Rowdies,Lexend,sans-serif;font-weight:400;letter-spacing:.02em}
.dw .ttl b{font-weight:700}
`;

type Mode = 'inv' | 'car' | 'job' | 'opt' | 'sorts' | 'quetes' | 'succes';

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
  private succesCat = '';
  private kind = '';
  private sort = '';
  private search = '';
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

  constructor(private world: World) {
    const style = document.createElement('style'); style.textContent = CSS + ICON_CSS; document.head.appendChild(style);
    this.root = document.createElement('div'); this.root.className = 'dw'; document.body.appendChild(this.root);
    this.tip = document.createElement('div'); this.tip.className = 'tip'; this.tip.style.display = 'none'; this.root.appendChild(this.tip);
  }
  get open() { return !!this.win; }
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
    const w = document.createElement('div'); w.className = `win ${mode}`;
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
    if (this.mode === 'car') this.renderCarac(); else if (this.mode === 'job') this.renderJob(); else if (this.mode === 'opt') this.renderOpt();
    else if (this.mode === 'sorts') this.renderSorts(); else if (this.mode === 'quetes') this.renderQuetes();
    else if (this.mode === 'succes') this.renderSucces(); else this.renderInv();
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
            <div class="stage"><div class="lv">${p.cls.name} · niveau ${p.level}</div><img class="socle" src="assets/ui/socle.png" alt=""><img class="who" src="${this.portrait}" alt=""></div>
            <div class="slots">${RIGHT.map(slot).join('')}</div>
          </div>
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
            <div class="foot"><span>Visible(s) : <b>${n}</b> · sac <b>${p.bag.length} / ${Player.BAG_SIZE}</b><br><span class="hint">Clic droit : équiper / retirer · Maj + clic : recycler</span></span>
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
    w.querySelectorAll<HTMLElement>('[data-res]').forEach(e => {
      const id = e.dataset.res!, r = ITEMS.resources[id];
      const eat = () => { if (this.world.eat(id)) this.changed(); };
      e.addEventListener('mouseenter', ev => { this.tip.innerHTML = `<h4>${r.name}</h4><div class="sub">${r.soin ? 'Consommable' : 'Ressource'} · niveau ${r.level}</div>${r.soin ? `<div class="up">+${r.soin} PV</div><div class="hint">Clic droit : manger</div>` : ''}`; this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      if (r.soin) { e.addEventListener('contextmenu', eat); e.addEventListener('dblclick', eat); }
    });
    w.querySelectorAll<HTMLElement>('[data-uid]').forEach(e => {
      const uid = +e.dataset.uid!, it = p.bag.find(b => b.uid === uid)!;
      const equip = () => { if (!p.equip(uid)) this.flash(e); this.changed(); };
      e.addEventListener('mouseenter', ev => this.showTip(it, ev, false));
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', equip);
      e.addEventListener('dblclick', equip);
      e.addEventListener('click', ev => { if (ev.shiftKey) { this.world.recycle(uid); this.changed(); } });
    });
  }

  private renderCarac() {
    const w = this.win!, p = this.world.player, st = (k: Stat) => p.stat(k), r1 = (v: number) => Math.round(v * 10) / 10;
    const row = (label: string, v: number | string, tip: string) => `<div title="${tip}"><span>${label}</span><b>${v}</b></div>`;
    w.innerHTML = `${this.title('Caractéristiques', 'characteristic')}
      <div class="carac">
        <div class="who2"><img src="${this.portrait}" alt=""><div><b>${p.cls.name}</b><br>Niveau ${p.level}</div></div>
        <div class="pts">${p.points} point${p.points > 1 ? 's' : ''} à placer</div>
        <div class="stats">
          <div><span>Points de vie</span><b>${Math.ceil(p.hp)} / ${p.maxHp}</b></div>
          <div><span>PA · PM</span><b>${p.paMax} · ${p.pmMax}</b></div>
          ${BASE_STATS.map(k => `<div><span>${STAT_NAMES[k]}</span><span><b>${st(k)}</b><span class="plus ${p.points ? '' : 'off'}" data-plus="${k}" title="Maj : +10">+</span></span></div>`).join('')}
          <div><span>Auto-attaque</span><b>${(1 / p.attackInterval()).toFixed(2)} / s</b></div>
          ${(['puissance', 'dommages', 'critique', 'vitesse', 'prospection', 'soins'] as Stat[]).map(k => `<div><span>${STAT_NAMES[k]}</span><b>${k === 'critique' ? Math.round(p.critChance * 100) : st(k)}</b></div>`).join('')}
        </div>
        <div class="sub">Combat</div>
        <div class="stats">
          ${row('Portée', st('portee'), '+1 case de portée par point pour les sorts à distance')}
          ${row('Initiative', p.initiative, 'Initiative + Force + Intelligence + Chance + Agilité. Le premier coup porté à un monstre fait +1 % par 10 points (jusqu\'à +50 %)')}
          ${row('Tacle', r1(p.tacle), 'Agilité / 10 + Tacle. Ralentit les monstres à ton contact (leur Fuite y résiste)')}
          ${row('Fuite', r1(p.fuite), 'Agilité / 10 + Fuite. Résiste au Tacle des monstres et réduit les ralentissements subis')}
          ${row('Retrait PA · PM', `${r1(p.retrait('PA'))} · ${r1(p.retrait('PM'))}`, 'Sagesse / 10 + Retrait. Chance que tes retraits de PA / PM passent l\'Esquive du monstre')}
          ${row('Esquive PA · PM', `${r1(p.esquive('PA'))} · ${r1(p.esquive('PM'))}`, 'Sagesse / 10 + Esquive. Chance d\'éviter les retraits de PA / PM des monstres')}
          ${row('Dommages Critiques', st('dommagesCritiques'), 'S\'ajoutent à chaque coup critique')}
          ${row('Dommages Poussée', st('dommagesPoussee'), 'S\'ajoutent aux coups qui repoussent')}
          ${row('Résistance Poussée · Critiques', `${st('resPoussee')} · ${st('resCritiques')}`, 'Sans effet pour l\'instant : les monstres ne font ni dommages de poussée ni coups critiques')}
          ${row('Invocations · Pods', `${st('invocations')} · ${st('pods')}`, 'Invocations : pour l\'Osamodas, plus tard. Pods : pas encore de limite de poids')}
        </div>
        <div class="sub">Résistances (fixe · %)</div>
        <div class="stats">
          ${(['Terre', 'Feu', 'Eau', 'Air', 'Neutre'] as const).map(e => row(e, `${st(`red${e}` as Stat)} · ${st(`res${e}` as Stat)} %`, `Les dommages ${e} reçus perdent d'abord la résistance fixe, puis le pourcentage (50 % au plus)`)).join('')}
        </div>
        <div class="hint">Force : sorts Terre · Intelligence : Feu · Chance : Eau · Agilité : Air (+1 % de dommages par point). Vitalité : +1 PV. Sagesse : +1 % d'XP.</div>
      </div>`;
    w.querySelectorAll<HTMLElement>('[data-plus]').forEach(e => e.addEventListener('click', ev => {
      p.spendPoint(e.dataset.plus as Stat, ev.shiftKey ? Math.min(10, p.points) : 1); this.changed();
    }));
  }

  /** Fenêtre « Métiers » (choix 6A) : le Chasseur, son niveau, et ses recettes officielles faisables avec le butin du jeu. */
  private renderJob() {
    const w = this.win!, p = this.world.player, M = ITEMS.metiers ?? {}, R = ITEMS.recipes ?? [];
    const res = (id: string) => ITEMS.resources[id];
    const jobs = Object.entries(M).map(([k, m]) => {
      const st = p.metiers[k] ?? { level: 1, xp: 0 }, need = metierXpNeeded(st.level);
      const weapon = p.huntingWeapon
        ? `<div class="note ok">Arme de chasse en main : les monstres peuvent lâcher leurs viandes.</div>`
        : `<div class="note">Équipe une arme avec l'effet « Arme de chasse » (Couteau de Chasse, Arc de Chasse…) pour que les monstres lâchent leurs viandes.</div>`;
      const recs = R.map((r, i) => ({ r, i })).filter(({ r }) => r.metier === k).map(({ r, i }) => {
        const out = res(r.result), lvlOk = st.level >= r.level;
        const ok = lvlOk && r.ingredients.every(([id, q]) => (p.resources[id] ?? 0) >= q);
        const ings = r.ingredients.map(([id, q]) => { const have = p.resources[id] ?? 0;
          return `<span class="ing" title="${res(id)?.name ?? id}">${iconHtml(res(id)?.icon ?? 0)}<span class="${have >= q ? 'have' : 'lack'}">${have}/${q}</span> ${res(id)?.name ?? ''}</span>`; }).join('');
        return `<div class="rec">${iconHtml(out?.icon ?? 0)}<div><b>${out?.name ?? r.result}</b> <span class="hint">niveau ${r.level}${out?.soin ? ` · +${out.soin} PV` : ''}</span>
          ${lvlOk ? '' : `<div class="lack" style="font-size:12px">${M[k].name} niveau ${r.level} requis</div>`}<div class="ings">${ings}</div></div>
          <span class="btn ${ok ? '' : 'off'}" data-craft="${i}">Fabriquer</span></div>`;
      }).join('');
      return `<div class="mh"><img src="assets/ui/metier_${k}.png" alt=""><div><b>${m.name}</b> · niveau ${st.level}
        <div class="bar"><i style="width:${Math.round((st.xp / need) * 100)}%"></i></div><span class="hint">${st.xp} / ${need} XP · une viande ramassée ou une recette faite fait monter le métier</span></div></div>
        ${weapon}${recs}`;
    }).join('');
    w.innerHTML = `${this.title('Métiers', 'job')}<div class="in">${jobs || '<div class="hint">Aucun métier.</div>'}</div>`;
    w.querySelectorAll<HTMLElement>('[data-craft]').forEach(e => e.addEventListener('click', () => { this.world.craft(+e.dataset.craft!); this.changed(); }));
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
    const ids = Q.enCours.map(c => c.id), fin = [...Q.finies].filter(id => Q.data.quetes[id]);
    if (!this.queteVue || !Q.data.quetes[this.queteVue]) this.queteVue = Q.suivie ?? ids[0] ?? fin[0] ?? null;
    const item = (id: string, done: boolean) => {
      const q = Q.def(id), c = Q.enCours.find(x => x.id === id);
      return `<div class="qi ${this.queteVue === id ? 'on' : ''} ${done ? 'fin' : ''}" data-q="${id}"><img src="${icon(id, !!c?.aRendre)}" alt="">
        <div>${q.nom}<br><small>${q.serie ?? ({ tutoriel: 'Tutoriel', principale: 'Quête principale', secondaire: 'Quête', prime: 'Prime', evenement: 'Événement' })[q.type]} · niv. ${q.niveau}</small></div>
        ${Q.suivie === id ? '<span class="pin" title="Quête suivie">◆</span>' : ''}</div>`;
    };
    let det = '<div class="hint">Aucune quête. Les PNJ avec une icône verte au-dessus de la tête en ont une à te confier.</div>';
    const id = this.queteVue;
    if (id) {
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
        r.potions ? '<span>Potions remplies</span>' : ''].filter(Boolean).join('');
      det = `<div><h3>${q.nom}</h3><div class="sub">${q.serie ? `${q.serie} · ` : ''}Niveau ${q.niveau}${pnj ? ` · ${pnj}` : ''}${done ? ' · Terminée' : ''}</div></div>
        <p>${q.texte}</p>${steps}<div class="qh">Récompenses</div><div class="rw">${rw || '<span class="hint">Aucune</span>'}</div>
        ${c ? `<span class="btn ${Q.suivie === id ? 'off' : ''}" data-suivre>${Q.suivie === id ? 'Quête suivie' : 'Suivre cette quête'}</span>` : ''}`;
    }
    w.innerHTML = `${this.title('Quêtes', 'quest')}<div class="qb"><div class="ql">
      <div class="qh">En cours (${ids.length})</div>${ids.map(i => item(i, false)).join('') || '<div class="hint">Aucune</div>'}
      <div class="qh">Terminées (${fin.length})</div>${fin.map(i => item(i, true)).join('') || '<div class="hint">Aucune</div>'}
      </div><div class="qd">${det}</div></div>`;
    w.querySelectorAll<HTMLElement>('[data-q]').forEach(e => e.addEventListener('click', () => { this.queteVue = e.dataset.q!; this.render(); }));
    w.querySelector('[data-suivre]')?.addEventListener('click', () => { if (id) { Q.suivie = id; this.render(); } });
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
          ['& é " \' ( -', 'barre de sorts'], ['Espace', 'déplacement'], ['E', 'potion'], ['S', 'sorts'], ['I', 'inventaire'], ['C', 'caractéristiques'], ['J', 'métiers'],
          ['O', 'options'], ['M', 'carte du monde (0.2a)'], ['Ctrl+M', 'couper ou remettre le son'], ['Molette', 'zoom'], ['F', 'effets d\'impact'], ['H', 'aide'], ['Échap', 'fermer']]
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
          { k: 'particules', nom: 'Particules (spores, braises…)', t: 'check' },
        ] },
      ] },
      { nom: 'Son', desc: 'Ces options règlent la musique et les sons du jeu. Ctrl+M coupe ou remet tout le son.', secs: [
        { id: 'son', titre: 'Général', opts: [
          { k: 'muet', nom: 'Couper tout le son', aide: 'Ctrl+M', t: 'check' },
          { k: 'volume', nom: 'Volume général', t: 'range', min: 0, max: 100 },
          { k: 'volMusique', nom: 'Musique', t: 'range', min: 0, max: 100 },
          { k: 'volEffets', nom: 'Effets (sorts, coups, monstres)', t: 'range', min: 0, max: 100 },
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
      e.addEventListener('change', () => { if (k === 'volEffets') Son.jouer(MANIFESTE.impacts[0], 'effets'); else if (k === 'volInterface' || k === 'volume') Son.jouer(MANIFESTE.ui.ok, 'interface'); });
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
        rows = [['Coût', mob ? `${x.cost} (déplacement)` : x.cost], ['Recharge', mob ? 'charges de PM' : x.cdS >= 1 ? `${n1(x.cdS)} s` : 'aucune'],
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

  private changed() { this.hideTip(); this.render(); this.onChange(); }
  private flash(e: HTMLElement) { e.style.borderColor = '#e0625a'; }

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
        cells.push(`<div class="cell ${up ? 'up' : ''} ${d.level > p.level ? 'low' : ''}" data-uid="${it.uid}">${iconHtml(d.icon)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i></div>`);
      }
    }
    if ((this.tab === 'tout' || this.tab === 'ressource' || this.tab === 'conso') && !this.kind) for (const [id, n] of Object.entries(p.resources)) {
      const r = ITEMS.resources[id];
      if (!r || (q && !r.name.toLowerCase().includes(q))) continue;
      if (this.tab === 'conso' && !r.soin) continue;
      cells.push(`<div class="cell" data-res="${id}">${iconHtml(r.icon)}<span class="n">${n}</span></div>`);
    }
    // Objets de quête (pages, Sac de Bijoux...) : onglet « Objets de quête » ; ils partent à la fin de la quête
    if ((this.tab === 'tout' || this.tab === 'quete') && !this.kind) for (const [nom, k] of Object.entries(this.world.quetes?.objets ?? {})) {
      if (q && !nom.toLowerCase().includes(q)) continue;
      cells.push(`<div class="cell" title="${nom} (objet de quête)"><img src="${INV}/tab_key.png" alt="" style="width:34px;height:34px;opacity:.9"><span class="n">${k}</span></div>`);
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
    const leg = [it.legendary, it.legendary2].map(l => l ? `<div class="leg"><b>${LEGENDARY[l.id].name}</b> : ${LEGENDARY[l.id].text(l.value)}</div>` : '').join('');
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
    this.tip.innerHTML = `<h4 style="color:${RARITY_COLORS[it.rarity]}">${d.name}</h4>
      <div class="sub">${RARITY_NAMES[it.rarity]} · ${d.weapon?.type ?? SLOT_NAMES[(slot ?? 'amulette') as EquipSlot]} · niveau ${d.level}</div>
      ${weapon}${stats}${leg}${set}${lvl}${cmp}
      <div class="hint">${worn ? 'Clic droit : retirer' : `Clic droit : équiper · Maj + clic : recycler (${recycleValue(d, it)} runes)`}</div>`;
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
