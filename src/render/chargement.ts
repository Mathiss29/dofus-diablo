/** Écran de chargement (logo du jeu + barre) : le HTML est dans index.html pour s'afficher avant même le script.
 *  ZoneScene le montre pendant son preload et le cache à la fin de create(). Après le premier lancement il apparaît
 *  en fondu avec un petit retard (classe « discret ») : un chargement déjà en cache ne fait pas clignoter l'écran. */
let premier = true;
const el = () => document.getElementById('chargement');

export const Chargement = {
  montrer() {
    const e = el(); if (!e) return;
    Chargement.progres(0);
    if (premier) { e.hidden = false; return; }
    e.classList.add('discret'); e.classList.remove('vu'); e.hidden = false;
    requestAnimationFrame(() => e.classList.add('vu'));
  },
  progres(p: number) {
    const e = el(); if (!e) return;
    const pc = Math.round(Math.max(0, Math.min(1, p)) * 100);
    (e.querySelector('.barre i') as HTMLElement | null)?.style.setProperty('width', `${pc}%`);
    const t = e.querySelector('small'); if (t) t.textContent = `Chargement… ${pc} %`;
  },
  cacher() {
    const e = el(); if (!e) return;
    premier = false; e.hidden = true; e.classList.remove('discret', 'vu');
  },
};
