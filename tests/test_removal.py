import sys
import os
import importlib.util

# Import remove-tte.py as a module (filename has dash, so use importlib)
spec = importlib.util.spec_from_file_location(
    "remove_tte",
    os.path.join(os.path.dirname(__file__), "..", "api", "remove-tte.py")
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

import pymupdf

pdf_path = r"C:\Users\Bank Yan\TTERemover\tests\fixtures\1160_KARYATI_S.Pd.I.pdf"
assert os.path.exists(pdf_path), f"Fixture not found: {pdf_path}"

doc = pymupdf.open(pdf_path)
assert len(doc) == 5, f"Expected 5 pages, got {len(doc)}"

# Area covered by the TTE QR (as in the original, page 5 = index 4)
areas = [{"page": 5, "x": 127, "y": 764, "width": 85, "height": 85}]

# Rebuild exactly like the handler does, then remove areas
doc = mod.rebuild_pdf(doc)
mod.remove_areas(doc, areas)

output_bytes = doc.tobytes(garbage=4, deflate=True)
doc.close()

out = pymupdf.open(stream=output_bytes, filetype="pdf")

# 1) Page count preserved
assert len(out) == 5, f"FAIL: pages after removal = {len(out)}"

# 2) TTE widget on page 5 must be gone
p5 = out[4]
widgets = list(p5.widgets())
print(f"[1] Widgets left on page 5: {len(widgets)}")
assert len(widgets) == 0, f"FAIL: {len(widgets)} widget(s) still present on page 5"

# 3) The region must be ~white (QR visually gone)
mat = pymupdf.Matrix(3, 3)
pix = p5.get_pixmap(matrix=mat, clip=pymupdf.Rect(120, 757, 220, 857), alpha=False)
s = pix.samples
total = len(s) // 3
white = sum(1 for i in range(0, len(s), 3) if s[i] > 240 and s[i + 1] > 240 and s[i + 2] > 240)
whiteness = white / total * 100
print(f"[2] Region whiteness after removal: {whiteness:.1f}%")
assert whiteness >= 99.0, f"FAIL: whiteness {whiteness:.1f}% < 99.0% - QR still visible"

# 4) Key document text must be preserved
text = p5.get_text("text")
assert "KARYATI" in text, "FAIL: signer name missing after removal"
print("[3] Signer name 'KARYATI' preserved on page 5")

# 5) Other pages unchanged (spot-check page 1 has content too)
p1 = out[0]
p1_text = p1.get_text("text").strip()
assert len(p1_text) > 0, "FAIL: page 1 text was lost"
print(f"[4] Page 1 intact ({len(p1_text)} chars)")

out.close()
print("\nALL REMOVAL TESTS PASSED!")
