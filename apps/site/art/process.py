"""Asset pipeline used for apps/site (kept for reproducibility).
Generated art and product screenshots -> optimised WebP srcsets in src/assets/img and public/hero, cut-outs via rembg.
Usage: python process.py <work_dir with gen/ and product/> <apps/site dir> [--cutouts]; picks map art names to files (art/picks.json)."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

scratch, site = Path(sys.argv[1]), Path(sys.argv[2])
do_cut = '--cutouts' in sys.argv
gen, product = scratch / 'gen', scratch / 'product'
out = site / 'src' / 'assets' / 'img'
out.mkdir(parents=True, exist_ok=True)
picks = json.loads((gen / 'picks.json').read_text())  # {"card-noor": "noor-101.png", "hero": "hero-7.png", ...}

def save_widths(im, base, widths, q=82, dest=None):
    for w in widths:
        w = min(w, im.width)
        h = round(im.height * w / im.width)
        im.resize((w, h), Image.LANCZOS).save((dest or out) / f'{base}-{w}.webp', 'WEBP', quality=q, method=6)

def src(name):
    p = gen / name
    return Image.open(p) if p.exists() else None

done = []
for base, name in picks.items():
    if not isinstance(name, str):
        continue
    im = src(name)
    if im is None:
        continue
    if base.startswith('card-'):
        save_widths(im.convert('RGB'), base, [400, 680])
    elif base == 'hero':
        rgb = im.convert('RGB')
        hero_dir = site / 'public' / 'hero'; hero_dir.mkdir(parents=True, exist_ok=True)
        save_widths(rgb, 'hero', [1400, 2100, 2748], q=78, dest=hero_dir)
        cx = picks.get('hero_noor_x', 0.68)  # Noor's horizontal centre, as a fraction of width
        h = rgb.height; w = round(h * 0.6)
        left = max(0, min(rgb.width - w, round(rgb.width * cx - w / 2)))
        save_widths(rgb.crop((left, 0, left + w, h)), 'hero-m', [480, 690], q=80, dest=hero_dir)
        # Social preview: hero on the right, copy on the left.
        og = rgb.resize((round(rgb.width * 630 / rgb.height), 630), Image.LANCZOS)
        ox = max(0, min(og.width - 1200, round(og.width * cx - 860)))
        og = og.crop((ox, 0, ox + 1200, 630)).convert('RGBA')
        shade = Image.new('RGBA', og.size)
        d = ImageDraw.Draw(shade)
        for x in range(1200):
            a = max(0, min(255, int(255 * (1 - (x - 420) / 420)))) if x > 420 else 255
            d.line([(x, 0), (x, 630)], fill=(0, 0, 0, int(a * 0.92)))
        og = Image.alpha_composite(og, shade)
        d = ImageDraw.Draw(og)
        fb = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 60)
        fs = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 26)
        fl = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 30)
        d.ellipse((72, 70, 104, 102), fill=(57, 135, 229)); d.ellipse((83, 81, 93, 91), fill=(255, 255, 255))
        d.text((116, 64), 'Opervio', font=fl, fill='white')
        d.multiline_text((72, 250), "You're the founder.\nYour AI team handles\nthe work.", font=fb, fill='white', spacing=6)
        d.text((72, 500), 'Noor and the specialists she hires — on your own computer.', font=fs, fill=(255, 255, 255, 170))
        og.convert('RGB').save(site / 'public' / 'og.jpg', 'JPEG', quality=86)
    elif base.startswith('close-') or base.startswith('bust-'):
        save_widths(im.convert('RGB'), base, [480], q=82)
    else:
        continue
    done.append(base)

# Cut-outs: subject on transparent background, trimmed to its bounds.
if do_cut:
    from rembg import new_session, remove
    session = new_session('isnet-general-use')
    for base, name in picks.items():
        if not base.startswith('card-'):
            continue
        im = src(name)
        if im is None:
            continue
        cid = base[5:]
        cache = gen / f'cut-{cid}.png'
        if not cache.exists() or cache.stat().st_mtime < (gen / name).stat().st_mtime:
            remove(im.convert('RGB'), session=session, post_process_mask=True).save(cache)
        cut = Image.open(cache).convert('RGBA')
        cut = cut.crop(cut.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox())
        save_widths(cut, f'cut-{cid}', [200, 400], q=86)
        done.append(f'cut-{cid}')

# Product screenshots (captured at 2x): crop to the UI that matters so it stays legible. Boxes in CSS px.
shots = {
    'ui-setup': ('setup-plate.png', (300, 40, 1140, 565)),
    'ui-plan': ('noor-plan.png', (600, 30, 1440, 555)),
    'ui-agent': ('agent-drawer.png', (600, 220, 1440, 745)),
    'ui-home': ('home-done.png', (230, 30, 1070, 555)),
}
for base, (name, box) in shots.items():
    p = product / name
    if p.exists():
        im = Image.open(p).convert('RGB')
        k = im.width / 1440
        im = im.crop(tuple(round(v * k) for v in box))
        save_widths(im, base, [840, 1680], q=86)
        done.append(base)
print('processed:', ', '.join(done))
