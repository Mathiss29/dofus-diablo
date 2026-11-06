/* Plan du serveur (tools/discord/serveur.json) → liste d'actions à faire sur Discord. Pur : testé par journal.test.mjs.
   Périmètre (choix 6C) : salons sans catégorie (généraux du studio) + catégories listées dans le plan. Jamais une catégorie Idlus.
   Un salon du plan avec un id est renommé / déplacé / changé de sujet ; sans id, il est créé ;
   un salon du périmètre absent du plan est supprimé (choix 7C), sauf si le plan dit "supprimer": false. */

export const TYPES = { texte: 0, vocal: 2, categorie: 4, annonces: 5, forum: 15, scene: 13 };
const NOM_TYPE = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]));
export const INTERDIT = /idlus/i;

export function actions(plan, salons) {
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
      const s = p.id && parId.get(p.id);
      if (p.id && !s) throw new Error(`Salon ${p.id} (${p.nom}) introuvable sur le serveur`);
      if (!s) return out.push({ type: "creer", nom: p.nom, genre, parent: catId, sujet: p.sujet, position });
      vus.add(s.id);
      if (INTERDIT.test(parId.get(s.parent_id)?.name || "")) throw new Error(`#${s.name} est dans la catégorie d'Idlus`);
      const modif = {};
      if (s.name !== p.nom) modif.name = p.nom;
      if (p.sujet !== undefined && (s.topic || "") !== p.sujet) modif.topic = p.sujet;
      if (typeof catId === "string" && s.parent_id !== catId) modif.parent_id = catId;
      if (g.categorie === null && s.parent_id) modif.parent_id = null;
      if (Object.keys(modif).length) out.push({ type: "modifier", id: s.id, de: s.name, modif });
    });
  }
  if (plan.supprimer !== false) {
    const cats = new Set(groupes.map((g) => g.categorie?.id).filter(Boolean));
    for (const s of salons) {
      if (vus.has(s.id) || s.type === TYPES.categorie || [10, 11, 12].includes(s.type)) continue; // fils : jamais
      const dansPerimetre = s.parent_id ? cats.has(s.parent_id) : true;
      if (dansPerimetre && !INTERDIT.test(s.name)) out.push({ type: "supprimer", id: s.id, de: s.name });
    }
  }
  return out;
}

export function decrire(a) {
  if (a.type === "creer") return `+ créer ${NOM_TYPE[a.genre]} « ${a.nom} »`;
  if (a.type === "renommer") return `~ catégorie « ${a.de} » → « ${a.vers} »`;
  if (a.type === "supprimer") return `- supprimer #${a.de}`;
  return `~ #${a.de} : ${Object.entries(a.modif).map(([k, v]) => `${k} = ${v === null ? "aucune catégorie" : `« ${v} »`}`).join(", ")}`;
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
