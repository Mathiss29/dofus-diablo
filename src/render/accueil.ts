import { v } from './assetUrl';
import { MANIFESTE, Son } from './son';
import { GAME_DATA, ITEMS, QUETES } from '../sim/data';
import { EQUIP_SLOTS, RARITY_COLORS, RARITY_NAMES } from '../sim/items';
import { LOOKS } from './looks';
import { DOSSIER, PALETTES, ZONES, apparenceValide, assemblagePour, fiches, objetsPortes, type Apparence, type Assemblage, type FichePerso } from './squelette';
import { ICON_CSS, iconHtml } from './icons';
import { PALIERS, lireBestiaire } from './carnet';
import { dessinerPortraits, groupesBestiaire } from './butinVue';
import { LADDER_CSS, VueLadder, chargerLadder, ladderCharge } from './ladder';
import { niveauHorsPartie } from '../sim/butin';
import { SORTS, niveauRequis, type SortOfficiel } from '../sim/sorts';
import { texteSort } from './sortsTextes';
import CLASSES_DOFUS from '../data/classes_dofus.json';
import JOURNAL from '../data/journal.json';
import DIAPORAMA from '../data/diaporama.json';
import { installable, installer, surChangement } from './installation';
import { API, Compte } from './compte';
import { DISCORD_INVITATION } from './liens';
import { Parcours } from './parcours';
import { EMPLACEMENTS, NB_SECOURS, dernier, dureeTexte, exporter, importer, lireCimetiere, lirePersos, lireSecours, nomValide, persosEnLigne, prendreSecours, restaurerSecours, sauverPerso, supprimerPerso, type Perso } from './persos';

/** Écrans hors du jeu (maquette unique, choix 17A à 23A, 19B, 22D, 30E) : accueil avec Incarnam en direct derrière,
 *  création du perso devant le dieu de sa classe, et « Mes personnages ». Du HTML posé sur le jeu : la partie (ZoneScene)
 *  tourne derrière en mode vitrine. Les textes des classes sont ceux de Dofus 3 (src/data/classes_dofus.json). */

interface ClasseDofus { id: number; cle: string; nom: string; titre: string; desc: string; complexite: number; roles: Record<string, number> }
const CLASSES = CLASSES_DOFUS as ClasseDofus[];
/** Classes jouables (planches en jeu) et date prévue des suivantes. */
/** Classes codées mais encore à l'essai (maquette Osamodas 13A) : jouables seulement dans la partie de test (diablofus.com/#test, F1),
 *  elles arrivent à la création quand Mathis les a validées. */
const EN_ESSAI = new Set(['forgelance', 'eniripsa', 'enutrof']);   // Osamodas ouvert à tous avec la 0.3 (Public : 2A) ; Sacrieur public depuis « 0.4 suite : 14B » ; Forgelance : maquette 14A (palier 1 sur #test)
const JOUABLES = new Set(Object.keys(GAME_DATA.classes).filter(k => !EN_ESSAI.has(k)));
/** Classes pas encore jouables (Accueil 9A) : leur fiche s'affiche quand même, avec la version prévue (feuille de route). */
const PLUS_TARD: Record<string, string> = { forgelance: 'En essai : partie de test', eniripsa: 'En essai : partie de test', enutrof: 'En essai : partie de test' };
const plusTard = (cle: string) => PLUS_TARD[cle] ?? 'Prévue après la 1.0';
/** Version affichée et textes de l'accueil (Accueil 12A) : ils racontent la zone de la version, pas le moteur. */
const VERSION = '0.4';
const TEXTES: Record<string, { zone: string; slogan: string; ruban: string; lignes: string[] }> = {
  '0.1': {
    zone: 'INCARNAM, LE VILLAGE DANS LES NUAGES', slogan: 'Les nuages d\'Incarnam grouillent de monstres.', ruban: 'En chasse !',
    lignes: ['Le Milimilou rôde dans la forêt, et la Milice cherche des bras.', 'Kardorim ne dort que d\'un œil au fond de sa crypte.', 'Astrub t\'attend sous les nuages, dans la prochaine version.'],
  },
  '0.2': {
    zone: 'ASTRUB, LA CITÉ DES AVENTURIERS', slogan: 'Astrub et ses environs grouillent de monstres.', ruban: 'En chasse !',
    lignes: ['Kankreblath et ses Vilinsekts pillent les maisons de la Cité.', 'Sous les pavés, les égouts grouillent de Rats Strubiens.', 'L\'Osamodas et le butin complet arrivent dans la prochaine version.'],
  },
  '0.3': {
    zone: 'ASTRUB, LA CITÉ DES AVENTURIERS', slogan: 'Le butin complet est arrivé à Astrub.', ruban: 'En chasse !',
    lignes: ['Brise tes légendaires chez Malek : leur pouvoir reste dans ton Codex.', 'L\'Osamodas et sa meute rejoignent l\'Iop et le Crâ.', 'Amakna et le Sacrieur arrivent dans la prochaine version.'],
  },
  '0.4': {
    zone: 'AMAKNA, LE CONTINENT', slogan: 'Amakna s\'ouvre, de Madrestam à l\'île des Wabbits.', ruban: 'En route !',
    lignes: ['Le Bouftou Royal n\'est plus seul : Bworks, Gobelins et Craqueleurs gardent leurs donjons.', 'Le Wa Wabbit et ses Cawottes t\'attendent sur leur île.', 'Prends le bateau pour Moon : les tambours Kanniboul battent déjà.'],
  },
};
const TEXTE = TEXTES[VERSION];
/** Accueil des nouveaux venus (maquette « Accueil : » 2A, 4C, 9A) : ce qu'est le jeu, en quelques mots. */
const PRESENTATION = {
  pitch: 'Un action-RPG <em>en temps réel</em> dans le Monde des Douze.',
  pastilles: ['Gratuit', 'Dans le navigateur', 'Sans téléchargement', `Accès anticipé ${VERSION}`],
  lignes: ['Choisis ton <b>Iop</b>, ton <b>Crâ</b>, ton <b>Osamodas</b> ou ton <b>Sacrieur</b>.', 'Nettoie Incarnam, Astrub et Amakna, vague après vague.',
    'Ramasse du butin <b>légendaire</b> qui change tes sorts.', 'Monte de niveau, forge, collectionne les apparences.'],
  cartes: [['4 classes', 'Iop, Crâ, Osamodas et Sacrieur'], ['Butin', '6 raretés, pouvoirs légendaires'],
    ['Donjons', 'Vagues de monstres et boss officiels'], ['Monde ouvert', 'Incarnam, Astrub et Amakna, plus de 1 500 cartes']],
};
/** Diaporama (maquette « Diapo : ») : captures prises par le robot (tools/accueil/diaporama.cjs), légendes écrites à la main. */
const DIAPO = (DIAPORAMA as { captures: { id: string; legende: string }[] }).captures;
const diapoImg = (id: string) => img(`diapo/${id}.webp`);
/** Questions de la fenêtre « C'est quoi Diablofus ? » (Accueil 10A, 5A). */
const FAQ: [string, string][] = [
  ['C\'est gratuit ?', 'Oui, entièrement : rien à acheter, aucune publicité.'],
  ['Quel lien avec Dofus ?', 'C\'est un jeu de fan, fait avec les décors, monstres et sorts de Dofus. Mais ici tout se joue en temps réel, comme un Diablo : pas de tour, on esquive, on enchaîne.'],
  ['Comment on joue ?', 'Au clavier et à la souris, sur PC. Clic gauche pour bouger et frapper, touches 1 à 6 pour les sorts, Espace pour bondir, I pour l\'inventaire, M pour la carte. Toutes les touches se changent dans les Options.'],
  ['Où est ma sauvegarde ?', 'Dans ton navigateur, automatiquement. Connecte-toi avec Discord pour retrouver tes persos sur n\'importe quel PC.'],
  ['On peut jouer à plusieurs ?', 'Le Bastion des Douze est partagé avec les autres joueurs connectés, et la coop à 4 arrive bientôt pour tous.'],
  ['Il faut un gros PC ?', 'Non : un navigateur récent (Chrome, Edge, Firefox) suffit. Tu peux aussi l\'installer comme une application.'],
];
/** Nouveau venu : aucun perso sur ce navigateur ni dans le compte, aucun héros au cimetière. */
/** Classe conseillée pour débuter (idée A) : badge à la création. */
const DEBUTANT = 'iop';
const nouveauVenu = () => lirePersos().every(p => !p) && lireCimetiere().length === 0;
/** Pastilles de zones (Accueil 7A) : un clic ouvre la fiche de la zone. */
const ZONES_ACC: { cle: string; nom: string; zone: string; sous: string[]; dispo: boolean; plus?: string }[] = [
  { cle: 'incarnam', nom: 'Incarnam', zone: 'incarnam', sous: ['450', '444', '445', '442', '443', '778', '449', '446'], dispo: true },
  { cle: 'crypte', nom: 'Crypte de Kardorim', zone: 'incarnam', sous: ['447'], dispo: true },
  { cle: 'astrub', nom: 'Astrub', zone: 'astrub', sous: ['95', '99', '98', '173', '335', '96', '97', '30', '100', '102', '843'], dispo: true },
  { cle: 'donjons-astrub', nom: 'Donjons d\'Astrub', zone: 'astrub', sous: ['306', '336', '82', '842'], dispo: true },
];
/** Illustration du dieu de la classe (class_/LevelUp{N} de Dofus 3) ; les autres classes ont le décor du titre. */
const DIEUX = new Set(['iop', 'cra', 'osamodas']);
/** Animations du perso sur le socle : nombre d'images de chaque bande (rendues comme le jeu, voir LISEZMOI ;
 *  l'attaque est plus large : le perso s'élance vers la droite). */
const POSES: [string, string, number][] = [['repos', 'Repos', 24], ['garde', 'Garde', 24], ['attaque', 'Attaque', 23]];
/** Animation officielle de chaque pose, pour le perso dessiné en direct. */
const ANIM_POSE: Record<string, string> = { repos: 'AnimStatiqueExplo0_1', garde: 'AnimStatiqueCombat0_1', attaque: 'AnimArme0_1' };
/** Classes qui ont encore leurs anciennes planches d'accueil (repli hors ligne) ; les autres sont toujours dessinées en direct. */
const ANCIENNES_PLANCHES = new Set(['iop', 'cra']);
const hexa = (c: number) => '#' + c.toString(16).padStart(6, '0');
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
#acc .cls .soon.conseil{color:var(--ink);background:var(--lime)}
#acc .conseilT{margin-left:calc(.4*var(--u));font-size:calc(.7*var(--u));font-weight:800;color:var(--ink);background:var(--lime);border-radius:calc(1*var(--u));padding:calc(.15*var(--u)) calc(.7*var(--u))}
#acc .bar{height:calc(.55*var(--u));border-radius:9px;background:#33342a;overflow:hidden}
#acc .bar i{display:block;height:100%;background:linear-gradient(90deg,#9ccd2c,#d3f46f)}
#acc .dots{letter-spacing:calc(.15*var(--u));color:var(--lime)}
#acc .dots i{font-style:normal;color:#55553f}
#acc .sp{display:flex;align-items:center;gap:calc(.5*var(--u));font-size:calc(.8*var(--u));font-weight:700;line-height:1.1}
#acc .sp img{width:calc(1.9*var(--u));height:calc(1.9*var(--u));border-radius:calc(.3*var(--u));border:1px solid #5d5c45}
#acc .sp small{display:block;color:#a8a58e;font-size:calc(.62*var(--u))}
#acc .hero{background-repeat:no-repeat}
#acc canvas.vivant{pointer-events:none}
#acc .tetes{display:grid;grid-template-columns:repeat(6,1fr);gap:calc(.25*var(--u))}
#acc .tetes button{all:unset;cursor:pointer;aspect-ratio:1;border-radius:calc(.35*var(--u));background-color:#2a2b1f;background-repeat:no-repeat;border:1px solid #45452f}
#acc .tetes button.on{border-color:var(--lime);box-shadow:0 0 0 calc(.1*var(--u)) var(--lime);background-color:#3a4a1c}
#acc .tetes button:focus-visible,#acc .coul label:focus-within{outline:2px solid var(--lime)}
#acc .coul{display:grid;grid-template-columns:repeat(6,1fr);gap:calc(.25*var(--u))}
#acc .coul label{display:grid;justify-items:center;gap:calc(.1*var(--u));font-size:calc(.5*var(--u));font-weight:800;color:#c9c4ab;cursor:pointer;border-radius:calc(.3*var(--u))}
#acc .coul input{all:unset;width:100%;aspect-ratio:1.4;border-radius:calc(.35*var(--u));border:1px solid #f1ecd8aa;box-sizing:border-box;cursor:pointer}
#acc .pals{display:flex;flex-wrap:wrap;gap:calc(.25*var(--u));margin-top:calc(.35*var(--u))}
#acc .pals button{all:unset;cursor:pointer;display:flex;align-items:center;gap:calc(.2*var(--u));font-size:calc(.6*var(--u));font-weight:800;padding:calc(.15*var(--u)) calc(.4*var(--u));border-radius:calc(1*var(--u));background:#2a2b1f;border:1px solid #45452f}
#acc .pals i{display:inline-block;width:calc(.55*var(--u));height:calc(.55*var(--u));border-radius:50%}
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
#acc .som small{font-family:inherit;font-size:calc(.7*var(--u));color:#a8a58e;font-weight:700}
#acc .jres{font-size:calc(1*var(--u));line-height:1.6;color:#f1ecd8;margin-top:calc(.6*var(--u));max-width:calc(52*var(--u))}
#acc .june{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(1*var(--u));margin-top:calc(1.6*var(--u))}
#acc .june>div{background:#332e21;border-radius:calc(.3*var(--u));overflow:hidden}
#acc .june>div>img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
#acc .june>div>div{padding:calc(.6*var(--u)) calc(.8*var(--u)) calc(.8*var(--u))}
#acc .june b{display:flex;align-items:center;gap:calc(.4*var(--u));font-size:calc(.95*var(--u));color:#fbf3d4}
#acc .june b img{width:calc(1.3*var(--u));height:calc(1.3*var(--u));object-fit:contain}
#acc .june p{margin:calc(.25*var(--u)) 0 0;font-size:calc(.8*var(--u));line-height:1.45;color:#c9c4ab}
#acc .je{display:grid;grid-template-columns:calc(2.4*var(--u)) 1fr;gap:calc(.9*var(--u));padding:calc(.7*var(--u)) 0;border-top:1px solid #3a3426}
#acc .je>img{width:calc(2.4*var(--u));height:calc(2.4*var(--u));object-fit:contain}
#acc .jt{display:flex;flex-wrap:wrap;align-items:center;gap:calc(.4*var(--u))}
#acc .jt b{font-size:calc(1.05*var(--u));color:#fbf3d4;margin-right:calc(.2*var(--u))}
#acc .tag{font-size:calc(.65*var(--u));font-weight:700;color:var(--lime);border:1px solid #5d6b2c;border-radius:calc(1*var(--u));padding:0 calc(.5*var(--u));line-height:1.6;white-space:nowrap}
#acc .cn .jp{font-size:calc(.95*var(--u));line-height:1.55;font-weight:400;color:#f1ecd8;margin:calc(.15*var(--u)) 0 0}
#acc .je details{margin-top:calc(.2*var(--u))}
#acc .je summary{cursor:pointer;list-style:none;color:var(--lime);font-size:calc(.75*var(--u));font-weight:700;width:max-content}
#acc .je summary::-webkit-details-marker{display:none}
#acc .je summary::before{content:'▸ '}#acc .je details[open] summary::before{content:'▾ '}
#acc .cn .je details p{font-size:calc(.85*var(--u));line-height:1.55;font-weight:400;color:#c9c4ab;border-left:2px solid #4a4433;padding-left:calc(.7*var(--u));margin:calc(.3*var(--u)) 0 0}
#acc .jcourt{margin:0 0 calc(.6*var(--u));padding-left:calc(1.2*var(--u));color:#c9c4ab;font-size:calc(.9*var(--u));line-height:1.55}
#acc .jcourt li{margin:calc(.25*var(--u)) 0}
#acc .cn h3{margin-top:calc(1.6*var(--u))}
#acc .pitch{margin:0;font-family:var(--disp);font-weight:400;font-size:calc(2.3*var(--u));line-height:1.15;max-width:calc(40*var(--u));text-shadow:0 calc(.2*var(--u)) calc(.6*var(--u)) #000a;text-wrap:balance}
#acc .pitch em{font-style:normal;color:var(--lime)}
#acc .pastilles{display:flex;gap:calc(.5*var(--u));flex-wrap:wrap;max-width:calc(46*var(--u))}
#acc .pastilles span{font-size:calc(.8*var(--u));font-weight:800;color:#d7ecb0;border:1px solid #4d5a2c;border-radius:calc(2*var(--u));padding:calc(.2*var(--u)) calc(.8*var(--u));background:#1a1d10cc}
#acc .point b{color:#ffc14d}
#acc .enligne{font-weight:800;font-size:calc(.85*var(--u));display:flex;align-items:center;gap:calc(.4*var(--u));text-shadow:0 1px 2px #000}
#acc .enligne i{width:calc(.7*var(--u));height:calc(.7*var(--u));border-radius:50%;background:#6fdc5a;box-shadow:0 0 calc(.6*var(--u)) #6fdc5a}
#acc .dbtn.discord{background:#5865f2;border-color:#7983f5;color:#fff;box-shadow:0 calc(.25*var(--u)) 0 #2f3699;font-size:calc(.85*var(--u));padding:calc(.5*var(--u)) calc(1*var(--u))}
#acc .diapo{aspect-ratio:16/9;border:calc(.2*var(--u)) solid #e0b45a;border-radius:calc(.7*var(--u));box-shadow:0 calc(1*var(--u)) calc(3*var(--u)) #000a;background:#0d0e09;overflow:hidden;cursor:zoom-in}
#acc .diapo figure{position:absolute;inset:0;margin:0;opacity:0;transition:opacity .8s}
#acc .diapo figure.on{opacity:1}
#acc .diapo img{width:100%;height:100%;object-fit:cover;display:block;transform:scale(1);transition:transform 4.6s linear;transform-origin:55% 55%}
#acc .diapo figure.on img{transform:scale(1.1)}
#acc .diapo figcaption{position:absolute;left:0;right:0;bottom:0;padding:calc(2.2*var(--u)) calc(1*var(--u)) calc(.7*var(--u));font-weight:800;font-size:calc(.9*var(--u));color:#f6e7c1;background:linear-gradient(transparent,#000c);text-shadow:0 1px 2px #000}
#acc .diapo.petit figcaption{font-size:calc(.7*var(--u));padding:calc(1.4*var(--u)) calc(.7*var(--u)) calc(.5*var(--u))}
#acc .points{position:absolute;right:calc(.8*var(--u));top:calc(.7*var(--u));display:flex;gap:calc(.35*var(--u));z-index:1}
#acc .points button{all:unset;cursor:pointer;width:calc(.6*var(--u));height:calc(.6*var(--u));border-radius:50%;background:#ffffff66;box-shadow:0 0 2px #000}
#acc .points button.on{background:#e0b45a}
#acc .grand{display:grid;gap:calc(.6*var(--u))}
#acc .grand img{width:100%;border-radius:calc(.5*var(--u));display:block}
#acc .modal>.card.large{width:calc(64*var(--u));max-height:none}
@media (prefers-reduced-motion:reduce){#acc .diapo img{transition:none}#acc .diapo figure.on img{transform:none}}
#acc .cartesB{width:calc(36*var(--u));display:grid;grid-template-columns:repeat(4,1fr);gap:calc(.6*var(--u))}
#acc .cartesB div{background:#191a12e6;border:1px solid #3d3b2a;border-radius:calc(.5*var(--u));padding:calc(.7*var(--u));font-size:calc(.75*var(--u));font-weight:700;line-height:1.35;color:#c9c4ab}
#acc .cartesB b{display:block;font-family:var(--disp);font-weight:400;color:#ffc14d;font-size:calc(1*var(--u));margin-bottom:calc(.2*var(--u))}
#acc .lienfaq{all:unset;position:absolute;cursor:pointer;font-weight:800;font-size:calc(.9*var(--u));color:#e8e2c8;border-bottom:1px dashed #8a8566;text-shadow:0 1px 2px #000}
#acc .lienfaq:hover,#acc .lienfaq:focus-visible{color:var(--lime);border-color:var(--lime)}
#acc .faq{display:grid;gap:calc(.7*var(--u));margin-top:calc(.6*var(--u))}
#acc .faq div{display:grid;gap:calc(.15*var(--u))}
#acc .faq b{font-size:calc(.95*var(--u));color:#fbf3d4}
#acc .faq span{font-size:calc(.82*var(--u));line-height:1.5;color:#c9c4ab;font-weight:600}
#acc .qdn{display:grid;grid-template-columns:1fr 1fr;gap:calc(.6*var(--u));margin-top:calc(.8*var(--u))}
#acc .qdn>div{display:grid;grid-template-columns:calc(2.2*var(--u)) 1fr;column-gap:calc(.7*var(--u));align-content:start;background:#25261bcc;border:1px solid #3c3c2a;border-radius:calc(.4*var(--u));padding:calc(.7*var(--u)) calc(.8*var(--u))}
#acc .qdn img{width:calc(2.2*var(--u));height:calc(2.2*var(--u));object-fit:contain;grid-row:span 2}
#acc .qdn b{font-size:calc(.9*var(--u));color:#fbf3d4}
#acc .qdn span:last-child{font-size:calc(.75*var(--u));line-height:1.45;color:#c9c4ab;font-weight:600}
#acc .hero{opacity:0}
#acc .hero.vu{opacity:1;animation:acc-app .5s ease-out}
@keyframes acc-app{0%{opacity:0;filter:brightness(3) blur(2px);transform-origin:50% 100%;scale:.92}60%{opacity:1;filter:brightness(1.6)}100%{filter:none;scale:1}}
@media (prefers-reduced-motion: reduce){#acc .hero{opacity:1}#acc .hero.vu{animation:none}}
#acc .check input{accent-color:#e0925a;width:calc(1.1*var(--u));height:calc(1.1*var(--u));margin:0}
`;

type Page = 'accueil' | 'creation' | 'persos' | 'succes' | 'bestiaire' | 'journal' | 'ladder';
/** Journal (Accueil 3A+3B+3C+3E) : un carnet par journée de travail, écrit à chaque mise à jour (src/data/journal.json). */
/** Carnets lisibles (Carnets : 1A…10A) : une entrée = titre court + une phrase, détails repliables, icône officielle, étiquettes.
 *  Corrections et En coulisses restent une ligne courte. `image` met l'entrée « À la une » (3 tuiles en haut du carnet). */
export interface Entree { titre: string; phrase: string; details?: string; icone?: string; etiquettes?: string[]; image?: string }
type Ligne = string | Entree;
interface Carnet { date: string; titre: string; resume: string; capture?: string; legende?: string; lignes: Record<string, Ligne[]> }
const CARNETS = (JOURNAL.carnets as Carnet[]).slice().sort((a, b) => b.date.localeCompare(a.date));
const ICONES = (JOURNAL as { icones?: Record<string, string> }).icones ?? {};
/** Rubriques écrites en lignes courtes, sans icône ni détails (7A). */
const COURTES = ['Corrections', 'En coulisses'];
const icone = (k?: string) => (k && ICONES[k] ? v(`assets/${ICONES[k]}`) : '');
const entrees = (ls: Ligne[] = []) => ls.filter((l): l is Entree => typeof l !== 'string');
function entreeHtml(l: Ligne): string {
  if (typeof l === 'string') return `<div class="je"><span></span><div><p class="jp">${esc(l)}</p></div></div>`;
  const ic = icone(l.icone);
  return `<div class="je">${ic ? `<img src="${ic}" alt="">` : '<span></span>'}<div>
    <div class="jt"><b>${esc(l.titre)}</b>${(l.etiquettes ?? []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <p class="jp">${esc(l.phrase)}</p>${l.details ? `<details><summary>Détails</summary><p>${esc(l.details)}</p></details>` : ''}</div></div>`;
}
const dateLongue = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const CLE_LU = 'diablofus.journal';
function carnetNonLu(): boolean {
  if (!CARNETS.length) return false;
  try { return (localStorage.getItem(CLE_LU) ?? '') !== luDe(CARNETS[0]); } catch { return false; }
}
function marquerLu() { try { if (CARNETS.length) localStorage.setItem(CLE_LU, luDe(CARNETS[0])); } catch { /* rien */ } }
/** Un carnet compte comme nouveau quand sa date OU son titre change (clôture d'une version le même jour qu'un autre carnet). */
function luDe(c: Carnet) { return `${c.date}|${c.titre}`; }

export class Accueil {
  private root: HTMLDivElement;
  private page: Page = 'accueil';
  /** Création : classe, sexe, pose, nom, Hardcore, filtre de la barre des classes. */
  private crea = { cle: 'iop', sexe: 'm' as 'm' | 'f', pose: 'repos', nom: '', hardcore: false, tuto: true, filtre: 'Toutes', err: '',
    /** Apparence (maquette Apparence 1A 2A 2C) : tête dans l'ordre officiel, couleurs (null = officielles de la classe). */
    tete: 0, couleurs: null as number[] | null };
  /** Fiches des persos dessinés en direct (corps, têtes, couleurs officielles), lues une fois. */
  private fiches: Record<string, FichePerso> | null = null;
  /** « Mes personnages » : emplacement choisi, et suppression en attente de confirmation. */
  private choix = 0;
  private confirmer = -1;
  private anim = 0;
  private toastT = 0;
  /** Fenêtre ouverte par-dessus la page (fiche de zone, cimetière, copies de secours). */
  private modal: string | null = null;
  /** Journal : carnet ouvert (sa date), ou la liste. */
  private carnet: string | null = null;
  /** « Quoi de neuf » déjà montré pendant cette session. */
  private quoiDeNeufVu = false;

  /** onJouer : lance la partie de cet emplacement (déjà sauvegardé). */
  /** Bouton Options de la colonne (Réglages 11A) : branché par main.ts sur la fenêtre Options du jeu. */
  onOptions: (() => void) | null = null;
  constructor(private onJouer: (slot: number) => void, private onEssayer?: (classe: string, sexe: 'm' | 'f', apparence?: Apparence) => void) {
    if (!document.getElementById('acc-css')) {
      const st = document.createElement('style'); st.id = 'acc-css'; st.textContent = CSS + ICON_CSS.replace('.ic{', '#acc .ic{') + LADDER_CSS; document.head.appendChild(st);
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
    // le bouton « Installer le jeu » apparaît dès que le navigateur le permet
    surChangement(() => { if (!this.root.hidden && this.page === 'accueil') this.render(); });
    let last = 0, f = 0;
    const tick = (t: number) => {
      this.anim = requestAnimationFrame(tick);
      if (t - last < 40) return;   // 25 images par seconde, comme les animations de Dofus
      last = t; f++;
      // diaporama : capture suivante toutes les 4 s, sauf sous la souris ou fenêtre ouverte (« Diapo : » 7B)
      if (t - this.diapoT > 4000) { this.diapoT = t; if (!this.root.hidden && !this.modal && !this.root.querySelector('.diapo:hover') && this.root.querySelector('.diapo')) this.montrerDiapo(this.diapoI + 1); }
      this.root.querySelectorAll<HTMLCanvasElement>('canvas.vivant').forEach(cv => this.socle(cv, f));
      this.root.querySelectorAll<HTMLElement>('.hero:not(canvas)').forEach(h => {
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

  /** Perso dessiné en direct sur le socle (maquette Apparence 3A) : mêmes place et taille que les anciennes planches
   *  (rendu à l'échelle 3,2, pied en (210, 592) d'une image de 504 x 684 pixels affichée sur 24 unités de haut). */
  private socle(cv: HTMLCanvasElement, f: number) {
    const cle = cv.dataset.cle!, app = JSON.parse(cv.dataset.app!) as Apparence, anim = cv.dataset.anim!, objets = cv.dataset.objets ? cv.dataset.objets.split(',') : [];
    const k = `${cle}|${app.tete}|${objets}`;
    const a = this.vus.get(k);
    if (!a) { if (!this.vus.has(k)) { this.vus.set(k, null); assemblagePour(cle, app, objets).then(x => this.vus.set(k, x), () => this.vus.delete(k)); } return; }
    a.recolorer(app.couleurs);
    // dessiné en 2x la taille de l'écran puis réduit par le navigateur : bords lisses (le découpage des triangles
    // du canevas n'est pas anticrénelé, en taille réelle les contours faisaient des escaliers)
    const dpr = (devicePixelRatio || 1) * 2, W = Math.round(cv.offsetWidth * dpr), H = Math.round(cv.offsetHeight * dpr);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const n = a.compte[anim] ?? 0; if (!n) return;
    const ctx = cv.getContext('2d')!, u = H / 24;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    a.dessiner(ctx, anim, Math.floor(f * (anim.startsWith('AnimStatique') ? 0.8 : 1)) % n, 210 / 28.5 * u, 592 / 28.5 * u, 3.2 / 28.5 * u);
    cv.classList.add('vu');
  }
  private vus = new Map<string, Assemblage | null>();
  /** Apparence en cours de création, valide pour la classe et le sexe choisis. */
  private appCrea(): Apparence | null {
    const f = this.fiches?.[`${this.crea.cle}_${this.crea.sexe}`];
    return f ? apparenceValide(f, { tete: this.crea.tete, couleurs: this.crea.couleurs ?? undefined }) : null;
  }
  /** Canevas du perso vivant, à la place de la planche de l'ancien socle. */
  private canevas(cle: string, app: Apparence, anim: string, style: string, label: string, objets: string[] = []) {
    return `<canvas class="abs hero vivant" data-cle="${cle}" data-app="${esc(JSON.stringify(app))}" data-objets="${esc(objets.join(','))}" data-anim="${anim}" role="img" aria-label="${esc(label)}" style="${style}"></canvas>`;
  }

  get visible() { return !this.root.hidden; }
  show(page: Page = 'accueil') {
    this.root.hidden = false; this.precharger(); this.lireEnLigne(); this.go(page);
    if (!this.ecouteCompte) this.ecouteCompte = Compte.ecouter(() => {
      if (this.root.hidden) return;
      if (this.page === 'persos') this.choix = dernier() ?? Math.max(0, lirePersos().findIndex(p => p));
      this.render();
    });
    // « Quoi de neuf » (feuille de route 21A, Accueil 3E) : au lancement, une fois par carnet non lu, les nouveautés en 5 lignes
    if (page === 'accueil' && carnetNonLu() && !this.quoiDeNeufVu && !nouveauVenu()) { this.quoiDeNeufVu = true; this.ouvrir('quoi-de-neuf'); }
    if (!this.fiches) fiches().then(f => { this.fiches = f; if (!this.root.hidden && (this.page === 'creation' || this.page === 'persos')) this.render(); }, () => { /* hors ligne : anciennes planches */ });
  }
  /** Accueil 5A : les planches des persos (3 emplacements) et des classes jouables sont chargées dès l'accueil,
   *  pour que le socle ne reste jamais vide. */
  private precharger() {
    const urls = new Set<string>();
    for (const p of lirePersos()) if (p) urls.add(img(`${p.classe}_${p.sexe}_repos.webp`));
    for (const c of JOUABLES) if (ANCIENNES_PLANCHES.has(c)) for (const sx of ['m', 'f']) for (const [k] of POSES) urls.add(img(`${c}_${sx}_${k}.webp`));
    for (const u of urls) { const im = new Image(); im.src = u; }
  }
  private jouer(slot: number) { prendreSecours(); this.onJouer(slot); }
  hide() { this.root.hidden = true; this.root.innerHTML = ''; }
  destroy() { cancelAnimationFrame(this.anim); this.root.remove(); }

  private go(page: Page) {
    this.page = page; this.confirmer = -1; this.crea.err = ''; this.modal = null;
    // parcours des nouveaux venus (idée C) : seulement tant qu'on n'a aucun perso
    if (nouveauVenu() && (page === 'accueil' || page === 'creation')) Parcours.noter(page);
    if (page === 'persos') { const d = dernier(); this.choix = d ?? Math.max(0, lirePersos().findIndex(p => p)); }
    this.render();
  }

  private ecouteCompte: (() => void) | null = null;
  /** Compte Discord (maquette « Vrai multi : » 3A, 4A) : connexion, persos du navigateur ou en ligne, import unique. */
  private blocCompte(): string {
    const c = Compte.infos, en = persosEnLigne();
    if (Compte.etat !== 'connecte' || !c) return `<div class="card" style="padding:calc(.7*var(--u)) calc(.9*var(--u));display:grid;gap:calc(.5*var(--u))">
        <div class="tiny" style="text-align:center">${Compte.etat === 'chargement' ? 'Connexion au serveur…' : 'Sauvegarde automatique dans ton navigateur · aucun compte'}</div>
        ${Compte.etat === 'chargement' ? '' : `<button type="button" class="mini" data-discord style="justify-self:center;background:#5865f2;border-color:#7983f5;padding:calc(.45*var(--u)) calc(1*var(--u))">Se connecter avec Discord</button>
        <div class="tiny" style="font-size:calc(.65*var(--u));text-align:center">Persos sauvés en ligne, sur n'importe quel PC.</div>`}</div>`;
    const loc = lirePersos(), p = !en ? loc[this.choix] : null;
    return `<div class="card" style="padding:calc(.7*var(--u)) calc(.9*var(--u));display:grid;gap:calc(.55*var(--u))">
        <div style="display:flex;align-items:center;gap:calc(.6*var(--u))">${c.avatar ? `<img src="${esc(c.avatar)}" alt="" style="width:calc(2*var(--u));height:calc(2*var(--u));border-radius:50%">` : ''}
          <b style="font-size:calc(.9*var(--u));flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(c.nom)}</b>
          <button type="button" class="mini" data-deconnexion style="font-size:calc(.65*var(--u))">Déconnexion</button></div>
        <div style="display:flex;gap:calc(.4*var(--u))">
          <button type="button" class="chip${en ? '' : ' on'}" data-mode="local" style="flex:1;text-align:center">Navigateur</button>
          <button type="button" class="chip${en ? ' on' : ''}" data-mode="enligne" style="flex:1;text-align:center">En ligne</button></div>
        <div class="tiny" style="font-size:calc(.65*var(--u))">${en ? 'Persos de ton compte, sauvés sur le serveur.' : 'Persos de ce navigateur, séparés de ceux du compte.'}</div>
        ${!en && p && !c.importe ? `<button type="button" class="mini" data-mettre-en-ligne="${this.choix}">Mettre ${esc(p.nom)} en ligne (une seule fois)</button>` : ''}
      </div>`;
  }

  private render() {
    const html = this.page === 'accueil' ? this.pageAccueil() : this.page === 'creation' ? this.pageCreation() : this.page === 'succes' ? this.pageSucces() : this.page === 'bestiaire' ? this.pageBestiaire() : this.page === 'journal' ? this.pageJournal() : this.page === 'ladder' ? '<div class="ladp"><div class="lad" data-ladder></div></div>' : this.pagePersos();
    if (!this.modal) this.modalLarge = false;
    const m = this.modal ? `<div class="modal" data-fermer><div class="card${this.modalLarge ? ' large' : ''}">${this.modal}<button type="button" class="x" data-fermer aria-label="Fermer">✕</button></div></div>` : '';
    this.root.innerHTML = `<div class="page">${html}${this.side()}${m}<div class="toast" style="opacity:0"></div></div>`;
    this.bind();
    this.portraits();
    this.dessinerLadder();
  }

  /** Page Ladder (maquette « Ladder : » 1A) : le classement du serveur, redessiné seul (sans toucher au reste de l'accueil). */
  private ladder = new VueLadder();
  private ladderDemande = false;
  /** #ladder/Nom (1C) : fiche à ouvrir à l'arrivée sur la page. */
  ouvrirLadder(nom = '') {
    this.show('ladder');
    if (nom) void this.ladder.ouvrirParNom(nom, () => this.dessinerLadder());
  }
  private dessinerLadder() {
    const el = this.root.querySelector<HTMLElement>('[data-ladder]');
    if (!el) return;
    if (!ladderCharge() && !this.ladderDemande) { this.ladderDemande = true; void chargerLadder().then(() => { this.ladderDemande = false; if (this.page === 'ladder' && ladderCharge()) this.dessinerLadder(); }); }
    el.innerHTML = this.ladder.html();
    this.ladder.brancher(el, () => this.dessinerLadder());
  }

  private toast(msg: string) {
    const t = this.root.querySelector<HTMLElement>('.toast'); if (!t) return;
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(this.toastT); this.toastT = window.setTimeout(() => { t.style.opacity = '0'; }, 2200);
  }

  /** Colonne fine (30E) : icônes en couleur du menu principal de Dofus 3 (uiassets_2x) + texte. Bestiaire, Succès et Journal arrivent plus tard. */
  private side(): string {
    const NAV: [string, string, string][] = [['accueil', 'assets/ui/menu/home.png', 'Accueil'], ['persos', 'assets/ui/menu/character.png', 'Personnages'],
      ['creation', img('h_80.png'), 'Classes'], ['bestiaire', 'assets/ui/menu/bestiary.png', 'Bestiaire'], ['succes', 'assets/ui/menu/success.png', 'Succès'], ['journal', 'assets/ui/menu/calendar.png', 'Journal'], ['ladder', 'assets/ui/menu/ladder.png', 'Ladder'], ['options', 'assets/ui/menu/options.png', 'Options']];
    return `<nav class="side"><img class="logo" src="${v('assets/logo/embleme.webp')}" alt="" aria-hidden="true">${NAV.map(([k, ic, l]) =>
      `<button type="button" class="nav${k === this.page ? ' on' : ''}" data-nav="${k}" style="position:relative"><img src="${ic}" alt="">${l}${k === 'journal' && carnetNonLu() ? '<span class="pastille">nouveau</span>' : ''}</button>`).join('')}
      <button type="button" class="play" data-jouer>Jouer</button><div class="ver">VERSION ${VERSION}</div></nav>`;
  }

  // --- Accueil (17A) : Incarnam en direct derrière, titre, Continuer / Nouvelle partie --------------------------
  private pageAccueil(): string {
    if (nouveauVenu()) return this.pageBienvenue();
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
      <span class="tiny">${EMPLACEMENTS} emplacements · sauvegarde automatique</span>
      ${installable() ? `<button type="button" class="dbtn" style="font-size:calc(.8*var(--u));padding:calc(.45*var(--u)) calc(.9*var(--u));color:#cfe9a0;border-color:#4d5a2c" data-installer title="Ouvre Diablofus dans sa propre fenêtre, avec une icône sur le bureau. Toujours à jour.">⤓ Installer le jeu</button>` : ''}</div>
    ${p ? this.derniereFois(p) : ''}
    ${this.diapo('right:calc(2*var(--u));top:calc(7.6*var(--u));width:calc(24*var(--u))', true)}
    <div class="abs" style="right:calc(2*var(--u));top:calc(1.6*var(--u));display:flex;gap:calc(.8*var(--u));align-items:center">
    ${this.communaute()}
    ${carnetNonLu() ? `<div class="card" style="padding:calc(.7*var(--u)) calc(1*var(--u));display:flex;gap:calc(1*var(--u));align-items:center;font-weight:800;font-size:calc(.85*var(--u))">
      <span class="pastille" style="position:static">nouveau</span><span>Carnet du ${dateLongue(CARNETS[0].date)}<br><span class="tiny">${esc(CARNETS[0].titre)}</span></span>
      <button type="button" class="mini" data-carnet="${CARNETS[0].date}">Lire</button></div>` : ''}</div>
    <div class="abs" style="right:calc(2*var(--u));bottom:calc(1.6*var(--u));display:flex;gap:calc(.6*var(--u))">
      ${ZONES_ACC.map(z => `<button type="button" class="chip${z.cle === 'astrub' ? ' on' : z.dispo ? '' : ' off'}" style="cursor:pointer" data-zone="${z.cle}">${z.nom}${z.dispo ? '' : ' · bientôt'}</button>`).join('')}</div>`;
  }

  /** Diaporama (« Diapo : » 7A 7B 8A) : fondu + zoom lent toutes les 4 s, pause au survol, points cliquables, clic = en grand. */
  private diapoI = 0;
  private diapoT = 0;
  private diapo(style: string, petit = false): string {
    if (!DIAPO.length) return '';
    this.diapoI %= DIAPO.length;
    return `<div class="abs diapo${petit ? ' petit' : ''}" style="${style}" data-diapo role="region" aria-label="Captures du jeu">
      ${DIAPO.map((c, i) => `<figure class="${i === this.diapoI ? 'on' : ''}"><img src="${diapoImg(c.id)}" alt="${esc(c.legende)}" loading="${i ? 'lazy' : 'eager'}"><figcaption>${esc(c.legende)}</figcaption></figure>`).join('')}
      <div class="points">${DIAPO.map((_, i) => `<button type="button" class="${i === this.diapoI ? 'on' : ''}" data-diapo-i="${i}" aria-label="Capture ${i + 1}"></button>`).join('')}</div></div>`;
  }
  /** Montre la capture i dans le cadre, sans tout redessiner. */
  private montrerDiapo(i: number) {
    this.diapoI = (i + DIAPO.length) % DIAPO.length;
    this.root.querySelectorAll('.diapo figure').forEach((f, k) => f.classList.toggle('on', k === this.diapoI));
    this.root.querySelectorAll('.diapo .points button').forEach((f, k) => f.classList.toggle('on', k === this.diapoI));
  }
  private ouvrirDiapo(i: number) {
    this.diapoI = (i + DIAPO.length) % DIAPO.length;
    const c = DIAPO[this.diapoI];
    this.modal = `<div class="grand"><img src="${diapoImg(c.id)}" alt=""><div style="display:flex;gap:calc(.8*var(--u));align-items:center">
      <button type="button" class="mini" data-diapo-prec aria-label="Précédente">◀</button><b style="flex:1;font-size:calc(1*var(--u))">${esc(c.legende)}</b>
      <span class="tiny">${this.diapoI + 1} / ${DIAPO.length}</span><button type="button" class="mini" data-diapo-suiv aria-label="Suivante">▶</button></div></div>`;
    this.modalLarge = true; this.render();
  }
  private modalLarge = false;

  /** Joueurs en ligne (Accueil 9B, caché à 0) et invitation au Discord (6A). */
  private communaute(): string {
    return `${this.enLigne > 0 ? `<span class="enligne"><i></i>${this.enLigne} aventurier${this.enLigne > 1 ? 's' : ''} en ligne</span>` : ''}
      <a class="dbtn discord" href="${DISCORD_INVITATION}" target="_blank" rel="noopener" data-discord-rejoindre>Rejoindre le Discord</a>`;
  }
  /** Joueurs en ligne lus sur le serveur (/sante), au plus une fois par minute. */
  private enLigne = 0;
  private enLigneT = 0;
  private lireEnLigne() {
    if (Date.now() - this.enLigneT < 60_000) return;
    this.enLigneT = Date.now();
    fetch(`${API}/sante`).then(r => r.json()).then((j: { enLigne?: number }) => {
      const n = Math.max(0, Math.floor(Number(j.enLigne) || 0));
      if (n !== this.enLigne) { this.enLigne = n; if (!this.root.hidden && this.page === 'accueil') this.render(); }
    }, () => { /* serveur injoignable : rien d'affiché */ });
  }

  /** Accueil d'un nouveau venu (maquette « Accueil : » 2A 3A 4A 4C 5A 6B 9A 10A) : ce qu'est le jeu, comment y jouer,
   *  un seul gros bouton. Les anciens joueurs gardent l'accueil de version. */
  private pageBienvenue(): string {
    const P = PRESENTATION;
    return `<div class="cover" style="background:linear-gradient(90deg,#0d0e09f5 6%,#0d0e09c8 36%,#0d0e0930 60%,transparent 78%)"></div>
    <div class="abs tiny" style="left:calc(11*var(--u));top:calc(2.2*var(--u));letter-spacing:.15em;font-weight:800">${TEXTE.zone}</div>
    <img class="abs logoI" style="left:calc(10.4*var(--u));top:calc(3.6*var(--u))" src="${v('assets/logo/logo.webp')}" alt="Diablofus : Les Douze Enfers">
    <h1 class="abs pitch" style="left:calc(11.5*var(--u));top:calc(15*var(--u))">${P.pitch}</h1>
    <div class="abs pastilles" style="left:calc(11.5*var(--u));top:calc(21.4*var(--u))">${P.pastilles.map(x => `<span>${esc(x)}</span>`).join('')}</div>
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(24.9*var(--u));font-weight:700;font-size:calc(1.05*var(--u));line-height:1.75;max-width:calc(36*var(--u))">
      ${P.lignes.map(x => `<div class="point">${x}</div>`).join('')}</div>
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(33.6*var(--u));display:flex;gap:calc(1*var(--u));align-items:center">
      <button type="button" class="lbtn" style="font-size:calc(1.6*var(--u));padding:calc(.9*var(--u)) calc(2.6*var(--u))" data-go="creation">Jouer gratuitement</button>
      <button type="button" class="dbtn" style="font-size:calc(.85*var(--u));padding:calc(.5*var(--u)) calc(1*var(--u))" data-go="persos">Mes personnages</button></div>
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(39.4*var(--u));display:flex;gap:calc(1*var(--u));align-items:center">
      ${Compte.etat === 'connecte' ? '' : `<button type="button" class="mini" data-discord style="background:#5865f2;border-color:#7983f5;padding:calc(.45*var(--u)) calc(1*var(--u))">Se connecter avec Discord</button>`}
      <span class="tiny">${Compte.etat === 'connecte' ? 'Connecté : tes persos sont sauvés en ligne' : 'Facultatif · sauvegarde automatique dans ton navigateur'}</span>
      ${installable() ? `<button type="button" class="dbtn" style="font-size:calc(.8*var(--u));padding:calc(.45*var(--u)) calc(.9*var(--u));color:#cfe9a0;border-color:#4d5a2c" data-installer title="Ouvre Diablofus dans sa propre fenêtre, avec une icône sur le bureau. Toujours à jour.">⤓ Installer le jeu</button>` : ''}</div>
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(42.6*var(--u))" ><span class="tiny">⌨ Clavier + souris · PC conseillé</span></div>
    <div class="abs" style="right:calc(2*var(--u));top:calc(1.6*var(--u));display:flex;gap:calc(.8*var(--u));align-items:center">${this.communaute()}</div>
    ${this.diapo('right:calc(2.4*var(--u));top:calc(7*var(--u));width:calc(36*var(--u))')}
    <div class="abs cartesB" style="right:calc(2.4*var(--u));${DIAPO.length ? 'top:calc(29.4*var(--u))' : 'bottom:calc(5.4*var(--u))'}">${P.cartes.map(([t, x]) => `<div><b>${esc(t)}</b>${esc(x)}</div>`).join('')}</div>
    <button type="button" class="abs lienfaq" style="right:calc(2.4*var(--u));bottom:calc(2*var(--u))" data-faq>C'est quoi Diablofus ?</button>`;
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
    const app = jouable ? this.appCrea() : null, fiche = this.fiches?.[`${c.cle}_${s.sexe}`];
    return `<div class="cover" style="background-image:url(${img(DIEUX.has(c.cle) ? `dieu_${c.cle}.jpg` : 'login.jpg')})"></div>
    <div class="cover" style="background:radial-gradient(ellipse 60% 70% at 52% 55%,transparent 30%,#0d0e09d0 80%),linear-gradient(90deg,#0d0e09f0 8%,#0d0e0980 32%,transparent 50%,#0d0e0980 72%,#0d0e09f0 92%)"></div>
    <div class="abs tiny" style="left:calc(8.4*var(--u));top:calc(1.4*var(--u));font-weight:800">Créer un personnage</div>
    <button type="button" class="abs dbtn" style="right:calc(2*var(--u));top:calc(1*var(--u));font-size:calc(.8*var(--u));padding:calc(.35*var(--u)) calc(.9*var(--u))" data-go="accueil">Retour</button>
    <div class="abs" style="left:calc(8.4*var(--u));top:calc(4.2*var(--u));width:calc(23*var(--u))">
      <div style="display:flex;align-items:center;gap:calc(.6*var(--u));font-weight:800;font-size:calc(1.15*var(--u))"><img src="${img(`c_${c.cle}.png`)}" alt="" style="height:calc(1.9*var(--u))">${esc(c.titre)}${c.cle === DEBUTANT ? '<span class="conseilT">Conseillé pour débuter</span>' : ''}</div>
      <div class="ttl" style="font-size:calc(5.2*var(--u));margin:calc(.3*var(--u)) 0 calc(.7*var(--u))">${esc(c.nom)}</div>
      <div class="card" style="padding:0 0 calc(.9*var(--u))">
        <div class="panelT">${roles.map(r => r[0]).join(' · ')}</div>
        <div style="padding:calc(.8*var(--u)) calc(1.1*var(--u)) 0;display:grid;gap:calc(.45*var(--u));font-size:calc(.85*var(--u));font-weight:700">
          <div style="font-weight:600;font-size:calc(.75*var(--u));color:#d9d4bd;line-height:1.4">${esc(c.desc)}</div>
          ${roles.map(([n, val]) => `<div style="display:grid;grid-template-columns:calc(6*var(--u)) 1fr;align-items:center;gap:calc(.6*var(--u))"><span>${n}</span><div class="bar"><i style="width:${Math.min(100, val / 12 * 100)}%"></i></div></div>`).join('')}
          <div style="display:flex;justify-content:space-between"><span>Difficulté</span><span class="dots">${'●'.repeat(c.complexite)}<i>${'●'.repeat(5 - c.complexite)}</i></span></div>
          ${jouable ? `<div class="lab" style="margin-bottom:0">Premiers sorts</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:calc(.5*var(--u))">${this.premiersSorts(c.cle).map(([sp, n]) =>
            `<div class="sp" data-sort data-nom="${esc(sp.name)}" data-desc="${esc(this.texteMaison(c.cle, sp))}" style="cursor:help"><img src="assets/ui/sorts/sort_${sp.icon}.png" alt=""><span>${esc(sp.name)}<small>niveau ${n}</small></span></div>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="abs card bulleSort" style="left:calc(33*var(--u));top:calc(30*var(--u));width:calc(18*var(--u));padding:calc(.7*var(--u)) calc(.9*var(--u));font-size:calc(.75*var(--u));font-weight:600;line-height:1.45;opacity:0;transition:opacity .15s;pointer-events:none;z-index:6"></div>
    <img src="${img('lumiere.png')}" alt="" class="abs" style="left:calc(50% - 7.5*var(--u));top:calc(6*var(--u));width:calc(15*var(--u));opacity:.7;mix-blend-mode:screen">
    <img src="assets/ui/socle.png" alt="" class="abs" style="left:calc(50% - 10.5*var(--u));top:calc(29.5*var(--u));width:calc(21*var(--u));filter:sepia(.55) saturate(1.3) brightness(.95) drop-shadow(0 0 calc(1.2*var(--u)) #8fe8ff99)">
    ${jouable && app ? this.canevas(`${c.cle}_${s.sexe}`, app, ANIM_POSE[s.pose], `left:calc(50% - 8.85*var(--u));top:calc(13.4*var(--u));width:calc(28.1*var(--u));height:calc(24*var(--u))`, c.nom)
      : jouable ? `<div class="abs hero" data-n="${pose[2]}" role="img" aria-label="${esc(c.nom)}" style="left:calc(50% - 8.85*var(--u));top:calc(13.4*var(--u));width:calc(${s.pose === 'attaque' ? 28.1 : 17.7}*var(--u));height:calc(24*var(--u));background-image:url(${img(`${c.cle}_${s.sexe}_${s.pose}.webp`)});background-size:${pose[2] * 100}% 100%" data-src="${img(`${c.cle}_${s.sexe}_${s.pose}.webp`)}"></div>`
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
        <div style="display:flex;gap:calc(.3*var(--u))">${POSES.map(([k, n]) =>
          `<button class="tab${s.pose === k ? ' on' : ''}" type="button" data-pose="${k}">${n}</button>`).join('')}</div>
        ${app && fiche ? `<div class="lab">Tête</div>
        <div class="tetes">${fiche.tetes.map((_, i) => `<button type="button" data-tete="${i}" class="${app.tete === i ? 'on' : ''}" aria-label="Tête ${i + 1}" title="Tête ${i + 1}"
          style="background-image:url(${v(`${DOSSIER}/tetes_${c.cle}_${s.sexe}.webp`)});background-size:${fiche.tetes.length * 100}% 100%;background-position:${fiche.tetes.length > 1 ? (i / (fiche.tetes.length - 1)) * 100 : 0}% 0"></button>`).join('')}</div>
        <div class="lab" style="display:flex;justify-content:space-between;align-items:center">Couleurs<button type="button" class="mini" data-officielles style="font-size:calc(.6*var(--u))">Couleurs officielles</button></div>
        <div class="coul">${app.couleurs.map((col, i) => `<label><input type="color" data-coul="${i}" value="${hexa(col)}" style="background:${hexa(col)}" aria-label="${ZONES[i]}">${ZONES[i]}</label>`).join('')}</div>
        <div class="pals">${PALETTES.map((pl, i) => `<button type="button" data-palette="${i}">${pl.c.slice(0, 3).map(x => `<i style="background:${hexa(x)}"></i>`).join('')}${pl.nom}</button>`).join('')}</div>` : ''}
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
      return `<button type="button" class="cls${k.cle === s.cle ? ' on' : ''}${JOUABLES.has(k.cle) ? ' play' : ''}${dim ? ' dim' : ''}" data-cls="${k.cle}"><img src="${tete(k, s.sexe)}" alt="">${esc(k.nom)}${JOUABLES.has(k.cle) ? (k.cle === DEBUTANT ? '<span class="soon conseil">débutant</span>' : '') : '<span class="soon">bientôt</span>'}</button>`;
    }).join('')}</div>`;
  }
  /** Texte maison du sort (menu des sorts 2A), sinon le texte officiel. */
  private texteMaison(cle: string, sp: SortOfficiel): string {
    const t = texteSort(GAME_DATA.classes[cle]?.sorts ?? cle, sp.id);
    return t ? `${t.accroche} ${t.texte}` : sp.desc;
  }
  /** Les 4 premiers sorts officiels de la classe (Dofus 3), avec le niveau où on les obtient. */
  private premiersSorts(cle: string): [SortOfficiel, number][] {
    const cls = GAME_DATA.classes[cle], mob = cls.spells[cls.mobility]?.dofusId;
    return (SORTS[cls.sorts] ?? []).map(p => [p[0], niveauRequis(p[0], mob, cls.niveau1)] as [SortOfficiel, number]).sort((a, b) => a[1] - b[1]).slice(0, 4);
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
      ${this.blocCompte()}
      <div class="card" style="padding:calc(.7*var(--u)) calc(.9*var(--u));display:${persosEnLigne() ? 'none' : 'grid'};gap:calc(.5*var(--u))">
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
      ${this.fiches?.[`${c.cle}_${p.sexe}`] ? this.canevas(`${c.cle}_${p.sexe}`, apparenceValide(this.fiches[`${c.cle}_${p.sexe}`], p.apparence), ANIM_POSE.repos,
        'left:calc(50% - 4.85*var(--u));top:calc(15.4*var(--u));width:calc(17.7*var(--u));height:calc(24*var(--u))', p.nom, objetsPortes(p.etat?.equipment, p.etat?.apparat))
      : `<div class="abs hero" data-n="24" role="img" aria-label="${esc(p.nom)}" style="left:calc(50% - 4.85*var(--u));top:calc(15.4*var(--u));width:calc(17.7*var(--u));height:calc(24*var(--u));background-image:url(${img(`${c.cle}_${p.sexe}_repos.webp`)});background-size:2400% 100%" data-src="${img(`${c.cle}_${p.sexe}_repos.webp`)}"></div>`}
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
    // maquette « Drops » 1A + 3A : toutes les sous-zones et donjons des mondes ouverts ; le butin se voit dès le premier vaincu
    const b = lireBestiaire(), zones = groupesBestiaire();
    const tous = zones.flatMap(x => x.monstres), connus = tous.filter(m => b[m]).length, nb = tous.length;
    const fiche = (m: string) => {
      const d = GAME_DATA.monsters[m], n = b[m] ?? 0, L = LOOKS[d.look];
      if (!n) return `<div class="card mob inconnu"><canvas data-atlas="${L?.atlas ?? ''}" width="96" height="96"></canvas><b>???</b><span class="lock">Pas encore croisé</span></div>`;
      const res = Object.entries(d.res ?? {}).map(([e, v]) => `${e[0].toUpperCase()}${e.slice(1)} ${v} %`).join(' · ');
      const drops = (ITEMS.drops[m] ?? []).filter(x => !x.cond).map(x => `${(ITEMS.resources[x.item] ?? ITEMS.equipment[x.item])?.name ?? x.item} ${x.chance.toLocaleString("fr-FR")} %`).join(', ');
      const pal = (k: keyof typeof PALIERS, txt: string) => n >= PALIERS[k] ? txt : `<span class="lock">à ${PALIERS[k]} vaincus</span>`;
      return `<div class="card mob"><canvas data-atlas="${L?.atlas ?? ''}" width="96" height="96"></canvas><b>${esc(d.name)}</b>
        <span class="l"><span>Niveau ${niveauHorsPartie(m, GAME_DATA)}</span><span>${n} vaincu${n > 1 ? 's' : ''}</span></span>
        <div class="det"><div class="l"><span>Sorts</span><span>${pal('sorts', esc((d.spells ?? []).map(x => x.name).join(', ') || 'aucun'))}</span></div>
        <div class="l"><span>Résistances</span><span>${pal('res', esc(res || 'aucune'))}</span></div>
        <div class="l"><span>Butin</span><span>${esc(drops || 'aucun')}</span></div></div></div>`;
    };
    return `<div class="cover" style="background-image:url(${img('login.jpg')});filter:brightness(.4) saturate(.8)"></div>
    <div class="abs tiny" style="left:calc(8.4*var(--u));top:calc(1.4*var(--u));font-weight:800">Bestiaire du compte</div>
    <button type="button" class="abs dbtn" style="right:calc(2*var(--u));top:calc(1*var(--u));font-size:calc(.8*var(--u));padding:calc(.35*var(--u)) calc(.9*var(--u))" data-go="accueil">Retour</button>
    <div class="abs" style="left:calc(8.4*var(--u));top:calc(3.6*var(--u));display:flex;align-items:baseline;gap:calc(1.2*var(--u))">
      <div class="ttl" style="font-size:calc(4*var(--u))">Bestiaire</div>
      <div style="font-weight:800;font-size:calc(1.1*var(--u))">${connus} / ${nb} monstres croisés · sorts à ${PALIERS.sorts} vaincus, résistances à ${PALIERS.res} · chances détaillées en jeu (touche B)</div></div>
    <div class="abs bes" style="left:calc(8.4*var(--u));right:calc(2*var(--u));top:calc(9.5*var(--u));bottom:calc(1.5*var(--u));overflow:auto;align-content:start">
      ${zones.map(x => `<div class="zt">${esc(x.zone)} · ${esc(x.nom)} · niveau ${x.niveau}</div>` + x.monstres.map(fiche).join('')).join('')}
    </div>`;
  }
  /** Portraits du Bestiaire : la première image de l'animation statique du monstre, prise dans sa planche. */
  private portraits() { dessinerPortraits(this.root); }

  // --- Journal (Accueil 3A) : façon « Les nouvelles d'Astrub », un carnet par journée ---------------------------
  private pageJournal(): string {
    const zone = JOURNAL.zone, c = this.carnet ? CARNETS.find(x => x.date === this.carnet) : null;
    if (c) {
      const rub = JOURNAL.rubriques.filter(r => c.lignes[r]?.length);
      const une = Object.values(c.lignes).flatMap(entrees).filter(e => e.image).slice(0, 3);
      return `<div class="jr" data-jr><div class="in">
        <button type="button" class="lire" data-carnet="" style="color:var(--lime)">← Tous les carnets</button>
        <div class="tiny" style="margin-top:calc(1.6*var(--u));font-weight:800">Mises à jour · ${dateLongue(c.date)}</div>
        <h1 style="font-size:calc(3.6*var(--u));margin-top:calc(.4*var(--u))">${dateLongue(c.date)}</h1>
        <div style="font-weight:800;font-size:calc(1.2*var(--u));color:#fbf3d4;margin-top:calc(.4*var(--u))">${esc(c.titre)}</div>
        <div class="jres">${esc(c.resume)}</div>
        ${une.length ? `<div class="june">${une.map(e => `<div><img src="${v(e.image!)}" alt=""><div><b>${icone(e.icone) ? `<img src="${icone(e.icone)}" alt="">` : ''}${esc(e.titre)}</b><p>${esc(e.phrase)}</p></div></div>`).join('')}</div>` : ''}
        <div class="cn"><nav class="som"><b>DANS CE CARNET</b>${rub.map((r, i) => `<button type="button" data-rub="${i}">${esc(r)} <small>${c.lignes[r].length}</small></button>`).join('')}
          <canvas data-atlas="${LOOKS.tofu_chimerique?.atlas ?? ''}" width="120" height="120" aria-hidden="true"></canvas></nav>
          <div>${!une.length && c.capture ? `<div class="photo" style="transform:none;margin-bottom:calc(2*var(--u))"><img src="${v(c.capture)}" alt=""><small>${esc(c.legende ?? '')}</small></div>` : ''}
          ${rub.map((r, i) => `<h3 id="rub-${i}">${esc(r)}</h3>${COURTES.includes(r)
            ? `<ul class="jcourt">${c.lignes[r].map(l => `<li>${esc(typeof l === 'string' ? l : `${l.titre} : ${l.phrase}`)}</li>`).join('')}</ul>`
            : c.lignes[r].map(entreeHtml).join('')}`).join('')}</div></div>
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
    const fait = compte(), all = Object.entries(QUETES.succes).filter(([, x]) => !(x as { test?: boolean }).test);
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
    if (k === 'quoi-de-neuf') {
      // 6A : 4 tuiles icône + titre + phrase, les nouveautés « À la une » d'abord
      const c = CARNETS[0], tout = entrees(c.lignes['Nouveautés'] ?? Object.values(c.lignes).flat());
      const l = [...tout.filter(e => e.image), ...tout.filter(e => !e.image)].slice(0, 4);
      this.modal = `<h2>Quoi de neuf ?</h2><div class="tiny">Carnet du ${dateLongue(c.date)} · ${esc(c.titre)}</div>
        <div class="qdn">${l.map(e => `<div>${icone(e.icone) ? `<img src="${icone(e.icone)}" alt="">` : '<span></span>'}<b>${esc(e.titre)}</b><span>${esc(e.phrase)}</span></div>`).join('')}</div>
        <div style="display:flex;gap:calc(.8*var(--u));margin-top:calc(1*var(--u))"><button type="button" class="lbtn" data-carnet="${c.date}">Lire tout le carnet</button>
        <button type="button" class="dbtn" data-fermer-btn>Plus tard</button></div>`;
    } else if (k === 'faq') {
      this.modal = `<h2>C'est quoi Diablofus ?</h2><div class="faq">${FAQ.map(([q, r]) => `<div><b>${esc(q)}</b><span>${esc(r)}</span></div>`).join('')}</div>
        <div style="display:flex;gap:calc(.8*var(--u));margin-top:calc(1*var(--u))"><button type="button" class="lbtn" data-go="creation">Jouer gratuitement</button>
        <a class="dbtn discord" href="${DISCORD_INVITATION}" target="_blank" rel="noopener">Poser une question sur Discord</a></div>`;
    } else if (k === 'cimetiere') {
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
      const sub = GAME_DATA.zones[z.zone]?.open?.subareas ?? {}, vues = new Set(lirePersos().flatMap(p => p?.zones ?? []));
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
      if (k === 'options') { this.onOptions?.(); return; }   // Réglages 11A : la fenêtre Options du jeu, par-dessus l'accueil
      if (k === 'ladder') { void chargerLadder(); }
      if (k === 'accueil' || k === 'persos' || k === 'creation' || k === 'succes' || k === 'bestiaire' || k === 'journal' || k === 'ladder') { this.carnet = null; this.go(k); }
      else this.toast(`${e.textContent!.trim()} : arrive dans une prochaine version`);
    });
    on('[data-go]', e => this.go(e.dataset.go as Page));
    on('[data-installer]', () => installer().then(ok => { this.render(); if (ok) this.toast('Diablofus est installé : il se lance depuis le bureau ou le menu Démarrer'); }));
    // fenêtres par-dessus (fiche de zone, cimetière, copies de secours)
    on('[data-zone]', e => this.ouvrir(e.dataset.zone!));
    on('[data-faq]', () => this.ouvrir('faq'));
    r.querySelector<HTMLElement>('[data-diapo]')?.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-diapo-i]');
      if (b) this.montrerDiapo(+b.dataset.diapoI!); else this.ouvrirDiapo(this.diapoI);
    });
    on('[data-diapo-prec]', () => this.ouvrirDiapo(this.diapoI - 1));
    on('[data-diapo-suiv]', () => this.ouvrirDiapo(this.diapoI + 1));
    // journal : ouvrir un carnet (le dernier ouvert = lu, la pastille s'éteint), sommaire
    on('[data-carnet]', e => { this.modal = null; this.carnet = e.dataset.carnet || null; if (this.carnet === CARNETS[0]?.date) marquerLu(); this.page = 'journal'; this.render(); this.root.querySelector('.jr')?.scrollTo(0, 0); });
    on('[data-rub]', e => this.root.querySelector(`#rub-${e.dataset.rub}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    on('[data-modal]', e => this.ouvrir(e.dataset.modal!));
    on('[data-fermer-btn]', () => { this.modal = null; this.render(); });
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
    on('[data-cls]', e => { if (this.crea.cle !== e.dataset.cls) { this.crea.tete = 0; this.crea.couleurs = null; } this.crea.cle = e.dataset.cls!; this.crea.err = ''; this.render(); });
    on('[data-sexe]', e => { if (this.crea.sexe !== e.dataset.sexe) { this.crea.tete = 0; this.crea.couleurs = null; } this.crea.sexe = e.dataset.sexe as 'm' | 'f'; this.render(); });
    // Apparence : tête (1A), couleurs libres (2A), palettes (2C) ; le perso du socle change tout de suite
    on('[data-tete]', e => { this.crea.tete = +e.dataset.tete!; this.render(); });
    on('[data-officielles]', () => { this.crea.couleurs = null; this.render(); });
    on('[data-palette]', e => {
      const a = this.appCrea(); if (!a) return;
      this.crea.couleurs = [a.couleurs[0], ...PALETTES[+e.dataset.palette!].c]; this.render();
    });
    r.querySelectorAll<HTMLInputElement>('input[data-coul]').forEach(inp => inp.addEventListener('input', () => {
      const a = this.appCrea(); if (!a) return;
      const c = [...a.couleurs]; c[+inp.dataset.coul!] = parseInt(inp.value.slice(1), 16);
      this.crea.couleurs = c; inp.style.background = inp.value;
      // pas de nouveau rendu de la page (le sélecteur de couleur resterait ouvert dans le vide) : seul le socle change
      const cv = r.querySelector<HTMLCanvasElement>('canvas.vivant'); if (cv) cv.dataset.app = JSON.stringify({ tete: a.tete, couleurs: c });
    }));
    on('[data-pose]', e => { this.crea.pose = e.dataset.pose!; this.render(); });
    on('[data-filtre]', e => { this.crea.filtre = e.dataset.filtre!; this.render(); });
    const nom = r.querySelector<HTMLInputElement>('input[data-nom]');
    nom?.addEventListener('input', () => { this.crea.nom = nom.value; });
    nom?.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.creer(); });
    nom?.addEventListener('keyup', e => e.stopPropagation());
    r.querySelector<HTMLInputElement>('[data-tuto]')?.addEventListener('change', e => { this.crea.tuto = (e.target as HTMLInputElement).checked; });
    r.querySelector<HTMLInputElement>('[data-hc]')?.addEventListener('change', e => { this.crea.hardcore = (e.target as HTMLInputElement).checked; });
    on('[data-creer]', () => this.creer());
    on('[data-essayer]', () => this.onEssayer?.(this.crea.cle, this.crea.sexe, this.appCrea() ?? undefined));
    // Accueil 8A : survol d'un premier sort = le perso du socle attaque, et le texte officiel du sort s'affiche
    r.querySelectorAll<HTMLElement>('[data-sort]').forEach(e => {
      const h = r.querySelector<HTMLElement>('.hero'), bulle = r.querySelector<HTMLElement>('.bulleSort');
      if (!h || !bulle) return;
      if (h instanceof HTMLCanvasElement) {
        const avant = h.dataset.anim!;
        e.addEventListener('mouseenter', () => { bulle.innerHTML = `<b>${esc(e.dataset.nom!)}</b><br>${esc(e.dataset.desc!)}`; bulle.style.opacity = '1'; h.dataset.anim = ANIM_POSE.attaque; });
        e.addEventListener('mouseleave', () => { bulle.style.opacity = '0'; h.dataset.anim = avant; });
        return;
      }
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
    // compte Discord
    on('[data-discord]', () => Compte.connecter());
    on('[data-deconnexion]', () => void Compte.deconnecter());
    on('[data-mode]', e => Compte.choisir(e.dataset.mode === 'enligne'));
    on('[data-mettre-en-ligne]', e => {
      const i = +e.dataset.mettreEnLigne!;
      Compte.choisir(true);
      void Compte.importer(i).then(err => { if (err) { Compte.choisir(false); this.toast(err); } else this.toast('Ton perso est en ligne'); });
    });
    if (Compte.message) { const m = Compte.message; Compte.message = ''; setTimeout(() => this.toast(m), 50); }
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
    const app = this.appCrea(); if (app) p.apparence = app;
    if (nouveauVenu()) Parcours.noter('perso');
    sauverPerso(libre, p);
    s.nom = ''; s.hardcore = false; s.tuto = true; s.tete = 0; s.couleurs = null;
    this.jouer(libre);
  }
}

/** Succès du compte (gardés par la partie dans le navigateur). */
function compte(): Set<string> {
  try { const c = JSON.parse(localStorage.getItem('diablofus.compte') ?? 'null'); return new Set(Array.isArray(c?.succes) ? c.succes : []); } catch { return new Set(); }
}
