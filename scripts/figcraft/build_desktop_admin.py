"""Bangun Page 3 (Dasbor Admin Desktop) sebagai file FigCraft terpisah.

Dua frame 1440x1024: 09 - Jadwal (grid titik) dan 10 - Ringkasan (log temuan).
Tidak menyentuh pwa_design_all.figcraft milik halaman Android/mobile.

Jalankan: python3 scripts/figcraft/build_desktop_admin.py
"""
import json
import subprocess

BG, CARD, INSET, BORDER = "#18191C", "#222429", "#1B1D22", "#2F3238"
TEXT, DIM, MUTED, DANGER = "#F4F5F7", "#A8AEBC", "#8E929B", "#C4623F"
INVERSE = "#121417"
W, H, SIDEBAR = 1440, 1024, 232
OPS = {}


def op(f):
    return OPS.setdefault(f, [])


def R(f, name, x, y, w, h, fill=None, r=0, stroke=None, sw=1, opacity=1.0):
    p = {"fills": [fill or "#00000000"]}
    if stroke:
        p["strokes"] = [stroke]
        p["strokeWeight"] = sw
    if r:
        p["cornerRadius"] = r
    if opacity != 1.0:
        p["opacity"] = opacity
    op(f).append({"command": "node.create", "params": {
        "type": "rectangle", "name": name, "x": x, "y": y, "width": w,
        "height": h, "parent": None, "props": p}})


def E(f, name, x, y, w, h, fill, stroke=None, sw=1, opacity=1.0):
    p = {"fills": [fill]}
    if opacity != 1.0:
        p["opacity"] = opacity
    if stroke:
        p["strokes"] = [stroke]
        p["strokeWeight"] = sw
    op(f).append({"command": "node.create", "params": {
        "type": "ellipse", "name": name, "x": x, "y": y, "width": w,
        "height": h, "parent": None, "props": p}})


def T(f, name, x, y, size, weight, color, text):
    op(f).append({"command": "node.create", "params": {
        "type": "text", "name": name, "x": x, "y": y, "text": text,
        "parent": None, "props": {"fontSize": size, "fontStyle": weight,
                                  "fills": [color]}}})


def quarters(f, name, cx, cy, radius, filled):
    """Indikator evaluasi: lingkaran dipotong empat kuadran."""
    E(f, f"{name} Cincin", cx - radius, cy - radius, radius * 2, radius * 2,
      "#00000000", stroke=BORDER, sw=1.5)
    r = radius - 2
    wedges = [
        f"M {cx} {cy} L {cx} {cy - r} A {r} {r} 0 0 1 {cx + r} {cy} Z",
        f"M {cx} {cy} L {cx + r} {cy} A {r} {r} 0 0 1 {cx} {cy + r} Z",
        f"M {cx} {cy} L {cx} {cy + r} A {r} {r} 0 0 1 {cx - r} {cy} Z",
        f"M {cx} {cy} L {cx - r} {cy} A {r} {r} 0 0 1 {cx} {cy - r} Z",
    ]
    for i, path in enumerate(wedges):
        op(f).append({"command": "node.create", "params": {
            "type": "vector", "name": f"{name} Kuadran {i + 1}",
            "x": cx - r, "y": cy - r, "width": r * 2, "height": r * 2,
            "path": path, "parent": None,
            "props": {"fills": [TEXT if i < filled else "#00000000"],
                      "strokes": [TEXT if i < filled else BORDER],
                      "strokeWeight": 0.8}}})


def sidebar(f, active):
    R(f, "Sidebar", 0, 0, SIDEBAR, H, CARD)
    R(f, "Garis Sidebar", SIDEBAR, 0, 1, H, BORDER)
    R(f, "Logo", 24, 28, 36, 36, TEXT, r=10)
    T(f, "Logo Teks", 31, 36, 13, "Extra Bold", INVERSE, "3P")
    T(f, "Merek", 72, 32, 15, "Bold", TEXT, "3PilarAA")
    T(f, "Merek Sub", 72, 54, 10, "Medium", MUTED, "Inspeksi 4S")
    for label, key, y in [("Ringkasan", "summary", 120), ("Jadwal", "schedule", 168)]:
        on = key == active
        if on:
            R(f, f"Pil {label}", 16, y - 8, SIDEBAR - 32, 40, INSET, r=10, stroke=BORDER)
        T(f, f"Tab {label}", 40, y, 13, "Bold" if on else "Medium",
          TEXT if on else DIM, label)
    R(f, "Garis Bawah", 16, H - 96, SIDEBAR - 32, 1, BORDER)
    T(f, "User Nama", 24, H - 80, 12, "Semi Bold", TEXT, "Super Admin")
    T(f, "User Peran", 24, H - 62, 10, "Medium", MUTED, "Administrator")


def topbar(f, title, subtitle):
    R(f, "Topbar", SIDEBAR, 0, W - SIDEBAR, 72, CARD)
    R(f, "Garis Topbar", SIDEBAR, 72, W - SIDEBAR, 1, BORDER)
    T(f, "Judul", SIDEBAR + 32, 18, 20, "Bold", TEXT, title)
    T(f, "Subjudul", SIDEBAR + 32, 46, 11, "Medium", DIM, subtitle)
    R(f, "Tombol Ekspor", W - 200, 20, 168, 34, TEXT, r=10)
    T(f, "Tombol Ekspor Teks", W - 172, 28, 11, "Extra Bold", INVERSE, "Ekspor CSV")


# ── Frame 09: Jadwal (grid titik) ────────────────────────────────────────────
F9 = "09 - Jadwal (Grid Titik)"
R(F9, "Latar", 0, 0, W, H, BG)
sidebar(F9, "schedule")
topbar(F9, "Jadwal Inspeksi", "November 2026 - 148 slot - 12 mesin")

R(F9, "Pemilih Bulan", SIDEBAR + 32, 96, 300, 40, CARD, r=10, stroke=BORDER)
T(F9, "Panah Kiri", SIDEBAR + 44, 106, 12, "Bold", DIM, "<")
T(F9, "Bulan Teks", SIDEBAR + 140, 106, 12, "Semi Bold", TEXT, "November 2026")
T(F9, "Panah Kanan", SIDEBAR + 296, 106, 12, "Bold", DIM, ">")

for label, state, lx in [("Belum dikerjakan", "empty", 360),
                         ("Selesai", "done", 520),
                         ("Ada masalah", "issue", 620)]:
    if state == "empty":
        E(F9, f"Legenda {label}", SIDEBAR + lx, 109, 14, 14, BG, stroke=BORDER, sw=1.5)
    else:
        E(F9, f"Legenda {label}", SIDEBAR + lx, 109, 14, 14,
          DANGER if state == "issue" else TEXT)
    T(F9, f"Legenda Teks {label}", SIDEBAR + lx + 20, 111, 10, "Medium", DIM, label)

GRID_X, COL_W, ROW_H, HEAD_Y = SIDEBAR + 162, 19, 40, 196
R(F9, "Kartu Grid", SIDEBAR + 32, 156, 740, 812, CARD, r=20, stroke=BORDER)

for d in range(1, 31):
    if (d - 1) % 2 == 0:
        R(F9, f"Kolom {d}", GRID_X + (d - 1) * COL_W, 172, COL_W, 780, INSET, opacity=0.35)
    T(F9, f"Tanggal {d}", GRID_X + (d - 1) * COL_W + 6, 176, 8, "Semi Bold", MUTED, str(d))

machines = [
    ("D-1.04", "Mesin Stamping Press #04"),
    ("D-1.05", "Conveyor Belt Jalur B"),
    ("D-2.01", "Kompresor Udara Sentral"),
    ("D-2.02", "Panel Listrik Utama"),
    ("D-3.01", "Mesin CNC Milling #07"),
]
for i, (code, name) in enumerate(machines):
    ry = HEAD_Y + 24 + i * ROW_H
    R(F9, f"Garis Baris {code}", SIDEBAR + 48, ry + ROW_H - 8, 708, 1, BORDER, opacity=0.5)
    T(F9, f"Kode {code}", SIDEBAR + 48, ry, 11, "Extra Bold", TEXT, code)
    T(F9, f"Nama {code}", SIDEBAR + 48, ry + 16, 9, "Medium", MUTED, name[:18])
    for d in range(1, 31):
        if (d + i * 3) % 7 != 0:
            continue
        state = "done" if d < 20 else ("issue" if (d + i) % 5 == 0 else "empty")
        cx, cy = GRID_X + (d - 1) * COL_W + 9, ry + 12
        if state == "empty":
            E(F9, f"Titik {code} {d}", cx - 7, cy - 7, 14, 14, BG, stroke=BORDER, sw=1.5)
        else:
            E(F9, f"Titik {code} {d}", cx - 7, cy - 7, 14, 14,
              DANGER if state == "issue" else TEXT)

PANEL_X = W - 420
R(F9, "Panel Detail", PANEL_X, 156, 356, 640, CARD, r=20, stroke=BORDER)
T(F9, "Panel Judul", PANEL_X + 20, 176, 14, "Bold", TEXT, "Detail Inspeksi")
R(F9, "Panel Chip", PANEL_X + 20, 204, 62, 22, INSET, r=8)
T(F9, "Panel Chip Teks", PANEL_X + 30, 209, 10, "Extra Bold", TEXT, "D-1.05")
R(F9, "Panel Badge", PANEL_X + 216, 202, 120, 22, DANGER, r=11, opacity=0.15)
T(F9, "Panel Badge Teks", PANEL_X + 224, 207, 9, "Extra Bold", DANGER, "PERLU DIPERBAIKI")

detail = [("Zona", "Zone 1"), ("Mesin", "Conveyor Belt Jalur B"),
          ("Waktu", "15/11/2026 14:10"), ("Petugas", "Aldi"),
          ("Pemeriksaan", "6 item - 2 masalah")]
for i, (k, v) in enumerate(detail):
    ry = 244 + i * 38
    T(F9, f"Detail Label {k}", PANEL_X + 20, ry, 10, "Semi Bold", MUTED, k.upper())
    T(F9, f"Detail Nilai {k}", PANEL_X + 20, ry + 15, 11, "Medium", TEXT, v)

T(F9, "Panel Temuan Label", PANEL_X + 20, 440, 10, "Semi Bold", MUTED, "TEMUAN")
R(F9, "Kotak Temuan", PANEL_X + 20, 458, 316, 56, DANGER, r=10, opacity=0.12)
T(F9, "Isi Temuan", PANEL_X + 32, 468, 10, "Medium", TEXT, "Tekanan oli rantai transmisi rendah")
T(F9, "Panel Perbaikan Label", PANEL_X + 20, 530, 10, "Semi Bold", MUTED, "PERBAIKAN")
T(F9, "Isi Perbaikan", PANEL_X + 20, 548, 11, "Medium", TEXT, "Rantai dilumasi ulang")

R(F9, "Garis Evaluasi", PANEL_X + 20, 590, 316, 1, BORDER)
T(F9, "Panel Evaluasi Label", PANEL_X + 20, 606, 10, "Semi Bold", MUTED, "EVALUASI PIC")
quarters(F9, "Panel Evaluasi", PANEL_X + 44, 646, 16, 3)
T(F9, "Panel Evaluasi Teks", PANEL_X + 70, 640, 11, "Medium", TEXT, "3 dari 4 tugas selesai")

R(F9, "Tombol Buka", PANEL_X + 20, 700, 316, 40, TEXT, r=10)
T(F9, "Tombol Buka Teks", PANEL_X + 126, 712, 11, "Extra Bold", INVERSE, "Buka laporan lengkap")

# ── Frame 10: Ringkasan (log temuan, 7 kolom) ───────────────────────────────
F10 = "10 - Ringkasan (Log Temuan)"
R(F10, "Latar", 0, 0, W, H, BG)
sidebar(F10, "summary")
topbar(F10, "Ringkasan Temuan", "November 2026 - seluruh zona")

kpis = [("Total Temuan", "27"), ("Sudah Diperbaiki", "18"),
        ("Belum", "9"), ("PIC Tuntas", "4 dari 6")]
KW = (W - SIDEBAR - 64 - 3 * 16) // 4
for i, (label, val) in enumerate(kpis):
    kx = SIDEBAR + 32 + i * (KW + 16)
    R(F10, f"KPI {label}", kx, 96, KW, 84, CARD, r=16, stroke=BORDER)
    T(F10, f"KPI Angka {label}", kx + 18, 110, 26, "Extra Bold", TEXT, val)
    T(F10, f"KPI Label {label}", kx + 18, 150, 10, "Medium", MUTED, label)

HEADERS = ["Tanggal", "Zona", "Mesin", "Temuan", "Perbaikan", "PIC", "Evaluasi"]
COLS = [20, 110, 200, 420, 690, 930, 1050]
ROWS = [
    ("15/11/2026", "Zone 1", "D-1.05 - Conveyor Belt Jalur B",
     "Tekanan oli rantai transmisi rendah", "Rantai dilumasi ulang", "Aldi", 4),
    ("14/11/2026", "Zone 2", "D-2.02 - Panel Listrik Utama",
     "Kabel ground terkelupas", "Kabel diganti dan diisolasi", "Sari", 3),
    ("12/11/2026", "Zone 1", "D-1.04 - Mesin Stamping Press #04",
     "Bearing aus pada poros utama", "Bearing diganti", "Aldi", 4),
    ("11/11/2026", "Zone 3", "D-3.01 - Mesin CNC Milling #07",
     "Kebocoran seal hidrolik", "-", "Budi", 1),
    ("09/11/2026", "Zone 2", "D-2.01 - Kompresor Udara Sentral",
     "Filter udara tersumbat debu", "Filter dibersihkan", "Sari", 3),
]

TX, TY = SIDEBAR + 32, 208
TW = W - SIDEBAR - 64
R(F10, "Kartu Tabel", TX, TY, TW, 44 + len(ROWS) * 56 + 12, CARD, r=20, stroke=BORDER)
R(F10, "Header Tabel", TX, TY, TW, 44, INSET, r=0)
for c, h in zip(COLS, HEADERS):
    T(F10, f"Kolom {h}", TX + c, TY + 16, 9, "Semi Bold", MUTED, h.upper())

for i, row in enumerate(ROWS):
    ry = TY + 44 + i * 56
    R(F10, f"Garis {i}", TX + 16, ry + 54, TW - 32, 1, BORDER, opacity=0.4)
    for j, (c, val) in enumerate(zip(COLS, row[:-1])):
        weight = "Extra Bold" if j == 2 else ("Medium" if j != 0 else "Semi Bold")
        color = DANGER if (j == 4 and val == "-") else TEXT
        T(F10, f"Sel {i} {j}", TX + c, ry + 18, 10, weight, color, str(val))
    quarters(F10, f"Evaluasi {i}", TX + COLS[6] + 12, ry + 28, 11, row[-1])

FRAMES = [F9, F10]


def run(lines, in_file=None, out_file=None):
    script = "/tmp/admin_desktop_script.jsonl"
    with open(script, "w") as fh:
        fh.write("\n".join(json.dumps(x) for x in lines) + "\n")
    args = ["figcraft-cli", "run", script]
    if in_file:
        args += ["--in", in_file]
    if out_file:
        args += ["--out", out_file]
    p = subprocess.run(args, capture_output=True, text=True)
    ids = []
    for ln in p.stdout.splitlines():
        try:
            o = json.loads(ln)
        except Exception:
            continue
        if o.get("ok"):
            res = o.get("result")
            if isinstance(res, dict) and "id" in res:
                ids.append(res["id"])
        else:
            print("FAIL:", ln)
    if p.returncode != 0:
        print("STDERR:", p.stderr[:600])
    return ids


if __name__ == "__main__":
    frames = [{"command": "frame.create", "params": {
        "name": n, "width": W, "height": H, "x": 100 + i * 1520, "y": 100}}
        for i, n in enumerate(FRAMES)]
    fids = run(frames, out_file="/tmp/admin_desktop_frames.figcraft")
    assert len(fids) == 2, fids
    fid = dict(zip(FRAMES, fids))
    lines = []
    for f in FRAMES:
        for o in OPS[f]:
            o["params"]["parent"] = fid[f]
            lines.append(o)
    print("nodes:", len(lines))
    print("created:", len(run(lines, in_file="/tmp/admin_desktop_frames.figcraft",
                             out_file="/home/creamkola/Documents/factory-report/admin_desktop.figcraft")))