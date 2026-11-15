import { DOFUS } from '../sim/dofus';
import type { Coffre } from '../sim/coffre';
import { MES_PALETTES_MAX, PALETTES_PERSO, PALETTE_PAR_ID, codeCouleurs, commentOuvrir, lireCodeCouleurs, paletteAuHasard, paletteOuverte } from '../sim/palettes';

/** Panneau des palettes (maquette « Palettes : » 1A 4A-4D 6A), commun à la création de perso et à la garde-robe :
 *  un onglet par famille + « Mes palettes », teints de peau, bouton dé, code couleur à copier et à coller. */
export interface CtxPalettes {
  /** Les 6 couleurs en cours (peau, cheveux, tenue 1 à 4). */
  couleurs: () => number[];
  /** Pose 6 couleurs et redessine l'écran. */
  poser: (c: number[]) => void;
  /** Palettes achetées et mélanges du compte. */
  coffre: () => Pick<Coffre, 'palettes' | 'mesPalettes'>;
  /** Dofus trouvés par les persos du compte (ouvrent les palettes Dofus). */
  dofus: () => Iterable<string>;
  /** Garde un mélange dans « Mes palettes » ; faux si c'est plein. */
  garder: (c: number[]) => boolean;
  retirer: (i: number) => void;
  /** Boutons en plus au bout de l'onglet Classiques (teintures achetées, couleurs officielles). */
  enPlus?: string;
}

let onglet = 'classiques', minuteur: ReturnType<typeof setTimeout> | undefined;
const hexa = (c: number) => '#' + c.toString(16).padStart(6, '0');
const pastilles = (c: number[]) => c.slice(0, 3).map(x => `<i style="background:${hexa(x)}"></i>`).join('');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const CSS = `
.pal-ui{display:grid;gap:.5em;margin-top:.4em}
.pal-ui .paltabs{display:flex;flex-wrap:wrap;gap:.3em}
.pal-ui .paltabs button{all:unset;cursor:pointer;padding:.2em .55em;border-radius:.35em;background:#24241b;border:1px solid #45452f;color:#d8d2bc;font-weight:700}
.pal-ui .paltabs button.on{background:#a8d23a;border-color:#a8d23a;color:#1b2108}
.pal-ui .paltabs button small{opacity:.7;font-weight:600;margin-left:.3em}
.pal-ui .pals button.ferme{opacity:.5;filter:grayscale(.55)}
.pal-ui .pals button.ferme::after{content:'';width:.75em;height:.75em;margin-left:.25em;background:currentColor;
  -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z'/%3E%3C/svg%3E") center/contain no-repeat;
  mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z'/%3E%3C/svg%3E") center/contain no-repeat}
.pal-ui .pals .x{margin-left:.35em;opacity:.6}.pal-ui .pals .x:hover{opacity:1;color:#e0625a}
.pal-ui .paltabs .de{display:flex;align-items:center;gap:.3em}
.pal-ui .paltabs .de svg{width:1.1em;height:1.1em;fill:currentColor}
.pal-ui .pals button.teint{width:1.5em!important;height:1.5em!important;padding:0!important;border-radius:50%!important;border:2px solid #0008!important;box-shadow:0 0 0 1px #45452f}
.pal-ui .pals button.teint.on{box-shadow:0 0 0 2px #a8d23a}
.pal-ui .pals input{all:unset;box-sizing:border-box;flex:1;min-width:8em;padding:.25em .5em;border-radius:.35em;background:#15150f;border:1px solid #45452f;font-family:ui-monospace,Consolas,monospace;font-size:.95em}
.pal-ui .palinfo{font-size:.92em;color:#c9c4ab}
.pal-ui .palinfo:empty{display:none}
.pal-ui .palinfo.err{color:#e0925a}
.pal-ui button:focus-visible{outline:2px solid #e8c26a;outline-offset:1px}`;
let style = false;

/** Le HTML du panneau (à poser là où étaient les pastilles des palettes). */
export function htmlPalettes(ctx: CtxPalettes): string {
  if (!style) { style = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  const co = ctx.coffre(), dofus = [...ctx.dofus()], cour = ctx.couleurs(), mes = co.mesPalettes ?? [];
  const ouverte = (id: string) => paletteOuverte(PALETTE_PAR_ID[id], co, dofus);
  const onglets = PALETTES_PERSO.familles.map(f => {
    const n = f.palettes.filter(p => ouverte(p.id)).length;
    return `<button type="button" role="tab" data-palonglet="${f.id}" class="${onglet === f.id ? 'on' : ''}" aria-selected="${onglet === f.id}">${f.nom}${n < f.palettes.length ? `<small>${n}/${f.palettes.length}</small>` : ''}</button>`;
  }).join('') + ([['mes', `Mes palettes<small>${mes.length}/${MES_PALETTES_MAX}</small>`], ['peau', 'Peau'], ['code', 'Code']] as const)
    .map(([k, t]) => `<button type="button" role="tab" data-palonglet="${k}" class="${onglet === k ? 'on' : ''}" aria-selected="${onglet === k}">${t}</button>`).join('')
    + `<button type="button" class="de" data-palde title="Des couleurs au hasard, mais assorties (la peau ne change pas)" aria-label="Couleurs au hasard"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="5" r="1.3"/><circle cx="11" cy="11" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="11" cy="5" r="1.3"/><circle cx="5" cy="11" r="1.3"/></svg>Hasard</button>`;
  let corps: string;
  if (onglet === 'peau') {
    corps = PALETTES_PERSO.teints.map((t, i) => `<button type="button" class="teint${cour[0] === t.c ? ' on' : ''}" data-palpeau="${i}" style="background:${hexa(t.c)}" title="Peau : ${t.nom}" aria-label="Peau : ${t.nom}"></button>`).join('');
  } else if (onglet === 'code') {
    corps = `<input data-palcode placeholder="Coller un code couleur" spellcheck="false" autocomplete="off" aria-label="Code couleur à appliquer"><button type="button" data-palcoller>Appliquer</button><button type="button" data-palcopie title="Copier le code de tes couleurs pour les partager">Copier le mien</button>`;
  } else if (onglet === 'mes') {
    corps = mes.map((c, i) => `<button type="button" data-palmes="${i}" title="Poser ce mélange (peau comprise)">${pastilles(c.slice(1))}n°${i + 1}<span class="x" data-palsup="${i}" role="button" aria-label="Retirer le mélange ${i + 1}" title="Retirer">×</span></button>`).join('')
      + (mes.length < MES_PALETTES_MAX ? `<button type="button" data-palgarder title="Garde tes couleurs du moment pour tout le compte">+ Garder mes couleurs</button>` : '');
  } else {
    const f = PALETTES_PERSO.familles.find(x => x.id === onglet) ?? PALETTES_PERSO.familles[0];
    corps = f.palettes.map(p => {
      const ok = ouverte(p.id), aide = ok ? '' : commentOuvrir(p, p.dofus ? DOFUS[p.dofus]?.nom : undefined);
      return `<button type="button" data-palid="${p.id}"${ok ? '' : ` class="ferme" title="${esc(aide)}"`}>${pastilles(p.c)}${p.nom}</button>`;
    }).join('') + (f.id === 'classiques' ? ctx.enPlus ?? '' : '');
  }
  return `<div class="pal-ui">
    <div class="paltabs" role="tablist">${onglets}</div>
    <div class="pals">${corps}</div>
    <div class="palinfo" aria-live="polite"></div></div>`;
}

/** Branche les boutons du panneau (après chaque rendu). */
export function brancherPalettes(root: HTMLElement, ctx: CtxPalettes) {
  const ui = root.querySelector<HTMLElement>('.pal-ui'); if (!ui) return;
  const info = ui.querySelector<HTMLElement>('.palinfo')!;
  const dire = (t: string, err = false) => { info.textContent = t; info.classList.toggle('err', err); clearTimeout(minuteur); minuteur = setTimeout(() => { info.textContent = ''; }, 6000); };
  const clic = (sel: string, f: (e: HTMLElement, ev: Event) => void) => ui.querySelectorAll<HTMLElement>(sel).forEach(e => e.addEventListener('click', ev => f(e, ev)));
  clic('[data-palonglet]', e => { onglet = e.dataset.palonglet!; ctx.poser(ctx.couleurs()); });
  clic('[data-palid]', e => {
    const p = PALETTE_PAR_ID[e.dataset.palid!]; if (!p) return;
    if (!paletteOuverte(p, ctx.coffre(), ctx.dofus())) { dire(`${commentOuvrir(p, p.dofus ? DOFUS[p.dofus]?.nom : undefined)}.`, true); return; }
    ctx.poser([ctx.couleurs()[0], ...p.c]);
  });
  clic('[data-palpeau]', e => { const t = PALETTES_PERSO.teints[+e.dataset.palpeau!]; if (t) { const c = [...ctx.couleurs()]; c[0] = t.c; ctx.poser(c); } });
  clic('[data-palde]', () => ctx.poser(paletteAuHasard(ctx.couleurs()[0], Math.random)));
  clic('[data-palmes]', (e, ev) => {
    if ((ev.target as HTMLElement).closest('[data-palsup]')) return;
    const m = ctx.coffre().mesPalettes?.[+e.dataset.palmes!]; if (m) ctx.poser([...m]);
  });
  clic('[data-palsup]', (e, ev) => { ev.stopPropagation(); ctx.retirer(+e.dataset.palsup!); ctx.poser(ctx.couleurs()); });
  clic('[data-palgarder]', () => { if (ctx.garder([...ctx.couleurs()])) ctx.poser(ctx.couleurs()); else dire(`Mes palettes est plein (${MES_PALETTES_MAX}) : retire un mélange d'abord.`, true); });
  const champ = ui.querySelector<HTMLInputElement>('[data-palcode]');
  clic('[data-palcopie]', () => {
    const code = codeCouleurs(ctx.couleurs());
    if (champ) champ.value = code;
    const plan = () => { champ?.select(); dire('Code prêt dans la case : copie-le avec Ctrl+C.'); };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => dire('Code copié : colle-le sur Discord (#looks) ou chez un ami.'), plan); else plan();
  });
  const appliquer = () => {
    if (!champ) return;
    const c = lireCodeCouleurs(champ.value, ctx.couleurs()[0]);
    if (!c) { dire('Code illisible : il faut 6 couleurs (ou 5, sans la peau) comme f2d36b-ffffff-…', true); return; }
    ctx.poser(c);
  };
  clic('[data-palcoller]', appliquer);
  // le champ ne doit pas déclencher les raccourcis du jeu
  champ?.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') appliquer(); });
  champ?.addEventListener('keyup', e => e.stopPropagation());
}
