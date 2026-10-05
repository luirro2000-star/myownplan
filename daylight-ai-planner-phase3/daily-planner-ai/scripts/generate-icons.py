from pathlib import Path

from PIL import Image, ImageDraw


output = Path(__file__).parents[1] / "site" / "public" / "icons"
output.mkdir(parents=True, exist_ok=True)

for size in (192, 512):
    image = Image.new("RGB", (size, size), "#f0b84b")
    draw = ImageDraw.Draw(image)
    draw.ellipse((size * 0.20, size * 0.20, size * 0.80, size * 0.80), fill="#171714")
    draw.ellipse((size * 0.35, size * 0.35, size * 0.65, size * 0.65), fill="#f7f7f3")
    image.save(output / f"daylight-{size}.png", optimize=True)
