/** 0.5 « monde vivant » (2E) : l'heure de Paris, la même pour tous les joueurs, quelle que soit l'heure de leur PC.
 *  Donnée à la sim en secondes « murales » (comme si Paris était à l'heure UTC) : World.opts.horloge. */
let decalage = 0, calcule = -Infinity;
/** Panneau de test (F1) : avance l'horloge du monde vivant (s). */
let avance = 0;

function decalageParis(ms: number): number {
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const v: Record<string, number> = {};
    for (const p of f.formatToParts(new Date(ms))) if (p.type !== 'literal') v[p.type] = +p.value;
    const mural = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
    return Math.round((mural - Math.floor(ms / 1000) * 1000) / 60000) * 60;
  } catch { return 3600; }   // navigateur sans fuseaux : heure d'hiver de Paris
}

/** Heure de Paris en secondes murales. Le décalage (heure d'été ou d'hiver) est revu toutes les 10 minutes. */
export function heureParis(): number {
  const ms = Date.now();
  if (ms - calcule > 600_000) { decalage = decalageParis(ms); calcule = ms; }
  return ms / 1000 + decalage + avance;
}

/** Panneau de test : avancer l'horloge du monde vivant de n secondes (0 = remettre à l'heure). */
export function avancerHorloge(n: number) { avance = n ? avance + n : 0; }
export const avanceHorloge = () => avance;
