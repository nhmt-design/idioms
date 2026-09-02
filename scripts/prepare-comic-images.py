from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "generated_images"
PAGES = ROOT / "public/assets/chengyu/pages"
THUMBS = ROOT / "public/assets/chengyu/thumbs"

def choose_source(num: int) -> Path:
    matches = sorted(SOURCE.glob(f"{num}_*.png"))
    if not matches:
        raise FileNotFoundError(f"Missing generated comic {num}")
    v2 = [path for path in matches if path.stem.endswith("_v2")]
    if num == 71 or num >= 107:
        if len(v2) != 1:
            raise RuntimeError(f"Expected one final v2 comic for {num}, found {len(v2)}")
        return v2[0]
    plain = [path for path in matches if not path.stem.endswith("_v2")]
    if len(plain) != 1:
        raise RuntimeError(f"Expected one final comic for {num}, found {len(plain)}")
    return plain[0]

def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGB", size, "white")
    fitted = ImageOps.contain(image, size, Image.Resampling.LANCZOS)
    canvas.paste(fitted, ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2))
    return canvas

for number in range(71, 139):
    source = choose_source(number)
    with Image.open(source) as original:
        rgb = original.convert("RGB")
        rgb.save(PAGES / f"{number}.jpg", "JPEG", quality=88, optimize=True, progressive=True)
        contain(rgb, (360, 450)).save(THUMBS / f"{number}.jpg", "JPEG", quality=82, optimize=True, progressive=True)

print("Prepared comic pages and thumbnails for idioms 71–138; approved gold cards were left untouched.")
