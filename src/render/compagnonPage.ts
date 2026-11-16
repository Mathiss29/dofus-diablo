// Page de l'écran du bas (diablofus.com/#compagnon, « Écran du bas : » 1A…9B) : 4 onglets (Carte, Sac, Perso, Quêtes),
// les fenêtres du jeu reçues en copie par-dessus, et la pastille du lien qui ouvre le diagnostic (rapport, essai GPU).
// Le jeu ne se charge pas sur cette page : tout arrive par compagnon.ts (Canal). Sans le jeu : la sauvegarde, en lecture seule.
import { API, Compte } from './compte';
import { dernier, lirePersos, type Perso } from './persos';
import { CLE_UNE_TEXTURE, texteDiag, uneTexture, type DiagGpu } from './diagGpu';
import { Canal, type ActionCompagnon, type LigneTchat, type OngletBas, type OrdreBas } from './compagnon';
import type { CarteBas, EtatBas, ObjetBas, QuetesBas, SacBas } from './compagnonEtat';
import { CSS_BAS, MiroirBas } from './miroir';
import { v } from './assetUrl';
import { verifierVersion } from './miseAJour';
import { appliNative } from './manette';
import { garderEcranAllume } from './console';
import { ITEMS } from '../sim/data';
import { RARITY_COLORS, type Item } from '../sim/items';

const ONGLETS: [OngletBas, string, string][] = [['carte', 'Carte', '🗺'], ['sac', 'Sac', '🎒'], ['perso', 'Perso', '🧍'], ['quetes', 'Quêtes', '📜'], ['tchat', 'Tchat', '💬']];
const CLE_ONGLET = 'diablofus.compagnon.onglet';
const EMPL: Record<string, string> = { chapeau: 'Chapeau', cape: 'Cape', amulette: 'Amulette', anneau1: 'Anneau', anneau2: 'Anneau', ceinture: 'Ceinture', bottes: 'Bottes', arme: 'Arme', bouclier: 'Bouclier', familier: 'Familier' };
const FENETRES: Record<string, string> = { car: 'Caractéristiques', sorts: 'Sorts', job: 'Métiers', art: 'Artisanat', succes: 'Succès', forge: 'Forgemagie', emp: 'Services', boutique: 'Boutique', hdv: 'Hôtel des ventes',
  coffre: 'Coffre', zaap: 'Zaap', bestiaire: 'Bestiaire', almanax: 'Almanax', dofus: 'Dofus', social: 'Amis et groupe', ladder: 'Classement', tresor: 'Trésor', idoles: 'Idoles', campagne: 'Carnet des Fêlures', arene: 'Arène', garde: 'Garde-robe' };
const esc = (t: string) => t.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const icone = (n: number) => `assets/ui/objets/${n}.webp`;

const CSS = `
html,body{margin:0;background:#0d0f14;overscroll-behavior:none}
#cmp{position:fixed;inset:0;display:grid;grid-template-rows:minmax(0,1fr) 52px;background:#0d0f14;color:#e8e2d4;font:500 14px Lexend,system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
#cmp button{font:600 13px Lexend,sans-serif;color:#e8e2d4;background:#232a1a;border:1px solid #4d5a2c;border-radius:9px;padding:9px 6px;touch-action:manipulation}
#cmp button:active{background:#3a4a1c;transform:scale(.97)}
#cmp button:disabled{opacity:.4}
#cmp .vues{position:relative;overflow:hidden}
#cmp .vue{position:absolute;inset:0;display:none;overflow:auto;padding:8px 10px;box-sizing:border-box}
#cmp .vue.on{display:block}
#cmp nav{display:grid;grid-template-columns:repeat(5,1fr) 46px;border-top:1px solid #2a2f3a;background:#12151c}
#cmp nav button{border:0;border-radius:0;background:none;padding:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:12px;color:#8e8a78}
#cmp nav button b{font-size:19px;line-height:1;filter:grayscale(1) opacity(.6)}
#cmp nav button.on{color:#d3f46f;background:#1a2012;box-shadow:inset 0 3px 0 #d3f46f}
#cmp nav button.on b{filter:none}
#cmp nav .pt{width:12px;height:12px;border-radius:50%;background:#4a4f5a;margin:auto}
#cmp nav .pt.ok{background:#7fd04b;box-shadow:0 0 8px #7fd04b}#cmp nav .pt.lent{background:#ffc14d}
#cmp .ro{position:absolute;left:8px;right:8px;top:6px;z-index:3;background:#1d1a10ee;border:1px solid #5a5236;border-radius:9px;padding:6px 9px;font-size:12px;color:#cfc8b0;pointer-events:none}
#cmp .ro[hidden]{display:none}
#cmp .vide{color:#8e8a78;text-align:center;margin-top:60px;line-height:1.5}
/* carte */
#cmp .vue.carte{padding:0;overflow:hidden;touch-action:none;background:#0a0c10}
#cmp .carte .plan{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
#cmp .carte .plan img{display:block;position:absolute;left:0;top:0;image-rendering:auto}
#cmp .carte canvas{position:absolute;inset:0;width:100%;height:100%}
#cmp .carte .cb{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:6px}
#cmp .carte .cb button{width:40px;height:40px;padding:0;font-size:18px;background:#14181fdd}
#cmp .carte .ci{position:absolute;left:8px;bottom:6px;right:60px;font-size:12px;color:#cfc8b0;text-shadow:0 1px 2px #000}
/* sac */
#cmp .vue.sac{display:none;padding:0}
#cmp .vue.sac.on{display:grid;grid-template-columns:minmax(0,1fr) 236px}
#cmp .sac .gauche{display:flex;flex-direction:column;min-height:0;padding:6px 6px 6px 8px}
#cmp .seg{display:flex;gap:4px;margin-bottom:6px}
#cmp .seg button{flex:1;padding:6px;background:#161a22;border-color:#2a2f3a;color:#b9b29c}
#cmp .seg button.on{background:#2b3a14;border-color:#4d5a2c;color:#d3f46f}
#cmp .grille{overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:5px;align-content:start;flex:1}
#cmp .ob{position:relative;aspect-ratio:1;background:#161a22;border:2px solid #333;border-radius:8px;display:flex;align-items:center;justify-content:center}
#cmp .ob img{width:82%;height:82%;object-fit:contain}
#cmp .ob.sel{outline:2px solid #fff;outline-offset:1px}
#cmp .ob.trop img{opacity:.45}
#cmp .ob i{position:absolute;font-style:normal;font-size:11px;line-height:1}
#cmp .ob .up{right:2px;top:2px;color:#7be07b;font-weight:800}
#cmp .ob .cad{left:2px;bottom:2px}
#cmp .ob .neuf{left:3px;top:3px;width:8px;height:8px;border-radius:50%;background:#ffd24d;box-shadow:0 0 6px #ffd24d}
#cmp .ob .em{right:0;left:0;bottom:-1px;text-align:center;font-size:9px;color:#8e8a78}
#cmp .droite{border-left:1px solid #2a2f3a;display:flex;flex-direction:column;min-height:0;background:#11141a}
#cmp .droite .fi{flex:1;overflow:auto;padding:6px}
#cmp .droite .fb{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:6px;border-top:1px solid #2a2f3a}
#cmp .droite .fb button.large{grid-column:span 2}
#cmp .droite .fb button.dgr{background:#3a1c1a;border-color:#7a3a30}
#cmp .cmp-fiche{position:static!important;inset:auto!important;pointer-events:auto!important;z-index:auto!important}
#cmp .cmp-fiche .tip{position:static!important;display:block!important;min-width:0!important;max-width:none!important;box-shadow:none!important;padding:6px 8px!important;font-size:12.5px}
#cmp .cmp-fiche .tip .hint{display:none}
/* perso */
#cmp .ph{display:flex;gap:10px;align-items:center}
#cmp .ph img{width:64px;height:64px;object-fit:contain;background:#1c2620;border-radius:10px;flex:none}
#cmp .ph .nm{font:400 17px Rowdies,Lexend,sans-serif;color:#f4efe0}
#cmp .ph small{display:block;color:#b9b29c;font-size:12px}
#cmp .ph .kam{margin-left:auto;text-align:right;font-size:12px;color:#e6b85c;white-space:nowrap}
#cmp .bar{position:relative;height:16px;border-radius:5px;background:#24262c;overflow:hidden;margin-top:6px}
#cmp .bar>div{position:absolute;left:0;top:0;bottom:0}
#cmp .bar span{position:absolute;inset:0;text-align:center;font-size:11px;line-height:16px;font-weight:700;text-shadow:0 1px 2px #000}
#cmp .bar.xp{height:5px;margin-top:4px}
#cmp .ligne{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
#cmp .sorts{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:9px}
#cmp .so{position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:#161a22;border:1px solid #2a2f3a}
#cmp .so img{width:100%;height:100%;display:block}
#cmp .so .cd{position:absolute;left:0;right:0;bottom:0;background:#000b}
#cmp .so b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;text-shadow:0 1px 3px #000}
#cmp .so i{position:absolute;right:2px;bottom:1px;font-style:normal;font-size:11px;font-weight:800;color:#d3f46f;text-shadow:0 1px 2px #000}
#cmp .effets{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;min-height:24px}
#cmp .ef{font-size:11.5px;padding:3px 7px;border-radius:12px;background:#1d2a3a;color:#9cc9ff}
#cmp .ef.monstre{background:#3a1d1d;color:#ff9a8a}#cmp .ef.objet{background:#2e2414;color:#f0c070}
#cmp .acts{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px}
/* quêtes */
#cmp .q{background:#161a22;border:1px solid #2a2f3a;border-radius:10px;padding:7px 9px;margin-bottom:6px}
#cmp .q.suivie{border-color:#d3f46f}
#cmp .q b{display:block;font-size:13.5px}#cmp .q.campagne b{color:#ffb84d}
#cmp .q div{font-size:12px;color:#b9b29c;margin-top:2px}
#cmp .q .tag{float:right;font-size:10.5px;color:#d3f46f}
#cmp h3{font:400 13px Rowdies,Lexend,sans-serif;color:#8e8a78;margin:8px 0 5px;letter-spacing:.03em}
#cmp .gp{display:grid;grid-template-columns:1fr 1.2fr;gap:8px;align-items:center;font-size:12.5px;margin-bottom:4px}
/* tchat + journal (4C+4D) */
#cmp .vue.tchat{display:none;padding:6px 8px}
#cmp .vue.tchat.on{display:flex;flex-direction:column}
#cmp .tl{flex:1;overflow:auto;background:#0a0b0f;border-radius:9px;padding:6px 8px;font-size:13px;line-height:1.35;user-select:text;-webkit-user-select:text}
#cmp .tl p{margin:0 0 3px}#cmp .tl p.j{color:#b9b29c;font-size:12.5px}
#cmp .tl .vide{margin-top:40px}
#cmp .te{display:flex;gap:6px;margin-top:6px}
#cmp .te input{flex:1;min-width:0;font:500 14px Lexend,sans-serif;color:#e8e2d4;background:#161a22;border:1px solid #2a2f3a;border-radius:9px;padding:8px 10px}
#cmp .te[hidden]{display:none}
#cmp .seg button i{font-style:normal;color:#ffd24d;margin-left:4px}
/* « Idées Thor » : vue combat (1A+1B), raccourcis (2A), groupe (5A), bilan (3C) */
#cmp .vue.combat{padding:6px 9px}
#cmp .cbt{display:grid;grid-template-columns:minmax(0,1fr) 128px;gap:8px}
#cmp .cbt .bar{height:22px;margin-top:0}#cmp .cbt .bar span{line-height:22px;font-size:13px}
#cmp .cbt .ligne{margin-top:6px}
#cmp .cbt .ci2{margin-top:7px;background:#161a22;border:1px solid #6b2a30;border-radius:9px;padding:6px 8px}
#cmp .cbt .ci2 b{font-size:14px}#cmp .cbt .ci2 small{display:block;color:#b9b29c;font-size:11.5px}
#cmp .cbt .ci2.r1{border-color:#c99a1f}#cmp .cbt .ci2.r2{border-color:#c04dff}
#cmp .cbt .ci2 .bar{height:9px;margin-top:5px}
#cmp .cbt canvas{width:128px;height:128px;border-radius:50%;background:radial-gradient(circle,#1a2012 0 18%,#12151c 19%);border:1px solid #2a2f3a}
#cmp .cbt .rd{font-size:11px;color:#8e8a78;text-align:center;margin-top:3px}
#cmp .rac{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
/* « Confort 2 : » 7A volumes, 2A toujours allumé, 2B plein écran, 6C s'assombrit */
#cmp .reg{margin-top:10px;display:grid;gap:7px;padding-top:8px;border-top:1px solid #2a2f3a}
#cmp .reg label{display:grid;grid-template-columns:70px 1fr 40px;align-items:center;gap:8px;font-size:12.5px;color:#cfc8b0}
#cmp .reg input[type=range]{width:100%;accent-color:#d3f46f;height:22px}
#cmp .reg output{text-align:right;font-size:12px;color:#8e8a78}
#cmp .reg .sw{display:flex;gap:6px;flex-wrap:wrap}
#cmp .reg .sw button{flex:1;min-width:0;padding:7px 4px;font-size:12px}
#cmp .reg .sw button.on{background:#2b3a14;border-color:#4d5a2c;color:#d3f46f}
#cmp-sombre{position:fixed;inset:0;z-index:9999;background:#000;opacity:0;pointer-events:none;transition:opacity 1.2s}
#cmp-sombre.on{opacity:.72;pointer-events:auto}
#cmp .rac button{display:flex;align-items:center;gap:5px;padding:6px 9px;font-size:12px}
#cmp .rac img{width:22px;height:22px;object-fit:contain}
#cmp .grp{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
#cmp .grp button{flex:1;min-width:110px;text-align:left;padding:5px 8px;font-size:12px}
#cmp .grp button small{display:block;color:#b9b29c;font-size:11px}
#cmp .grp .bar{height:6px;margin-top:3px}
#cmp .tl p .ob2{margin-left:6px;padding:2px 7px;font-size:11px;border-radius:7px}
#cmp .bilan{position:absolute;inset:10px;z-index:8;background:#14181ff6;border:1px solid #c99a1f;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;box-shadow:0 8px 30px #000c}
#cmp .bilan[hidden]{display:none}
#cmp .bilan h4{margin:0 0 4px;font:400 17px Rowdies,Lexend,sans-serif;color:#ffd27a}
#cmp .bilan p{margin:0;font-size:13.5px}
#cmp .bilan button{margin-top:auto}
#cmp .bat{margin-bottom:8px;font-size:12.5px;color:#cfc8b0}
/* fenêtre du jeu reçue */
#cmp .fen{position:absolute;inset:0;z-index:4;background:#0d0f14;display:grid;grid-template-rows:38px minmax(0,1fr)}
#cmp .fen[hidden]{display:none}
#cmp .fen .fh{display:flex;align-items:center;justify-content:space-between;padding:0 6px 0 10px;background:#12151c;border-bottom:1px solid #2a2f3a;font:400 15px Rowdies,Lexend,sans-serif;color:#d3f46f}
#cmp .fen .fh button{padding:5px 12px}
#cmp .fen .fc{overflow:auto;padding:2px}
/* liens (diagnostic) */
#cmp .btns .appli{display:inline-block;padding:7px 10px;border-radius:8px;background:#2b3a14;border:1px solid #4d5a2c;color:#d3f46f;font-size:12.5px;text-decoration:none}
#cmp .liens{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}
#cmp .lien{background:#161a22;border:1px solid #2a2f3a;border-radius:10px;padding:6px 8px;font-size:12.5px;line-height:1.3}
#cmp .lien b{display:flex;align-items:center;gap:6px}
#cmp .lien i{width:10px;height:10px;border-radius:50%;background:#4a4f5a;flex:none}
#cmp .lien.ok i{background:#7fd04b}#cmp .lien.lent i{background:#ffc14d}
#cmp .lien span{color:#8e8a78;font-size:11.5px}
#cmp .btns{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px}
#cmp .journal{font:11.5px ui-monospace,Menlo,monospace;color:#9a957f;background:#0a0b0f;border-radius:8px;padding:6px 8px;min-height:50px;white-space:pre-wrap}
#cmp .ctx{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);z-index:3;font-size:14px!important;padding:11px 18px!important;background:#2b3a14ee!important;color:#d3f46f!important;border-color:#8fae3c!important;box-shadow:0 4px 14px #000a;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis}
#cmp .ctx[hidden]{display:none}
#cmp .toast{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);background:#1d2412f4;border:1px solid #4d5a2c;color:#e8e2d4;border-radius:10px;padding:7px 12px;font-size:13px;z-index:9;pointer-events:none;transition:opacity .3s;max-width:90%}
`;

const NOMS: Record<string, string> = { direct: 'Lien direct', stockage: 'Stockage partagé', sauvegarde: 'Sauvegarde', serveur: 'Serveur' };

/** Remplace la page par l'écran du bas (le jeu ne se charge pas). */
export function ecranCompagnon() {
  document.getElementById('chargement')?.remove();
  document.getElementById('game')?.remove();
  const s = document.createElement('style'); s.textContent = CSS + CSS_BAS; document.head.appendChild(s);
  const stJeu = document.createElement('style'); stJeu.id = 'cmp-jeu'; document.head.insertBefore(stJeu, s);   // styles du jeu, sous les nôtres
  const r = document.createElement('div'); r.id = 'cmp'; document.body.appendChild(r);
  r.innerHTML = `<div class="vues">
      <div class="ro" hidden></div>
      <div class="vue carte" data-v="carte"><div class="plan"><img alt=""></div><canvas></canvas>
        <div class="cb"><button data-c="moi" title="Sur moi">◎</button><button data-c="plus">＋</button><button data-c="moins">－</button></div><div class="ci"></div></div>
      <div class="vue sac" data-v="sac"><div class="gauche"><div class="seg"><button data-s="sac" class="on">Sac</button><button data-s="porte">Porté</button></div><div class="grille"></div></div>
        <div class="droite"><div class="fi"><div class="vide" style="margin-top:30px">Touche un objet</div></div><div class="fb"></div></div></div>
      <div class="vue" data-v="perso"></div>
      <div class="vue combat" data-v="combat"></div>
      <div class="vue" data-v="quetes"></div>
      <div class="vue tchat" data-v="tchat"><div class="seg"><button data-t="tchat" class="on">Tchat</button><button data-t="journal">Journal<i></i></button></div><div class="tl"></div>
        <form class="te"><input maxlength="200" placeholder="Écrire aux joueurs…" enterkeyhint="send" autocomplete="off"><button>Envoyer</button></form></div>
      <div class="vue" data-v="liens"><div class="bat"></div><div class="liens">${Object.keys(NOMS).map(k => `<div class="lien" data-l="${k}"><b><i></i>${NOMS[k]}</b><span>jamais</span></div>`).join('')}</div>
        <div class="btns"><button data-d="ping">Coucou au jeu</button><button data-d="rapport">Copier le rapport</button><button data-d="texture">Essai carrés noirs</button><button data-d="retour">Retour</button>${appliNative() ? '' : '<a class="appli" href="appli/diablofus-thor.apk" download>Appli Thor (deux écrans)</a>'}</div>
        <div class="journal"></div></div>
      <div class="bilan" hidden><h4></h4><div class="bl"></div><button data-bilan="x">Fermer</button></div>
      <div class="fen" hidden><div class="fh"><span></span><button data-f="x">✕ Fermer</button></div><div class="fc"></div></div>
      <button class="ctx" hidden></button>
      <div class="toast" style="opacity:0"></div>
    </div>
    <nav>${ONGLETS.map(([k, n, ic]) => `<button data-o="${k}"><b>${ic}</b>${n}</button>`).join('')}<button data-o="liens" title="Liaison avec le jeu"><i class="pt"></i></button></nav>`;
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => r.querySelector(sel) as T;
  const vue = (k: string) => q(`.vue[data-v="${k}"]`);

  // ---------- liaison ----------
  const c = new Canal('ecran');
  const debut = performance.now();
  const vu: Record<string, number> = { direct: 0, stockage: 0, sauvegarde: 0, serveur: 0 };
  const detail: Record<string, string> = {};
  const pings = new Map<number, number>(); let nPing = 0, dernierPing = '';
  let etat: EtatBas | null = null, etatT = 0, carte: CarteBas | null = null, sac: SacBas | null = null, quetes: QuetesBas | null = null;
  let stylesRecus = false, diag: DiagGpu | null = null, enJeu = false;
  const lignes: string[] = [];
  const noter = (t: string) => { lignes.unshift(`${new Date().toLocaleTimeString('fr-FR')}  ${t}`); lignes.length = Math.min(lignes.length, 8); q('.journal').textContent = lignes.join('\n'); };
  let toastT = 0;
  const toast = (t: string) => { const el = q('.toast'); el.textContent = t; el.style.opacity = '1'; clearTimeout(toastT); toastT = window.setTimeout(() => { el.style.opacity = '0'; }, 2200); };
  const relie = () => { const m = Math.max(vu.direct, vu.stockage); return m > 0 && performance.now() - m < 3000; };
  const ordre = (o: OrdreBas) => c.envoyer({ k: 'ordre', o });
  const action = (a: ActionCompagnon) => c.envoyer({ k: 'action', a });

  // ---------- onglets ----------
  let onglet: string = (() => { try { return localStorage.getItem(CLE_ONGLET) ?? 'perso'; } catch { return 'perso'; } })();
  if (!ONGLETS.some(o => o[0] === onglet)) onglet = 'perso';
  const montrerOnglet = (o: string) => {
    onglet = o;
    if (o !== 'liens' && o !== 'combat') try { localStorage.setItem(CLE_ONGLET, o); } catch { /* rien */ }
    r.querySelectorAll<HTMLElement>('.vue').forEach(el => el.classList.toggle('on', el.dataset.v === o));
    r.querySelectorAll<HTMLElement>('nav button').forEach(b => b.classList.toggle('on', b.dataset.o === o));
    if (o === 'carte') { centrerSiBesoin(); dessinerCarte(); }
    else if (o === 'sac') dessinerSac();
    else if (o === 'quetes') dessinerQuetes();
    else if (o === 'tchat') dessinerTchat();
    else if (o === 'combat') dessinerCombat();
    dessiner();
  };
  q('nav').addEventListener('click', e => {
    const o = (e.target as HTMLElement).closest('button')?.dataset.o; if (!o) return;
    if (combatAuto.on) { combatAuto.refus = true; combatAuto.on = false; }   // un onglet touché en combat : la vue Combat attend la fin du combat
    if (o === 'liens' && onglet === 'liens') montrerOnglet(ONGLETS[0][0]); else montrerOnglet(o);
    if (!miroir.ouverte) return;
    action('fermer');   // un onglet touché ferme la fenêtre du jeu reçue
  });

  // ---------- fenêtre du jeu reçue (2A+2B) ----------
  const miroir = new MiroirBas(q('.fen .fc'), e => ordre({ k: 'evt', e }));
  q('.fen [data-f="x"]').addEventListener('click', () => action('fermer'));

  // ---------- tchat et journal (4C+4D, 8A) ----------
  let tchat: LigneTchat[] = [], tchatEnLigne = false, vueT: 'tchat' | 'journal' = 'tchat', nonLus = 0;
  const journal: LigneTchat[] = [];
  const marquerNonLus = () => { q('.vue.tchat .seg i').textContent = nonLus ? `${Math.min(nonLus, 99)}` : ''; };
  const dessinerTchat = () => {
    const tl = q('.vue.tchat .tl');
    const bas = tl.scrollHeight - tl.scrollTop - tl.clientHeight < 30;
    r.querySelectorAll<HTMLElement>('.vue.tchat .seg button').forEach(b => b.classList.toggle('on', b.dataset.t === vueT));
    if (vueT === 'journal') { nonLus = 0; marquerNonLus(); }
    const l = vueT === 'tchat' ? tchat.filter(x => !x.j) : [...tchat.filter(x => x.j), ...journal];
    tl.innerHTML = l.length ? l.map(x => `<p class="${x.j ? 'j' : ''}"${x.c ? ` style="color:${x.c}"` : ''}>${x.h}</p>`).join('')
      : `<div class="vide">${vueT === 'journal' ? 'Le butin, les combats et les quêtes s\'écrivent ici.' : enJeu ? (tchatEnLigne ? 'Personne n\'a encore parlé.' : 'Le tchat des joueurs s\'ouvre en mode « En ligne ».') : 'Lance le jeu sur l\'écran du haut.'}</div>`;
    if (bas) tl.scrollTop = tl.scrollHeight;
    const f = q<HTMLFormElement>('.vue.tchat .te'); f.hidden = vueT !== 'tchat' || !tchatEnLigne || !relie();
  };
  // « Idées Thor : » 3B : chaque objet ramassé du Journal a ses boutons
  function boutonsObjet(uid: number) { return `<button class="ob2" data-jo="equiper" data-uid="${uid}">Équiper</button><button class="ob2" data-jo="cadenas" data-uid="${uid}">Cadenas</button>`; }
  q('.vue.tchat .tl').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-jo]'); if (!b) return;
    if (!relie()) { toast('Lecture seule : lance le jeu en haut'); return; }
    const uid = +b.dataset.uid!;
    if (b.dataset.jo === 'equiper') { ordre({ k: 'equiper', uid }); toast('Équipé'); } else { ordre({ k: 'cadenas', uid }); toast('Cadenas posé ou retiré'); }
  });
  q('.bilan [data-bilan="x"]').addEventListener('click', () => { q('.bilan').hidden = true; });
  q('.vue.tchat .seg').addEventListener('click', e => { const t = (e.target as HTMLElement).closest('button')?.dataset.t; if (t === 'tchat' || t === 'journal') { vueT = t; dessinerTchat(); } });
  q('.vue.tchat .te').addEventListener('submit', e => {
    e.preventDefault();
    const inp = q<HTMLInputElement>('.vue.tchat .te input'), t = inp.value.trim();
    if (!t) return;
    ordre({ k: 'dire', texte: t.slice(0, 200) }); inp.value = '';
  });

  c.ecoute = (m, par) => {
    const t = performance.now();
    vu[par] = t;
    if (!enJeu) { enJeu = true; noter(`Jeu trouvé (${NOMS[par].toLowerCase()})`); }
    switch (m.k) {
      case 'etat': etat = m.e; etatT = t; break;
      case 'carte': carte = m.c; if (onglet === 'carte') dessinerCarte(); break;
      case 'sac': sac = m.s; if (onglet === 'sac') dessinerSac(); break;
      case 'quetes': quetes = m.q; if (onglet === 'quetes') dessinerQuetes(); break;
      case 'tchat': tchat = m.l; tchatEnLigne = m.enLigne; if (onglet === 'tchat') dessinerTchat(); break;
      case 'annonce': reveiller(); toast(m.t); journal.push({ h: `${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}  ${esc(m.t)}${m.uid != null ? boutonsObjet(m.uid) : ''}`, j: true, c: m.c }); if (journal.length > 80) journal.splice(0, journal.length - 80);
        if (onglet === 'tchat' && vueT === 'journal') dessinerTchat(); else { nonLus++; marquerNonLus(); } break;
      case 'bilan': {   // 3C
        const b = q('.bilan'); b.hidden = false; b.querySelector('h4')!.textContent = m.titre;
        b.querySelector('.bl')!.innerHTML = m.lignes.map(l => `<p>${esc(l)}</p>`).join('');
        journal.push({ h: `<b>${esc(m.titre)}</b> · ${m.lignes.map(esc).join(' · ')}`, j: true, c: '#ffd27a' });
        break;
      }
      case 'styles': stJeu.textContent = m.css; stylesRecus = true; break;
      case 'fiche': if (m.uid === choisi?.uid) { ficheHtml = m.html; dessinerFiche(); } break;
      case 'fenetre': {
        const avant = miroir.ouverte; miroir.montrer(m.f);
        const fen = q('.fen'); fen.hidden = !m.f;
        if (m.f) q('.fen .fh span').textContent = FENETRES[m.f.mode] ?? 'Fenêtre';
        if (!avant && m.f) miroir.montrer(m.f);   // la taille du conteneur n'est connue qu'une fois visible
        break;
      }
      case 'onglet': {
        const i = ONGLETS.findIndex(o => o[0] === onglet);
        montrerOnglet(m.o === 'suivant' ? ONGLETS[(i + 1) % ONGLETS.length][0] : m.o);
        break;
      }
      case 'diag':
        if (diag && m.d.echecs.length > diag.echecs.length) noter(`Jeu : texture refusée par la carte graphique (${m.d.echecs.length})`);
        diag = m.d; break;
      case 'pong': {
        const t0 = pings.get(m.n);
        if (t0 != null) { pings.delete(m.n); dernierPing = `${Math.round(t - t0)} ms`; noter(`Réponse du jeu en ${dernierPing}`); }
        break;
      }
    }
  };
  // on s'annonce toutes les 2 s ; tant que les styles du jeu manquent, on redemande tout (page rechargée)
  const annoncer = () => c.envoyer({ k: 'bonjour', neuf: !stylesRecus });
  annoncer(); setInterval(annoncer, 2000);
  if (!c.direct) detail.direct = 'absent de ce navigateur';

  // ---------- secours (9B) : la sauvegarde du dernier perso joué, puis le serveur ----------
  let sauve: Perso | null = null, majSauvegarde = 0;
  const lireSauvegarde = () => {
    const i = dernier(), p = i == null ? null : lirePersos()[i];
    if (!p) { detail.sauvegarde = 'aucun perso'; return; }
    if (p.maj !== majSauvegarde) { if (majSauvegarde) vu.sauvegarde = performance.now(); majSauvegarde = p.maj; }
    detail.sauvegarde = `écrite à ${new Date(p.maj).toLocaleTimeString('fr-FR')}`;
    sauve = p;
  };
  lireSauvegarde(); setInterval(lireSauvegarde, 3000);
  const lireServeur = async () => {
    const jeton = Compte.jeton;
    if (!jeton) { detail.serveur = 'pas connecté (Discord)'; return; }
    try {
      const rep = await fetch(`${API}/moi`, { headers: { authorization: `Bearer ${jeton}` }, cache: 'no-store' });
      if (!rep.ok) { detail.serveur = `erreur ${rep.status}`; return; }
      const d = await rep.json() as { persos: ({ perso: Perso } | null)[] };
      const i = dernier() ?? d.persos.findIndex(x => x), p = i == null || i < 0 ? null : d.persos[i]?.perso;
      vu.serveur = performance.now();
      detail.serveur = p ? `perso du ${new Date(p.maj).toLocaleTimeString('fr-FR')}` : 'répond, aucun perso';
      if (p && (!sauve || p.maj > sauve.maj)) sauve = p;
    } catch { detail.serveur = 'injoignable'; }
  };
  void lireServeur(); setInterval(() => void lireServeur(), 30000);
  // mise à jour du site : la page se recharge seule (comme le jeu)
  setInterval(() => { if (!relie()) void verifierVersion(); }, 10 * 60_000);

  // ---------- Carte (3A-3D) ----------
  const cv = q<HTMLCanvasElement>('.carte canvas'), img = q<HTMLImageElement>('.carte .plan img'), planEl = q('.carte .plan');
  const vc = { cx: 0, cy: 0, z: 0, suivre: true, monde: '' as string | null, w: 0, h: 0 };
  const chargerMonde = (m: string | null) => {
    if (m === vc.monde) return;
    vc.monde = m; vc.z = 0; vc.suivre = true; img.removeAttribute('src'); vc.w = vc.h = 0;
    if (!m) return;
    fetch(v(`assets/mondes/${m}/plan.json`)).then(x => x.ok ? x.json() : null).then((p: { carte?: { w?: number; h?: number } } | null) => {
      if (vc.monde !== m || !p?.carte?.w) return;
      vc.w = p.carte.w; vc.h = p.carte.h ?? 0;
      img.style.width = `${vc.w}px`; img.style.height = `${vc.h}px`; img.src = v(`assets/mondes/${m}/carte_fondu.webp`);
      dessinerCarte();
    }).catch(() => {});
  };
  const zoomDepart = () => { const L = cv.clientWidth || 500, pc = carte?.pxCase || 1; return carte?.monde ? L / (34 * pc) : L / 30; };
  const centrerSiBesoin = () => { if (carte && (vc.suivre || !vc.z)) { if (!vc.z) vc.z = zoomDepart(); vc.cx = carte.monde ? carte.moi.x : 0; vc.cy = carte.monde ? carte.moi.y : 0; } };
  const versEcran = (x: number, y: number): [number, number] => [cv.clientWidth / 2 + (x - vc.cx) * vc.z, cv.clientHeight / 2 + (y - vc.cy) * vc.z];
  const depuisEcran = (sx: number, sy: number): [number, number] => [vc.cx + (sx - cv.clientWidth / 2) / vc.z, vc.cy + (sy - cv.clientHeight / 2) / vc.z];
  const dessinerCarte = () => {
    if (onglet !== 'carte') return;
    const W = cv.clientWidth, H = cv.clientHeight, k = devicePixelRatio || 1;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * k) || cv.height !== Math.round(H * k)) { cv.width = Math.round(W * k); cv.height = Math.round(H * k); }
    const g = cv.getContext('2d')!; g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, W, H);
    const ci = q('.carte .ci');
    if (!carte) { planEl.style.display = 'none'; ci.textContent = relie() ? '' : 'La carte s\'affiche quand le jeu tourne en haut.'; return; }
    chargerMonde(carte.monde);
    centrerSiBesoin();
    planEl.style.display = carte.monde ? '' : 'none';
    planEl.style.transform = `translate(${W / 2 - vc.cx * vc.z}px,${H / 2 - vc.cy * vc.z}px) scale(${vc.z})`;
    if (!carte.monde) {   // radar : cercles tous les 10 cases
      g.strokeStyle = '#2a3a2a'; g.lineWidth = 1;
      for (let rr = 10; rr <= 40; rr += 10) { g.beginPath(); g.arc(W / 2 + (0 - vc.cx) * vc.z, H / 2 + (0 - vc.cy) * vc.z, rr * vc.z, 0, Math.PI * 2); g.stroke(); }
    }
    const rond = (x: number, y: number, rr: number, f: string, bord = '#000') => { const [a, b] = versEcran(x, y); g.beginPath(); g.arc(a, b, rr, 0, Math.PI * 2); g.fillStyle = f; g.fill(); g.strokeStyle = bord; g.lineWidth = 1.5; g.stroke(); };
    const losange = (x: number, y: number, rr: number, f: string, bord = '#000') => { const [a, b] = versEcran(x, y); g.beginPath(); g.moveTo(a, b - rr); g.lineTo(a + rr, b); g.lineTo(a, b + rr); g.lineTo(a - rr, b); g.closePath(); g.fillStyle = f; g.fill(); g.strokeStyle = bord; g.lineWidth = 1.5; g.stroke(); };
    const texte = (x: number, y: number, t: string, col = '#fff') => { const [a, b] = versEcran(x, y); g.font = '600 11px Lexend,sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000c'; g.strokeText(t, a, b - 10); g.fillStyle = col; g.fillText(t, a, b - 10); };
    if (carte.trajet && carte.trajet.length > 1) {   // « Idées Thor : » 4B : trajet de la quête suivie
      g.save(); g.setLineDash([7, 5]); g.lineWidth = 3; g.strokeStyle = '#ffd24dcc'; g.beginPath();
      carte.trajet.forEach(([x, y], i) => { const [a, b] = versEcran(x, y); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
      g.stroke(); g.restore();
    }
    for (const z of carte.zaaps) { losange(z.x, z.y, carte.surZaap && z.i >= 0 ? 9 : 7, z.i >= 0 ? '#5fd7ff' : '#55606a', carte.surZaap && z.i >= 0 ? '#fff' : '#000'); if (carte.surZaap && z.i >= 0) texte(z.x, z.y, z.nom, '#bdf0ff'); }
    for (const [x, y, rar] of carte.butin) losange(x, y, 4, RARITY_COLORS[rar as keyof typeof RARITY_COLORS] ?? '#fff');
    for (const [x, y, t] of carte.monstres) rond(x, y, t === 2 ? 7 : t === 1 ? 5 : 3.5, t === 2 ? '#c04dff' : t === 1 ? '#ff9a3c' : '#ff4d4d');
    for (const [x, y, n] of carte.allies) { rond(x, y, 5, '#4da6ff', '#fff'); if (n) texte(x, y, n, '#bcdcff'); }
    if (carte.but) { const [a, b] = versEcran(carte.but.x, carte.but.y); g.font = '18px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd24d'; g.fillText('★', a, b + 6); texte(carte.but.x, carte.but.y - 4 / vc.z, carte.but.nom, '#ffe08a'); }
    { // moi : flèche dans le sens du regard
      const [a, b] = versEcran(carte.monde ? carte.moi.x : 0, carte.monde ? carte.moi.y : 0), d = carte.moi.dir;
      g.save(); g.translate(a, b); g.rotate(d); g.beginPath(); g.moveTo(11, 0); g.lineTo(-7, -7); g.lineTo(-3, 0); g.lineTo(-7, 7); g.closePath();
      g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); g.restore();
    }
    ci.textContent = carte.surZaap ? 'Sur un Zaap : touche une destination bleue pour voyager.' : carte.monde ? 'Touche la carte : la flèche te guide. Un Zaap bleu : tu y voyages.' : 'Radar (pas de carte ici)';
  };
  { // gestes : un doigt = déplacer, deux = zoomer, toucher = flèche ou Zaap
    const doigts = new Map<number, { x: number; y: number }>();
    let geste: { x: number; y: number; t: number; bouge: boolean; d0: number; z0: number } | null = null;
    const pos = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    const el = vue('carte');
    el.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('button')) return;
      el.setPointerCapture(e.pointerId); doigts.set(e.pointerId, pos(e));
      const l = [...doigts.values()];
      if (l.length === 1) geste = { ...l[0], t: performance.now(), bouge: false, d0: 0, z0: vc.z };
      else if (geste) { geste.bouge = true; geste.d0 = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y); geste.z0 = vc.z; }
    });
    el.addEventListener('pointermove', e => {
      const avant = doigts.get(e.pointerId); if (!avant || !geste) return;
      const p = pos(e); doigts.set(e.pointerId, p);
      const l = [...doigts.values()];
      if (l.length >= 2 && geste.d0) {
        const d = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y), mx = (l[0].x + l[1].x) / 2, my = (l[0].y + l[1].y) / 2;
        const [ax, ay] = depuisEcran(mx, my);
        vc.z = Math.max(0.03, Math.min(6, geste.z0 * d / Math.max(1, geste.d0)));
        const [bx, by] = depuisEcran(mx, my); vc.cx += ax - bx; vc.cy += ay - by;
      } else if (l.length === 1) {
        if (!geste.bouge && Math.hypot(p.x - geste.x, p.y - geste.y) < 8) return;
        geste.bouge = true; vc.suivre = false;
        vc.cx -= (p.x - avant.x) / vc.z; vc.cy -= (p.y - avant.y) / vc.z;
      }
      dessinerCarte();
    });
    const fin = (e: PointerEvent) => {
      if (!doigts.delete(e.pointerId)) return;
      if (doigts.size || !geste) return;
      const g0 = geste; geste = null;
      if (g0.bouge || performance.now() - g0.t > 600 || !carte) return;
      toucherCarte(pos(e).x, pos(e).y);
    };
    el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', e => { doigts.delete(e.pointerId); geste = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); vc.z = Math.max(0.03, Math.min(6, vc.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); dessinerCarte(); }, { passive: false });
    el.querySelector('.cb')!.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button')?.dataset.c;
      if (b === 'moi') { vc.suivre = true; vc.z = zoomDepart(); }
      else if (b === 'plus') vc.z = Math.min(6, vc.z * 1.4);
      else if (b === 'moins') vc.z = Math.max(0.03, vc.z / 1.4);
      dessinerCarte();
    });
  }
  const toucherCarte = (sx: number, sy: number) => {
    if (!carte) return;
    if (!relie()) { toast('Lecture seule : lance le jeu en haut'); return; }
    // Zaap (3D) : toucher une destination découverte = voyage ; de loin (« Idées Thor : » 4A), le perso va d'abord au Zaap le plus proche
    {
      let best: CarteBas['zaaps'][number] | null = null, bd = 26;
      for (const z of carte.zaaps) { const [a, b] = versEcran(z.x, z.y), d = Math.hypot(a - sx, b - sy); if (d < bd) { bd = d; best = z; } }
      if (best) {
        if (best.i < 0) toast(`${best.nom} : pas encore découvert`);
        else { ordre({ k: 'zaap', i: best.i }); toast(carte.surZaap ? `Voyage vers ${best.nom}` : `Zaap le plus proche, puis ${best.nom}`); }
        return;
      }
    }
    if (!carte.monde) { toast('Pas de carte du monde ici'); return; }
    const [x, y] = depuisEcran(sx, sy);
    ordre({ k: 'fleche', x, y }); toast('La flèche te guide jusque-là');
  };
  new ResizeObserver(() => dessinerCarte()).observe(vue('carte'));

  // ---------- Sac (4A-4C) ----------
  let vueSac: 'sac' | 'porte' = 'sac', choisi: (ObjetBas & { porte: boolean }) | null = null, ficheHtml = '', sur = '';
  const objetDeSauvegarde = (it: Item): ObjetBas | null => {
    const d = ITEMS.equipment[it.id]; if (!d) return null;
    return { uid: it.uid, icone: d.icon, rar: it.rarity, nom: d.name, niv: d.level, slot: null, cadenas: !!it.cadenas, mieux: false, trop: false, neuf: false };
  };
  const sacVu = (): SacBas | null => {
    if (sac && relie()) return sac;
    const e = sauve?.etat; if (!e) return null;
    const portes: Record<string, ObjetBas> = {};
    for (const [k, it] of Object.entries(e.equipment ?? {})) { const o = it && objetDeSauvegarde(it); if (o) portes[k] = o; }
    return { objets: (e.bag ?? []).map(objetDeSauvegarde).filter((o): o is ObjetBas => !!o), portes, taille: 0, defaire: false };
  };
  const caseObjet = (o: ObjetBas, porte: boolean, empl?: string) => `<div class="ob${o.trop ? ' trop' : ''}${choisi?.uid === o.uid ? ' sel' : ''}" data-u="${o.uid}" data-p="${porte ? 1 : 0}" style="border-color:${RARITY_COLORS[o.rar as keyof typeof RARITY_COLORS] ?? '#333'}">
    <img src="${icone(o.icone)}" alt="" loading="lazy">${o.neuf ? '<i class="neuf"></i>' : ''}${o.mieux && !porte ? '<i class="up">▲</i>' : ''}${o.cadenas ? '<i class="cad">🔒</i>' : ''}${empl ? `<i class="em">${empl}</i>` : ''}</div>`;
  const dessinerSac = () => {
    const s = sacVu(), gr = q('.sac .grille');
    r.querySelectorAll<HTMLElement>('.seg button').forEach(b => b.classList.toggle('on', b.dataset.s === vueSac));
    q('.seg button[data-s="sac"]').textContent = s ? `Sac ${s.objets.length}${s.taille ? `/${s.taille}` : ''}` : 'Sac';
    if (!s) { gr.innerHTML = '<div class="vide" style="grid-column:1/-1">Rien à montrer : lance le jeu en haut.</div>'; return; }
    gr.innerHTML = vueSac === 'sac' ? (s.objets.map(o => caseObjet(o, false)).join('') || '<div class="vide" style="grid-column:1/-1">Sac vide</div>')
      : Object.entries(s.portes).map(([k, o]) => caseObjet(o, true, EMPL[k] ?? k)).join('') || '<div class="vide" style="grid-column:1/-1">Rien de porté</div>';
    // l'objet choisi a changé (équipé, défait…) : sa fiche suit
    if (choisi) {
      const l = choisi.porte ? Object.values(s.portes) : s.objets, o = l.find(x => x.uid === choisi!.uid);
      if (!o) { const ailleurs = (choisi.porte ? s.objets : Object.values(s.portes)).find(x => x.uid === choisi!.uid); choisi = ailleurs ? { ...ailleurs, porte: !choisi.porte } : null; if (choisi) demanderFiche(); else { ficheHtml = ''; } }
      else choisi = { ...o, porte: choisi.porte };
      dessinerFiche();
    }
  };
  const demanderFiche = () => { if (!choisi) return; ficheHtml = ''; sur = ''; if (relie()) ordre({ k: 'fiche', uid: choisi.uid, porte: choisi.porte }); dessinerFiche(); };
  const dessinerFiche = () => {
    const fi = q('.sac .fi'), fb = q('.sac .fb'), o = choisi;
    if (!o) { fi.innerHTML = '<div class="vide" style="margin-top:30px">Touche un objet</div>'; fb.innerHTML = ''; return; }
    fi.innerHTML = ficheHtml && stylesRecus ? `<div class="dw cmp-fiche"><div class="tip">${ficheHtml}</div></div>`
      : `<div style="padding:4px"><b style="color:${RARITY_COLORS[o.rar as keyof typeof RARITY_COLORS]}">${esc(o.nom)}</b><br><small style="color:#a9a48b">niveau ${o.niv}</small>${relie() ? '' : '<p style="color:#8e8a78;font-size:12px">La fiche complète s\'affiche quand le jeu tourne.</p>'}</div>`;
    const s = sacVu(), ok = relie();
    fb.innerHTML = !ok ? '' : o.porte ? '<button class="large" data-b="retirer">Retirer</button>'
      : `<button class="large" data-b="equiper"${o.trop || !o.slot ? ' disabled' : ''}>${o.trop ? `Niveau ${o.niv} requis` : 'Équiper'}</button>
         <button data-b="cadenas">${o.cadenas ? 'Ôter 🔒' : 'Cadenas 🔒'}</button>
         <button data-b="defaire" class="${sur === 'defaire' ? 'dgr' : ''}"${!s?.defaire || o.cadenas ? ' disabled' : ''}>${sur === 'defaire' ? 'Sûr ?' : 'Défaire'}</button>`;
  };
  q('.sac .seg').addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button')?.dataset.s; if (b === 'sac' || b === 'porte') { vueSac = b; dessinerSac(); } });
  q('.sac .grille').addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.ob'); if (!el) return;
    const uid = +el.dataset.u!, porte = el.dataset.p === '1', s = sacVu();
    const o = porte ? Object.values(s?.portes ?? {}).find(x => x.uid === uid) : s?.objets.find(x => x.uid === uid);
    if (!o) return;
    choisi = { ...o, porte };
    r.querySelectorAll('.sac .ob.sel').forEach(x => x.classList.remove('sel')); el.classList.add('sel');
    demanderFiche();
  });
  q('.sac .fb').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button')?.dataset.b, o = choisi; if (!b || !o) return;
    if (b === 'equiper') ordre({ k: 'equiper', uid: o.uid });
    else if (b === 'retirer') { const slot = Object.entries(sacVu()?.portes ?? {}).find(([, x]) => x.uid === o.uid)?.[0]; if (slot) ordre({ k: 'retirer', slot }); }
    else if (b === 'cadenas') ordre({ k: 'cadenas', uid: o.uid });
    else if (b === 'defaire') { if (sur !== 'defaire') { sur = 'defaire'; dessinerFiche(); return; } ordre({ k: 'defaire', uid: o.uid }); choisi = null; ficheHtml = ''; }
    sur = '';
    setTimeout(() => { if (choisi) demanderFiche(); }, 150);
  });

  // ---------- Perso (5A+5B) ----------
  vue('perso').addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a as ActionCompagnon | undefined;
    if (a && relie()) action(a);
  });
  const barre = (v: number, max: number, col: string, txt: string, extra = '') => `<div class="bar"><div style="width:${Math.round(100 * Math.min(1, v / Math.max(1, max)))}%;background:${col}"></div>${extra}<span>${txt}</span></div>`;
  let persoCle = '';
  // « Idées Thor : » 1A+1B : vue Combat, ouverte toute seule au premier coup, refermée 5 s après le combat
  const combatAuto = { on: false, avant: 'perso', finT: 0, refus: false };
  const suivreCombat = () => {
    const en = !!(relie() && etat?.combat?.en), t = performance.now();
    if (en) combatAuto.finT = t;
    if (en && !combatAuto.on && !combatAuto.refus && !miroir.ouverte && onglet !== 'combat') {
      combatAuto.on = true; combatAuto.avant = onglet === 'liens' ? 'perso' : onglet; montrerOnglet('combat'); reveiller();
    } else if (!en && t - combatAuto.finT > 5000) {
      combatAuto.refus = false;
      if (combatAuto.on) { combatAuto.on = false; if (onglet === 'combat') montrerOnglet(combatAuto.avant); }
    }
  };
  let combatCle = '';
  const htmlRaccourcis = (e: EtatBas) => (e.raccourcis ?? []).map(r => `<button data-rac="${esc(r.id)}">${r.icone >= 0 ? `<img src="${icone(r.icone)}" alt="">` : `<b>${r.icone === -1 ? '🎒' : '🌀'}</b>`}${esc(r.nom)}${r.n ? ` (${r.n})` : ''}</button>`).join('');
  const htmlGroupe = (e: EtatBas) => (e.groupe ?? []).map(a => `<button data-allie="${a.id}">${esc(a.nom)}<small>${esc(a.classe)} niv. ${a.niveau}</small>${barre(a.pv, a.pvMax, '#3fae4a', '')}</button>`).join('');
  const dessinerCombat = () => {
    const el = vue('combat'), e = relie() && etat ? etat : null, c = e?.combat;
    if (!e || !c) { el.innerHTML = '<div class="vide">La vue Combat s\'ouvre toute seule au premier coup.</div>'; combatCle = ''; return; }
    if (combatCle !== 'ok') {
      combatCle = 'ok';
      el.innerHTML = `<div class="cbt"><div><div class="pv"></div><div class="ligne"></div><div class="ci2"></div></div><div><canvas width="256" height="256"></canvas><div class="rd"></div></div></div>
        <div class="sorts"></div><div class="rac"></div><div class="grp"></div>`;
    }
    const p = e.perso;
    el.querySelector('.pv')!.innerHTML = barre(p.pv, p.pvMax, 'linear-gradient(#ff6a5a,#c8332a)', `PV ${p.pv} / ${p.pvMax}${p.bouclier ? `  +${p.bouclier}` : ''}`);
    el.querySelector('.ligne')!.innerHTML = barre(p.pa, p.paMax, '#2f8fd8', `PA ${p.pa}`) + barre(p.pm, p.pmMax, '#3fae4a', `PM ${p.pm}`)
      + (p.jauge ? barre(p.jauge.v, p.jauge.max, '#e0702a', `${p.jauge.nom} ${p.jauge.v}`) : `<div class="bar"><span>Potions ${p.potions}</span></div>`);
    const ci = el.querySelector<HTMLElement>('.ci2')!, cb = c.cible;
    ci.className = `ci2${cb ? ` r${cb.rang}` : ''}`;
    ci.innerHTML = cb ? `<b>${esc(cb.nom)}</b><small>${cb.rang === 2 ? 'Boss · ' : cb.rang === 1 ? 'Élite · ' : ''}niv. ${cb.niveau}${cb.info ? ` · ${esc(cb.info)}` : ''} · ${cb.pv} / ${cb.pvMax} PV</small>${barre(cb.pv, cb.pvMax, '#e8665a', '')}`
      : '<small>Pas de cible : vise un monstre (auto-visée ou stick droit).</small>';
    el.querySelector('.sorts')!.innerHTML = e.sorts.map(s => `<div class="so"><img src="assets/ui/sorts/sort_${s.icone}.png" alt="">${s.t > 0 ? `<div class="cd" style="height:${Math.round(s.frac * 100)}%"></div><b>${s.t >= 1 ? Math.ceil(s.t) : s.t.toFixed(1).replace('.', ',')}</b>` : ''}${s.charges != null ? `<i>${s.charges}</i>` : ''}</div>`).join('');
    const rh = htmlRaccourcis(e), gh = htmlGroupe(e), rac = el.querySelector<HTMLElement>('.rac')!, grp = el.querySelector<HTMLElement>('.grp')!;
    if (rac.dataset.h !== rh) { rac.dataset.h = rh; rac.innerHTML = rh; }
    if (grp.dataset.h !== gh) { grp.dataset.h = gh; grp.innerHTML = gh; }
    // 1B : radar, 14 cases autour (rouge : monstre, orange : élite, violet : boss)
    const cv2 = el.querySelector('canvas')!, g = cv2.getContext('2d')!, R = 128, k = R / 15;
    g.clearRect(0, 0, 256, 256);
    g.strokeStyle = '#2a3a2a'; g.lineWidth = 1; for (const rr of [5, 10]) { g.beginPath(); g.arc(R, R, rr * k, 0, Math.PI * 2); g.stroke(); }
    let n = 0, el2 = 0;
    for (const [x, y, t] of c.radar) {
      const a = R + x * k, b = R + y * k; if (Math.hypot(a - R, b - R) > R - 4) continue;
      n++; if (t) el2++;
      g.beginPath(); g.arc(a, b, t === 2 ? 9 : t === 1 ? 7 : 5, 0, Math.PI * 2); g.fillStyle = t === 2 ? '#c04dff' : t === 1 ? '#ff9a3c' : '#ff4d4d'; g.fill();
    }
    g.beginPath(); g.arc(R, R, 6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    el.querySelector('.rd')!.textContent = n ? `${n} monstre${n > 1 ? 's' : ''} autour${el2 ? `, ${el2} élite${el2 > 1 ? 's' : ''} ou boss` : ''}` : 'Personne autour';
  };
  // 2A raccourcis, 5A groupe : dans la vue Combat et dans Perso
  r.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-rac],button[data-allie]'); if (!b) return;
    if (!relie()) { toast('Lecture seule : lance le jeu en haut'); return; }
    if (b.dataset.rac) { ordre({ k: 'raccourci', id: b.dataset.rac }); toast(b.textContent ?? ''); }
    else ordre({ k: 'allie', id: +b.dataset.allie! });
  });
  // ---------- « Confort 2 : » 7A volumes, 2A toujours allumé, 2B plein écran, 6C s'assombrit ----------
  const pref = (k: string, d: boolean) => { try { const x = localStorage.getItem(`diablofus.bas.${k}`); return x == null ? d : x === '1'; } catch { return d; } };
  const ecrire = (k: string, on: boolean) => { try { localStorage.setItem(`diablofus.bas.${k}`, on ? '1' : '0'); } catch { /* rien */ } };
  const natif = appliNative();
  const reg = document.createElement('div'); reg.className = 'reg';
  reg.innerHTML = `<label class="son">Musique<input type="range" min="0" max="100" data-vol="musique"><output></output></label>
    <label class="son">Effets<input type="range" min="0" max="100" data-vol="effets"><output></output></label>
    <div class="sw">${natif ? '' : '<button data-sw="plein">⛶ Plein écran</button>'}<button data-sw="allume">☀ Toujours allumé</button><button data-sw="sombre">🌙 S'assombrit</button><button data-sw="muet" class="son">🔇 Muet</button></div>`;
  let volTouche = 0, volT = 0;
  const majReg = (e: EtatBas | null) => {
    const so = e?.son;
    reg.querySelectorAll<HTMLElement>('.son').forEach(x => { x.style.display = so ? '' : 'none'; });
    if (so && performance.now() - volTouche > 1500) for (const k of ['musique', 'effets'] as const) {
      const i = reg.querySelector<HTMLInputElement>(`[data-vol="${k}"]`)!, n = Math.round(so[k] * 100);
      if (+i.value !== n) i.value = String(n);
      i.nextElementSibling!.textContent = `${n} %`;
    }
    reg.querySelector('[data-sw="muet"]')?.classList.toggle('on', !!so?.muet);
    reg.querySelector('[data-sw="plein"]')?.classList.toggle('on', !!document.fullscreenElement);
    reg.querySelector('[data-sw="allume"]')!.classList.toggle('on', pref('allume', true));
    reg.querySelector('[data-sw="sombre"]')!.classList.toggle('on', pref('sombre', true));
  };
  reg.addEventListener('input', ev => {
    const i = (ev.target as HTMLElement).closest<HTMLInputElement>('[data-vol]'); if (!i) return;
    volTouche = performance.now(); i.nextElementSibling!.textContent = `${i.value} %`;
    clearTimeout(volT); volT = window.setTimeout(() => ordre({ k: 'volume', [i.dataset.vol!]: +i.value / 100 }), 120);
  });
  reg.addEventListener('click', ev => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-sw]')?.dataset.sw; if (!b) return;
    if (b === 'muet') { ordre({ k: 'volume', muet: !etat?.son?.muet }); return; }
    if (b === 'plein') {
      const on = !document.fullscreenElement; ecrire('plein', on);
      void (on ? document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }) : document.exitFullscreen?.())?.catch(() => toast('Plein écran refusé par Chrome'));
    }
    if (b === 'allume') { const on = !pref('allume', true); ecrire('allume', on); garderEcranAllume(on); toast(on ? 'L\'écran du bas reste allumé' : 'L\'écran du bas peut s\'éteindre'); }
    if (b === 'sombre') { const on = !pref('sombre', true); ecrire('sombre', on); reveiller(); toast(on ? 'Sans toucher pendant 30 s, l\'écran s\'assombrit' : 'L\'écran ne s\'assombrit plus'); }
    majReg(relie() ? etat : null);
  });
  garderEcranAllume(pref('allume', true));
  // 2B : plein écran gardé : Chrome le quitte (retour, appli changée) ; le prochain toucher le remet
  if (!natif) addEventListener('click', () => { if (pref('plein', false) && !document.fullscreenElement) void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {}); }, true);
  // 6C : 30 s sans toucher, l'écran s'assombrit ; un toucher le rallume (ce toucher-là ne fait rien d'autre)
  const sombre = document.createElement('div'); sombre.id = 'cmp-sombre'; document.body.appendChild(sombre);
  let dernierToucher = performance.now();
  const reveiller = () => { dernierToucher = performance.now(); if (sombre.classList.contains('on')) { sombre.classList.remove('on'); natif?.luminosite?.(-1); } };
  sombre.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); reveiller(); });
  addEventListener('pointerdown', () => { dernierToucher = performance.now(); }, true);
  setInterval(() => {
    if (!pref('sombre', true) || sombre.classList.contains('on') || performance.now() - dernierToucher < 30_000) return;
    sombre.classList.add('on'); natif?.luminosite?.(0.08);
  }, 1000);

  const dessinerPerso = () => {
    const el = vue('perso'), e = relie() && etat ? etat : null, sv = sauve;
    if (!e && !sv) { if (persoCle !== 'rien') { persoCle = 'rien'; el.innerHTML = '<div class="vide">Aucun perso : lance le jeu en haut et entre en jeu.</div>'; el.appendChild(reg); } majReg(null); return; }
    const classeId = e?.perso.classeId ?? sv?.classe ?? 'iop';
    const cle = e ? 'direct' : 'sauve';
    if (cle !== persoCle) {
      persoCle = cle;
      el.innerHTML = `<div class="ph"><img alt=""><div style="flex:1;min-width:0"><div class="nm"></div><small class="cl"></small><div class="bar xp"><div style="background:#d3f46f"></div></div></div><div class="kam"></div></div>
        <div class="pv"></div><div class="ligne"></div><div class="sorts"></div><div class="effets"></div><div class="rac"></div><div class="grp"></div>
        <div class="acts">${e ? '<button data-a="potion" class="pot">Potion</button><button data-a="sorts">Sorts</button><button data-a="car">Caracs</button><button data-a="job">Métiers</button><button data-a="succes">Succès</button>' : ''}</div>`;
      el.appendChild(reg);
    }
    majReg(e);
    const im = el.querySelector<HTMLImageElement>('.ph img')!, src = `assets/accueil/c_${classeId}.png`;
    if (!im.src.endsWith(src)) im.src = src;
    if (!e) {
      const st = sv!.etat;
      el.querySelector('.nm')!.textContent = sv!.nom;
      el.querySelector('.cl')!.textContent = `${sv!.classe} niv. ${st?.level ?? '?'} · ${sv!.lieu}`;
      el.querySelector('.kam')!.innerHTML = st ? `${st.kamas.toLocaleString('fr-FR')} kamas<br>${st.potions} potions` : '';
      el.querySelector('.pv')!.innerHTML = '<p style="color:#8e8a78;font-size:12.5px">PV, sorts et effets s\'affichent quand le jeu tourne en haut.</p>';
      return;
    }
    const p = e.perso;
    el.querySelector('.nm')!.textContent = p.nom;
    el.querySelector('.cl')!.textContent = `${p.classe} niv. ${p.niveau} · ${p.lieu}`;
    el.querySelector<HTMLElement>('.xp div')!.style.width = `${Math.round(p.xp * 100)}%`;
    el.querySelector('.kam')!.innerHTML = `${p.kamas.toLocaleString('fr-FR')} kamas`;
    el.querySelector('.pv')!.innerHTML = barre(p.pv, p.pvMax, 'linear-gradient(#ff6a5a,#c8332a)', `PV ${p.pv} / ${p.pvMax}${p.bouclier ? `  +${p.bouclier}` : ''}`,
      p.bouclier ? `<div style="width:${Math.round(100 * Math.min(1, p.bouclier / Math.max(1, p.pvMax)))}%;background:#a46cff99;height:4px;top:auto"></div>` : '');
    el.querySelector('.ligne')!.innerHTML = barre(p.pa, p.paMax, '#2f8fd8', `PA ${p.pa} / ${p.paMax}`) + barre(p.pm, p.pmMax, '#3fae4a', `PM ${p.pm} / ${p.pmMax}`)
      + (p.jauge ? barre(p.jauge.v, p.jauge.max, '#e0702a', `${p.jauge.nom} ${p.jauge.v}`) : '<div></div>');
    el.querySelector('.sorts')!.innerHTML = e.sorts.map(s => `<div class="so"><img src="assets/ui/sorts/sort_${s.icone}.png" alt="">${s.t > 0 ? `<div class="cd" style="height:${Math.round(s.frac * 100)}%"></div><b>${s.t >= 1 ? Math.ceil(s.t) : s.t.toFixed(1).replace('.', ',')}</b>` : ''}${s.charges != null ? `<i>${s.charges}</i>` : ''}</div>`).join('');
    el.querySelector('.effets')!.innerHTML = e.effets.map(f => `<span class="ef ${f.sorte}">${esc(f.nom)}${f.t >= 0 ? ` ${f.t} s` : ''}</span>`).join('') || '<span style="color:#55606a;font-size:12px">Aucun effet actif</span>';
    const pot = el.querySelector<HTMLButtonElement>('.pot'); if (pot) { pot.textContent = `Potion (${p.potions})`; pot.disabled = !p.potions; }
    const rh = htmlRaccourcis(e), gh = htmlGroupe(e), rac = el.querySelector<HTMLElement>('.rac'), grp = el.querySelector<HTMLElement>('.grp');
    if (rac && rac.dataset.h !== rh) { rac.dataset.h = rh; rac.innerHTML = rh; }
    if (grp && grp.dataset.h !== gh) { grp.dataset.h = gh; grp.innerHTML = gh; }
  };

  // ---------- Quêtes + groupe (6A+6B) ----------
  const dessinerQuetes = () => {
    const el = vue('quetes'), Q = relie() ? quetes : null;
    if (!Q) { el.innerHTML = '<div class="vide">Les quêtes s\'affichent quand le jeu tourne en haut.</div>'; return; }
    const haut = el.scrollTop;
    el.innerHTML = (Q.groupe.length ? `<h3>GROUPE</h3>${Q.groupe.map(g => `<div class="gp"><span>${esc(g.nom)} <small style="color:#8e8a78">${esc(g.classe)} ${g.niveau}</small></span>${barre(g.pv, g.pvMax, 'linear-gradient(#ff6a5a,#c8332a)', `${g.pv} / ${g.pvMax}`)}</div>`).join('')}` : '')
      + `<h3>QUÊTES</h3>${Q.quetes.map(x => `<div class="q${x.suivie ? ' suivie' : ''}${x.campagne ? ' campagne' : ''}">${x.suivie ? '<span class="tag">SUIVIE</span>' : ''}<b>${esc(x.nom)}</b>${x.lignes.map(l => `<div>${esc(l)}</div>`).join('')}</div>`).join('') || '<div class="vide" style="margin-top:10px">Aucune quête en cours</div>'}`
      + (Q.succes.length ? `<h3>SUCCÈS ÉPINGLÉS</h3>${Q.succes.map(x => `<div class="q"><div style="margin:0">${esc(x)}</div></div>`).join('')}` : '');
    el.scrollTop = haut;
  };

  // ---------- Liens (diagnostic) ----------
  vue('liens').addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.d; if (!a) return;
    if (a === 'retour') montrerOnglet(ONGLETS.some(o => o[0] === localStorage.getItem(CLE_ONGLET)) ? localStorage.getItem(CLE_ONGLET)! : 'perso');
    else if (a === 'ping') { const n = ++nPing; pings.set(n, performance.now()); c.envoyer({ k: 'ping', n, t: Date.now() }); noter('Coucou envoyé'); }
    else if (a === 'rapport') void copierRapport();
    else if (a === 'texture') {
      const oui = !uneTexture();
      try { if (oui) localStorage.setItem(CLE_UNE_TEXTURE, '1'); else localStorage.removeItem(CLE_UNE_TEXTURE); } catch { /* rien */ }
      action('recharger'); noter(oui ? 'Essai carrés noirs : ON, le jeu redémarre' : 'Essai carrés noirs : OFF, le jeu redémarre'); majEssai();
    }
  });
  const majEssai = () => { q('button[data-d="texture"]').textContent = `Essai carrés noirs : ${uneTexture() ? 'ON' : 'OFF'}`; };
  majEssai();
  const age = (t: number) => { const s = (performance.now() - t) / 1000; return s < 2 ? 'à l\'instant' : s < 60 ? `il y a ${Math.round(s)} s` : `il y a ${Math.round(s / 60)} min`; };
  const dessinerLiens = () => {
    const t = performance.now();
    for (const k of Object.keys(NOMS)) {
      const el = q(`.lien[data-l="${k}"]`), d = t - vu[k], fen = k === 'serveur' ? 40000 : k === 'sauvegarde' ? 8000 : 3000;
      el.className = `lien${vu[k] && d < fen ? ' ok' : vu[k] ? ' lent' : ''}`;
      el.querySelector('span')!.textContent = [vu[k] ? age(vu[k]) : 'jamais', detail[k]].filter(Boolean).join(' · ');
    }
  };
  const copierRapport = async () => {
    const t = performance.now();
    const txt = ['Diablofus, écran du bas', `Écran : ${innerWidth}×${innerHeight} px CSS, densité ${devicePixelRatio}`,
      `Appli installée : ${matchMedia('(display-mode: standalone)').matches ? 'oui' : 'non (onglet Chrome)'}`,
      ...Object.keys(NOMS).map(k => `${NOMS[k]} : ${vu[k] ? `${t - vu[k] < 5000 ? 'OK' : 'plus de nouvelles'} (${age(vu[k])})` : 'jamais'}${detail[k] ? `, ${detail[k]}` : ''}`),
      `Coucou aller-retour : ${dernierPing || 'pas essayé'}`, ...(diag ? texteDiag(diag) : ['Carte graphique : pas de nouvelles du jeu']), navigator.userAgent,
      ...(natif?.journal ? ['', 'Journal de l\'appli Thor :', natif.journal()] : [])].join('\n');
    try { await navigator.clipboard.writeText(txt); noter('Rapport copié : colle-le dans le fil'); } catch { noter('Copie impossible : rapport ci-dessous'); q('.journal').textContent = txt; }
  };

  // Confort Thor 1E : tout près d'un PNJ, d'un Zaap, d'un objet… le bouton apparaît en bas, à toucher au doigt
  q('.ctx').addEventListener('click', () => { if (relie()) ordre({ k: 'interagir' }); });

  // ---------- boucle d'affichage ----------
  let sacLu = false;
  function dessiner() {
    const t = performance.now(), ok = relie(), pt = q('nav .pt');
    pt.className = `pt${ok ? ' ok' : enJeu ? ' lent' : ''}`;
    const ro = q('.ro'), lectureSeule = !ok && t - debut > 4000 && onglet !== 'liens';
    ro.hidden = !lectureSeule;
    if (lectureSeule) ro.textContent = sauve ? `Lecture seule : d'après la sauvegarde de ${new Date(sauve.maj).toLocaleTimeString('fr-FR')}. Lance le jeu en haut pour tout piloter.` : 'Lance le jeu sur l\'écran du haut et entre en jeu : cette page le trouve toute seule.';
    if (!ok && miroir.ouverte) { miroir.montrer(null); q('.fen').hidden = true; }
    const ctx = q<HTMLButtonElement>('.ctx'), inter = ok && !miroir.ouverte && onglet !== 'carte' && onglet !== 'tchat' ? etat?.inter : null;
    ctx.hidden = !inter; if (inter && ctx.textContent !== inter) ctx.textContent = inter;
    suivreCombat();
    if (onglet === 'combat') dessinerCombat();
    if (onglet === 'perso') dessinerPerso();
    else if (onglet === 'liens') dessinerLiens();
    else if (onglet === 'sac' && (!sacLu || !ok)) { sacLu = true; dessinerSac(); }
    else if (onglet === 'quetes' && !ok) dessinerQuetes();
    else if (onglet === 'carte' && !ok) dessinerCarte();
    else if (onglet === 'tchat') { const f = q<HTMLFormElement>('.vue.tchat .te'), cache = vueT !== 'tchat' || !tchatEnLigne || !ok; if (f.hidden !== cache) f.hidden = cache; }
    if (etat && t - etatT > 3000) etat = null;
  }
  setInterval(dessiner, 250);
  // « Idées Thor : » 8B : batterie de la console (c'est le même appareil) et images par seconde du jeu, en haut du diagnostic
  type Batterie = { level: number; charging: boolean };
  let bat: Batterie | null = null;
  (navigator as unknown as { getBattery?: () => Promise<Batterie> }).getBattery?.().then(b => { bat = b; }).catch(() => {});
  setInterval(() => {
    const el = q('.vue[data-v="liens"] .bat'); if (onglet !== 'liens') return;
    const fps = relie() && etat?.fps ? `${etat.fps} images/s` : 'jeu non relié';
    el.textContent = `${bat ? `Batterie ${Math.round(bat.level * 100)} %${bat.charging ? ' (en charge)' : ''}` : 'Batterie : inconnue'} · ${fps}`;
  }, 1000);
  montrerOnglet(onglet);
}
