// Accueil sur la Thor (maquette « Accueil Thor : 1A 2A 3A 4A 5A 6A 7A+7B 8A », 2026-11-17) : en mode console, l'accueil
// n'est plus la page du PC rétrécie. Onglets en haut (LB / RB), création en trois étapes à la manette (une classe à la fois,
// l'apparence ligne par ligne, le nom avec un nom au hasard), fiche de la classe sur l'écran du bas, pages à la taille de
// l'écran (854 x 480 px CSS) et une barre d'aide des boutons. Le PC ne change pas. Ce fichier : le style et les petits outils ;
// les pages sont dans accueil.ts (elles ont besoin de ses données).

/** Hauteur de la barre d'onglets et de la barre d'aide (px CSS). */
export const HAUT_ONGLETS = 40, HAUT_AIDE = 30;

export const CSS_THOR = `
#acc .kthor{display:none}
#acc.thor .kthor{display:inline-grid;place-items:center;font:700 11px ui-monospace,Menlo,monospace;color:#ffc14d;border:1px solid #5a5236;border-radius:5px;padding:1px 5px}
#acc.thor .side{right:0;bottom:auto;width:auto;height:${HAUT_ONGLETS}px;flex-direction:row;justify-content:center;align-items:stretch;padding:0 120px 0 48px;gap:2px;border-right:0;border-bottom:1px solid #2c2f1f}
#acc.thor .side .logo{position:absolute;left:10px;top:5px;width:28px;margin:0}
#acc.thor .side .kthor{align-self:center;margin:0 6px}
#acc.thor .nav{width:auto;display:flex;align-items:center;gap:5px;padding:0 9px;font-size:13px;border-left:0;border-bottom:3px solid transparent}
#acc.thor .nav img{height:20px;width:22px}
#acc.thor .nav.on img{transform:none}
#acc.thor .nav.on{border-bottom-color:var(--lime)}
#acc.thor .nav .pastille{font-size:8px;top:2px;right:0;padding:0 3px}
#acc.thor .side .play{position:absolute;right:10px;top:6px;margin:0;font-size:15px;padding:4px 14px}
#acc.thor .side .ver{display:none}
#acc.thor .pg{position:absolute;top:${HAUT_ONGLETS}px;bottom:${HAUT_AIDE}px;left:0;right:0;container-type:size;overflow:hidden}
#acc.thor .pg.pc{left:-48px}
#acc.thor .pg[data-p=journal],#acc.thor .pg[data-p=bestiaire]{--u:11px}
#acc.thor .pg[data-p=journal] .jr .in{width:auto;max-width:760px;padding:20px 24px 40px}
#acc.thor .pg[data-p=journal] .grille{grid-template-columns:1fr}
#acc.thor .pg[data-p=journal] .une{grid-template-columns:1fr}
#acc.thor .lad .lad-hero{height:120px}
#acc.thor .lad .lad-tx h1{font-size:34px}
#acc.thor .lad .lad-corps{grid-template-columns:1fr}
#acc.thor .lad .lad-ong button{padding:8px 12px;font-size:14px}
#acc.thor .lad .lad-t{font-size:14px}
#acc.thor .lad .lad-t th{font-size:12px}
#acc.thor .lad .lad-titre h2{font-size:22px}
#acc.thor .aideT{position:absolute;left:0;right:0;bottom:0;height:${HAUT_AIDE}px;display:flex;align-items:center;justify-content:center;gap:22px;background:#0d0f14f0;border-top:1px solid #2c3242;font:500 13px Lexend,Nunito,system-ui,sans-serif;color:#cfc8b0;z-index:6;white-space:nowrap}
#acc.thor .aideT span{display:flex;align-items:center;gap:6px}
#acc.thor .aideT em{font:700 11px ui-monospace,Menlo,monospace;font-style:normal;color:#fff;border-radius:50%;display:inline-grid;place-items:center;width:19px;height:19px}
#acc.thor .aideT em.l{border-radius:5px;width:auto;padding:0 5px;background:#3a4152}
#acc.thor .aideT .ea{background:#5fc25a}#acc.thor .aideT .ex{background:#4f8cff}#acc.thor .aideT .ey{background:#d6b02a}#acc.thor .aideT .eb{background:#e8665a}
/* --- Création en trois étapes --- */
#acc .tc{position:absolute;inset:0;font-family:Lexend,Nunito,system-ui,sans-serif}
#acc .tc .fond{position:absolute;inset:0;background-size:cover;background-position:center;filter:brightness(.5) saturate(.9)}
#acc .tc .voile{position:absolute;inset:0;background:linear-gradient(90deg,#0d0e09e8 0%,#0d0e09a0 34%,transparent 52%,#0d0e0990 78%,#0d0e09d8 100%)}
#acc .tc .etapes{position:absolute;left:20px;top:10px;display:flex;gap:14px;font-size:13px;font-weight:700;color:#8e8a78}
#acc .tc .etapes b{color:#ffc14d}
#acc .tc .info{position:absolute;left:20px;top:34px;width:280px;display:grid;gap:5px}
#acc .tc .info h2{margin:0;font-family:var(--disp);font-weight:400;font-size:46px;line-height:1;color:var(--lime);-webkit-text-stroke:2px #1f2a08;paint-order:stroke fill;text-shadow:0 3px 0 #1f2a08}
#acc .tc .info .role{font-size:14px;font-weight:700;color:#ffc14d}
#acc .tc .info p{margin:0;font-size:13px;line-height:1.4;color:#ece6d0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
#acc .tc .info .jauge{display:grid;grid-template-columns:96px 1fr;align-items:center;gap:8px;font-size:12px;line-height:1.2;font-weight:700}
#acc .tc .info .jauge .bar{height:7px}
#acc .tc .info .bientot{font-family:var(--disp);font-size:20px;color:#e0925a}
#acc .tc .hero.vu,#acc .ta .hero.vu{animation:none}
#acc .tc .app .mini{padding:2px 8px;font-size:12px}
#acc .tc .socleT{position:absolute;left:50%;bottom:78px;width:190px;transform:translateX(-50%);filter:sepia(.55) saturate(1.3) brightness(.95) drop-shadow(0 0 10px #8fe8ff99)}
#acc .tc canvas.vivant,#acc .tc .hero{left:calc(50% - 80px);bottom:92px;top:auto;width:254px;height:218px}
#acc .tc .teteGrande{position:absolute;left:50%;bottom:120px;width:120px;transform:translateX(-50%);filter:drop-shadow(0 6px 10px #000)}
#acc .tc .fle{all:unset;position:absolute;top:150px;font:400 44px var(--disp);color:#ffffffcc;text-shadow:0 2px 6px #000;cursor:pointer}
#acc .tc .carr{position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;align-items:flex-end;gap:5px}
#acc .tc .carr button{all:unset;cursor:pointer;width:30px;opacity:.55;border-radius:6px;display:grid;justify-items:center}
#acc .tc .carr button img{width:100%}
#acc .tc .carr button.dim img{filter:grayscale(1) brightness(.7)}
#acc .tc .carr button.on{width:48px;opacity:1;outline:3px solid var(--lime);outline-offset:1px;background:#2a2c1f}
#acc .tc .app{position:absolute;right:20px;top:40px;width:330px;display:grid;gap:8px}
#acc .tc .app .l{display:grid;grid-template-columns:84px 1fr;align-items:center;gap:8px;background:#191c24ee;border:1px solid #343a4a;border-radius:9px;padding:9px 12px;font-size:15px;font-weight:700;color:#cfc8b0;cursor:pointer}
#acc .tc .app .l.cur{border-color:var(--lime);box-shadow:0 0 0 3px #b9e54b44}
#acc .tc .app .v{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#fff}
#acc .tc .app .v i{font-style:normal;color:#ffc14d}
#acc .tc .app .sw{display:flex;gap:4px}
#acc .tc .app .sw u{width:22px;height:22px;border-radius:5px;display:block;border:1px solid #0006}
#acc .tc .app .tetev{width:34px;height:34px;border-radius:6px;background-repeat:no-repeat;background-color:#2a2b1f}
#acc .tc .app .nomPal{font-size:13px;color:#cfc8b0;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#acc .tc .nomF{position:absolute;right:20px;top:40px;width:340px;display:grid;gap:10px;background:#191c24ee;border:1px solid #343a4a;border-radius:10px;padding:14px 16px}
#acc .tc .nomF .lab{font-size:13px;margin:0}
#acc .tc .nomF input.field{font-size:18px;padding:8px 10px}
#acc .tc .nomF .err{font-size:13px;margin:0}
#acc .tc .nomF .check{font-size:14px;margin:0}
#acc .tc .nomF .check input{width:18px;height:18px}
#acc .tc .nomF .lbtn{font-size:18px;padding:9px;text-align:center}
#acc .tc .nomF .dbtn{font-size:14px;padding:7px 10px}
#acc .tc .nomF .ligne{display:flex;gap:8px}
#acc .tc .nomF .ligne>*{flex:1}
/* --- Accueil allégé et Mes personnages --- */
#acc .ta{position:absolute;inset:0;font-family:Lexend,Nunito,system-ui,sans-serif}
#acc .ta .voile{position:absolute;inset:0;background:linear-gradient(90deg,#0d0e09f2 0%,#0d0e09d8 45%,#0d0e0960 75%,transparent 100%)}
#acc .ta .col{position:absolute;left:24px;top:14px;bottom:14px;width:430px;display:flex;flex-direction:column;gap:10px}
#acc .ta .logoT{width:210px;height:auto;filter:drop-shadow(0 4px 10px #000b)}
#acc .ta .vivantC{padding:8px 12px}
#acc .ta .vivantC b{font-size:17px}
#acc .ta .vivantC .l2,#acc .ta .vivantC .inv,#acc .ta .vivantC .tiny{font-size:12px}
#acc .ta .vivantC .cpt{font-size:16px}
#acc .ta .vivantC>img{width:26px;height:26px}
#acc .ta .nouvT{font-size:13px;font-weight:700;color:#d7ecb0;line-height:1.45;text-shadow:0 1px 2px #000}
#acc .ta .nouvT span{background:#3c5a12;color:#e6fa9c;border-radius:9px;padding:0 7px;margin-right:6px}
#acc .ta .carteT{margin-top:auto;display:grid;grid-template-columns:64px 1fr;gap:4px 12px;align-items:center;background:#1b1c13f0;border:1px solid #4c4b3a;border-radius:10px;padding:12px 14px}
#acc .ta .carteT .tete{width:64px;height:64px;border-radius:50%;background:#2a2c1f;border:2px solid var(--lime);object-fit:contain;grid-row:span 3}
#acc .ta .carteT .nom{font-family:var(--disp);font-size:22px;color:#f6f1dc;line-height:1.1}
#acc .ta .carteT .nom em{font:800 13px Nunito,system-ui,sans-serif;font-style:normal;color:#c9c4ab;margin-left:6px}
#acc .ta .carteT .det{font-size:13px;color:#c9c4ab;font-weight:600}
#acc .ta .carteT .xp{height:6px;border-radius:9px;background:#33342a;overflow:hidden}
#acc .ta .carteT .xp i{display:block;height:100%;background:linear-gradient(90deg,#9ccd2c,#d3f46f)}
#acc .ta .actT{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#acc .ta .actT .lbtn{font-size:20px;padding:9px 26px}
#acc .ta .actT .dbtn{font-size:14px;padding:8px 12px}
#acc .ta .carteT .actT{flex-wrap:nowrap;gap:8px}
#acc .ta .carteT .actT .lbtn{font-size:18px;padding:8px 18px}
#acc .ta .slotsT{position:absolute;left:24px;top:16px;width:330px;display:grid;gap:8px;--u:13px}
#acc .ta .slotsT .slot{grid-template-columns:52px 1fr;gap:12px;padding:8px 12px;border-radius:9px}
#acc .ta .slotsT .slot b{font-size:19px}
#acc .ta .slotsT .slot span{font-size:13px}
#acc .ta .slotsT .slot .tiny{font-size:12px}
#acc .ta .slotsT .slot .plus{width:52px;height:52px;border-radius:50%;border:2px dashed #6d6c54;display:grid;place-items:center;font-family:var(--disp);font-size:26px}
#acc .ta .choixT{position:absolute;left:380px;right:20px;top:10px;bottom:10px}
#acc .ta .choixT .ttl{position:absolute;left:0;right:0;top:4px;text-align:center;font-size:36px}
#acc .ta .choixT .sous{position:absolute;left:0;right:0;top:48px;text-align:center;font-size:14px;font-weight:800}
#acc .ta .choixT canvas.vivant,#acc .ta .choixT .hero{left:calc(50% - 70px);top:70px;width:166px;height:225px}
#acc .ta .choixT .socleT{position:absolute;left:50%;top:262px;width:170px;transform:translateX(-50%);filter:sepia(.55) saturate(1.3) brightness(.95) drop-shadow(0 0 10px #8fe8ff99)}
#acc .ta .choixT .actT{position:absolute;left:0;right:0;bottom:4px;justify-content:center}
`;

/** Syllabes des noms au hasard (5A) : des noms qui sonnent Monde des Douze, 5 à 11 lettres. */
const DEBUTS = ['Ar', 'Bra', 'Cal', 'Dra', 'El', 'Fa', 'Gor', 'Ka', 'Lu', 'Mor', 'Na', 'Or', 'Pa', 'Ri', 'Sa', 'Tho', 'Ul', 'Va', 'Xa', 'Zé', 'Bou', 'Gri', 'Kro', 'Mé', 'Ty'];
const MILIEUX = ['ra', 'li', 'ka', 'mo', 'na', 'rel', 'zu', 'ga', 'do', 'vi', 'lo', 'ne', 'ta', 'bi', 'rou'];
const FINS = ['k', 'n', 'x', 'th', 'ra', 'ia', 'or', 'us', 'el', 'is', 'an', 'ok', 'ine', 'ar', 'ou'];
export function nomAuHasard(hasard: () => number = Math.random): string {
  const p = <T>(l: T[]) => l[Math.floor(hasard() * l.length)];
  const n = p(DEBUTS) + (hasard() < 0.7 ? p(MILIEUX) : '') + p(FINS);
  return n.length > 11 ? n.slice(0, 11) : n;
}

/** Fiche de la classe envoyée à l'écran du bas (6A). */
export interface ClasseBas { nom: string; titre: string; desc: string; roles: [string, number][]; complexite: number; jouable: boolean; note: string; sorts: { nom: string; icone: number; niveau: number; texte: string }[] }
export interface AccueilBas { page: string; etape: number; classe: ClasseBas | null }
