import { v } from './assetUrl';
import { MANIFESTE, Son } from './son';
import { GAME_DATA, ITEMS, QUETES } from '../sim/data';
import { EQUIP_SLOTS, RARITY_COLORS, RARITY_NAMES } from '../sim/items';
import { LOOKS } from './looks';
import { ICON_CSS, iconHtml } from './icons';
import { PALIERS, lireBestiaire } from './carnet';
import { SORTS, niveauRequis, type SortOfficiel } from '../sim/sorts';
import CLASSES_DOFUS from '../data/classes_dofus.json';
import JOURNAL from '../data/journal.json';
import { EMPLACEMENTS, NB_SECOURS, dernier, dureeTexte, exporter, importer, lireCimetiere, lirePersos, lireSecours, nomValide, prendreSecours, restaurerSecours, sauverPerso, supprimerPerso, type Perso } from './persos';

/** Écrans hors du jeu (maquette unique, choix 17A à 23A, 19B, 22D, 30E) : accueil avec Incarnam en direct derrière,
 *  création du perso devant le dieu de sa classe, et « Mes personnages ». Du HTML posé sur le jeu : la partie (ZoneScene)
 *  tourne derrière en mode vitrine. Les textes des classes sont ceux de Dofus 3 (src/data/classes_dofus.json). */

interface ClasseDofus { id: number; cle: string; nom: string; titre: string; desc: string; complexite: number; roles: Record<string, number> }
const CLASSES = CLASSES_DOFUS as ClasseDofus[];
/** Classes jouables (planches en jeu) et date prévue des suivantes. */
const JOUABLES = new Set(Object.keys(GAME_DATA.classes));
/** Classes pas encore jouables (Accueil 9A) : leur fiche s'affiche quand même, avec la version prévue (feuille de route). */
const PLUS_TARD: Record<string, string> = { osamodas: 'Prévue en 0.4' };
const plusTard = (cle: string) => PLUS_TARD[cle] ?? 'Prévue après la 1.0';
/** Version affichée et textes de l'accueil (Accueil 12A) : ils racontent la zone de la version, pas le moteur. */
const VERSION = '0.1';
const TEXTES: Record<string, { zone: string; slogan: string; ruban: string; lignes: string[] }> = {
  '0.1': {
    zone: 'INCARNAM, LE VILLAGE DANS LES NUAGES', slogan: 'Les nuages d\'Incarnam grouillent de monstres.', ruban: 'En chasse !',
    lignes: ['Le Milimilou rôde dans la forêt, et la Milice cherche des bras.', 'Kardorim ne dort que d\'un œil au fond de sa crypte.', 'Astrub t\'attend sous les nuages, dans la prochaine version.'],
  },
};
const TEXTE = TEXTES[VERSION];
/** Pastilles de zones (Accueil 7A) : un clic ouvre la fiche de la zone. */
const ZONES_ACC: { cle: string; nom: string; sous: string[]; dispo: boolean; plus?: string }[] = [
  { cle: 'incarnam', nom: 'Incarnam', sous: ['450', '444', '445', '442', '443', '778', '449', '446'], dispo: true },
  { cle: 'crypte', nom: 'Crypte de Kardorim', sous: ['447'], dispo: true },
  { cle: 'astrub', nom: 'Astrub', sous: [], dispo: false, plus: 'Arrive en 0.2 : 16 sous-zones, du niveau 10 au 40, et 4 donjons (Tournesol Affamé, Mob l\'Éponge, Bouftou Royal, Kankreblath).' },
];
/** Illustration du dieu de la classe (class_/LevelUp{N} de Dofus 3) ; les autres classes ont le décor du titre. */
const DIEUX = new Set(['iop', 'cra', 'osamodas']);
/** Animations du perso sur le socle : nombre d'images de chaque bande (rendues comme le jeu, voir LISEZMOI ;
 *  l'attaque est plus large : le perso s'élance vers la droite). */
const POSES: [string, string, number][] = [['repos', 'Repos', 24], ['garde', 'Garde', 24], ['attaque', 'Attaque', 23]];
const FILTRES = ['Toutes', 'Dégâts', 'Tank', 'Soins', 'Invocation'];

const A = 'assets/accueil';
const img = (f: string) => v(`${A}/${f}`);
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Planche d'un gros perso : une bande (anciennes planches) ou une grille (planches fines, voir tools/extraction/accueil_grille.py).
 *  Le nombre de colonnes se déduit de la taille de l'image et du format de la case (celui de l'élément). */
const grilles = new Map<string, { cols: number; rows: number; fh: number } | null>();
function grille(h: HTMLElement, n: number) {
  const src = h.dataset.src!, k = `${src}|${n}`;
  if (grilles.has(k)) return grilles.get(k)!;
  grilles.set(k, null);
  const im = new Image();
  im.onload = () => {
    if (!h.offsetWidth || !h.offsetHeight) { grilles.delete(k); return; }   // pas encore affiché : on réessaiera
    const ratio = h.offsetWidth / h.offsetHeight;
    let best = { cols: n, rows: 1, fh: im.naturalHeight }, err = Infinity;
    for (let rows = 1; rows <= n; rows++) {
      // colonnes prédites par la taille de l'image ; la dernière ligne peut être incomplète
      const p = im.naturalWidth * rows / (im.naturalHeight * ratio), cols = Math.max(1, Math.round(p));
      if (cols * rows < n || cols * (rows - 1) >= n) continue;
      const e = Math.abs(p - cols) / cols;
      if (e < err) { err = e; best = { cols, rows, fh: im.naturalHeight / rows }; }
    }
    grilles.set(k, best);
  };
  im.src = src;
  return null;
}
const tete = (c: ClasseDofus, sexe: 'm' | 'f') => img(`h_${c.id}${sexe === 'm' ? 0 : 1}.png`);
const classe = (cle: string) => CLASSES.find(c => c.cle === cle) ?? CLASSES[0];

// 1 unité = 1 % de la largeur d'un écran 16:9 qui tient dans la fenêtre (les maquettes étaient en cqw)
const CSS = `
#acc{position:fixed;inset:0;z-index:20;container-type:size;font-family:Nunito,system-ui,sans-serif;color:#f6f1dc;user-select:none;
  --u:min(1cqw,1.7778cqh);--lime:#b9e54b;--ink:#1d2a06;--disp:"Lilita One","Arial Rounded MT Bold",system-ui,sans-serif}
#acc *{box-sizing:border-box}
#acc[hidden]{display:none}
#acc .page{position:absolute;inset:0;overflow:hidden}
#acc .cover{position:absolute;inset:0;background-size:cover;background-position:center}
#acc .abs{position:absolute}
#acc .side{position:absolute;left:0;top:0;bottom:0;width:calc(6.6*var(--u));background:#17180f;border-right:1px solid #2c2f1f;display:flex;flex-direction:column;align-items:center;padding:calc(1.2*var(--u)) 0 calc(1*var(--u));gap:calc(.35*var(--u));z-index:5}
#acc .side .logo{width:calc(4.4*var(--u));height:auto;margin-bottom:calc(1*var(--u));filter:drop-shadow(0 calc(.3*var(--u)) calc(.6*var(--u)) #000a)}
#acc .nav{all:unset;cursor:pointer;width:100%;display:grid;justify-items:center;gap:calc(.2*var(--u));padding:calc(.55*var(--u)) 0;font-size:calc(.72*var(--u));font-weight:800;color:#d9d4bd;border-left:calc(.2*var(--u)) solid transparent;box-sizing:border-box}
#acc .nav img{height:calc(2.3*var(--u));width:calc(2.7*var(--u));object-fit:contain;filter:drop-shadow(0 1px 1px #000);transition:transform .15s,filter .15s}
#acc .nav.on img{transform:scale(1.15);filter:drop-shadow(0 0 calc(.4*var(--u)) #b9e54b88) drop-shadow(0 1px 1px #000)}
#acc .nav:hover{background:#1f2116}
#acc .nav.on{background:#23261a;border-left-color:var(--lime);color:#fff}
#acc .side .play{all:unset;cursor:pointer;margin-top:auto;font-family:var(--disp);font-size:calc(1.25*var(--u));color:var(--ink);background:linear-gradient(#cff26a,#9ccd2c);padding:calc(.5*var(--u)) calc(1.1*var(--u));clip-path:polygon(8% 0,100% 0,92% 100%,0 100%);box-shadow:0 calc(.2*var(--u)) 0 #5d7d14}
#acc .side .ver{font-size:calc(.6*var(--u));color:#7d7a66;letter-spacing:.1em;margin-top:calc(.6*var(--u))}
#acc .lbtn{all:unset;cursor:pointer;font-family:var(--disp);font-size:calc(1.25*var(--u));color:var(--ink);background:linear-gradient(#d3f46f,#a2d332);border-radius:calc(.5*var(--u));padding:calc(.85*var(--u)) calc(1.8*var(--u));box-shadow:0 calc(.25*var(--u)) 0 #5d7d14,0 calc(.5*var(--u)) calc(1.2*var(--u)) #0007;white-space:nowrap;text-align:center}
#acc .lbtn:hover{filter:brightness(1.08)}
#acc .lbtn[aria-disabled=true]{filter:grayscale(1) brightness(.7);cursor:default}
#acc .dbtn{all:unset;cursor:pointer;font-weight:800;font-size:calc(1.05*var(--u));color:#f1ecd8;background:#2a2a20e6;border:1px solid #4c4b3a;border-radius:calc(.5*var(--u));padding:calc(.8*var(--u)) calc(1.5*var(--u));box-shadow:0 calc(.25*var(--u)) 0 #0a0a07;white-space:nowrap;text-align:center}
#acc .dbtn:hover{border-color:#8a8a66}
#acc .dbtn.rouge{color:#ffb39a;border-color:#7a3a2a}
#acc .tiny{font-size:calc(.75*var(--u));color:#c9c4ab}
#acc .ttl{font-family:var(--disp);color:var(--lime);-webkit-text-stroke:calc(.12*var(--u)) #1f2a08;paint-order:stroke fill;text-shadow:0 calc(.3*var(--u)) 0 #1f2a08,0 calc(.6*var(--u)) calc(1.4*var(--u)) #0009;line-height:.95}
#acc .logoI{width:calc(25*var(--u));height:auto;filter:drop-shadow(0 calc(.5*var(--u)) calc(1.2*var(--u)) #000b)}
#acc .ribbon{font-family:var(--disp);font-size:calc(4.4*var(--u));color:#e6fa9c;-webkit-text-stroke:calc(.18*var(--u)) #1f2a08;paint-order:stroke fill;text-shadow:0 calc(.3*var(--u)) 0 #1f2a08;padding:calc(.6*var(--u)) calc(3*var(--u)) calc(.9*var(--u)) calc(2.2*var(--u));background:linear-gradient(90deg,#3c5a12,#56801a 70%,#3c5a1200);clip-path:polygon(0 15%,100% 0,96% 100%,3% 88%);white-space:nowrap}
#acc .card{background:#1d1e15ee;border:1px solid #45452f;border-radius:calc(.6*var(--u));box-shadow:0 calc(.3*var(--u)) calc(1*var(--u)) #0008}
#acc .chip{all:unset;cursor:pointer;font-weight:800;font-size:calc(.8*var(--u));border:1px solid #f1ecd8aa;border-radius:calc(2*var(--u));padding:calc(.4*var(--u)) calc(1.1*var(--u));background:#1b1c13cc;white-space:nowrap}
#acc .chip.on{background:linear-gradient(#cff26a,#9ccd2c);color:var(--ink);border-color:#e9ffb0}
#acc .chip.off{opacity:.6;cursor:default}
#acc .panelT{font-family:var(--disp);font-size:calc(1.25*var(--u));text-align:center;padding:calc(.6*var(--u));border-bottom:1px solid #45452f;color:#fbf3d4}
#acc .tab{all:unset;cursor:pointer;flex:1;display:flex;align-items:center;gap:calc(.5*var(--u));justify-content:center;font-weight:800;font-size:calc(.9*var(--u));padding:calc(.45*var(--u));border-radius:calc(.4*var(--u));background:#2a2b1f;border:1px solid #45452f}
#acc .tab img{height:calc(1.8*var(--u))}
#acc .tab.on{background:linear-gradient(#cff26a,#9ccd2c);color:var(--ink);border-color:#e9ffb0}
#acc input.field{all:unset;display:block;width:100%;box-sizing:border-box;background:#0f100b;border:1px solid #45452f;border-radius:calc(.4*var(--u));padding:calc(.55*var(--u)) calc(.7*var(--u));font-size:calc(.95*var(--u));color:#f6f1dc;user-select:text}
#acc input.field:focus{border-color:var(--lime)}
#acc .lab{font-size:calc(.75*var(--u));font-weight:800;color:#c9c4ab;margin:calc(.7*var(--u)) 0 calc(.3*var(--u))}
#acc .strip{position:absolute;left:calc(7.6*var(--u));right:calc(1*var(--u));bottom:calc(.7*var(--u));display:flex;gap:calc(.25*var(--u));justify-content:space-between;z-index:4}
#acc .cls{all:unset;cursor:pointer;display:grid;justify-items:center;gap:calc(.1*var(--u));font-size:calc(.6*var(--u));font-weight:800;color:#d9d4bd;width:calc(4.3*var(--u));padding:calc(.2*var(--u)) 0 calc(.3*var(--u));border-radius:calc(.4*var(--u));position:relative}
#acc .cls img{height:calc(3.2*var(--u));filter:grayscale(.85) brightness(.75)}
#acc .cls.play img{filter:none}
#acc .cls.on{background:#2a2c1f;box-shadow:inset 0 calc(-.25*var(--u)) 0 var(--lime)}
#acc .cls.on img{filter:none}
#acc .cls.dim{opacity:.3}
#acc .cls .soon{position:absolute;top:0;right:calc(.1*var(--u));font-size:calc(.5*var(--u));background:#0f100bdd;padding:0 calc(.25*var(--u));border-radius:calc(.3*var(--u));color:#e0925a}
#acc .bar{height:calc(.55*var(--u));border-radius:9px;background:#33342a;overflow:hidden}
#acc .bar i{display:block;height:100%;background:linear-gradient(90deg,#9ccd2c,#d3f46f)}
#acc .dots{letter-spacing:calc(.15*var(--u));color:var(--lime)}
#acc .dots i{font-style:normal;color:#55553f}
#acc .sp{display:flex;align-items:center;gap:calc(.5*var(--u));font-size:calc(.8*var(--u));font-weight:700;line-height:1.1}
#acc .sp img{width:calc(1.9*var(--u));height:calc(1.9*var(--u));border-radius:calc(.3*var(--u));border:1px solid #5d5c45}
#acc .sp small{display:block;color:#a8a58e;font-size:calc(.62*var(--u))}
#acc .hero{background-repeat:no-repeat}
#acc .slot{all:unset;cursor:pointer;display:grid;grid-template-columns:calc(4.6*var(--u)) 1fr;align-items:center;gap:calc(.8*var(--u));width:100%;box-sizing:border-box;padding:calc(.7*var(--u)) calc(.9*var(--u));border-radius:calc(.6*var(--u));background:#1b1c13e6;border:1px solid #45452f}
#acc .slot img{width:100%}
#acc .slot b{font-family:var(--disp);font-weight:400;font-size:calc(1.5*var(--u));color:#fbf3d4;display:block;line-height:1.05}
#acc .slot.on{border-color:var(--lime);box-shadow:0 0 0 calc(.12*var(--u)) var(--lime),0 calc(.4*var(--u)) calc(1.4*var(--u)) #b9e54b33}
#acc .slot.vide{border-style:dashed;color:#a8a58e}
#acc .hc{color:#e0925a;font-weight:800}
#acc .toast{position:absolute;left:50%;bottom:calc(6*var(--u));transform:translateX(-50%);background:#14130fee;border:1px solid #5d5c45;padding:calc(.6*var(--u)) calc(1.4*var(--u));border-radius:calc(.5*var(--u));font-weight:800;font-size:calc(.95*var(--u));z-index:9;pointer-events:none;transition:opacity .3s}
#acc .err{color:#ff9a7a;font-size:calc(.7*var(--u));margin-top:calc(.3*var(--u));min-height:1em}
#acc .check{display:flex;align-items:center;gap:calc(.5*var(--u));margin-top:calc(.8*var(--u));font-weight:800;font-size:calc(.8*var(--u));cursor:pointer}
#acc .modal{position:absolute;inset:0;z-index:12;background:#05060399;display:grid;place-items:center}
#acc .modal>.card{width:calc(44*var(--u));max-height:calc(46*var(--u));overflow:auto;padding:calc(1.2*var(--u)) calc(1.6*var(--u));position:relative}
#acc .modal h2{font-family:var(--disp);font-weight:400;font-size:calc(2*var(--u));color:var(--lime);margin:0 0 calc(.4*var(--u))}
#acc .modal .x{all:unset;cursor:pointer;position:absolute;right:calc(1*var(--u));top:calc(.7*var(--u));font-size:calc(1.4*var(--u));color:#c9c4ab}
#acc .lst{display:grid;gap:calc(.45*var(--u));margin-top:calc(.7*var(--u))}
#acc .lst>div{display:grid;grid-template-columns:1fr auto;gap:calc(.2*var(--u)) calc(1*var(--u));align-items:center;background:#25261bcc;border:1px solid #3c3c2a;border-radius:calc(.4*var(--u));padding:calc(.5*var(--u)) calc(.8*var(--u));font-size:calc(.85*var(--u));font-weight:700}
#acc .lst small{grid-column:1/-1;color:#a8a58e;font-weight:600;font-size:calc(.72*var(--u))}
#acc .lst .ok{color:var(--lime)}
#acc .lst .no{color:#77745f}
#acc .lst>.stele{display:grid;grid-template-columns:calc(3.4*var(--u)) 1fr;gap:calc(.8*var(--u));align-items:center;background:linear-gradient(#3a3a33,#26261f);border:1px solid #57554c;border-radius:calc(1.6*var(--u)) calc(1.6*var(--u)) calc(.3*var(--u)) calc(.3*var(--u));padding:calc(.6*var(--u)) calc(1*var(--u))}
#acc .stele img{width:100%;filter:grayscale(1) brightness(.85)}
#acc .stele b{font-family:var(--disp);font-weight:400;font-size:calc(1.3*var(--u));color:#e8e2c8}
#acc .mini{all:unset;cursor:pointer;font-weight:800;font-size:calc(.75*var(--u));color:#f1ecd8;background:#2a2a20;border:1px solid #4c4b3a;border-radius:calc(.4*var(--u));padding:calc(.3*var(--u)) calc(.8*var(--u));white-space:nowrap}
#acc .mini:hover{border-color:#8a8a66}
#acc .bes{display:grid;grid-template-columns:repeat(auto-fill,minmax(calc(19*var(--u)),1fr));gap:calc(.8*var(--u))}
#acc .mob{display:grid;grid-template-columns:calc(5*var(--u)) 1fr;gap:calc(.3*var(--u)) calc(.8*var(--u));padding:calc(.7*var(--u)) calc(.9*var(--u));font-size:calc(.75*var(--u));font-weight:700;align-content:start}
#acc .mob canvas{width:calc(5*var(--u));height:calc(5*var(--u));grid-row:span 2}
#acc .mob.inconnu canvas{filter:brightness(0) opacity(.55)}
#acc .mob b{font-family:var(--disp);font-weight:400;font-size:calc(1.15*var(--u));color:#fbf3d4;display:block}
#acc .mob .l{display:flex;justify-content:space-between;gap:calc(.5*var(--u));color:#c9c4ab}
#acc .mob .l span:last-child{color:#f6f1dc;text-align:right}
#acc .mob .lock{color:#77745f;font-style:italic;font-weight:600}
#acc .mob .det{grid-column:1/-1;display:grid;gap:calc(.25*var(--u))}
#acc .zt{grid-column:1/-1;font-family:var(--disp);font-size:calc(1.4*var(--u));color:var(--lime);margin-top:calc(.4*var(--u))}
#acc .pastille{position:absolute;top:calc(.2*var(--u));right:calc(.4*var(--u));font-size:calc(.5*var(--u));font-weight:800;background:#e0572a;color:#fff;border-radius:calc(.6*var(--u));padding:0 calc(.3*var(--u));box-shadow:0 0 calc(.5*var(--u)) #e0572a99}
#acc .jr{position:absolute;left:calc(6.6*var(--u));right:0;top:0;bottom:0;overflow:auto;background:#29251a;user-select:text}
#acc .jr .in{width:calc(70*var(--u));margin:0 auto;padding:calc(3*var(--u)) 0 calc(4*var(--u))}
#acc .jr h1{font-family:var(--disp);font-weight:400;font-size:calc(4.6*var(--u));line-height:1;margin:0;color:#fbf3d4}
#acc .jr h1 em{font-style:normal;color:var(--lime)}
#acc .une{display:grid;grid-template-columns:1fr 1.05fr;gap:calc(2.4*var(--u));align-items:center;background:#ece2c4;color:#2b2416;border-radius:calc(.3*var(--u));padding:calc(2.4*var(--u));margin:calc(2.4*var(--u)) 0;position:relative}
#acc .une .t,#acc .jc .t{font-size:calc(.75*var(--u));font-weight:800;color:#4e6b14}
#acc .une h2{font-family:var(--disp);font-weight:400;font-size:calc(3*var(--u));margin:calc(.4*var(--u)) 0}
#acc .une p{font-size:calc(.95*var(--u));line-height:1.6;color:#4a4030;margin:0 0 calc(1*var(--u))}
#acc .lire{all:unset;cursor:pointer;font-weight:800;font-size:calc(.85*var(--u));color:#3c5a14;border-bottom:1px solid currentColor}
#acc .jc .lire{color:var(--lime)}
#acc .photo{background:#fff;padding:calc(.5*var(--u));box-shadow:0 calc(.5*var(--u)) calc(1.4*var(--u)) #0006;transform:rotate(1.4deg)}
#acc .photo img{display:block;width:100%}
#acc .photo small{display:block;font-size:calc(.65*var(--u));color:#5a5236;margin-top:calc(.4*var(--u))}
#acc .grille{display:grid;grid-template-columns:1fr 1fr;gap:calc(2.4*var(--u)) calc(2*var(--u))}
#acc .jc img{width:100%;aspect-ratio:16/9;object-fit:cover;border:calc(.25*var(--u)) solid #4a4433;display:block}
#acc .jc h3{font-family:var(--disp);font-weight:400;font-size:calc(2*var(--u));margin:calc(.5*var(--u)) 0;color:#fbf3d4}
#acc .jc p{font-size:calc(.85*var(--u));line-height:1.6;color:#d9d4bd;margin:0 0 calc(.6*var(--u))}
#acc .sec{font-family:var(--disp);font-weight:400;font-size:calc(1.6*var(--u));color:#fbf3d4;border-bottom:1px solid #4a4433;padding-bottom:calc(.4*var(--u));margin:0 0 calc(1.4*var(--u))}
#acc .cn{display:grid;grid-template-columns:calc(14*var(--u)) 1fr;gap:calc(3*var(--u));margin-top:calc(2*var(--u))}
#acc .som{position:sticky;top:calc(1*var(--u));align-self:start;display:grid;gap:calc(.6*var(--u));font-size:calc(.75*var(--u));font-weight:700}
#acc .som b{font-size:calc(.7*var(--u));letter-spacing:.08em;color:#c9c4ab}
#acc .som button{all:unset;cursor:pointer;border-left:2px solid #4a4433;padding-left:calc(.7*var(--u));color:#d9d4bd}
#acc .som button:hover{color:var(--lime);border-color:var(--lime)}
#acc .som canvas{width:calc(6*var(--u));height:calc(6*var(--u));margin:calc(1.4*var(--u)) 0 0 calc(2*var(--u));animation:acc-flotte 3s ease-in-out infinite}
@keyframes acc-flotte{50%{transform:translateY(calc(-.5*var(--u)))}}
#acc .cn h3{font-family:var(--disp);font-weight:400;font-size:calc(2*var(--u));color:#e6fa9c;margin:0 0 calc(.8*var(--u))}
#acc .cn p{font-size:calc(.95*var(--u));line-height:1.65;font-weight:700;color:#f1ecd8;margin:0 0 calc(1*var(--u))}
#acc .hero{opacity:0}
#acc .hero.vu{opacity:1;animation:acc-app .5s ease-out}
@keyframes acc-app{0%{opacity:0;filter:brightness(3) blur(2px);transform-origin:50% 100%;scale:.92}60%{opacity:1;filter:brightness(1.6)}100%{filter:none;scale:1}}
@media (prefers-reduced-motion: reduce){#acc .hero{opacity:1}#acc .hero.vu{animation:none}}
#acc .check input{accent-color:#e0925a;width:calc(1.1*var(--u));height:calc(1.1*var(--u));margin:0}
`;

type Page = 'accueil' | 'creation' | 'persos' | 'succes' | 'bestiaire' | 'journal';
/** Journal (Accueil 3A+3B+3C+3E) : un carnet par journée de travail, écrit à chaque mise à jour (src/data/journal.json). */
interface Carnet { date: string; titre: string; resume: string; capture?: string; legende?: string; lignes: Record<string, string[]> }
const CARNETS = (JOURNAL.carnets as Carnet[]).slice().sort((a, b) => b.date.localeCompare(a.date));
const dateLongue = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const CLE_LU = 'diablofus.journal';
function carnetNonLu(): boolean {
  if (!CARNETS.length) return false;
  try { return (localStorage.getItem(CLE_LU) ?? '') < CARNETS[0].date; } catch { return false; }
}
function marquerLu() { try { if (CARNETS.length) localStorage.setItem(CLE_LU, CARNETS[0].date); } catch { /* rien */ } }

export class Accueil {
  private root: HTMLDivElement;
  private page: Page = 'accueil';
  /** Création : classe, sexe, pose, nom, Hardcore, filtre de la barre des classes. */
  private crea = { cle: 'iop', sexe: 'm' as 'm' | 'f', pose: 'repos', nom: '', hardcore: false, tuto: true, filtre: 'Toutes', err: '' };
  /** « Mes personnages » : emplacement choisi, et suppression en attente de confirmation. */
  private choix = 0;
  private confirmer = -1;
  private anim = 0;
  private toastT = 0;
  /** Fenêtre ouverte par-dessus la page (fiche de zone, cimetière, copies de secours). */
  private modal: string | null = null;
  /** Journal : carnet ouvert (sa date), ou la liste. */
  private carnet: string | null = null;

  /** onJouer : lance la partie de cet emplacement (déjà sauvegardé). */
  constructor(private onJouer: (slot: number) => void, private onEssayer?: (classe: string, sexe: 'm' | 'f') => void) {
    if (!document.getElementById('acc-css')) {
      const st = document.createElement('style'); st.id = 'acc-css'; st.textContent = CSS + ICON_CSS.replace('.ic{', '#acc .ic{'); document.head.appendChild(st);
    }
    this.root = document.createElement('div'); this.root.id = 'acc'; this.root.hidden = true;
    // les clics sur ces écrans ne vont pas au jeu derrière
    for (const ev of ['pointerdown', 'wheel', 'contextmenu'] as const) this.root.addEventListener(ev, e => { e.stopPropagation(); if (ev === 'contextmenu') e.preventDefault(); });
    // Son officiel au clic (UI.bank) : « OK » pour jouer / créer / continuer, onglet pour la navigation, bouton générique sinon
    Son.demarrer(); Son.precharger([MANIFESTE.ui.ok, MANIFESTE.ui.bouton, MANIFESTE.ui.onglet]);
    this.root.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button,[data-go],[data-nav]');
      if (!b || b.getAttribute('aria-disabled') === 'true') return;
      const f = b.matches('.lbtn,.play,[data-jouer],[data-creer],[data-continuer],[data-jouer-slot]') ? MANIFESTE.ui.ok
        : b.matches('.nav,.tab,.chip,.cls,.slot,[data-nav]') ? MANIFESTE.ui.onglet : MANIFESTE.ui.bouton;
      Son.jouer(f, 'interface', { cle: 'clic', ecart: 0.05 });
    }, true);
    document.body.appendChild(this.root);
    let last = 0, f = 0;
    const tick = (t: number) => {
      this.anim = requestAnimationFrame(tick);
      if (t - last < 40) return;   // 25 images par seconde, comme les animations de Dofus
      last = t; f++;
      this.root.querySelectorAll<HTMLElement>('.hero').forEach(h => {
        const n = +h.dataset.n!, g = grille(h, n);
        if (!g) return;
        h.classList.add('vu');
        const i = f % n, c = i % g.cols, l = Math.floor(i / g.cols);
        h.style.backgroundSize = `${g.cols * 100}% ${g.rows * 100}%`;
        // jamais agrandi au-delà de la taille de l'image (sinon flou) : le perso rapetisse, les pieds restent sur le socle
        h.style.transformOrigin = '50% 100%'; h.style.transform = `scale(${Math.min(1, g.fh / (Math.max(1, h.offsetHeight) * (devicePixelRatio || 1)))})`;   // en pixels de l'écran (Windows à 125 %, 150 %…)
        h.style.backgroundPosition = `${g.cols > 1 ? (c / (g.cols - 1)) * 100 : 0}% ${g.rows > 1 ? (l / (g.rows - 1)) * 100 : 0}%`;
      });
    };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.anim = requestAnimationFrame(tick);
  }

  get visible() { return !this.root.hidden; }
  show(page: Page = 'accueil') { this.root.hidden = false; this.precharger(); this.go(page); }
  /** Accueil 5A : les planches des persos (3 emplacements) et des classes jouables sont chargées dès l'accueil,
   *  pour que le socle ne reste jamais vide. */
  private precharger() {
    const urls = new Set<string>();
    for (const p of lirePersos()) if (p) urls.add(img(`${p.classe}_${p.sexe}_repos.webp`));
    for (const c of JOUABLES) for (const sx of ['m', 'f']) for (const [k] of POSES) urls.add(img(`${c}_${sx}_${k}.webp`));
    for (const u of urls) { const im = new Image(); im.src = u; }
  }
  private jouer(slot: number) { prendreSecours(); this.onJouer(slot); }
  hide() { this.root.hidden = true; this.root.innerHTML = ''; }
  destroy() { cancelAnimationFrame(this.anim); this.root.remove(); }

  private go(page: Page) {
    this.page = page; this.confirmer = -1; this.crea.err = ''; this.modal = null;
    if (page === 'persos') { const d = dernier(); this.choix = d ?? Math.max(0, lirePersos().findIndex(p => p)); }
    this.render();
  }

  private render() {
    const html = this.page === 'accueil' ? this.pageAccueil() : this.page === 'creation' ? this.pageCreation() : this.page === 'succes' ? this.pageSucces() : this.page === 'bestiaire' ? this.pageBestiaire() : this.page === 'journal' ? this.pageJournal() : this.pagePersos();
    const m = this.modal ? `<div class="modal" data-fermer><div class="card">${this.modal}<button type="button" class="x" data-fermer aria-label="Fermer">✕</button></div></div>` : '';
    this.root.innerHTML = `<div class="page">${html}${this.side()}${m}<div class="toast" style="opacity:0"></div></div>`;
    this.bind();
    this.portraits();
  }

  private toast(msg: string) {
    const t = this.root.querySelector<HTMLElement>('.toast'); if (!t) return;
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(this.toastT); this.toastT = window.setTimeout(() => { t.style.opacity = '0'; }, 2200);
  }

  /** Colonne fine (30E) : icônes en couleur du menu principal de Dofus 3 (uiassets_2x) + texte. Bestiaire, Succès et Journal arrivent plus tard. */
  private side(): string {
    const NAV: [string, string, string][] = [['accueil', 'assets/ui/menu/home.png', 'Accueil'], ['persos', 'assets/ui/menu/character.png', 'Personnages'],
      ['creation', img('h_80.png'), 'Classes'], ['bestiaire', 'assets/ui/menu/bestiary.png', 'Bestiaire'], ['succes', 'assets/ui/menu/success.png', 'Succès'], ['journal', 'assets/ui/menu/calendar.png', 'Journal']];
    return `<nav class="side"><img class="logo" src="${v('assets/logo/embleme.webp')}" alt="" aria-hidden="true">${NAV.map(([k, ic, l]) =>
      `<button type="button" class="nav${k === this.page ? ' on' : ''}" data-nav="${k}" style="position:relative"><img src="${ic}" alt="">${l}${k === 'journal' && carnetNonLu() ? '<span class="pastille">nouveau</span>' : ''}</button>`).join('')}
      <button type="button" class="play" data-jouer>Jouer</button><div class="ver">VERSION ${VERSION}</div></nav>`;
  }

  // --- Accueil (17A) : Incarnam en direct derrière, titre, Continuer / Nouvelle partie --------------------------
  private pageAccueil(): string {
    const l = lirePersos(), d = dernier(), p = d != null ? l[d] : null, n = l.filter(Boolean).length;
    const c = p && classe(p.classe);
    return `<div class="cover" style="background:linear-gradient(90deg,#0d0e09f0 6%,#0d0e09b0 30%,#0d0e0918 55%,transparent 70%)"></div>
    <div class="abs tiny" style="left:calc(11*var(--u));top:calc(2.2*var(--u));letter-spacing:.15em;font-weight:800">${TEXTE.zone}</div>
    <img class="abs logoI" style="left:calc(10.4*var(--u));top:calc(3.6*var(--u))" src="${v('assets/logo/logo.webp')}" alt="Diablofus : Les Douze Enfers">
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(15.2*var(--u));font-weight:800;font-size:calc(1.7*var(--u))">${TEXTE.slogan}</div>
    <div class="abs ribbon" style="left:calc(9.8*var(--u));top:calc(18.2*var(--u))">${TEXTE.ruban}</div>
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(26.8*var(--u));font-weight:700;font-size:calc(1.05*var(--u));line-height:1.75;max-width:calc(34*var(--u))">
      ${TEXTE.lignes.join('<br>')}</div>
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(34.5*var(--u));display:flex;gap:calc(1*var(--u));align-items:center">
      ${p ? `<button type="button" class="lbtn" data-continuer>Continuer · ${esc(p.nom)}, ${c!.nom} niv. ${p.etat?.level ?? 1}</button>
        <button type="button" class="dbtn" data-go="creation">Nouvelle partie</button>`
        : `<button type="button" class="lbtn" data-go="creation">Nouvelle partie</button>`}
    </div>
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(39.6*var(--u));display:flex;gap:calc(1*var(--u));align-items:center">
      <button type="button" class="dbtn" style="font-size:calc(.85*var(--u));padding:calc(.5*var(--u)) calc(1*var(--u))" data-go="persos">Mes personnages${n ? ` (${n})` : ''}</button>
      <span class="tiny">${EMPLACEMENTS} emplacements · sauvegarde automatique</span></div>
    ${p ? this.derniereFois(p) : ''}
    ${carnetNonLu() ? `<div class="abs card" style="right:calc(2*var(--u));top:calc(1.6*var(--u));padding:calc(.7*var(--u)) calc(1*var(--u));display:flex;gap:calc(1*var(--u));align-items:center;font-weight:800;font-size:calc(.85*var(--u))">
      <span class="pastille" style="position:static">nouveau</span><span>Carnet du ${dateLongue(CARNETS[0].date)}<br><span class="tiny">${esc(CARNETS[0].titre)}</span></span>
      <button type="button" class="mini" data-carnet="${CARNETS[0].date}">Lire</button></div>` : ''}
    <div class="abs" style="right:calc(2*var(--u));bottom:calc(1.6*var(--u));display:flex;gap:calc(.6*var(--u))">
      ${ZONES_ACC.map(z => `<button type="button" class="chip${z.cle === 'incarnam' ? ' on' : z.dispo ? '' : ' off'}" style="cursor:pointer" data-zone="${z.cle}">${z.nom}${z.dispo ? '' : ' · bientôt'}</button>`).join('')}</div>`;
  }

  /** « La dernière fois… » (Accueil 4C) : la dernière partie du perso, sur une note de parchemin. */
  private derniereFois(p: Perso): string {
    const s = p.session, d = s ? Math.max(0, Math.round((p.maj - s.debut) / 1000)) : 0;
    const l: [string, string][] = s ? [
      ...(s.niveau > s.niveau0 ? [['Niveaux', `+${s.niveau - s.niveau0}`] as [string, string]] : []),
      ['Monstres vaincus', String(s.vaincus)],
      ...(s.quetes ? [['Quêtes finies', String(s.quetes)] as [string, string]] : []),
      ...(s.elites.length ? [['Élites', s.elites.join(', ')] as [string, string]] : []),
      ...(s.meilleur ? [['Meilleur objet', `<span style="color:${RARITY_COLORS[s.meilleur.rarete] === '#e8e2d4' ? '#2a2615' : RARITY_COLORS[s.meilleur.rarete]}">${esc(s.meilleur.nom)}</span>`] as [string, string]] : []),
    ] : [];
    return `<div class="abs card" style="right:calc(2*var(--u));bottom:calc(5.4*var(--u));width:calc(19*var(--u));padding:calc(.8*var(--u)) calc(1.1*var(--u));font-weight:700;font-size:calc(.85*var(--u));transform:rotate(-1deg);background:#f4ecd0;color:#2a2615;border-color:#c9b98a">
      <div style="font-family:var(--disp);font-size:calc(1.2*var(--u));margin-bottom:calc(.3*var(--u))">${s ? 'La dernière fois…' : 'Dernière sortie'}</div>
      <div style="display:flex;justify-content:space-between;gap:calc(.6*var(--u))"><span>${esc(p.lieu)}</span><span>${dureeTexte(s ? d : p.temps)}${s ? '' : ' de jeu'}</span></div>
      ${l.map(([k, x]) => `<div style="display:flex;justify-content:space-between;gap:calc(.6*var(--u));color:#5a5236"><span>${k}</span><span style="color:#2a2615;text-align:right">${k === 'Meilleur objet' ? x : esc(x)}</span></div>`).join('')}</div>`;
  }
  /** Résumé du perso choisi (Accueil 4A). */
  private resume(p: Perso): string {
    const st = p.stats, e = p.etat;
    const l: [string, string][] = [['Temps de jeu', dureeTexte(p.temps)], ['Dernière sortie', esc(p.lieu)], ['Kamas', (e?.kamas ?? 0).toLocaleString('fr-FR')],
      ['Monstres vaincus', (st?.vaincus ?? 0).toLocaleString('fr-FR')], ['Quêtes finies', String(st?.quetes ?? 0)],
      ...(p.hardcore ? [] : [['Défaites', String(st?.morts ?? 0)] as [string, string]]),
      ['Meilleur objet', st?.meilleur ? `<span style="color:${RARITY_COLORS[st.meilleur.rarete]}">${esc(st.meilleur.nom)}</span> <span class="tiny">${RARITY_NAMES[st.meilleur.rarete]}</span>` : '<span class="tiny">aucun</span>']];
    // Accueil 4B : la tenue réelle du perso. Les gros persos du socle sont des rendus faits d'avance (sans équipement),
    // alors l'équipement porté s'affiche en cases, comme la fiche du perso en jeu.
    const eq = EQUIP_SLOTS.map(k => e?.equipment?.[k]).filter(Boolean);
    const cases = eq.length ? `<div style="display:flex;flex-wrap:wrap;gap:calc(.3*var(--u));padding:calc(.6*var(--u)) calc(1*var(--u)) 0">${eq.map(it => {
      const d = ITEMS.equipment[it!.id]; return `<span title="${esc(d?.name ?? '')} · ${RARITY_NAMES[it!.rarity]}" style="width:calc(2.6*var(--u));height:calc(2.6*var(--u));border:1px solid ${RARITY_COLORS[it!.rarity]};border-radius:calc(.3*var(--u));background:#0f100b;padding:calc(.15*var(--u));display:grid">${iconHtml(d?.icon ?? 0)}</span>`; }).join('')}</div>` : '';
    return `<div class="abs card" style="right:calc(2*var(--u));top:calc(12*var(--u));width:calc(17*var(--u));padding:0 0 calc(.7*var(--u))">
      <div class="panelT">Résumé</div>${cases}<div style="padding:calc(.6*var(--u)) calc(1*var(--u)) 0;display:grid;gap:calc(.4*var(--u));font-size:calc(.82*var(--u));font-weight:700">
      ${l.map(([k, x]) => `<div style="display:flex;justify-content:space-between;gap:calc(.6*var(--u))"><span style="color:#c9c4ab">${k}</span><span style="text-align:right">${x}</span></div>`).join('')}</div></div>`;
  }

  // --- Création (18A-21A, 19B en partie, Hardcore 10D) ----------------------------------------------------------
  private pageCreation(): string {
    const s = this.crea, c = classe(s.cle), jouable = JOUABLES.has(c.cle);
    const pose = POSES.find(p => p[0] === s.pose)!;
    const roles = Object.entries(c.roles).slice(0, 3);
    const libre = lirePersos().findIndex(p => !p);
    const bouton = !jouable ? plusTard(c.cle) : libre < 0 ? 'Emplacements pleins' : 'Créer et jouer';
    return `<div class="cover" style="background-image:url(${img(DIEUX.has(c.cle) ? `dieu_${c.cle}.jpg` : 'login.jpg')})"></div>
    <div class="cover" style="background:radial-gradient(ellipse 60% 70% at 52% 55%,transparent 30%,#0d0e09d0 80%),linear-gradient(90deg,#0d0e09f0 8%,#0d0e0980 32%,transparent 50%,#0d0e0980 72%,#0d0e09f0 92%)"></div>
    <div class="abs tiny" style="left:calc(8.4*var(--u));top:calc(1.4*var(--u));font-weight:800">Créer un personnage</div>
    <button type="button" class="abs dbtn" style="right:calc(2*var(--u));top:calc(1*var(--u));font-size:calc(.8*var(--u));padding:calc(.35*var(--u)) calc(.9*var(--u))" data-go="accueil">Retour</button>
    <div class="abs" style="left:calc(8.4*var(--u));top:calc(4.2*var(--u));width:calc(23*var(--u))">
      <div style="display:flex;align-items:center;gap:calc(.6*var(--u));font-weight:800;font-size:calc(1.15*var(--u))"><img src="${img(`c_${c.cle}.png`)}" alt="" style="height:calc(1.9*var(--u))">${esc(c.titre)}</div>
      <div class="ttl" style="font-size:calc(5.2*var(--u));margin:calc(.3*var(--u)) 0 calc(.7*var(--u))">${esc(c.nom)}</div>
      <div class="card" style="padding:0 0 calc(.9*var(--u))">
        <div class="panelT">${roles.map(r => r[0]).join(' · ')}</div>
        <div style="padding:calc(.8*var(--u)) calc(1.1*var(--u)) 0;display:grid;gap:calc(.45*var(--u));font-size:calc(.85*var(--u));font-weight:700">
          <div style="font-weight:600;font-size:calc(.75*var(--u));color:#d9d4bd;line-height:1.4">${esc(c.desc)}</div>
          ${roles.map(([n, val]) => `<div style="display:grid;grid-template-columns:calc(6*var(--u)) 1fr;align-items:center;gap:calc(.6*var(--u))"><span>${n}</span><div class="bar"><i style="width:${Math.min(100, val / 12 * 100)}%"></i></div></div>`).join('')}
          <div style="display:flex;justify-content:space-between"><span>Difficulté</span><span class="dots">${'●'.repeat(c.complexite)}<i>${'●'.repeat(5 - c.complexite)}</i></span></div>
          ${jouable ? `<div class="lab" style="margin-bottom:0">Premiers sorts</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:calc(.5*var(--u))">${this.premiersSorts(c.cle).map(([sp, n]) =>
            `<div class="sp" data-sort data-nom="${esc(sp.name)}" data-desc="${esc(sp.desc)}" style="cursor:help"><img src="assets/ui/sorts/sort_${sp.icon}.png" alt=""><span>${esc(sp.name)}<small>niveau ${n}</small></span></div>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="abs card bulleSort" style="left:calc(33*var(--u));top:calc(30*var(--u));width:calc(18*var(--u));padding:calc(.7*var(--u)) calc(.9*var(--u));font-size:calc(.75*var(--u));font-weight:600;line-height:1.45;opacity:0;transition:opacity .15s;pointer-events:none;z-index:6"></div>
    <img src="${img('lumiere.png')}" alt="" class="abs" style="left:calc(50% - 7.5*var(--u));top:calc(6*var(--u));width:calc(15*var(--u));opacity:.7;mix-blend-mode:screen">
    <img src="assets/ui/socle.png" alt="" class="abs" style="left:calc(50% - 10.5*var(--u));top:calc(29.5*var(--u));width:calc(21*var(--u));filter:sepia(.55) saturate(1.3) brightness(.95) drop-shadow(0 0 calc(1.2*var(--u)) #8fe8ff99)">
    ${jouable ? `<div class="abs hero" data-n="${pose[2]}" role="img" aria-label="${esc(c.nom)}" style="left:calc(50% - 8.85*var(--u));top:calc(13.4*var(--u));width:calc(${s.pose === 'attaque' ? 28.1 : 17.7}*var(--u));height:calc(24*var(--u));background-image:url(${img(`${c.cle}_${s.sexe}_${s.pose}.webp`)});background-size:${pose[2] * 100}% 100%" data-src="${img(`${c.cle}_${s.sexe}_${s.pose}.webp`)}"></div>`
      : `<img src="${tete(c, s.sexe)}" alt="" class="abs" style="left:calc(50% - 6*var(--u));top:calc(15*var(--u));width:calc(12*var(--u));filter:drop-shadow(0 calc(.5*var(--u)) calc(1*var(--u)) #000)">
      <div class="abs" style="left:50%;top:calc(27*var(--u));transform:translateX(-50%);font-family:var(--disp);font-size:calc(1.5*var(--u));color:#e0925a;-webkit-text-stroke:calc(.1*var(--u)) #2a1407;paint-order:stroke fill;white-space:nowrap">${plusTard(c.cle)}</div>`}
    <div class="abs card" style="right:calc(2*var(--u));top:calc(4.2*var(--u));width:calc(17.5*var(--u));padding:0 0 calc(1*var(--u));${jouable ? '' : 'opacity:.55'}">
      <div class="panelT">Ton personnage</div>
      <div style="padding:calc(.8*var(--u)) calc(1*var(--u)) 0">
        <div style="display:flex;gap:calc(.5*var(--u))">
          <button class="tab${s.sexe === 'm' ? ' on' : ''}" type="button" data-sexe="m"><img src="${tete(c, 'm')}" alt="">Homme</button>
          <button class="tab${s.sexe === 'f' ? ' on' : ''}" type="button" data-sexe="f"><img src="${tete(c, 'f')}" alt="">Femme</button>
        </div>
        <div class="lab">Pose</div>
        <div style="display:grid;gap:calc(.4*var(--u))">${POSES.map(([k, n]) =>
          `<button class="tab${s.pose === k ? ' on' : ''}" type="button" data-pose="${k}" style="justify-content:flex-start;padding-left:calc(1*var(--u))">${n}</button>`).join('')}</div>
        <div class="lab">Nom du personnage</div>
        <input class="field" data-nom maxlength="16" spellcheck="false" autocomplete="off" value="${esc(s.nom)}" placeholder="3 à 16 lettres" ${jouable ? '' : 'disabled'}>
        <div class="err">${esc(s.err)}</div>
        <label class="check"><input type="checkbox" data-hc ${s.hardcore ? 'checked' : ''} ${jouable ? '' : 'disabled'}><span>Mode Hardcore <span class="hc">(mort définitive)</span></span></label>
        <label class="check"><input type="checkbox" data-tuto ${s.tuto ? 'checked' : ''} ${jouable ? '' : 'disabled'}><span>Faire le tutoriel <span style="opacity:.7">(Temple Céleste)</span></span></label>
        <button type="button" class="lbtn" data-creer style="display:block;width:100%;box-sizing:border-box;margin-top:calc(1*var(--u));font-size:calc(1.15*var(--u));padding:calc(.7*var(--u))" ${jouable && libre >= 0 ? '' : 'aria-disabled="true"'}>${bouton}</button>
        ${jouable && libre < 0 ? `<div class="tiny" style="margin-top:calc(.4*var(--u))">Supprime un personnage dans « Mes personnages ».</div>` : ''}
        ${jouable && this.onEssayer ? `<button type="button" class="dbtn" data-essayer style="display:block;width:100%;box-sizing:border-box;margin-top:calc(.6*var(--u));font-size:calc(.85*var(--u));padding:calc(.5*var(--u))">Essayer 60 secondes</button>` : ''}
      </div>
    </div>
    <div class="abs" style="left:calc(8.4*var(--u));bottom:calc(6.4*var(--u));display:flex;gap:calc(.5*var(--u))">${FILTRES.map(f =>
      `<button type="button" class="chip${s.filtre === f ? ' on' : ''}" data-filtre="${f}" style="font-size:calc(.7*var(--u));padding:calc(.3*var(--u)) calc(.9*var(--u))">${f}</button>`).join('')}</div>
    <div class="strip">${CLASSES.map(k => {
      const dim = s.filtre !== 'Toutes' && (k.roles[s.filtre] ?? 0) < 7;
      return `<button type="button" class="cls${k.cle === s.cle ? ' on' : ''}${JOUABLES.has(k.cle) ? ' play' : ''}${dim ? ' dim' : ''}" data-cls="${k.cle}"><img src="${tete(k, s.sexe)}" alt="">${esc(k.nom)}${JOUABLES.has(k.cle) ? '' : '<span class="soon">bientôt</span>'}</button>`;
    }).join('')}</div>`;
  }
  /** Les 4 premiers sorts officiels de la classe (Dofus 3), avec le niveau où on les obtient. */
  private premiersSorts(cle: string): [SortOfficiel, number][] {
    const cls = GAME_DATA.classes[cle], mob = cls.spells[cls.mobility]?.dofusId;
    return (SORTS[cls.sorts] ?? []).map(p => [p[0], niveauRequis(p[0], mob)] as [SortOfficiel, number]).sort((a, b) => a[1] - b[1]).slice(0, 4);
  }

  // --- Mes personnages (22D) : la liste à gauche, le perso choisi sur le socle devant son dieu -------------------
  private pagePersos(): string {
    const l = lirePersos(), p = l[this.choix], c = p && classe(p.classe);
    const fond = c && DIEUX.has(c.cle) ? `dieu_${c.cle}.jpg` : 'login.jpg';
    return `<div class="cover" style="background-image:url(${img(fond)});filter:saturate(.9) brightness(.8)"></div>
    <div class="cover" style="background:radial-gradient(ellipse 50% 65% at 55% 55%,transparent 30%,#0d0e09d8 80%),linear-gradient(90deg,#0d0e09f5 8%,#0d0e09a0 30%,transparent 50%)"></div>
    <div class="abs tiny" style="left:calc(8.4*var(--u));top:calc(1.4*var(--u));font-weight:800">Mes personnages</div>
    <button type="button" class="abs dbtn" style="right:calc(2*var(--u));top:calc(1*var(--u));font-size:calc(.8*var(--u));padding:calc(.35*var(--u)) calc(.9*var(--u))" data-go="accueil">Retour</button>
    <div class="abs" style="left:calc(8.4*var(--u));top:calc(4.5*var(--u));width:calc(19*var(--u));display:grid;gap:calc(.7*var(--u))">
      ${l.map((q, i) => {
        if (!q) return `<button type="button" class="slot vide" data-slot="${i}"><span style="width:calc(4.6*var(--u));height:calc(4.6*var(--u));border-radius:50%;border:2px dashed #6d6c54;display:grid;place-items:center;font-family:var(--disp);font-size:calc(2.4*var(--u))">+</span>
          <span><b style="color:#c9c4ab">Nouveau personnage</b><span class="tiny">Emplacement libre</span></span></button>`;
        const k = classe(q.classe);
        return `<button type="button" class="slot${i === this.choix ? ' on' : ''}" data-slot="${i}"><img src="${tete(k, q.sexe)}" alt="">
          <span><b>${esc(q.nom)}</b><span style="font-weight:800;font-size:calc(.85*var(--u))">${k.nom} · niveau ${q.etat?.level ?? 1}${q.hardcore ? ' · <span class="hc">Hardcore</span>' : ''}</span>
          <span class="tiny" style="display:block">${esc(q.lieu)} · ${dureeTexte(q.temps)} de jeu</span></span></button>`;
      }).join('')}
      <div class="tiny" style="text-align:center">Sauvegarde automatique dans ton navigateur · aucun compte</div>
      <div class="card" style="padding:calc(.7*var(--u)) calc(.9*var(--u));display:grid;gap:calc(.5*var(--u))">
        <div style="font-weight:800;font-size:calc(.85*var(--u))">Ta sauvegarde</div>
        <div style="display:flex;gap:calc(.5*var(--u));flex-wrap:wrap">
          <button type="button" class="mini" data-exporter>Exporter</button>
          <button type="button" class="mini" data-importer>Importer</button>
          <button type="button" class="mini" data-modal="secours">Copies de secours (${lireSecours().length})</button>
        </div>
        <div class="tiny" style="font-size:calc(.65*var(--u))">Garde le fichier .diablofus : il remet tes personnages sur un autre PC ou après avoir vidé le navigateur.</div>
        <input type="file" accept=".diablofus,.json,application/json" data-fichier hidden>
      </div>
      ${lireCimetiere().length ? `<button type="button" class="dbtn" data-modal="cimetiere" style="font-size:calc(.85*var(--u));padding:calc(.5*var(--u))">Cimetière des héros (${lireCimetiere().length})</button>` : ''}
    </div>
    ${p && c ? `<div class="abs ttl" style="left:calc(50% + 4*var(--u));transform:translateX(-50%);top:calc(2.6*var(--u));font-size:calc(4.2*var(--u));white-space:nowrap">${esc(p.nom)}</div>
      <div class="abs" style="left:calc(50% + 4*var(--u));transform:translateX(-50%);top:calc(7.6*var(--u));font-weight:800;font-size:calc(1.15*var(--u));white-space:nowrap">${c.nom} · niveau ${p.etat?.level ?? 1}${p.hardcore ? ' · <span class="hc">Hardcore</span>' : ''}</div>
      <img src="${img('lumiere.png')}" alt="" class="abs" style="left:calc(50% - 3.5*var(--u));top:calc(8*var(--u));width:calc(15*var(--u));opacity:.7;mix-blend-mode:screen">
      <img src="assets/ui/socle.png" alt="" class="abs" style="left:calc(50% - 6.5*var(--u));top:calc(31.5*var(--u));width:calc(21*var(--u));filter:sepia(.55) saturate(1.3) brightness(.95) drop-shadow(0 0 calc(1.2*var(--u)) #8fe8ff99)">
      <div class="abs hero" data-n="24" role="img" aria-label="${esc(p.nom)}" style="left:calc(50% - 4.85*var(--u));top:calc(15.4*var(--u));width:calc(17.7*var(--u));height:calc(24*var(--u));background-image:url(${img(`${c.cle}_${p.sexe}_repos.webp`)});background-size:2400% 100%" data-src="${img(`${c.cle}_${p.sexe}_repos.webp`)}"></div>
      ${this.resume(p)}
      <div class="abs" style="left:calc(50% + 4*var(--u));transform:translateX(-50%);top:calc(47*var(--u));display:flex;gap:calc(1*var(--u));align-items:center">
        <button type="button" class="dbtn rouge" data-suppr="${this.choix}" style="font-size:calc(.9*var(--u))">${this.confirmer === this.choix ? 'Vraiment supprimer ?' : 'Supprimer'}</button>
        <button type="button" class="lbtn" data-jouer-slot="${this.choix}" style="font-size:calc(1.5*var(--u));padding:calc(.8*var(--u)) calc(3*var(--u))">Jouer</button>
      </div>`
      : `<div class="abs" style="left:calc(50% + 4*var(--u));top:50%;transform:translate(-50%,-50%);text-align:center;display:grid;gap:calc(1*var(--u));justify-items:center">
        <div class="ttl" style="font-size:calc(3*var(--u))">Aucun personnage</div>
        <button type="button" class="lbtn" data-go="creation">Créer un personnage</button></div>`}`;
  }

  // --- Bestiaire (Accueil 1A) : les monstres d'Incarnam par sous-zone, dévoilés en chassant ---------------------
  private pageBestiaire(): string {
    const b = lireBestiaire(), sub = GAME_DATA.zones.incarnam.open?.subareas ?? {}, deja = new Set<string>();
    const zones = ZONES_ACC.filter(z => z.dispo).flatMap(z => z.sous).map(id => sub[id]).filter(x => x && x.monsters.length);
    const tous = zones.flatMap(x => [...new Set(x.monsters)]), connus = new Set(tous.filter(m => b[m])).size, nb = new Set(tous).size;
    const fiche = (m: string) => {
      const d = GAME_DATA.monsters[m], n = b[m] ?? 0, L = LOOKS[d.look];
      if (!n) return `<div class="card mob inconnu"><canvas data-atlas="${L?.atlas ?? ''}" width="96" height="96"></canvas><b>???</b><span class="lock">Pas encore croisé</span></div>`;
      const res = Object.entries(d.res ?? {}).map(([e, v]) => `${e[0].toUpperCase()}${e.slice(1)} ${v} %`).join(' · ');
      const drops = (ITEMS.drops[m] ?? []).map(x => `${(ITEMS.resources[x.item] ?? ITEMS.equipment[x.item])?.name ?? x.item} ${x.chance.toLocaleString("fr-FR")} %`).join(', ');
      const pal = (k: keyof typeof PALIERS, txt: string) => n >= PALIERS[k] ? txt : `<span class="lock">à ${PALIERS[k]} vaincus</span>`;
      return `<div class="card mob"><canvas data-atlas="${L?.atlas ?? ''}" width="96" height="96"></canvas><b>${esc(d.name)}</b>
        <span class="l"><span>Niveau ${d.level ?? '?'}</span><span>${n} vaincu${n > 1 ? 's' : ''}</span></span>
        <div class="det"><div class="l"><span>Sorts</span><span>${pal('sorts', esc((d.spells ?? []).map(x => x.name).join(', ') || 'aucun'))}</span></div>
        <div class="l"><span>Résistances</span><span>${pal('res', esc(res || 'aucune'))}</span></div>
        <div class="l"><span>Butin</span><span>${pal('butin', esc(drops || 'aucun'))}</span></div></div></div>`;
    };
    return `<div class="cover" style="background-image:url(${img('login.jpg')});filter:brightness(.4) saturate(.8)"></div>
    <div class="abs tiny" style="left:calc(8.4*var(--u));top:calc(1.4*var(--u));font-weight:800">Bestiaire du compte</div>
    <button type="button" class="abs dbtn" style="right:calc(2*var(--u));top:calc(1*var(--u));font-size:calc(.8*var(--u));padding:calc(.35*var(--u)) calc(.9*var(--u))" data-go="accueil">Retour</button>
    <div class="abs" style="left:calc(8.4*var(--u));top:calc(3.6*var(--u));display:flex;align-items:baseline;gap:calc(1.2*var(--u))">
      <div class="ttl" style="font-size:calc(4*var(--u))">Bestiaire</div>
      <div style="font-weight:800;font-size:calc(1.1*var(--u))">${connus} / ${nb} monstres croisés · sorts à ${PALIERS.sorts} vaincus, résistances à ${PALIERS.res}, butin à ${PALIERS.butin}</div></div>
    <div class="abs bes" style="left:calc(8.4*var(--u));right:calc(2*var(--u));top:calc(9.5*var(--u));bottom:calc(1.5*var(--u));overflow:auto;align-content:start">
      ${zones.map(x => `<div class="zt">${esc(x.name)} · niveau ${x.level}</div>` + [...new Set(x.monsters)].filter(m => !deja.has(m) && deja.add(m)).map(fiche).join('')).join('')}
    </div>`;
  }
  /** Portraits du Bestiaire : la première image de l'animation statique du monstre, prise dans sa planche. */
  private portraits() {
    this.root.querySelectorAll<HTMLCanvasElement>('canvas[data-atlas]').forEach(async cv => {
      const a = cv.dataset.atlas; if (!a) return;
      const f = await cadre(a); if (!f || !cv.isConnected) return;
      const ctx = cv.getContext('2d')!, k = Math.min(cv.width / f.w, cv.height / f.h);
      ctx.drawImage(f.im, f.x, f.y, f.w, f.h, (cv.width - f.w * k) / 2, cv.height - f.h * k, f.w * k, f.h * k);
    });
  }

  // --- Journal (Accueil 3A) : façon « Les nouvelles d'Astrub », un carnet par journée ---------------------------
  private pageJournal(): string {
    const zone = JOURNAL.zone, c = this.carnet ? CARNETS.find(x => x.date === this.carnet) : null;
    if (c) {
      const rub = JOURNAL.rubriques.filter(r => c.lignes[r]?.length);
      return `<div class="jr" data-jr><div class="in">
        <button type="button" class="lire" data-carnet="" style="color:var(--lime)">← Tous les carnets</button>
        <div class="tiny" style="margin-top:calc(1.6*var(--u));font-weight:800">Mises à jour · ${dateLongue(c.date)}</div>
        <h1 style="font-size:calc(3.6*var(--u));margin-top:calc(.4*var(--u))">${dateLongue(c.date)}</h1>
        <div style="font-weight:800;font-size:calc(1.2*var(--u));color:#e6fa9c;margin-top:calc(.4*var(--u))">${esc(c.titre)}</div>
        <div class="cn"><nav class="som"><b>DANS CE CARNET</b>${rub.map((r, i) => `<button type="button" data-rub="${i}">${esc(r)}</button>`).join('')}
          <canvas data-atlas="${LOOKS.tofu_chimerique?.atlas ?? ''}" width="120" height="120" aria-hidden="true"></canvas></nav>
          <div>${c.capture ? `<div class="photo" style="transform:none;margin-bottom:calc(2*var(--u))"><img src="${v(c.capture)}" alt=""><small>${esc(c.legende ?? '')}</small></div>` : ''}
          ${rub.map((r, i) => `<h3 id="rub-${i}">${esc(r)}</h3>${c.lignes[r].map(l => `<p>${esc(l)}</p>`).join('')}`).join('')}</div></div>
      </div></div>`;
    }
    const [une, ...autres] = CARNETS;
    return `<div class="jr"><div class="in">
      <h1>Les nouvelles<br>d'<em>${esc(zone)}.</em></h1>
      <div style="font-weight:700;font-size:calc(.9*var(--u));line-height:1.7;margin-top:calc(1*var(--u))">Ce qui change dans tes chasses.<br>Ce qui se prépare en coulisses.</div>
      ${une ? `<div class="une"><div><div class="t">À la une · Mises à jour</div><h2>${dateLongue(une.date)}</h2>
        <p><b>${esc(une.titre)}.</b> ${esc(une.resume)}</p><button type="button" class="lire" data-carnet="${une.date}">Ouvrir le carnet ↗</button></div>
        <div>${une.capture ? `<div class="photo"><img src="${v(une.capture)}" alt=""><small>${esc(une.legende ?? '')}</small></div>` : ''}</div>
        <img src="${v('assets/ui/kamas_tas.png')}" alt="" style="position:absolute;right:calc(1.4*var(--u));bottom:calc(-1.2*var(--u));width:calc(5*var(--u));filter:drop-shadow(0 calc(.3*var(--u)) calc(.4*var(--u)) #0008)"></div>` : ''}
      ${autres.length ? `<div class="sec">Les carnets précédents</div><div class="grille">${autres.map(c => `<div class="jc">${c.capture ? `<img src="${v(c.capture)}" alt="">` : ''}
        <div class="t" style="color:#c9c4ab;margin-top:calc(.8*var(--u))">Mises à jour · ${dateLongue(c.date)}</div><h3>${dateLongue(c.date)}</h3>
        <p>${esc(c.resume)}</p><button type="button" class="lire" data-carnet="${c.date}">Lire le carnet ↗</button></div>`).join('')}</div>` : ''}
    </div></div>`;
  }

  // --- Succès (Accueil 2A) : ceux du compte, comme la fenêtre Succès du jeu ------------------------------------
  private pageSucces(): string {
    const fait = compte(), all = Object.entries(QUETES.succes);
    const total = all.reduce((n, [, x]) => n + x.points, 0), pts = all.filter(([id]) => fait.has(id)).reduce((n, [, x]) => n + x.points, 0);
    const cats = [...new Set(all.map(([, x]) => `${x.categorie} · ${x.sousCategorie}`))];
    return `<div class="cover" style="background-image:url(${img('login.jpg')});filter:brightness(.45) saturate(.8)"></div>
    <div class="abs tiny" style="left:calc(8.4*var(--u));top:calc(1.4*var(--u));font-weight:800">Succès du compte</div>
    <button type="button" class="abs dbtn" style="right:calc(2*var(--u));top:calc(1*var(--u));font-size:calc(.8*var(--u));padding:calc(.35*var(--u)) calc(.9*var(--u))" data-go="accueil">Retour</button>
    <div class="abs" style="left:calc(8.4*var(--u));top:calc(3.6*var(--u));display:flex;align-items:baseline;gap:calc(1.2*var(--u))">
      <div class="ttl" style="font-size:calc(4*var(--u))">Succès</div>
      <div style="font-weight:800;font-size:calc(1.2*var(--u))">${pts} / ${total} points · ${fait.size} / ${all.length} succès</div></div>
    <div class="abs" style="left:calc(8.4*var(--u));right:calc(2*var(--u));top:calc(9.5*var(--u));bottom:calc(1.5*var(--u));overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(calc(26*var(--u)),1fr));gap:calc(1*var(--u));align-content:start">
      ${cats.map(c => {
        const ss = all.filter(([, x]) => `${x.categorie} · ${x.sousCategorie}` === c);
        return `<div class="card" style="padding:calc(.8*var(--u)) calc(1*var(--u))"><div style="display:flex;justify-content:space-between;font-weight:800;font-size:calc(.95*var(--u))"><span>${esc(c)}</span><span class="tiny">${ss.filter(([id]) => fait.has(id)).length} / ${ss.length}</span></div>
          <div class="lst">${ss.map(([id, x]) => `<div><span class="${fait.has(id) ? 'ok' : ''}">${fait.has(id) ? '✓ ' : ''}${esc(x.nom)}</span><span class="tiny">${x.points} pt${x.points > 1 ? 's' : ''}</span><small>${esc(x.description)}</small></div>`).join('')}</div></div>`;
      }).join('')}
    </div>`;
  }

  /** Fiches ouvertes par-dessus la page. */
  private ouvrir(k: string) {
    if (k === 'cimetiere') {
      const l = lireCimetiere();
      this.modal = `<h2>Cimetière des héros</h2><div class="tiny">Les héros Hardcore tombés au combat. Leur emplacement est libre, leur nom reste ici.</div>
        <div class="lst" style="gap:calc(.7*var(--u))">${l.map(m => { const c = classe(m.classe); return `<div class="stele"><img src="${tete(c, m.sexe)}" alt=""><span><b>${esc(m.nom)}</b><br>
          <span class="tiny">${c.nom} niveau ${m.niveau} · ${dureeTexte(m.temps)} de jeu<br>Tombé face à ${esc(m.tueur)}, ${esc(m.lieu)}, le ${new Date(m.date).toLocaleDateString('fr-FR')}</span></span></div>`; }).join('')}</div>`;
    } else if (k === 'secours') {
      const l = lireSecours();
      this.modal = `<h2>Copies de secours</h2><div class="tiny">Les ${NB_SECOURS} dernières, prises en lançant une partie, avant un import et avant une suppression. Restaurer remplace la sauvegarde actuelle (elle-même gardée en copie).</div>
        <div class="lst">${l.length ? l.map((c, i) => `<div><span>${new Date(c.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span><button type="button" class="mini" data-restaurer="${i}">Restaurer</button><small>${esc(c.resume)}</small></div>`).join('') : '<div><span class="no">Aucune copie pour l\'instant.</span></div>'}</div>`;
    } else {
      const z = ZONES_ACC.find(x => x.cle === k); if (!z) return;
      const sub = GAME_DATA.zones.incarnam.open?.subareas ?? {}, vues = new Set(lirePersos().flatMap(p => p?.zones ?? []));
      const lignes = z.sous.map(id => sub[id]).filter(Boolean);
      const nb = lignes.filter(x => vues.has(x.name)).length;
      this.modal = `<h2>${esc(z.nom)}</h2>${z.dispo ? `<div class="tiny">${nb} / ${lignes.length} sous-zone${lignes.length > 1 ? 's' : ''} découverte${nb > 1 ? 's' : ''} par tes personnages</div>
        <div class="lst">${lignes.map(x => { const vu = vues.has(x.name), mons = [...new Set(x.monsters)].map(m => GAME_DATA.monsters[m]?.name ?? m);
          return `<div><span class="${vu ? 'ok' : 'no'}">${vu ? '✓ ' : ''}${esc(x.name)}</span><span class="tiny">niveau ${x.level}</span><small>${mons.length ? esc(mons.join(', ')) : 'Pas de monstres'}</small></div>`; }).join('')}</div>`
        : `<div class="tiny" style="font-size:calc(.9*var(--u));margin-top:calc(.6*var(--u))">${esc(z.plus ?? '')}</div>`}`;
    }
    this.render();
  }

  private bind() {
    const r = this.root, on = (sel: string, f: (e: HTMLElement) => void) => r.querySelectorAll<HTMLElement>(sel).forEach(e => e.addEventListener('click', () => f(e)));
    on('[data-nav]', e => {
      const k = e.dataset.nav!;
      if (k === 'accueil' || k === 'persos' || k === 'creation' || k === 'succes' || k === 'bestiaire' || k === 'journal') { this.carnet = null; this.go(k); }
      else this.toast(`${e.textContent!.trim()} : arrive dans une prochaine version`);
    });
    on('[data-go]', e => this.go(e.dataset.go as Page));
    // fenêtres par-dessus (fiche de zone, cimetière, copies de secours)
    on('[data-zone]', e => this.ouvrir(e.dataset.zone!));
    // journal : ouvrir un carnet (le dernier ouvert = lu, la pastille s'éteint), sommaire
    on('[data-carnet]', e => { this.carnet = e.dataset.carnet || null; if (this.carnet === CARNETS[0]?.date) marquerLu(); this.page = 'journal'; this.render(); this.root.querySelector('.jr')?.scrollTo(0, 0); });
    on('[data-rub]', e => this.root.querySelector(`#rub-${e.dataset.rub}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    on('[data-modal]', e => this.ouvrir(e.dataset.modal!));
    r.querySelectorAll<HTMLElement>('[data-fermer]').forEach(e => e.addEventListener('click', ev => { if (ev.target === e) { this.modal = null; this.render(); } }));
    on('[data-restaurer]', e => { const err = restaurerSecours(+e.dataset.restaurer!); this.modal = null; this.go('persos'); this.toast(err ?? 'Copie restaurée'); });
    // sauvegarde : fichier .diablofus
    on('[data-exporter]', () => {
      const f = exporter(), a = document.createElement('a'), d = new Date(f.date);
      a.href = URL.createObjectURL(new Blob([JSON.stringify(f)], { type: 'application/json' }));
      a.download = `diablofus-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.diablofus`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      this.toast('Sauvegarde exportée');
    });
    const fic = r.querySelector<HTMLInputElement>('[data-fichier]');
    on('[data-importer]', () => fic?.click());
    fic?.addEventListener('change', async () => {
      const f = fic.files?.[0]; if (!f) return;
      const err = importer(await f.text());
      this.go('persos'); this.toast(err ?? 'Sauvegarde importée');
    });
    on('[data-jouer]', () => { const d = dernier(); if (d != null) this.jouer(d); else this.go('creation'); });
    on('[data-continuer]', () => { const d = dernier(); if (d != null) this.jouer(d); });
    // création
    on('[data-cls]', e => { this.crea.cle = e.dataset.cls!; this.crea.err = ''; this.render(); });
    on('[data-sexe]', e => { this.crea.sexe = e.dataset.sexe as 'm' | 'f'; this.render(); });
    on('[data-pose]', e => { this.crea.pose = e.dataset.pose!; this.render(); });
    on('[data-filtre]', e => { this.crea.filtre = e.dataset.filtre!; this.render(); });
    const nom = r.querySelector<HTMLInputElement>('[data-nom]');
    nom?.addEventListener('input', () => { this.crea.nom = nom.value; });
    nom?.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.creer(); });
    nom?.addEventListener('keyup', e => e.stopPropagation());
    r.querySelector<HTMLInputElement>('[data-tuto]')?.addEventListener('change', e => { this.crea.tuto = (e.target as HTMLInputElement).checked; });
    r.querySelector<HTMLInputElement>('[data-hc]')?.addEventListener('change', e => { this.crea.hardcore = (e.target as HTMLInputElement).checked; });
    on('[data-creer]', () => this.creer());
    on('[data-essayer]', () => this.onEssayer?.(this.crea.cle, this.crea.sexe));
    // Accueil 8A : survol d'un premier sort = le perso du socle attaque, et le texte officiel du sort s'affiche
    r.querySelectorAll<HTMLElement>('[data-sort]').forEach(e => {
      const h = r.querySelector<HTMLElement>('.hero'), bulle = r.querySelector<HTMLElement>('.bulleSort');
      if (!h || !bulle) return;
      const avant = { src: h.dataset.src!, n: h.dataset.n!, w: h.style.width };
      const att = img(`${this.crea.cle}_${this.crea.sexe}_attaque.webp`), [, , na] = POSES.find(p => p[0] === 'attaque')!;
      e.addEventListener('mouseenter', () => {
        bulle.innerHTML = `<b>${esc(e.dataset.nom!)}</b><br>${esc(e.dataset.desc!)}`; bulle.style.opacity = '1';
        if (this.crea.pose === 'attaque') return;
        h.dataset.src = att; h.dataset.n = String(na); h.style.width = 'calc(28.1*var(--u))'; h.style.backgroundImage = `url(${att})`;
      });
      e.addEventListener('mouseleave', () => {
        bulle.style.opacity = '0';
        h.dataset.src = avant.src; h.dataset.n = avant.n; h.style.width = avant.w; h.style.backgroundImage = `url(${avant.src})`;
      });
    });
    // mes personnages
    on('[data-slot]', e => { const i = +e.dataset.slot!; if (lirePersos()[i]) { this.choix = i; this.confirmer = -1; this.render(); } else this.go('creation'); });
    on('[data-suppr]', e => {
      const i = +e.dataset.suppr!;
      if (this.confirmer !== i) { this.confirmer = i; this.render(); return; }
      supprimerPerso(i); this.confirmer = -1; this.choix = Math.max(0, lirePersos().findIndex(p => p)); this.render();
    });
    on('[data-jouer-slot]', e => this.jouer(+e.dataset.jouerSlot!));
  }

  private creer() {
    const s = this.crea, c = classe(s.cle);
    if (!JOUABLES.has(c.cle)) return;
    const libre = lirePersos().findIndex(p => !p);
    if (libre < 0) { this.toast('Tes 3 emplacements sont pris'); return; }
    const nom = s.nom.trim().replace(/\s+/g, ' ');
    if (!nomValide(nom)) { s.err = '3 à 16 lettres (accents, tiret et espace permis).'; this.render(); return; }
    if (lirePersos().some(p => p?.nom.toLowerCase() === nom.toLowerCase())) { s.err = 'Tu as déjà un personnage de ce nom.'; this.render(); return; }
    const now = Date.now();
    const p: Perso = { nom, classe: c.cle, sexe: s.sexe, hardcore: s.hardcore, tuto: s.tuto, cree: now, maj: now, temps: 0, lieu: 'Incarnam', zones: [] };
    sauverPerso(libre, p);
    s.nom = ''; s.hardcore = false; s.tuto = true;
    this.jouer(libre);
  }
}

interface Cadre { im: HTMLImageElement; x: number; y: number; w: number; h: number }
const cadres = new Map<string, Promise<Cadre | null>>();
/** Image de repos d'une planche de monstre (atlas simple ou multi-atlas de TexturePacker). */
function cadre(atlas: string): Promise<Cadre | null> {
  if (!cadres.has(atlas)) cadres.set(atlas, (async () => {
    try {
      type F = { filename?: string; frame: { x: number; y: number; w: number; h: number } };
      const j = await (await fetch(v(`assets/sprites/${atlas}.json`))).json();
      const pages: { image: string; frames: F[] }[] = j.textures ?? [{ image: `${atlas}.webp`, frames: Object.entries(j.frames).map(([filename, f]) => ({ filename, ...(f as F) })) }];
      let pick: { page: string; f: F } | null = null;
      for (const pg of pages) for (const f of pg.frames) {
        if (!pick || (f.filename?.startsWith('AnimStatique_1') && !pick.f.filename?.startsWith('AnimStatique_1'))) pick = { page: pg.image, f };
      }
      if (!pick) return null;
      const im = new Image(); im.src = v(`assets/sprites/${pick.page}`); await im.decode();
      return { im, ...pick.f.frame };
    } catch { return null; }
  })());
  return cadres.get(atlas)!;
}

/** Succès du compte (gardés par la partie dans le navigateur). */
function compte(): Set<string> {
  try { const c = JSON.parse(localStorage.getItem('diablofus.compte') ?? 'null'); return new Set(Array.isArray(c?.succes) ? c.succes : []); } catch { return new Set(); }
}
