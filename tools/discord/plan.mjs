/* Plan du serveur (tools/discord/serveur.json) → liste d'actions à faire sur Discord. Pur : testé par journal.test.mjs.
   Périmètre (choix 6C) : salons sans catégorie (généraux du studio) + catégories listées dans le plan. Jamais une catégorie Idlus.
   Un salon du plan avec un id est renommé / déplacé / changé de sujet ; sans id, il est créé ;
   un salon du périmètre absent du plan est supprimé (choix 7C), sauf si le plan dit "supprimer": false.
   Réorganisation (maquette « Salons », 2026-11-07) :
   - "lectureSeule": true → @everyone ne peut ni écrire ni ouvrir de fil (toi et le robot, administrateurs, si) ;
   - "etiquettes" (forums) : [{ "nom", "emoji", "modo" }] ajoutées si elles manquent (modo = posée seulement par la modération) ;
   - "reaction" (forums) : réaction par défaut des posts (vote) ;
   - texte ↔ annonces : le type change sur place ; tout autre changement de type recrée le salon ;
   - un salon texte avec des messages n'est jamais supprimé : il est archivé (« 🗄・ancien-… », lecture seule, rangé en bas) ;
   - ordre() remet les salons de chaque catégorie dans l'ordre du plan. */

export const TYPES = { texte: 0, vocal: 2, categorie: 4, annonces: 5, forum: 15, scene: 13 };
const NOM_TYPE = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]));
// les autres jeux du studio (Idlus, Re:Arise) ne sont jamais touchés
export const slug = (s) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}-]+/gu, "");
export const INTERDIT = /idlus|re:? ?arise/i;

// écrire, écrire dans les fils, créer des fils publics / privés
export const ECRIRE = (1n << 11n) | (1n << 38n) | (1n << 35n) | (1n << 36n);
export const ARCHIVE = "🗄・ancien-";
const TEXTUEL = [0, 5];

/** Droits de @everyone à poser pour un salon en lecture seule, ou null s'ils y sont déjà. */
export function lectureSeule(s, everyone) {
  const o = (s.permission_overwrites || []).find((x) => x.id === everyone) || { allow: "0", deny: "0" };
  const deny = BigInt(o.deny || 0), allow = BigInt(o.allow || 0);
  if ((deny & ECRIRE) === ECRIRE && !(allow & ECRIRE)) return null;
  return { id: everyone, type: 0, allow: String(allow & ~ECRIRE), deny: String(deny | ECRIRE) };
}
const tag = (t) => ({ name: t.nom, ...(t.emoji ? { emoji_name: t.emoji } : {}), moderated: !!t.modo });

/** Salon réel qui correspond à une ligne du plan (par id, sinon même nom sans émojis et même type dans la catégorie). */
function trouver(p, salons, catId, vus) {
  const genre = TYPES[p.type || "texte"];
  if (p.id) return salons.find((x) => x.id === p.id);
  return salons.find((x) => !vus.has(x.id) && x.type === genre && (x.parent_id || null) === (typeof catId === "string" ? catId : null) && slug(x.name) === slug(p.nom));
}

export function actions(plan, salons, { everyone } = {}) {
  const out = [];
  const parId = new Map(salons.map((s) => [s.id, s]));
  const vus = new Set();
  const groupes = [{ categorie: null, salons: plan.general || [] }, ...(plan.categories || [])];
  for (const g of groupes) {
    let catId = null;
    if (g.categorie) {
      if (INTERDIT.test(g.categorie.nom) || (g.categorie.id && INTERDIT.test(parId.get(g.categorie.id)?.name || ""))) throw new Error("Le plan ne doit pas toucher à Idlus : " + g.categorie.nom);
      const k = g.categorie.id && parId.get(g.categorie.id);
      if (g.categorie.id && !k) throw new Error(`Catégorie ${g.categorie.id} (${g.categorie.nom}) introuvable sur le serveur`);
      if (k) { vus.add(k.id); catId = k.id; if (k.name !== g.categorie.nom) out.push({ type: "renommer", id: k.id, de: k.name, vers: g.categorie.nom, categorie: true }); }
      else out.push({ type: "creer", nom: g.categorie.nom, genre: TYPES.categorie, cle: g.categorie.nom });
      catId = catId || { cle: g.categorie.nom };
    }
    (g.salons || []).forEach((p, position) => {
      const genre = TYPES[p.type || "texte"];
      if (genre === undefined) throw new Error("Type de salon inconnu : " + p.type);
      if (p.id && !parId.get(p.id)) throw new Error(`Salon ${p.id} (${p.nom}) introuvable sur le serveur`);
      // sans id : un salon de même nom (sans les émojis) dans la catégorie compte comme celui du plan, pour ne pas le recréer à chaque déploiement
      const s = trouver(p, salons, catId, vus);
      if (!s) {
        const extra = {};
        if (p.lectureSeule && everyone) extra.permission_overwrites = [lectureSeule({}, everyone)];
        if (p.etiquettes) extra.available_tags = p.etiquettes.map(tag);
        if (p.reaction) extra.default_reaction_emoji = { emoji_id: null, emoji_name: p.reaction };
        return out.push({ type: "creer", nom: p.nom, genre, parent: catId, sujet: p.sujet, position, ...(Object.keys(extra).length ? { extra } : {}) });
      }
      vus.add(s.id);
      if (INTERDIT.test(parId.get(s.parent_id)?.name || "")) throw new Error(`#${s.name} est dans la catégorie d'Idlus`);
      const modif = {};
      if (s.name !== p.nom) modif.name = p.nom;
      if (p.sujet !== undefined && (s.topic || "") !== p.sujet) modif.topic = p.sujet;
      if (typeof catId === "string" && s.parent_id !== catId) modif.parent_id = catId;
      if (g.categorie === null && s.parent_id) modif.parent_id = null;
      if (s.type !== genre) {
        if (!TEXTUEL.includes(s.type) || !TEXTUEL.includes(genre)) throw new Error(`#${s.name} : un salon ne peut pas passer de ${NOM_TYPE[s.type]} à ${p.type} (retire son id pour en créer un nouveau)`);
        modif.type = genre;
      }
      if (p.etiquettes) {
        const ont = s.available_tags || [], manque = p.etiquettes.filter((t) => !ont.some((x) => x.name === t.nom));
        if (manque.length) modif.available_tags = [...ont, ...manque.map(tag)];
      }
      if (p.reaction && s.default_reaction_emoji?.emoji_name !== p.reaction) modif.default_reaction_emoji = { emoji_id: null, emoji_name: p.reaction };
      if (Object.keys(modif).length) out.push({ type: "modifier", id: s.id, de: s.name, modif });
      const droits = p.lectureSeule && everyone && lectureSeule(s, everyone);
      if (droits) out.push({ type: "droits", id: s.id, de: s.name, droits });
    });
  }
  if (plan.supprimer !== false) {
    const cats = new Set(groupes.map((g) => g.categorie?.id).filter(Boolean));
    for (const s of salons) {
      if (vus.has(s.id) || s.type === TYPES.categorie || [10, 11, 12].includes(s.type)) continue; // fils : jamais
      const dansPerimetre = s.parent_id ? cats.has(s.parent_id) : true;
      if (!dansPerimetre || INTERDIT.test(s.name)) continue;
      // un salon texte qui a déjà des messages est archivé plutôt que supprimé (maquette « Salons » 3B)
      if (TEXTUEL.includes(s.type) && s.last_message_id) {
        const nom = s.name.startsWith(ARCHIVE) ? s.name : ARCHIVE + slug(s.name);
        const droits = everyone && lectureSeule(s, everyone);
        if (nom !== s.name) out.push({ type: "modifier", id: s.id, de: s.name, modif: { name: nom } });
        if (droits) out.push({ type: "droits", id: s.id, de: nom, droits });
      } else out.push({ type: "supprimer", id: s.id, de: s.name });
    }
  }
  return out;
}

export function decrire(a) {
  if (a.type === "creer") return `+ créer ${NOM_TYPE[a.genre]} « ${a.nom} »`;
  if (a.type === "renommer") return `~ catégorie « ${a.de} » → « ${a.vers} »`;
  if (a.type === "supprimer") return `- supprimer #${a.de}`;
  if (a.type === "droits") return `~ #${a.de} : lecture seule pour @everyone`;
  const val = (k, v) => v === null ? "aucune catégorie" : k === "type" ? NOM_TYPE[v] : k === "available_tags" ? v.map((t) => t.name).join(" / ") : k === "default_reaction_emoji" ? v.emoji_name : `« ${v} »`;
  return `~ #${a.de} : ${Object.entries(a.modif).map(([k, v]) => `${k} = ${val(k, v)}`).join(", ")}`;
}

/** Nouvel ordre des salons de chaque catégorie du plan : [{ id, position }], vide si tout est déjà rangé.
   Les salons du plan d'abord, dans l'ordre du fichier, puis les autres (archives) dans leur ordre actuel. */
export function ordre(plan, salons) {
  const out = [];
  const tri = (a, b) => a.position - b.position || (BigInt(a.id) < BigInt(b.id) ? -1 : 1);
  for (const g of plan.categories || []) {
    const catId = g.categorie?.id;
    if (!catId) continue;
    const ici = salons.filter((s) => s.parent_id === catId && ![10, 11, 12].includes(s.type)).sort(tri);
    const vus = new Set(), voulu = [];
    for (const p of g.salons || []) { const s = trouver(p, ici, catId, vus); if (s) { vus.add(s.id); voulu.push(s); } }
    voulu.push(...ici.filter((s) => !vus.has(s.id)));
    if (voulu.some((s, i) => s.id !== ici[i].id)) out.push(...voulu.map((s, i) => ({ id: s.id, position: i, nom: s.name })));
  }
  return out;
}

/** Plan tiré de l'état actuel du serveur (action « liste ») : à coller dans serveur.json puis à modifier. */
export function planActuel(salons, categoriesGerees) {
  const tri = (a, b) => a.position - b.position;
  const sal = (s) => ({ id: s.id, nom: s.name, type: NOM_TYPE[s.type] || "texte", ...(s.topic ? { sujet: s.topic } : {}) });
  const cats = salons.filter((s) => s.type === TYPES.categorie && !INTERDIT.test(s.name) && categoriesGerees.test(s.name)).sort(tri);
  return {
    actif: true,
    general: salons.filter((s) => !s.parent_id && s.type !== TYPES.categorie && ![10, 11, 12].includes(s.type)).sort(tri).map(sal),
    categories: cats.map((k) => ({ categorie: { id: k.id, nom: k.name }, salons: salons.filter((s) => s.parent_id === k.id).sort(tri).map(sal) })),
  };
}
