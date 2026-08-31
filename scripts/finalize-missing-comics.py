from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT.parent / "generated_images"
BASE = ROOT / "public/assets/chengyu/pages/70.jpg"

sources = {
  88:"exec-c66c6c32-6a12-46ea-9d53-b060b9cc212b.png",
  89:"exec-a63258d2-6067-4475-aa88-c3ff32abc6e4.png",
  90:"exec-6123dbf0-3ad7-488a-b7a6-9c93dbbb1d3b.png",
  91:"exec-85933ef2-605a-4b8c-93d6-a2c8f8c70714.png",
  92:"exec-6f3bcefc-25d3-465f-9b2c-10b1d9606ef4.png",
  93:"exec-e09c6cc6-1e4d-4dad-b11c-d82a2dab9728.png",
  94:"exec-d8dabbba-1ace-4e8c-99c4-a71e76f1ba25.png",
  95:"exec-512641a1-3dae-4ff7-affb-968e6cb11695.png",
  96:"exec-488aa2c1-0b3b-4ec4-90db-eb0b96218104.png",
  97:"exec-c23eb336-c8e6-45b2-92e1-e8e7d6771a6b.png",
  98:"exec-7600ee43-3097-4d70-8b3a-5916b08b2e8b.png",
}

# Reuse the already-published crest that visibly reads “南华中学 / N.H.”.
with Image.open(BASE) as base:
    crest = base.convert("RGB").crop((995, 45, 1122, 275))

for number, filename in sources.items():
    path = GEN / filename
    with Image.open(path) as src:
        image = src.convert("RGB")
        # Cover any model-drawn school badge or the reserved blank with a clean panel.
        box_w, box_h = 190, 225
        x0, y0 = image.width - box_w - 18, 18
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((x0, y0, x0 + box_w, y0 + box_h), radius=16,
                               fill="white", outline="#c89121", width=4)
        fitted = ImageOps.contain(crest, (box_w - 24, box_h - 20), Image.Resampling.LANCZOS)
        image.paste(fitted, (x0 + (box_w-fitted.width)//2, y0 + (box_h-fitted.height)//2))
        image.save(GEN / f"{number}_补全最终版_南华熊成语漫画.png", "PNG", optimize=True)

print("Finalized comics 88–98 with the published 南华中学 crest.")
