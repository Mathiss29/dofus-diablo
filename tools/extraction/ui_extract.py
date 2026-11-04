import os, csv, re, sys
import UnityPy
from UnityPy import config

config.FALLBACK_UNITY_VERSION = "6000.3.16f1"

SA = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\mathi\AppData\Local\Ankama\Dofus-dofus3\Dofus_Data\StreamingAssets"
AA = os.path.join(SA, "aa", "StandaloneWindows64")
OUT = sys.argv[2] if len(sys.argv) > 2 else "dofus-ui-extract"

jobs = [(n, os.path.join(AA, n + ".bundle")) for n in [
    "uielements_assets_all", "uiassets_assets_", "uiassets_assets_1x", "uidarkstone_assets_all",
    "icons_assets_1x", "spriteassets_assets_1x", "graphics_assets_all", "figs_assets_1x"]]
jobs.append(("spells", os.path.join(SA, "Content", "Picto", "Spells", "spell_assets_1x.bundle")))


def safe(s):
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", s or "unnamed").strip(" .")
    return s[:150] or "unnamed"


rows = []
for label, path in jobs:
    outdir = os.path.join(OUT, "png", label)
    os.makedirs(outdir, exist_ok=True)
    used = set()
    n = errs = 0
    try:
        env = UnityPy.load(path)
    except Exception as e:
        print(f"{label}: LOAD FAIL {e}", flush=True)
        continue
    for obj in env.objects:
        t = obj.type.name
        if t not in ("Texture2D", "Sprite"):
            continue
        try:
            data = obj.read()
            name = getattr(data, "m_Name", None) or getattr(data, "name", "") or "unnamed"
            img = data.image
            if img is None or img.width == 0 or img.height == 0:
                continue
            base = safe(name)
            fn, k = base, 1
            while fn.lower() in used:
                k += 1
                fn = f"{base}_{k}"
            used.add(fn.lower())
            img.save(os.path.join(outdir, fn + ".png"))
            rows.append([label, t, fn, img.width, img.height])
            n += 1
        except Exception as e:
            errs += 1
    print(f"{label}: {n} images, {errs} errors", flush=True)

with open(os.path.join(OUT, "index.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["bundle", "type", "nom", "largeur", "hauteur"])
    w.writerows(rows)
print("TOTAL", len(rows))
