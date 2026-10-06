#!/usr/bin/env python3
"""Generuje ikony Androida (prod i DEV) z plików w assets/.

Uruchomienie: python3 scripts/make-icons.py
Wynik (commitowany do repozytorium):
  android/app/src/main/res/mipmap-*  -> AlvaTour (produkcja)
  android/app/src/dev/res/mipmap-*   -> AlvaTour DEV (z pomarańczowym paskiem "DEV")
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICON = Image.open(ROOT / 'assets/icon-512.png').convert('RGBA')
MASKABLE = Image.open(ROOT / 'assets/icon-maskable-512.png').convert('RGBA')
BG = '#1F3A5F'
DEV_BAND = (232, 106, 26, 255)
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
BIG = 1024


def dev_band(img, top, bottom, left=0, right=None):
    """Pasek DEV w poziomie, współrzędne jako ułamki wysokości/szerokości obrazka."""
    img = img.copy()
    w, h = img.size
    right = w if right is None else right
    d = ImageDraw.Draw(img)
    y0, y1 = int(h * top), int(h * bottom)
    d.rectangle([left, y0, right, y1], fill=DEV_BAND)
    font = ImageFont.truetype(FONT, int((y1 - y0) * 0.78))
    tw = d.textlength('DEV', font=font)
    d.text(((left + right - tw) / 2, (y0 + y1) / 2), 'DEV', font=font, fill='white', anchor='lm')
    return img


def legacy(dev):
    """Ikona dla starszych launcherów (kwadrat z zaokrągleniem) i okrągła."""
    base = ICON.resize((BIG, BIG), Image.LANCZOS)
    if dev:
        base = dev_band(base, 0.70, 0.86)
    mask = Image.new('L', (BIG, BIG), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, BIG - 1, BIG - 1], radius=int(BIG * 0.18), fill=255)
    square = Image.new('RGBA', (BIG, BIG), (0, 0, 0, 0))
    square.paste(base, (0, 0), mask)
    rmask = Image.new('L', (BIG, BIG), 0)
    ImageDraw.Draw(rmask).ellipse([0, 0, BIG - 1, BIG - 1], fill=255)
    rnd = Image.new('RGBA', (BIG, BIG), (0, 0, 0, 0))
    rnd.paste(base, (0, 0), rmask)
    return square, rnd


def foreground(dev):
    """Warstwa pierwszoplanowa ikony adaptacyjnej (108 dp, widoczne środkowe 72 dp)."""
    fg = MASKABLE.resize((BIG, BIG), Image.LANCZOS)
    if dev:
        # widoczny obszar: 1/6..5/6 wysokości; pasek w dolnej części widocznego koła
        fg = dev_band(fg, 0.64, 0.76)
    return fg


def write(res_dir, dev):
    square, rnd = legacy(dev)
    fg = foreground(dev)
    for name, k in DENSITIES.items():
        out = res_dir / f'mipmap-{name}'
        out.mkdir(parents=True, exist_ok=True)
        square.resize((round(48 * k),) * 2, Image.LANCZOS).save(out / 'ic_launcher.png')
        rnd.resize((round(48 * k),) * 2, Image.LANCZOS).save(out / 'ic_launcher_round.png')
        fg.resize((round(108 * k),) * 2, Image.LANCZOS).save(out / 'ic_launcher_foreground.png')
    return fg


write(ROOT / 'android/app/src/main/res', dev=False)
dev_fg = write(ROOT / 'android/app/src/dev/res', dev=True)
# podgląd do sprawdzenia wzrokiem (nie trafia do APK)
preview = ROOT / 'assets/icon-dev-preview.png'
dev_fg.resize((512, 512), Image.LANCZOS).save(preview)
print('Ikony gotowe.')
