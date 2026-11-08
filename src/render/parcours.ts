// Parcours des nouveaux venus (maquette « Accueil : », idée C) : on compte, sans rien savoir de la personne, combien
// arrivent sur l'accueil, ouvrent la création, créent un perso et finissent le tuto. Chaque étape part une seule fois
// par navigateur ; le serveur garde seulement un total par jour (serveur/comptes.mjs, /parcours).
import { API } from './compte';

const CLE = 'diablofus.parcours';
export type Etape = 'accueil' | 'creation' | 'perso' | 'tuto';

export const Parcours = {
  noter(etape: Etape) {
    if (/test|cra|astrub|jeu/.test(location.hash) || /localhost|127\.0\.0\.1/.test(location.hostname)) return;
    let faites: string[] = [];
    try { faites = JSON.parse(localStorage.getItem(CLE) ?? '[]'); if (!Array.isArray(faites)) faites = []; } catch { return; }
    if (faites.includes(etape)) return;
    faites.push(etape);
    try { localStorage.setItem(CLE, JSON.stringify(faites)); } catch { return; }
    fetch(`${API}/parcours?etape=${etape}`, { method: 'POST', keepalive: true }).catch(() => { /* serveur injoignable : tant pis */ });
  },
};
