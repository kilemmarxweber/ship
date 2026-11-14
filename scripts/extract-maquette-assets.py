"""Crop IA Chat + Wanted assets from the ShipShop maquette (exact mockup pixels)."""

from pathlib import Path

from PIL import Image

SRC = Path(
    r"C:\Users\kilemmarxweber\.cursor\projects\c-Users-kilemmarxweber-Desktop-ShipShop\assets"
    r"\Maquette_ShipShop___IA__demandes_et_analytics-5c11f415-738e-43ea-8827-b79daaebde5f.jpg"
)
OUT = Path(__file__).resolve().parents[1] / "assets" / "images" / "maquette"
OUT.mkdir(parents=True, exist_ok=True)

im = Image.open(SRC).convert("RGBA")
w, h = im.size
col = w / 4

# Full phone refs (top band)
phone_bottom = int(h * 0.62)
im.crop((int(col), 8, int(col * 2), phone_bottom)).save(OUT / "ref-ia-chat-phone.png")
im.crop((int(col * 2), 8, int(col * 3), phone_bottom)).save(
    OUT / "ref-wanted-phone.png"
)

# Robot hero from IA phone
ref_ia = Image.open(OUT / "ref-ia-chat-phone.png")
rw, rh = ref_ia.size
ref_ia.crop((int(rw * 0.05), int(rh * 0.14), int(rw * 0.95), int(rh * 0.46))).save(
    OUT / "ia-robot.png"
)

# Phase columns (roadmap) → headphones from Phase 2 Wanted
for i in range(5):
    x0 = int(i * w / 5)
    x1 = int((i + 1) * w / 5)
    im.crop((x0, 640, x1, h)).save(OUT / f"ref-phase-{i}.png")

p2 = Image.open(OUT / "ref-phase-2.png")
pw, ph = p2.size
hp = p2.crop((int(pw * 0.08), int(ph * 0.48), int(pw * 0.78), int(ph * 0.92)))
hw, hh = hp.size
hp.crop((0, int(hh * 0.12), int(hw * 0.95), int(hh * 0.88))).save(
    OUT / "wanted-headphones.png"
)

# AirPods thumb from Wanted phone
ref_w = Image.open(OUT / "ref-wanted-phone.png")
ww, wh = ref_w.size
ref_w.crop(
    (int(ww * 0.10), int(wh * 0.52), int(ww * 0.34), int(wh * 0.62))
).save(OUT / "wanted-airpods.png")

print("wrote", sorted(p.name for p in OUT.glob("*.png")))
