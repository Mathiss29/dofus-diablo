import { World } from '../sim/world';
import { Player } from '../sim/player';
import { ORDRES_JOUEUR, ORDRES_MONDE, type Ordre } from '../sim/ordres';
import { versReseau, type Val } from '../sim/miroir';

/** « En ligne : » 4B : chez l'invité d'une partie à plusieurs, les gestes de fenêtre (src/sim/ordres.ts) sont joués dans le miroir
 *  pour la réponse à l'écran, et envoyés à celui qui fait la partie. On enveloppe une seule fois les méthodes du monde et du perso ;
 *  elles n'envoient rien hors du miroir branché (partie normale, hôte, serveur). */
let branche: { w: World; envoyer: (o: Ordre) => void } | null = null;
/** Profondeur d'appel : un geste qui en appelle un autre (relâcher une âme → invoquer) ne part qu'une fois. */
let prof = 0;
let installe = false;

function envelopper(proto: object, noms: ReadonlySet<string>, c: Ordre['c'], estLeMien: (o: unknown) => boolean) {
  const P = proto as Record<string, unknown>;
  for (const f of noms) {
    const avant = P[f];
    if (typeof avant !== 'function') continue;
    P[f] = function (this: unknown, ...a: unknown[]) {
      const b = branche;
      if (b && prof === 0 && estLeMien(this)) {
        const args = a.map(x => versReseau(x) ?? null) as Val[];
        try { b.envoyer({ c, f, a: args }); } catch (e) { console.warn('ordre', f, e); }
      }
      prof++;
      try { return (avant as (...x: unknown[]) => unknown).apply(this, a); } finally { prof--; }
    };
  }
}
function installer() {
  if (installe) return;
  installe = true;
  envelopper(World.prototype, ORDRES_MONDE, 'w', o => o === branche?.w);
  envelopper(Player.prototype, ORDRES_JOUEUR, 'p', o => !!branche && o === branche.w.player);
}
/** Branche le miroir de cette scène ; renvoie de quoi le débrancher (fin de scène). */
export function brancherOrdres(w: World, envoyer: (o: Ordre) => void): () => void {
  installer();
  branche = { w, envoyer };
  return () => { if (branche?.w === w) branche = null; };
}
