/* Carte Discord (embed) du carnet du jour du Journal (src/data/journal.json). Pur : pas de réseau, testé par journal.test.mjs.
   Limites Discord : titre 256, description 4 096, champ 1 024, 6 000 caractères en tout. */

export const SITE = "https://diablofus.com";
const EMOJI = { "Nouveautés": "✨", "Le monde": "🌍", "Combat": "⚔️", "Corrections": "🛠️", "En coulisses": "🎬" };
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const CHAMP = 1024, TOTAL = 5800; // marge sous les 6 000

export const dateFr = (iso) => { const [a, m, j] = iso.split("-").map(Number); return `${j} ${MOIS[m - 1]} ${a}`; };
/** Pied de carte : sert aussi à retrouver le message du jour pour le réécrire. */
export const pied = (iso) => `Carnet du ${iso} · ${SITE.replace("https://", "")}`;
/** Nom du post de forum : commence par la date, pour le retrouver même si le titre change dans la journée. */
export const nomPost = (c) => `${dateFr(c.date)} · ${c.titre}`.slice(0, 100);

/** Lignes réservées à la partie de test (0.3, Osamodas en essai) : gardées dans le Journal du jeu, pas sur Discord
    tant que ce contenu n'est pas public. À retirer de la liste quand il sort pour tout le monde. */
export const CACHE_DISCORD = [/partie de test/i, /#test\b/i, /\bOsamodas\b/i];
export const publique = (l) => !CACHE_DISCORD.some((r) => r.test(texteComplet(l)));

/** Carnets lisibles (10A) : une entrée { titre, phrase, details, etiquettes } s'affiche « **titre** · phrase » ;
    les détails restent sur le site. Les vieilles lignes (texte simple) passent telles quelles. */
export const texte = (l) => (typeof l === "string" ? l : `**${l.titre}** · ${l.phrase}`);
const texteComplet = (l) => (typeof l === "string" ? l : [l.titre, l.phrase, l.details, ...(l.etiquettes || [])].filter(Boolean).join(" "));

const couper = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + "…");

/** Les lignes les plus récentes d'abord (chaque PR ajoute à la fin), tant que ça tient. */
function champ(nom, lignes, budget, une = false) {
  const tete = `${EMOJI[nom] || "•"} ${nom}`;
  const pris = [];
  let taille = 0;
  // « À la une » : la première ligne des Nouveautés (l'annonce du jour) reste en tête, même dans un gros carnet
  if (une && lignes.length > 1) {
    const l = "• " + couper(texte(lignes[0]), 300);
    pris.push(l); taille += l.length + 1;
    lignes = lignes.slice(1);
  }
  const deja = pris.length;
  for (let i = lignes.length - 1; i >= 0; i--) {
    const l = "• " + couper(texte(lignes[i]), 300);
    const reste = i; // lignes encore non montrées si on s'arrête après celle-ci
    const suite = reste ? `\n*… et ${reste} autre${reste > 1 ? "s" : ""}*` : "";
    if (taille + l.length + 1 + suite.length > Math.min(CHAMP, budget)) break;
    pris.push(l);
    taille += l.length + 1;
  }
  const caches = lignes.length + deja - pris.length;
  if (!pris.length) return { name: tete, value: `*${lignes.length} ligne${lignes.length > 1 ? "s" : ""} dans le Journal du jeu*` };
  return { name: tete, value: pris.join("\n") + (caches ? `\n*… et ${caches} autre${caches > 1 ? "s" : ""}*` : "") };
}

export function carte(c, rubriques = Object.keys(EMOJI)) {
  const e = {
    title: couper(`📜 ${dateFr(c.date)} · ${c.titre}`, 256),
    url: `${SITE}/`,
    description: couper(c.resume || "", 600) + `\n\n[Jouer sur diablofus.com](${SITE}/) · Journal complet dans l'onglet Journal de l'accueil`,
    color: 0xe0894f,
    fields: [],
    footer: { text: pied(c.date) },
  };
  if (c.capture) e.image = { url: `${SITE}/${c.capture.replace(/^\/+/, "")}` };
  let budget = TOTAL - e.title.length - e.description.length - e.footer.text.length;
  const noms = [...rubriques, ...Object.keys(c.lignes || {}).filter((r) => !rubriques.includes(r))];
  // l'annonce « à la une » (1re ligne des Nouveautés) est toujours publique ; les autres lignes sont filtrées
  const lignes = Object.fromEntries(noms.map((r) => [r, (c.lignes?.[r] || []).filter((l, i) => (r === "Nouveautés" && i === 0) || publique(l))]));
  const pleines = noms.filter((r) => lignes[r].length);
  pleines.forEach((r, i) => {
    const part = Math.floor(budget / (pleines.length - i)) - r.length - 4;
    const f = champ(r, lignes[r], part, r === "Nouveautés");
    budget -= f.name.length + f.value.length;
    e.fields.push(f);
  });
  return e;
}

/** Le carnet du jour (le plus récent), ou celui de la date donnée. */
export function carnetDuJour(journal, date) {
  const cs = [...journal.carnets].sort((a, b) => (a.date < b.date ? 1 : -1));
  return date ? cs.find((c) => c.date === date) : cs[0];
}

export const tailleCarte = (e) => e.title.length + e.description.length + e.footer.text.length + e.fields.reduce((n, f) => n + f.name.length + f.value.length, 0);
