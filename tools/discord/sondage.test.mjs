import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { verifier, messageSondage, votes, classement, trouverSondage, lignesClassement, remplir, texteReponse, emojiNom, LIMITES } from "./sondage.mjs";

const lire = (n) => JSON.parse(fs.readFileSync(new URL(`./sondages/${n}`, import.meta.url), "utf8"));
const fichiers = fs.readdirSync(new URL("./sondages/", import.meta.url)).filter((f) => f.endsWith(".json"));

describe("sondages Discord", () => {
  it("chaque sondage tient dans les limites de Discord", () => {
    for (const f of fichiers) expect(verifier(lire(f)), f).toEqual([]);
  });
  it("chaque classe a son symbole et un nom d'émoji valide", () => {
    for (const f of fichiers) for (const s of lire(f).sondages) for (const r of s.reponses) {
      expect(fs.existsSync(new URL(`./sondages/symboles/${r.emoji}.png`, import.meta.url)), r.emoji).toBe(true);
      expect(emojiNom(r.emoji)).toMatch(/^\w{2,32}$/);
    }
  });
  it("le sondage des classes couvre les 16 classes sans Iop, Crâ ni Osamodas", () => {
    const c = lire("classes.json").sondages.flatMap((s) => s.reponses.map((r) => r.classe));
    expect(c).toHaveLength(16);
    for (const x of ["Iop", "Crâ", "Osamodas"]) expect(c).not.toContain(x);
  });
  it("signale ce qui dépasse", () => {
    const r = { classe: "X", texte: "a".repeat(60), emoji: "x" };
    const e = verifier({ duree: 1000, sondages: [{ question: "q", reponses: Array(11).fill(r) }] });
    expect(e.length).toBeGreaterThanOrEqual(3);
    expect(texteReponse(r).length).toBeGreaterThan(LIMITES.reponse);
  });
  it("construit le message du sondage avec les émojis connus", () => {
    const rep = [{ classe: "Sram", texte: "pièges", emoji: "sram" }, { classe: "Féca", texte: "bouclier", emoji: "feca" }];
    const m = messageSondage("Q ?", rep, 72, new Map([["sram", "123"]]));
    expect(m.poll.duration).toBe(72);
    expect(m.poll.allow_multiselect).toBe(true);
    expect(m.poll.answers[0].poll_media).toEqual({ text: "Sram : pièges", emoji: { id: "123" } });
    expect(m.poll.answers[1].poll_media.emoji).toBeUndefined();
  });
  it("compte les votes et classe (égalité = ordre du fichier)", () => {
    const rep = ["A", "B", "C"].map((c) => ({ classe: c, texte: "t", emoji: c.toLowerCase() }));
    const msg = { author: { id: "moi" }, poll: { question: { text: "Q" }, answers: [{ answer_id: 1 }, { answer_id: 2 }, { answer_id: 3 }], results: { is_finalized: true, answer_counts: [{ id: 2, count: 5 }, { id: 3, count: 5 }, { id: 1, count: 1 }] } } };
    expect(trouverSondage([{ author: { id: "autre" } }, msg], "moi", "Q")).toBe(msg);
    const c = classement(votes(rep, msg));
    expect(c.map((r) => r.classe)).toEqual(["B", "C", "A"]);
    expect(lignesClassement(c, new Map([["b", "9"]]))).toBe("🥇 <:dfus_b:9> **B** : 5 votes\n🥈 **C** : 5 votes\n🥉 **A** : 1 vote");
  });
  it("remplit les champs du texte", () => {
    expect(remplir("{mention} va dans {fil} {inconnu}", { mention: "@everyone", fil: "<#1>" })).toBe("@everyone va dans <#1> {inconnu}");
  });
});
