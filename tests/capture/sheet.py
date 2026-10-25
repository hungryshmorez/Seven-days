# python3 sheet.py <shotsDir> <outDir>: one contact sheet per episode, labelled with the story time.
import sys, os, re, collections
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
groups = collections.defaultdict(list)
for f in sorted(os.listdir(src)):
    m = re.match(r'(.+)_(\d+)\.png$', f)
    if m: groups[m.group(1)].append((int(m.group(2)), f))
for ep, items in groups.items():
    ims = [Image.open(os.path.join(src, f)).convert('RGB').resize((240, 427)) for _, f in items]
    cols = 3; rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 244, rows * 431), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, (im, (t, _)) in enumerate(zip(ims, items)):
        x, y = (i % cols) * 244 + 2, (i // cols) * 431 + 2
        sheet.paste(im, (x, y)); d.text((x + 6, y + 6), f'{ep} t={t}s', fill=(255, 255, 0))
    sheet.save(os.path.join(out, f'{ep}.png'))
