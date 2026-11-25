// « Fluidité Thor : » 1A : la mesure intégrée. Le jeu chronomètre chaque étape de chaque image, garde les pires images et ce
// qui les a causées, et envoie le tout dans le rapport de l'écran du bas (« Copier le rapport »). Coût : quelques lectures
// d'horloge par image. Active seulement quand quelqu'un écoute (écran du bas relié, ou #diag dans l'adresse).

export type Etape = 'bas' | 'sim' | 'decor' | 'persos' | 'sil' | 'perso' | 'hud' | 'dessin';
const NOMS: Record<Etape, string> = { bas: 'écran du bas', sim: 'simulation', decor: 'décor', persos: 'monstres et persos', sil: 'silhouettes', perso: 'dessin du perso', hud: 'interface', dessin: 'envoi à la carte graphique' };
const ETAPES = Object.keys(NOMS) as Etape[];
/** Fenêtre glissante : les dernières images (≈ 30 s à 60 images/s). */
const N = 1800;

interface Pire { dt: number; quoi: string; t: number }

class MesureImages {
  actif = false;
  private dts = new Float32Array(N); private n = 0; private i = 0;
  private som: Record<string, number> = {}; private images = 0; private travail = 0;
  private cour: Record<string, number> = {}; private t0: Record<string, number> = {};
  private notes: string[] = []; private debutImage = 0; private travailImage = 0;
  private pires: Pire[] = [];
  private lents = [0, 0, 0];
  /** Compteurs libres (messages vers le bas, silhouettes refaites ou gardées…), remis à zéro avec la fenêtre. */
  compte: Record<string, number> = {};
  private depuis = 0;
  /** Faits du lancement (préparation du perso), gardés jusqu'au rechargement. */
  faits: Record<string, string> = {};

  debut(k: Etape) { if (this.actif) this.t0[k] = performance.now(); }
  fin(k: Etape) { if (this.actif && this.t0[k]) { this.cour[k] = (this.cour[k] ?? 0) + performance.now() - this.t0[k]; this.t0[k] = 0; } }
  /** Ce qui peut expliquer une image lente (« carte posée », « 3 images du perso »). */
  note(t: string) { if (this.actif && this.notes.length < 6) this.notes.push(t); }
  plus(k: string, n = 1) { if (this.actif) this.compte[k] = (this.compte[k] ?? 0) + n; }

  private avant = 0; private dt = 0;
  /** Début du travail d'une image (avant la simulation). */
  ouvrir() { if (!this.actif) { this.avant = 0; return; } const t = performance.now(); this.dt = this.avant ? t - this.avant : 0; this.avant = t; this.debutImage = t; }
  /** Fin du travail d'une image (après l'envoi à la carte graphique). */
  fermer() {
    if (!this.actif) return;
    const dt = this.dt;
    const t = performance.now();
    if (!this.depuis) this.depuis = t;
    if (this.debutImage) this.travailImage = t - this.debutImage;
    if (dt > 0 && dt < 1000 && !(typeof document !== 'undefined' && document.hidden)) {
      this.dts[this.i] = dt; this.i = (this.i + 1) % N; this.n = Math.min(N, this.n + 1);
      this.images++; this.travail += this.travailImage;
      for (const k of ETAPES) this.som[k] = (this.som[k] ?? 0) + (this.cour[k] ?? 0);
      if (dt > 25) this.lents[0]++; if (dt > 50) this.lents[1]++; if (dt > 100) this.lents[2]++;
      if (dt > 33 && (this.pires.length < 6 || dt > this.pires[this.pires.length - 1].dt)) {
        let gros: Etape = 'sim', v = 0;
        for (const k of ETAPES) if ((this.cour[k] ?? 0) > v) { v = this.cour[k]; gros = k; }
        const quoi = [`travail ${Math.round(this.travailImage)} ms`, v >= 4 ? `${NOMS[gros]} ${Math.round(v)} ms` : '', ...this.notes].filter(Boolean).join(', ');
        this.pires.push({ dt, quoi, t }); this.pires.sort((a, b) => b.dt - a.dt); this.pires.length = Math.min(6, this.pires.length);
      }
    }
    this.cour = {}; this.notes = []; this.debutImage = 0;
    // la fenêtre repart toutes les 60 s : le rapport parle du moment présent
    if (t - this.depuis > 60_000) this.vider();
  }
  private garde: string[] = [];
  private vider() {
    this.garde = this.lignes(); this.depuis = performance.now();
    this.som = {}; this.images = 0; this.travail = 0; this.lents = [0, 0, 0]; this.pires = []; this.compte = {}; this.n = 0; this.i = 0;
  }

  /** Écran : fréquence estimée (le plus court écart courant entre deux images). */
  private hz(): number {
    if (this.n < 30) return 0;
    const a = Array.from(this.dts.subarray(0, this.n)).sort((x, y) => x - y), bas = a[Math.floor(a.length * 0.05)];
    for (const h of [144, 120, 90, 60, 30]) if (Math.abs(1000 / h - bas) < 1000 / h * 0.12) return h;
    return Math.round(1000 / Math.max(1, bas));
  }
  /** Lignes du rapport. Moins de 5 s de mesure : la fenêtre d'avant. */
  lignes(): string[] {
    if (!this.actif) return ['Fluidité : mesure inactive'];
    if (this.images < 120) return this.garde.length ? this.garde : ['Fluidité : mesure en cours (reviens dans quelques secondes)'];
    const a = Array.from(this.dts.subarray(0, this.n)).sort((x, y) => x - y), n = a.length;
    const moy = a.reduce((x, y) => x + y, 0) / n, p99 = a[Math.min(n - 1, Math.floor(n * 0.99))], med = a[Math.floor(n / 2)];
    const f = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',');
    const s = (performance.now() - this.depuis) / 1000;
    const parImage = (k: string) => f((this.som[k] ?? 0) / this.images);
    const reste = this.travail / this.images - ETAPES.reduce((x, k) => x + (this.som[k] ?? 0) / this.images, 0);
    const c = Object.entries(this.compte).map(([k, v]) => `${k} ${f(v / s)}/s`).join(', ');
    return [
      `Fluidité (${Math.round(s)} dernières s) : ${Math.round(1000 / moy)} images/s en moyenne, ${Math.round(1000 / med)} le plus souvent, ${Math.round(1000 / p99)} dans le pire 1 %, écran estimé à ${this.hz() || '?'} Hz`,
      `Images lentes : ${this.lents[0]} de plus de 25 ms, ${this.lents[1]} de plus de 50 ms, ${this.lents[2]} de plus de 100 ms, sur ${this.images}`,
      `Travail par image : ${f(this.travail / this.images)} ms (${ETAPES.map(k => `${NOMS[k]} ${parImage(k)}`).join(' · ')} · reste ${f(Math.max(0, reste))})`,
      `Pires images : ${this.pires.length ? this.pires.map(p => `${Math.round(p.dt)} ms (${p.quoi})`).join(' ; ') : 'aucune au-dessus de 33 ms'}`,
      ...(c ? [`Par seconde : ${c}`] : []),
      ...Object.entries(this.faits).map(([k, v]) => `${k} : ${v}`),
      `Horloge du moteur : précision ${f(precisionHorloge())} ms`,
    ];
  }
}
export const Mesure = new MesureImages();

let precision = 0;
/** Le plus petit pas de performance.now() (Firefox l'arrondit : à 1 ms, les mouvements tremblent un peu). */
function precisionHorloge(): number {
  if (precision) return precision;
  let min = Infinity, avant = performance.now(), pas = 0;
  const fin = Date.now() + 25;
  while (pas < 8 && Date.now() < fin) { const t = performance.now(); if (t > avant) { min = Math.min(min, t - avant); avant = t; pas++; } }
  return precision = Number.isFinite(min) ? min : 0;
}
