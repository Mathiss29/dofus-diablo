// Pont entre la page du jeu et l'appli (GeckoView n'a pas d'addJavascriptInterface) : l'appli pousse l'état de la manette
// et le journal par un port, la page les lit sans attendre avec window.DiablofusAppli.manette() / journal(), comme avec
// l'appli WebView (src/render/manette.ts, padNatif).
'use strict';
let etat = '{"c":false}', journal = '', version = '?', ecran = '';
const port = browser.runtime.connectNative('diablofus');
const envoyer = m => { try { port.postMessage(m); } catch (e) { /* appli partie */ } };
port.onMessage.addListener(m => {
  if (typeof m.m === 'string') etat = m.m;
  if (typeof m.j === 'string') journal = m.j;
  if (typeof m.v === 'string') version = m.v;
  if (typeof m.e === 'string') ecran = m.e;
  if (m.retour) {   // retour Android = Échap, comme au clavier
    const o = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    (document.activeElement || document.body || document).dispatchEvent(new KeyboardEvent('keydown', o));
    document.dispatchEvent(new KeyboardEvent('keyup', o));
  }
});
const api = {
  manette: () => etat,
  version: () => version,
  journal: () => journal,
  moteur: () => 'gecko',
  vibrer: (fort, faible, ms) => envoyer({ k: 'vibrer', fort: +fort || 0, faible: +faible || 0, ms: +ms || 0 }),
  luminosite: f => envoyer({ k: 'lum', f: +f }),
  // appli 4 : fréquence de l'écran du haut (0 = la plus haute), et ce que l'appli sait de l'écran et du moteur
  frequence: hz => envoyer({ k: 'hz', hz: +hz || 0 }),
  ecran: () => ecran,
};
window.wrappedJSObject.DiablofusAppli = cloneInto(api, window, { cloneFunctions: true });
// Erreurs de la page gardées dans le journal de l'appli (rapport de l'écran du bas), comme la console du WebView
const texte = a => { try { return a instanceof Error ? `${a.message}` : typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (e) { return String(a); } };
try {
  const c = window.wrappedJSObject.console, avant = c.error;
  // avant.call(c, ...a) et non avant.apply(c, a) : la console de la page ne peut pas lire un tableau de l'extension
  // (« Permission denied to access property "length" », qui faisait échouer le jeu dès sa 1re ligne d'erreur, appli 1)
  exportFunction(function (...a) { envoyer({ k: 'err', t: a.map(texte).join(' ').slice(0, 400) }); try { avant.call(c, ...a); } catch (e) { /* console muette */ } }, c, { defineAs: 'error' });
} catch (e) { /* console intouchable */ }
window.addEventListener('error', e => envoyer({ k: 'err', t: `${e.message} (${e.filename}:${e.lineno})` }));
window.addEventListener('unhandledrejection', e => envoyer({ k: 'err', t: `promesse : ${texte(e.reason)}` }));
// Pour le rapport : le pont est branché, et ce que le moteur offre à la page
window.addEventListener('DOMContentLoaded', () => {
  const p = window.wrappedJSObject, n = p.navigator;
  let gl = '?';
  try { const c = document.createElement('canvas').getContext('webgl2'); gl = c ? (c.getParameter(c.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? c.RENDERER) || 'webgl2') : 'sans webgl2'; } catch (e) { gl = 'erreur webgl'; }
  envoyer({ k: 'pret', t: `pont branché (DiablofusAppli ${typeof p.DiablofusAppli?.manette === 'function' ? 'ok' : 'absent'}, manettes du navigateur ${n.getGamepads ? 'oui' : 'non'}, ${gl}, mémoire ${n.deviceMemory ?? '?'} Go)` });
});
