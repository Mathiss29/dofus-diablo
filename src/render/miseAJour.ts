// Mise à jour automatique (Mathis, 2026-11-15, AYN Thor) : GitHub Pages laisse le navigateur garder la page 10 minutes,
// donc une console ou un onglet rouvert pouvait jouer l'ancienne version après une fusion. Au lancement, et en revenant
// sur l'accueil après une absence, on lit version.json (sans cache) : s'il annonce une autre version, on recharge la page.
declare const __BUILD__: string;
const CLE = 'diablofus.majTentee';

async function versionEnLigne(): Promise<string | null> {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json() as { v?: unknown };
    return typeof j.v === 'string' ? j.v : null;
  } catch { return null; }
}

/** Recharge si une version plus récente est en ligne (une seule tentative par version, pour ne jamais boucler). */
export async function verifierVersion(): Promise<void> {
  if (!import.meta.env.PROD) return;
  const v = await versionEnLigne();
  if (!v || v === __BUILD__) return;
  try { if (sessionStorage.getItem(CLE) === v) return; sessionStorage.setItem(CLE, v); } catch { return; }
  location.reload();
}

/** Au lancement, puis à chaque retour sur l'onglet ou l'app après 2 minutes d'absence, seulement si l'accueil est affiché (jamais en pleine partie). */
export function brancherMiseAJour(): void {
  void verifierVersion();
  let cache = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cache = Date.now(); return; }
    const acc = document.getElementById('acc');
    if (cache && Date.now() - cache > 120_000 && acc && !acc.hidden) void verifierVersion();
  });
}
