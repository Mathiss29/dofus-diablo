/* Robot Discord de Diablofus sur le serveur Ombrelune Studio (jeton dans le secret GitHub DISCORD_BOT_TOKEN).
   Repris du système du projet idlus (tools/discord_api.js + discord_bot.js), réduit à ce dont le jeu a besoin.
   Lancé à la main par le workflow « Discord » (.github/workflows/discord.yml), et après chaque déploiement de diablofus.com
   par le workflow « Pages » (actions plan puis journal ; sans jeton, il ne fait rien).

   node tools/discord/discord_bot.mjs liste                      → affiche les catégories et salons du serveur, puis le plan actuel à coller dans serveur.json (rien n'est modifié)
   node tools/discord/discord_bot.mjs plan                       → applique tools/discord/serveur.json (créer, renommer, déplacer, supprimer ; jamais Idlus)
   node tools/discord/discord_bot.mjs journal [date]             → publie ou réécrit le carnet du jour : message dans DISCORD_JOURNAL,
                                                                     post dans le forum DISCORD_FORUM, rôle DISCORD_ROLE mentionné une fois par jour
   node tools/discord/discord_bot.mjs categorie <ancien> <nouveau> → renomme la catégorie du jeu
   node tools/discord/discord_bot.mjs annonce                    → publie DISCORD_TEXTE dans le salon DISCORD_SALON,
                                                                     cherché d'abord dans la catégorie DISCORD_CATEGORIE, avec la mention DISCORD_ROLE (« aucun » par défaut)
   node tools/discord/discord_bot.mjs captures <dossier>         → publie les images du dossier (10 par message) dans DISCORD_SALON, avec DISCORD_TEXTE au-dessus
   Ajouter --print pour afficher ce qui serait fait sans rien envoyer. */
import fs from "node:fs";
import { carte, carnetDuJour, pied, nomPost } from "./journal.mjs";
import { actions, decrire, planActuel, TYPES, INTERDIT } from "./plan.mjs";

const API = process.env.DISCORD_API || "https://discord.com/api/v10";
const UA = "diablofus-bot (github.com/Mathiss29/dofus-diablo, 1)";
const DRY = process.argv.includes("--print");
const [cmd, ...args] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().normalize("NFC").trim();
const slug = (s) => norm(s).replace(/[^\p{L}\p{N}-]+/gu, "");

async function api(method, path, body) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: "Bot " + process.env.DISCORD_BOT_TOKEN, "Content-Type": "application/json", "User-Agent": UA },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { const j = await res.json(); await sleep((j.retry_after || 1) * 1000 + 100); continue; }
    const txt = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${txt.slice(0, 300)}`);
    return txt ? JSON.parse(txt) : null;
  }
  throw new Error(`${method} ${path} : trop de limitations de débit`);
}

async function guildId() {
  if (process.env.DISCORD_GUILD_ID) return process.env.DISCORD_GUILD_ID;
  const gs = await api("GET", "/users/@me/guilds");
  if (gs.length !== 1) throw new Error(`Le robot est sur ${gs.length} serveurs : précise DISCORD_GUILD_ID.`);
  return gs[0].id;
}

const CATEGORY = 4;
// salon cherché dans la catégorie du jeu en priorité (les autres jeux du studio ont aussi un #annonces)
async function findChannel(gid, name, opt = {}) {
  const all = opt.salons || await api("GET", `/guilds/${gid}/channels`);
  const cat = process.env.DISCORD_CATEGORIE ? all.find((c) => c.type === CATEGORY && norm(c.name).includes(norm(process.env.DISCORD_CATEGORIE))) : null;
  const hits = all.filter((c) => c.type !== CATEGORY && slug(c.name) === slug(name) && (opt.type === undefined || c.type === opt.type));
  const c = (cat && hits.find((h) => h.parent_id === cat.id)) || (hits.length === 1 ? hits[0] : null);
  if (c && INTERDIT.test(all.find((k) => k.id === c.parent_id)?.name || "")) throw new Error("Salon d'Idlus : " + name);
  if (!c && opt.facultatif) return null;
  if (!c) throw new Error(hits.length ? `Plusieurs salons #${name} : précise la catégorie.` : "Salon introuvable : " + name);
  return c.id;
}
const roleId = async (gid, name) => ((await api("GET", `/guilds/${gid}/roles`)).find((r) => r.name === name) || {}).id;

function texte() {
  const t = (process.env.DISCORD_TEXTE || "").replace(/\\n/g, "\n").trim();
  if (t.length > 1900) { console.log("Texte trop long :", t.length, "caractères (1 900 au plus)."); process.exit(1); }
  return t;
}

async function main() {
  if (cmd === "liste") {
    const all = await api("GET", `/guilds/${await guildId()}/channels`);
    const cats = all.filter((c) => c.type === CATEGORY).sort((a, b) => a.position - b.position);
    const under = (id) => all.filter((c) => c.type !== CATEGORY && c.parent_id === id).sort((a, b) => a.position - b.position);
    for (const c of under(null)) console.log("#" + c.name);
    for (const k of cats) { console.log(`\n[${k.name}]`); for (const c of under(k.id)) console.log("  #" + c.name); }
    console.log("\n--- plan actuel (catégorie du jeu + salons généraux), à coller dans tools/discord/serveur.json ---");
    console.log(JSON.stringify(planActuel(all, new RegExp(process.env.DISCORD_CATEGORIE || "diablofus", "i")), null, 2));
  } else if (cmd === "plan") {
    const plan = JSON.parse(fs.readFileSync(new URL("./serveur.json", import.meta.url), "utf8"));
    if (!plan.actif) return console.log("serveur.json : plan inactif (\"actif\": false), rien à faire.");
    const gid = await guildId(), all = await api("GET", `/guilds/${gid}/channels`);
    const todo = actions(plan, all);
    if (!todo.length) return console.log("Plan : le serveur est déjà à jour.");
    for (const a of todo) console.log(decrire(a));
    if (DRY) return console.log(`(essai : ${todo.length} changement(s) non appliqué(s))`);
    const crees = new Map();
    for (const a of todo) {
      if (a.type === "supprimer") await api("DELETE", `/channels/${a.id}`);
      else if (a.type === "renommer") await api("PATCH", `/channels/${a.id}`, { name: a.vers });
      else if (a.type === "modifier") await api("PATCH", `/channels/${a.id}`, a.modif);
      else {
        const parent = a.parent && typeof a.parent === "object" ? crees.get(a.parent.cle) : a.parent;
        const c = await api("POST", `/guilds/${gid}/channels`, { name: a.nom, type: a.genre, ...(parent ? { parent_id: parent } : {}), ...(a.sujet ? { topic: a.sujet } : {}) });
        if (a.cle) crees.set(a.cle, c.id);
      }
    }
    console.log(`Plan appliqué : ${todo.length} changement(s).`);
  } else if (cmd === "journal") {
    const journal = JSON.parse(fs.readFileSync(new URL("../../src/data/journal.json", import.meta.url), "utf8"));
    const c = carnetDuJour(journal, args[0]);
    if (!c) throw new Error("Aucun carnet " + (args[0] || ""));
    const embed = carte(c, journal.rubriques);
    const salon = process.env.DISCORD_JOURNAL || "journal", forum = process.env.DISCORD_FORUM || "carnets", roleName = (process.env.DISCORD_ROLE || "aucun").trim();
    if (DRY) return console.log(`[#${salon} + forum #${forum} @${roleName}]\n` + JSON.stringify(embed, null, 2));
    const gid = await guildId(), all = await api("GET", `/guilds/${gid}/channels`);
    const marque = pied(c.date);
    // 1B : un message par jour dans #journal, réécrit à chaque déploiement ; 4B : rôle mentionné à la création seulement
    const ch = await findChannel(gid, salon, { salons: all, type: TYPES.texte, facultatif: true }) || await findChannel(gid, salon, { salons: all, type: TYPES.annonces, facultatif: true });
    if (ch) {
      const moi = (await api("GET", "/users/@me")).id;
      const last = await api("GET", `/channels/${ch}/messages?limit=50`);
      const deja = last.find((m) => m.author?.id === moi && m.embeds?.some((e) => e.footer?.text === marque));
      if (deja) { await api("PATCH", `/channels/${ch}/messages/${deja.id}`, { embeds: [embed] }); console.log(`#${salon} : carnet du ${c.date} réécrit.`); }
      else {
        const role = roleName === "aucun" ? null : await roleId(gid, roleName);
        if (roleName !== "aucun" && !role) console.log("Rôle introuvable, pas de mention :", roleName);
        await api("POST", `/channels/${ch}/messages`, { content: role ? `<@&${role}>` : "", embeds: [embed], allowed_mentions: { parse: [], roles: role ? [role] : [] } });
        console.log(`#${salon} : carnet du ${c.date} publié.`);
      }
    } else console.log(`Salon #${salon} introuvable : message du jour non publié.`);
    // 3C : un post par jour dans le forum, où les joueurs répondent ; le premier message est réécrit
    const fo = await findChannel(gid, forum, { salons: all, type: TYPES.forum, facultatif: true });
    if (fo) {
      const debut = nomPost(c).split(" · ")[0] + " · ";
      const fils = (await api("GET", `/guilds/${gid}/threads/active`)).threads || [];
      const post = fils.find((t) => t.parent_id === fo && t.name.startsWith(debut));
      if (post) {
        await api("PATCH", `/channels/${post.id}/messages/${post.id}`, { embeds: [embed] });
        if (post.name !== nomPost(c)) await api("PATCH", `/channels/${post.id}`, { name: nomPost(c) });
        console.log(`Forum #${forum} : post du ${c.date} réécrit.`);
      } else {
        await api("POST", `/channels/${fo}/threads`, { name: nomPost(c), auto_archive_duration: 10080, message: { embeds: [embed], allowed_mentions: { parse: [] } } });
        console.log(`Forum #${forum} : post du ${c.date} créé.`);
      }
    } else console.log(`Forum #${forum} introuvable : pas de post.`);
  } else if (cmd === "categorie") {
    const [ancien, nouveau] = args;
    if (!ancien || !nouveau) { console.log("Usage : categorie <ancien nom (ou un morceau)> <nouveau nom>"); process.exit(1); }
    const all = await api("GET", `/guilds/${await guildId()}/channels`);
    const hits = all.filter((c) => c.type === CATEGORY && norm(c.name).includes(norm(ancien)));
    if (hits.length !== 1) throw new Error(`${hits.length} catégories contiennent « ${ancien} » : ${hits.map((c) => c.name).join(", ") || "aucune"}`);
    if (DRY) return console.log(`[${hits[0].name}] → [${nouveau}]`);
    await api("PATCH", `/channels/${hits[0].id}`, { name: nouveau });
    console.log(`Catégorie renommée : [${hits[0].name}] → [${nouveau}]`);
  } else if (cmd === "annonce") {
    const text = texte();
    if (!text) { console.log("Texte attendu dans DISCORD_TEXTE."); process.exit(1); }
    const salon = (process.env.DISCORD_SALON || "annonces").trim(), roleName = (process.env.DISCORD_ROLE || "aucun").trim();
    if (DRY) return console.log(`[#${salon} @${roleName}]\n${text}`);
    const gid = await guildId(), ch = await findChannel(gid, salon);
    const last = await api("GET", `/channels/${ch}/messages?limit=20`);
    if (last.some((m) => (m.content || "").includes(text.slice(0, 80)))) return console.log("Déjà publié.");
    const role = roleName === "aucun" ? null : await roleId(gid, roleName);
    if (roleName !== "aucun" && !role) throw new Error("Rôle introuvable : " + roleName);
    await api("POST", `/channels/${ch}/messages`, { content: (role ? `<@&${role}> ` : "") + text, allowed_mentions: { parse: [], roles: role ? [role] : [] } });
    console.log(`Annonce publiée dans #${salon} :`, text.length, "caractères");
  } else if (cmd === "captures") {
    const dir = args[0] || ".", text = texte(), salon = (process.env.DISCORD_SALON || "captures").trim();
    const imgs = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|gif|mp4|webm)$/i.test(f)).sort();
    if (!imgs.length) { console.log("Aucune image dans", dir); process.exit(1); }
    if (DRY) return console.log(`#${salon}\n${text}\n${imgs.join("\n")}`);
    const ch = await findChannel(await guildId(), salon);
    for (let i = 0; i < imgs.length; i += 10) { // Discord : 10 pièces jointes par message au plus
      const fd = new FormData();
      fd.append("payload_json", JSON.stringify({ content: i ? "" : text, allowed_mentions: { parse: [] } }));
      imgs.slice(i, i + 10).forEach((f, j) => fd.append(`files[${j}]`, new Blob([fs.readFileSync(`${dir}/${f}`)]), f));
      const res = await fetch(`${API}/channels/${ch}/messages`, { method: "POST", headers: { Authorization: "Bot " + process.env.DISCORD_BOT_TOKEN, "User-Agent": UA }, body: fd });
      if (!res.ok) throw new Error(`envoi des images → ${res.status} ${(await res.text()).slice(0, 300)}`);
    }
    console.log(`Images publiées dans #${salon} :`, imgs.length);
  } else {
    console.log("Commandes : liste, plan, journal [date], categorie <ancien> <nouveau>, annonce, captures <dossier> (voir l'en-tête du fichier)");
    process.exit(1);
  }
}

if (!DRY && !process.env.DISCORD_BOT_TOKEN) {
  console.log("Secret DISCORD_BOT_TOKEN manquant (Settings > Secrets and variables > Actions).");
  process.exit(process.argv.includes("--auto") ? 0 : 1); // après un déploiement : ne pas mettre le workflow en rouge
}
main().catch((e) => { console.error(e.message); process.exit(1); });
