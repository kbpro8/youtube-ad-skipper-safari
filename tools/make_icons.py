"""Generates the extension's PNG icons (red rounded square with a white 'skip' symbol).
Pure Python, no dependencies. Usage: python3 tools/make_icons.py
"""
import os, struct, zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "extension", "images")
SS = 4  # supersampling for smooth edges


def inside(x, y, n):
    """Return colour for the point (x, y) in an n×n icon, or None for transparent."""
    r = 0.22 * n  # corner radius
    # rounded-rectangle test
    cx = min(max(x, r), n - r)
    cy = min(max(y, r), n - r)
    if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
        return None
    # white "skip" glyph: triangle + bar
    u, v = x / n, y / n
    tri = 0.30 <= u <= 0.62 and abs(v - 0.5) <= (0.62 - u) * 0.62
    bar = 0.64 <= u <= 0.72 and 0.32 <= v <= 0.68
    return (255, 255, 255) if (tri or bar) else (230, 33, 23)


def toolbar(x, y, n):
    """Monochrome glyph for the Safari toolbar (Safari tints it)."""
    u, v = x / n, y / n
    tri = 0.18 <= u <= 0.66 and abs(v - 0.5) <= (0.66 - u) * 0.7
    bar = 0.70 <= u <= 0.82 and 0.22 <= v <= 0.78
    return (0, 0, 0) if (tri or bar) else None


def render(n, fn):
    rows = []
    for py in range(n):
        row = bytearray([0])
        for px in range(n):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    c = fn(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS, n)
                    if c:
                        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255
            k = SS * SS
            a = acc[3] // k
            if a:
                row += bytes([acc[0] * 255 // acc[3], acc[1] * 255 // acc[3], acc[2] * 255 // acc[3], a])
            else:
                row += b"\0\0\0\0"
        rows.append(bytes(row))
    return png(n, n, b"".join(rows))


def png(w, h, raw):
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for n in (48, 96, 128, 256, 512):
        with open(os.path.join(OUT, f"icon-{n}.png"), "wb") as f:
            f.write(render(n, inside))
    for n in (16, 32):
        with open(os.path.join(OUT, f"toolbar-{n}.png"), "wb") as f:
            f.write(render(n, toolbar))
    print("icons written to", os.path.abspath(OUT))
