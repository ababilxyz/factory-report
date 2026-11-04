"""Cek teks keluar frame dan teks bertumpuk, murni dari document.json.

Tidak butuh render. Lebar teks didekati dengan faktor per-karakter Inter
(0.56em untuk huruf kecil, +0.10 untuk kapital) supaya cek ini cukup ketat
tanpa false positive. Sengaja sederhana: ini penjaga tata letak, bukan
layout engine.
"""
import json
import zipfile

DOC = "/home/creamkola/Documents/factory-report/admin_desktop.figcraft"
FRAME_W, FRAME_H = 1440.0, 1024.0

with zipfile.ZipFile(DOC) as z:
    d = json.loads(z.read("document.json"))

n = d["nodes"]
frames = [k for k, v in n.items() if v.get("type") == "frame"]


def text_width(node):
    chars = node.get("characters") or ""
    fs = node["style"]["font_size"]
    if not chars:
        return 0.0
    caps = sum(1 for c in chars if c.isupper()) / len(chars)
    return len(chars) * fs * (0.56 + 0.10 * caps)


def box(node):
    t = node["transform"]
    x, y = t[4], t[5]
    if node["type"] == "text":
        return x, y, x + text_width(node), y + node["style"]["font_size"] * 1.25
    return x, y, x + node.get("width", 0.0), y + node.get("height", 0.0)


bad = 0
for fid in frames:
    fnode = n[fid]
    texts = [n[str(c)] for c in fnode.get("children", []) if n.get(str(c), {}).get("type") == "text"]

    out = []
    for t in texts:
        x0, y0, x1, y1 = box(t)
        if x1 > FRAME_W - 4 or x0 < 4 or y1 > FRAME_H - 4:
            out.append((t["name"], round(x0), round(x1), (t.get("characters") or "")[:30]))

    ov = []
    for i in range(len(texts)):
        for j in range(i + 1, len(texts)):
            a, b = box(texts[i]), box(texts[j])
            ox = min(a[2], b[2]) - max(a[0], b[0])
            oy = min(a[3], b[3]) - max(a[1], b[1])
            if ox > 2 and oy > 2:
                ov.append((texts[i]["name"], texts[j]["name"], round(ox), round(oy)))

    print(f"=== [{fid}] {fnode['name']} ===")
    print(f"  teks keluar frame: {len(out)}")
    for o in out:
        print("   ", o)
    print(f"  teks bertumpuk: {len(ov)}")
    for o in ov:
        print("   ", o)
    bad += len(out) + len(ov)

raise SystemExit(1 if bad else 0)