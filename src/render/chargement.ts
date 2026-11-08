import VOYAGE from '../data/voyage.json';
import { v } from './assetUrl';

/** Écran de chargement (logo du jeu + barre) : le HTML est dans index.html pour s'afficher avant même le script.
 *  ZoneScene le montre pendant son preload et le cache à la fin de create(). Après le premier lancement il apparaît
 *  en fondu avec un petit retard (classe « discret ») : un chargement déjà en cache ne fait pas clignoter l'écran.
 *  Entre deux zones (maquette Entrées 15A), c'est un écran de voyage : illustration de la zone d'arrivée, son nom,
 *  ses niveaux et une astuce ; le logo reste pour le tout premier lancement. Vers le Havre-Sac (14A), c'est le noir
 *  d'une porte : l'écran ne vient que si le chargement traîne (classe « lent »). */
let premier = true;
let astuce = -1;
const el = () => document.getElementById('chargement');
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
type ZoneVoyage = { sous: string; niveau: string };

/** Comment on arrive : 'voyage' = changement de zone (15A), 'porte' = Havre-Sac (14A), sinon l'écran au logo. */
export type Arrivee = { mode: 'voyage'; zone: string; nom: string } | { mode: 'porte' } | null;

/** Premier chargement (maquette « Accueil : » 8A) : une astuce sous la barre, qui change toutes les 3 s. */
let tourne = 0;
function astucesDebut() {
  const p = document.querySelector<HTMLElement>('#chargement .astuce0'); if (!p) return;
  const suivante = () => { p.textContent = Chargement.astuce(); };
  suivante(); tourne = window.setInterval(suivante, 3000);
}

export const Chargement = {
  /** Astuce suivante (au hasard, jamais deux fois la même de suite). */
  astuce(): string {
    const l = VOYAGE.astuces;
    let i = Math.floor(Math.random() * l.length);
    if (i === astuce) i = (i + 1) % l.length;
    astuce = i;
    return l[i];
  },
  montrer(arrivee: Arrivee = null) {
    const e = el(); if (!e) return;
    Chargement.progres(0);
    const voy = e.querySelector('.voyage') as HTMLElement | null;
    e.classList.remove('voyage-on', 'lent');
    if (arrivee?.mode === 'voyage' && voy && !premier) {
      const z = (VOYAGE.zones as Record<string, ZoneVoyage>)[arrivee.zone];
      voy.innerHTML = `${z ? `<div class="ill" style="background-image:url('${v(`assets/voyage/${arrivee.zone}.webp`)}')"></div>` : ''}
        <div class="txt"><small class="vers">Voyage vers</small><b>${esc(arrivee.nom)}</b>${z ? `<span>${esc(z.sous)} · <em>${esc(z.niveau)}</em></span>` : ''}</div>
        <p class="astuce"><em>Astuce</em>${esc(Chargement.astuce())}</p>`;
      e.classList.add('voyage-on');
    }
    if (arrivee?.mode === 'porte' && !premier) e.classList.add('lent');
    if (premier) { e.hidden = false; return; }
    e.classList.add('discret'); e.classList.remove('vu'); e.hidden = false;
    requestAnimationFrame(() => e.classList.add('vu'));
  },
  progres(p: number) {
    const e = el(); if (!e) return;
    const pc = Math.round(Math.max(0, Math.min(1, p)) * 100);
    (e.querySelector('.barre i') as HTMLElement | null)?.style.setProperty('width', `${pc}%`);
    const t = e.querySelector('small:not(.vers)'); if (t) t.textContent = `Chargement… ${pc} %`;
  },
  cacher() {
    const e = el(); if (!e) return;
    if (tourne) { clearInterval(tourne); tourne = 0; }
    premier = false; e.hidden = true; e.classList.remove('discret', 'vu', 'voyage-on', 'lent');
  },
};

if (typeof document !== 'undefined') astucesDebut();
