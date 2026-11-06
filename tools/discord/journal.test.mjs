import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { carte, carnetDuJour, tailleCarte, pied, nomPost } from "./journal.mjs";
import { actions, planActuel } from "./plan.mjs";

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
});
