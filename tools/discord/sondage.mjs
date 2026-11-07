/* Sondages natifs Discord publiés par le robot (tools/discord/sondages/<nom>.json). Fonctions pures, testées par sondage.test.mjs.
   Limites Discord : 10 réponses par sondage, question 300 caractères, réponse 55, durée 1 à 768 heures. */

export const LIMITES = { reponses: 10, question: 300, reponse: 55, dureeMax: 768, message: 2000 };

/** Nom de l'émoji du serveur pour une classe (le préfixe évite de croiser les émojis d'Idlus). */
export const emojiNom = (cle) => "dfus_" + cle;

export const texteReponse = (r) => `${r.classe} : ${r.texte}`;

/** Remplace {cle} par vars.cle (les clés inconnues restent telles quelles). */
export const remplir = (t, vars) => t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** Corps du message d'un sondage. emojis : Map cle → id d'émoji du serveur (une classe sans émoji n'en a pas). */
export function messageSondage(question, reponses, duree, emojis = new Map()) {
  return {
    poll: {
      question: { text: question },
      answers: reponses.map((r) => ({ poll_media: { text: texteReponse(r), ...(emojis.get(r.emoji) ? { emoji: { id: emojis.get(r.emoji) } } : {}) } })),
      duration: duree,
      allow_multiselect: true,
      layout_type: 1,
    },
    allowed_mentions: { parse: [] },
  };
}

/** Erreurs de la configuration (vide = tout tient dans les limites de Discord). */
export function verifier(conf) {
  const err = [];
  const duree = (d, ou) => { if (!(Number.isInteger(d) && d >= 1 && d <= LIMITES.dureeMax)) err.push(`${ou} : durée ${d} h (1 à ${LIMITES.dureeMax})`); };
  duree(conf.duree, "sondages");
  for (const s of conf.sondages) {
    if (s.question.length > LIMITES.question) err.push(`question trop longue (${s.question.length}) : ${s.question}`);
    if (s.reponses.length > LIMITES.reponses) err.push(`${s.reponses.length} réponses (10 au plus) : ${s.question}`);
    for (const r of s.reponses) if (texteReponse(r).length > LIMITES.reponse) err.push(`réponse trop longue (${texteReponse(r).length}) : ${texteReponse(r)}`);
  }
  if (conf.finale) {
    duree(conf.finale.duree, "finale");
    if (conf.finale.question.length > LIMITES.question) err.push("question de la finale trop longue");
    if (conf.finale.nombre > LIMITES.reponses) err.push("finale : 10 classes au plus");
  }
  const noms = conf.sondages.flatMap((s) => s.reponses.map((r) => r.classe));
  if (new Set(noms).size !== noms.length) err.push("une classe apparaît deux fois");
  return err;
}

/** Les réponses d'un sondage publié, avec leurs votes. Discord numérote les réponses à partir de 1 dans l'ordre d'envoi. */
export function votes(reponses, message) {
  const comptes = new Map((message?.poll?.results?.answer_counts || []).map((a) => [a.id, a.count]));
  const ids = (message?.poll?.answers || []).map((a) => a.answer_id);
  return reponses.map((r, i) => ({ ...r, votes: comptes.get(ids[i] ?? i + 1) || 0 }));
}

/** Classement décroissant ; à égalité, l'ordre du fichier. */
export const classement = (liste) => liste.map((r, i) => [r, i]).sort((a, b) => b[0].votes - a[0].votes || a[1] - b[1]).map(([r]) => r);

/** Retrouve le sondage du robot dont la question est donnée, parmi des messages d'un salon. */
export const trouverSondage = (messages, moi, question) => messages.find((m) => m.author?.id === moi && m.poll?.question?.text === question);

/** Lignes « 1. 🗡️ Sram : 42 votes » du message de résultat. emojis : Map cle → id. */
export function lignesClassement(liste, emojis = new Map()) {
  const medaille = ["🥇", "🥈", "🥉"];
  return liste.map((r, i) => {
    const e = emojis.get(r.emoji) ? `<:${emojiNom(r.emoji)}:${emojis.get(r.emoji)}> ` : "";
    return `${medaille[i] || `${i + 1}.`} ${e}**${r.classe}** : ${r.votes} vote${r.votes > 1 ? "s" : ""}`;
  }).join("\n");
}
