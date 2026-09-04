import sys
import os
import importlib.util

# Import detect-tte.py as a module (filename has dash, so use importlib)
spec = importlib.util.spec_from_file_location(
    "detect_tte",
    os.path.join(os.path.dirname(__file__), "..", "api", "detect-tte.py")
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

import pymupdf

pdf_path = r"C:\Users\Bank Yan\TTERemover\tests\fixtures\1160_KARYATI_S.Pd.I.pdf"
doc = pymupdf.open(pdf_path)
print(f"Pages: {len(doc)}")
assert len(doc) == 5, f"Expected 5 pages, got {len(doc)}"

all_candidates = []
for i in range(len(doc)):
    page = doc[i]
    analysis = mod.analyze_page(page, i, doc)
    p = analysis["page_num"]
    c = len(analysis["candidates"])
    print(f"\nPage {p}: {c} candidate(s)")
    print(f"  Page size: {analysis['page_w']:.1f} x {analysis['page_h']:.1f}")
    print(f"  Widgets: {analysis['widgets_count']}, Visual objects: {analysis['visual_objects_count']}")
    print(f"  Sig texts: {analysis['sig_text_count']}, Role texts: {analysis['role_text_count']}")
    print(f"  Name blocks: {analysis['name_blocks_count']}")
    for cand in analysis["candidates"]:
        print(f"  Candidate: page={cand['page']} type={cand['type']} conf={cand['confidence']}")
        print(f"    bbox: ({cand['x0']:.1f}, {cand['y0']:.1f}, {cand['x1']:.1f}, {cand['y1']:.1f})")
        for e in cand["evidence"]:
            print(f"    evidence: {e}")
    all_candidates.extend(analysis["candidates"])

doc.close()

all_candidates = mod.merge_candidates(all_candidates)

print(f"\n=== MERGED CANDIDATES: {len(all_candidates)} ===")
for c in all_candidates:
    print(f"  Page {c['page']}: type={c['type']} conf={c['confidence']}")
    print(f"    bbox: ({c['x0']:.1f}, {c['y0']:.1f}, {c['x1']:.1f}, {c['y1']:.1f})")

page5_candidates = [c for c in all_candidates if c["page"] == 5]
print(f"\nPage 5 candidates: {len(page5_candidates)}")

assert len(page5_candidates) >= 1, "FAIL: No candidates on page 5!"

best = max(page5_candidates, key=lambda c: c["confidence"])
print(f"Best page 5 candidate: conf={best['confidence']} type={best['type']}")
print(f"  bbox: ({best['x0']:.1f}, {best['y0']:.1f}, {best['x1']:.1f}, {best['y1']:.1f})")

assert best["confidence"] >= 0.75, f"FAIL: Confidence {best['confidence']} < 0.75"

tolerance = 15
assert abs(best["x0"] - 127.68) < tolerance, f"FAIL: x0={best['x0']} not near 127.68"
assert abs(best["y0"] - 764.12) < tolerance, f"FAIL: y0={best['y0']} not near 764.12"
assert abs(best["x1"] - 212.68) < tolerance, f"FAIL: x1={best['x1']} not near 212.68"
assert abs(best["y1"] - 849.12) < tolerance, f"FAIL: y1={best['y1']} not near 849.12"

print("\nALL TESTS PASSED!")
