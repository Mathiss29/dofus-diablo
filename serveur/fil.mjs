// Fil d'une partie (« En ligne : » 7B, Mathis 2026-11-15) : un fil Node par cœur fait tourner des parties tenues par le serveur.
// Le fil principal (index.mjs) garde les connexions, les salons et la base ; il parle à ce fil par messages (fils.mjs).
// Ici : les parties de ce fil, leur boucle à 60 pas par seconde, et ce qu'elles renvoient (instantanés, sauvegardes, records).
import { parentPort, workerData } from 'node:worker_threads';
import { chargerSim, Partie } from './partie.mjs';
import { creerSigneur } from './hdv.mjs';

const S = await chargerSim(workerData?.dossierSim ? new URL(workerData.dossierSim) : undefined);
const signeur = workerData?.cle ? creerSigneur(workerData.cle) : null;
/** code du salon → Partie */
const parties = new Map();
const dire = m => parentPort.postMessage(m);

function creer(code, seed, o) {
  const p = new Partie(S, (num, d) => dire({ t: 'env', code, num, texte: JSON.stringify(d) }), seed,
    (c, perso) => dire({ t: 'sauver', compte: c.compte, emplacement: c.emplacement, perso }),
    { ...o, signer: signeur ? it => signeur.signer(it) : null, donjonFini: (nom, temps, L, idoles) => dire({ t: 'donjonFini', nom, temps, L, idoles }) });
  parties.set(code, p);
}

let boucle = null, avant = 0, n = 0;
function tourner() {
  if (boucle) return;
  avant = performance.now();
  boucle = setInterval(() => {
    const t = performance.now(), dt = (t - avant) / 1000; avant = t;
    for (const [code, p] of parties) {
      try { p.avancer(dt); }
      catch (e) { console.warn(`partie ${code} arrêtée :`, e.message); try { p.sauverTout(); } catch { /* rien */ } parties.delete(code); dire({ t: 'arret', code }); }
    }
    // une fois par seconde : où joue chaque compte (rejoindre un allié, 5B)
    if (++n % 60 === 0) for (const [code, p] of parties) dire({ t: 'positions', code, L: p.positions() });
    if (!parties.size) { clearInterval(boucle); boucle = null; }
  }, 1000 / 60);
}

parentPort.on('message', m => {
  const p = parties.get(m.code);
  try {
    switch (m.t) {
      case 'creer': if (!S) { dire({ t: 'arret', code: m.code }); break; } creer(m.code, m.seed, m.o); tourner(); break;
      case 'arrivee': p?.arrivee(m.num); break;
      case 'depart': p?.depart(m.num); break;
      case 'recu': p?.recu(m.num, m.d); if (m.d?.k === 'bonjour') dire({ t: 'positions', code: m.code, L: p?.positions() ?? [] }); break;
      case 'hdv': dire({ t: 'reponse', id: m.id, v: p?.joueurDuCompte(m.compte, m.emplacement)?.appliquer(m.op) ?? null }); break;
      case 'sauverTout': p?.sauverTout(); dire({ t: 'reponse', id: m.id, v: true }); break;
      case 'fermer': if (p) { p.sauverTout(); parties.delete(m.code); } dire({ t: 'reponse', id: m.id, v: true }); break;
    }
  } catch (e) {
    console.warn(`fil : ${m.t} raté :`, e.message);
    if (m.id != null) dire({ t: 'reponse', id: m.id, v: null });
  }
});
dire({ t: 'pret', sim: !!S });
