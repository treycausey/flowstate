#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow==12.2.0", "resvg-py==0.3.2"]
# ///
"""Regenerate web, macOS and iOS icons from assets/flowstate-icon.svg."""
from __future__ import annotations

import io
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw
import resvg_py

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/flowstate-icon.svg"


def save_png(image: Image.Image, size: int, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.Resampling.LANCZOS).save(destination)


def main() -> None:
    svg = SOURCE.read_text()
    image = Image.open(io.BytesIO(resvg_py.svg_to_bytes(svg_string=svg))).convert("RGB")
    native = ROOT / "src-tauri/icons"
    save_png(image, 1024, native / "flowstate-icon-1024.png")
    for size in (192, 512):
        save_png(image, size, ROOT / f"public/icons/icon-{size}.png")
        (ROOT / f"public/icons/icon-{size}.svg").write_text(
            svg.replace('width="1024" height="1024"', f'width="{size}" height="{size}"', 1)
        )
    save_png(image, 180, ROOT / "public/icons/apple-touch-icon.png")
    (ROOT / "app/icon.svg").write_text(svg)

    # macOS uses a rounded tile inset into a transparent canvas. iOS applies its own mask.
    mask = Image.new("L", (1024, 1024))
    ImageDraw.Draw(mask).rounded_rectangle((100, 100, 923, 923), radius=184, fill=255)
    mac = Image.new("RGBA", (1024, 1024))
    tile = Image.new("RGBA", (1024, 1024))
    tile.paste(image.resize((824, 824), Image.Resampling.LANCZOS), (100, 100))
    mac.paste(tile, (0, 0), mask)
    work = ROOT / "tmp/icons"
    work.mkdir(parents=True, exist_ok=True)
    mac.save(work / "macos.png")
    subprocess.run(
        ["bun", "run", "tauri", "icon", str(work / "macos.png"), "--output", str(work / "native")],
        cwd=ROOT, check=True,
    )
    for existing in native.iterdir():
        generated = work / "native" / existing.name
        if existing.is_file() and generated.is_file():
            shutil.copyfile(generated, existing)

    catalog = ROOT / "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset"
    for item in json.loads((catalog / "Contents.json").read_text())["images"]:
        size = round(float(item["size"].split("x")[0]) * float(item["scale"].removesuffix("x")))
        save_png(image, size, catalog / item["filename"])
    print("Updated web, macOS and iOS icon assets.")


if __name__ == "__main__":
    main()
