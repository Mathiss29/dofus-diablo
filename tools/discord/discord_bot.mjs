/* Robot Discord de Diablofus sur le serveur Ombrelune Studio (jeton dans le secret GitHub DISCORD_BOT_TOKEN).
   Repris du système du projet idlus (tools/discord_api.js + discord_bot.js), réduit à ce dont le jeu a besoin.
   Lancé par le workflow « Discord » (.github/workflows/discord.yml), jamais automatiquement.

   node tools/discord/discord_bot.mjs liste                      → affiche les catégories et salons du serveur (rien n'est modifié)
   node tools/discord/discord_bot.mjs categorie <ancien> <nouveau> → renomme la catégorie du jeu
   node tools/discord/discord_bot.mjs annonce                    → publie DISCORD_TEXTE dans le salon DISCORD_SALON,
                                                                     cherché d'abord dans la catégorie DISCORD_CATEGORIE, avec la mention DISCORD_ROLE (« aucun » par défaut)
   node tools/discord/discord_bot.mjs captures <dossier>         → publie les images du dossier (10 par message) dans DISCORD_SALON, avec DISCORD_TEXTE au-dessus
   Ajouter --print pour afficher ce qui serait fait sans rien envoyer. */
import fs from "node:fs";

const API = process.env.DISCORD_API || "https://discord.com/api/v10";
const UA = "diablofus-bot (github.com/Mathiss29/dofus-diablo, 1)";
const DRY = process.argv.includes("--print");
const [cmd, ...args] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().normalize("NFC").trim();

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
async function findChannel(gid, name) {
  const all = await api("GET", `/guilds/${gid}/channels`);
  const cat = process.env.DISCORD_CATEGORIE ? all.find((c) => c.type === CATEGORY && norm(c.name).includes(norm(process.env.DISCORD_CATEGORIE))) : null;
  const hits = all.filter((c) => c.type !== CATEGORY && norm(c.name) === norm(name));
  const c = (cat && hits.find((h) => h.parent_id === cat.id)) || (hits.length === 1 ? hits[0] : null);
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
    console.log("Commandes : liste, categorie <ancien> <nouveau>, annonce, captures <dossier> (voir l'en-tête du fichier)");
    process.exit(1);
  }
}

if (!DRY && !process.env.DISCORD_BOT_TOKEN) { console.log("Secret DISCORD_BOT_TOKEN manquant (Settings > Secrets and variables > Actions)."); process.exit(1); }
main().catch((e) => { console.error(e.message); process.exit(1); });
