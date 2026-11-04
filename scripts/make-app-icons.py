"""Build Expo launcher / splash / favicon PNGs from the fox artwork."""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "images" / "fox-emoji.jpg"
OUT = ROOT / "assets" / "images"
BG = (10, 10, 15, 255)


def square_fox(size: int, fox_ratio: float = 0.92) -> Image.Image:
    src = Image.open(SRC).convert("RGBA")
    side = min(src.size)
    left = (src.width - side) // 2
    top = (src.height - side) // 2
    src = src.crop((left, top, left + side, top + side))
    fox = src.resize(
        (max(1, int(size * fox_ratio)), max(1, int(size * fox_ratio))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), BG)
    x = (size - fox.width) // 2
    y = (size - fox.height) // 2
    canvas.paste(fox, (x, y), fox)
    return canvas


def opaque(img: Image.Image) -> Image.Image:
    bg = Image.new("RGB", img.size, BG[:3])
    bg.paste(img, mask=img.split()[-1])
    return bg


def monochrome(size: int) -> Image.Image:
    rgb = opaque(square_fox(size, 0.72))
    gray = ImageOps.grayscale(rgb)
    gray = ImageEnhance.Contrast(gray).enhance(2.4)
    # Themed Android icons: light glyph, transparent outside the fox.
    mask = gray.point(lambda p: 255 if p > 28 else 0)
    glyph = Image.new("L", (size, size), 255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.putalpha(ImageChops.multiply(glyph, mask))
    return out


def solid(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG[:3])
    ImageDraw.Draw(img).rectangle([0, 0, size, size], fill=BG[:3])
    return img


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")

    icon = opaque(square_fox(1024, 0.96))
    icon.save(OUT / "icon.png", "PNG")

    fg = opaque(square_fox(1024, 0.72))
    fg.save(OUT / "android-icon-foreground.png", "PNG")

    solid(1024).save(OUT / "android-icon-background.png", "PNG")
    monochrome(1024).save(OUT / "android-icon-monochrome.png", "PNG")

    splash = opaque(square_fox(1024, 0.88))
    splash.save(OUT / "splash-icon.png", "PNG")

    fav = opaque(square_fox(192, 0.96))
    fav.save(OUT / "favicon.png", "PNG")

    for name in (
        "icon.png",
        "android-icon-foreground.png",
        "android-icon-background.png",
        "android-icon-monochrome.png",
        "splash-icon.png",
        "favicon.png",
    ):
        path = OUT / name
        with Image.open(path) as im:
            print(f"{name} {im.size} {im.mode}")


if __name__ == "__main__":
    main()
