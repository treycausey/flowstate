#!/usr/bin/env python3
"""Generate Flowstate icon PNG assets from the primary logo geometry."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw

# Colours align with the SVG assets in public/icons/
ACCENT = (14, 165, 233)  # #0ea5e9
ACCENT_DARK = (2, 132, 199)  # #0284c7
SURFACE = (224, 242, 254)  # #e0f2fe


@dataclass(frozen=True)
class Cubic:
    start: tuple[float, float]
    control1: tuple[float, float]
    control2: tuple[float, float]
    end: tuple[float, float]


def _draw_wave(
    draw: ImageDraw.ImageDraw,
    segments: Sequence[Cubic],
    scale: float,
    width: int,
    color: tuple[int, int, int],
) -> None:
    points: list[tuple[float, float]] = []

    def cubic_point(seg: Cubic, t: float) -> tuple[float, float]:
        inv = 1 - t
        x = (
            inv**3 * seg.start[0]
            + 3 * inv**2 * t * seg.control1[0]
            + 3 * inv * t**2 * seg.control2[0]
            + t**3 * seg.end[0]
        )
        y = (
            inv**3 * seg.start[1]
            + 3 * inv**2 * t * seg.control1[1]
            + 3 * inv * t**2 * seg.control2[1]
            + t**3 * seg.end[1]
        )
        return x * scale, y * scale

    samples = 96
    for seg in segments:
        for i in range(samples + 1):
            t = i / samples
            pt = cubic_point(seg, t)
            if points and pt == points[-1]:
                continue
            points.append(pt)

    draw.line(points, fill=color, width=width, joint="curve")


def _build_wave_paths() -> tuple[tuple[Cubic, ...], tuple[Cubic, ...]]:
    # Geometry lifted from public/icons/icon-512.svg converted to absolute coordinates.
    upper = (
        Cubic((56, 240), (100, 240), (122, 174), (188, 174)),
        Cubic((188, 174), (254, 174), (276, 240), (342, 240)),
        Cubic((342, 240), (408, 240), (430, 174), (452, 174)),
    )
    lower = (
        Cubic((56, 304), (100, 304), (122, 238), (188, 238)),
        Cubic((188, 238), (254, 238), (276, 304), (342, 304)),
        Cubic((342, 304), (408, 304), (430, 238), (452, 238)),
    )
    return upper, lower


def generate_icon(size: int, dest: Path) -> None:
    """Render a square PNG icon at the requested size."""
    oversample = 4
    canvas_size = size * oversample
    scale = canvas_size / 512

    image = Image.new("RGBA", (canvas_size, canvas_size), ACCENT)
    draw = ImageDraw.Draw(image)

    inset = 36 * scale
    inner = 440 * scale
    radius = 56 * scale
    draw.rounded_rectangle(
        (inset, inset, inset + inner, inset + inner),
        radius=radius,
        fill=SURFACE,
    )

    upper, lower = _build_wave_paths()
    stroke_width = max(2, int(24 * scale))

    # Lay down a soft base stroke for a subtle glow.
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_width = stroke_width + oversample * 2
    _draw_wave(glow_draw, upper, scale, glow_width, ACCENT)
    _draw_wave(glow_draw, lower, scale, glow_width, ACCENT)
    image = Image.alpha_composite(image, glow)

    # Primary stroke in the darker accent tone.
    _draw_wave(draw, upper, scale, stroke_width, ACCENT_DARK)
    _draw_wave(draw, lower, scale, stroke_width, ACCENT_DARK)

    if size != canvas_size:
        image = image.resize((size, size), Image.Resampling.LANCZOS)

    dest.parent.mkdir(parents=True, exist_ok=True)
    image.save(dest, format="PNG")


def main(sizes: Iterable[int], output_dir: Path) -> None:
    for size in sizes:
        out = output_dir / f"flowstate-icon-{size}.png"
        generate_icon(size, out)
        print(f"wrote {out}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate Flowstate PNG icons")
    parser.add_argument("--size", action="append", type=int, dest="sizes", help="One or more target sizes")
    parser.add_argument("--output", type=Path, default=Path("src-tauri/icons"), help="Output directory for PNG files")
    args = parser.parse_args()

    sizes = args.sizes or [1024]
    main(sizes, args.output)
