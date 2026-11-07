import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { carte, carnetDuJour, tailleCarte, pied, nomPost } from "./journal.mjs";
import { actions, planActuel, ordre, ECRIRE } from "./plan.mjs";

const journal = JSON.parse(fs.readFileSync(new URL("../../src/data/journal.json", import.meta.url), "utf8"));

describe("carte Discord du Journal", () => {
  it("tient dans les limites de Discord pour chaque carnet", () => {
    for (const c of journal.carnets) {
      const e = carte(c, journal.rubriques);
      expect(tailleCarte(e)).toBeLessThanOrEqual(6000);
      expect(e.title.length).toBeLessThanOrEqual(256);
      expect(e.fields.length).toBeLessThanOrEqual(25);
      for (const f of e.fields) expect(f.value.length).toBeLessThanOrEqual(1024);
      expect(e.footer.text).toBe(pied(c.date));
      expect(nomPost(c).length).toBeLessThanOrEqual(100);
    }
  });
  it("montre les lignes les plus récentes et compte les autres", () => {
    const lignes = Array.from({ length: 80 }, (_, i) => `Ligne numéro ${i} avec un peu de texte pour remplir la carte du jour.`);
    const e = carte({ date: "2026-11-06", titre: "T", resume: "R", lignes: { "Nouveautés": lignes } });
    expect(e.fields[0].value.startsWith("• Ligne numéro 79")).toBe(true);
    expect(e.fields[0].value).toMatch(/… et \d+ autres/);
  });
  it("prend le carnet le plus récent", () => {
    expect(carnetDuJour(journal).date).toBe([...journal.carnets].map((c) => c.date).sort().pop());
  });
});

describe("plan du serveur", () => {
  const salons = [
    { id: "1", type: 0, name: "accueil", position: 0, parent_id: null },
    { id: "10", type: 4, name: "DIABLOFUS", position: 1 },
    { id: "11", type: 0, name: "general", position: 0, parent_id: "10" },
    { id: "12", type: 0, name: "vieux", position: 1, parent_id: "10" },
    { id: "20", type: 4, name: "IDLUS", position: 2 },
    { id: "21", type: 0, name: "general", position: 0, parent_id: "20" },
  ];
  it("renomme, crée, supprime dans le périmètre et laisse Idlus", () => {
    const plan = { general: [{ id: "1", nom: "👋・accueil" }], categories: [{ categorie: { id: "10", nom: "🔥 DIABLOFUS" }, salons: [{ id: "11", nom: "💬・discussion" }, { nom: "📜・journal" }] }] };
    const a = actions(plan, salons);
    expect(a.map((x) => x.type).sort()).toEqual(["creer", "modifier", "modifier", "renommer", "supprimer"]);
    expect(a.find((x) => x.type === "supprimer").id).toBe("12");
    expect(a.some((x) => x.id === "21" || x.id === "20")).toBe(false);
  });
  it("retrouve par leur nom les salons créés sans id, sans les recréer ni les supprimer", () => {
    const plan = { general: [{ id: "1", nom: "accueil" }], categories: [{ categorie: { id: "10", nom: "DIABLOFUS" }, salons: [{ id: "11", nom: "general" }, { id: "12", nom: "vieux" }, { nom: "📜・journal" }] }] };
    const apres = [...salons, { id: "13", type: 0, name: "📜・journal", position: 2, parent_id: "10" }];
    expect(actions(plan, apres)).toEqual([]);
  });
  it("refuse un plan qui vise Idlus", () => {
    expect(() => actions({ categories: [{ categorie: { id: "20", nom: "Jeu" }, salons: [] }] }, salons)).toThrow(/Idlus/);
  });
  it("le plan actuel ne change rien quand on le réapplique", () => {
    expect(actions(planActuel(salons, /diablofus/i), salons)).toEqual([]);
  });
  it("réorganisation : annonces sur place, lecture seule, forum à étiquettes, archive des salons avec messages, ordre", () => {
    const srv = [
      { id: "10", type: 4, name: "DIABLOFUS", position: 1 },
      { id: "11", type: 0, name: "💬・discussion", position: 0, parent_id: "10" },
      { id: "12", type: 0, name: "📣・annonces", position: 1, parent_id: "10" },
      { id: "13", type: 0, name: "🐛・bugs", position: 2, parent_id: "10", last_message_id: "99" },
      { id: "14", type: 15, name: "🗞・carnets", position: 3, parent_id: "10", last_message_id: "98" },
      { id: "15", type: 0, name: "💡・idées", position: 4, parent_id: "10" },
    ];
    const plan = { categories: [{ categorie: { id: "10", nom: "DIABLOFUS" }, salons: [
      { id: "12", nom: "📣・annonces", type: "annonces", lectureSeule: true },
      { id: "11", nom: "💬・discussion" },
      { nom: "🐛・bugs", type: "forum", etiquettes: [{ nom: "Combat" }, { nom: "Corrigé", modo: true }] },
    ] }] };
    const a = actions(plan, srv, { everyone: "1" });
    expect(a.find((x) => x.id === "12" && x.type === "modifier").modif).toEqual({ type: 5 });
    const d = a.find((x) => x.type === "droits");
    expect(BigInt(d.droits.deny) & ECRIRE).toBe(ECRIRE);
    const f = a.find((x) => x.type === "creer");
    expect(f.extra.available_tags).toEqual([{ name: "Combat", moderated: false }, { name: "Corrigé", moderated: true }]);
    expect(a.find((x) => x.id === "13").modif.name).toBe("🗄・ancien-bugs");   // des messages : archivé
    expect(a.filter((x) => x.type === "supprimer").map((x) => x.id).sort()).toEqual(["14", "15"]);   // forum et salon vide : supprimés
    // une fois appliqué, le plan ne redemande rien
    const apres = [
      { id: "10", type: 4, name: "DIABLOFUS", position: 1 },
      { id: "11", type: 0, name: "💬・discussion", position: 0, parent_id: "10" },
      { id: "12", type: 5, name: "📣・annonces", position: 1, parent_id: "10", permission_overwrites: [{ id: "1", type: 0, allow: "0", deny: d.droits.deny }] },
      { id: "13", type: 0, name: "🗄・ancien-bugs", position: 2, parent_id: "10", last_message_id: "99", permission_overwrites: [{ id: "1", type: 0, allow: "0", deny: d.droits.deny }] },
      { id: "16", type: 15, name: "🐛・bugs", position: 3, parent_id: "10", available_tags: [{ id: "a", name: "Combat" }, { id: "b", name: "Corrigé" }] },
    ];
    expect(actions(plan, apres, { everyone: "1" })).toEqual([]);
    expect(ordre(plan, apres).map((x) => x.id)).toEqual(["12", "11", "16", "13"]);
    expect(ordre(plan, ordre(plan, apres).map((x) => ({ ...apres.find((s) => s.id === x.id), position: x.position })).concat(apres[0]))).toEqual([]);
  });
});
