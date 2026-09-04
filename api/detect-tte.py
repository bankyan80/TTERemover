import json
import math
from http.server import BaseHTTPRequestHandler
import pymupdf


# ============================================================
# Text Extraction
# ============================================================

def extract_text_blocks(page):
    """Extract text as line-level blocks (grouped spans)."""
    blocks = []
    text_dict = page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE)
    for block in text_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            line_text = ""
            line_bbox = None
            for span in line.get("spans", []):
                t = span.get("text", "").strip()
                if not t:
                    continue
                bbox = span.get("bbox", [0, 0, 0, 0])
                if line_bbox is None:
                    line_bbox = list(bbox)
                    line_text = span.get("text", "")
                else:
                    if bbox[0] - line_bbox[2] < 15:
                        line_text += " " + span.get("text", "")
                        line_bbox[2] = max(line_bbox[2], bbox[2])
                        line_bbox[3] = max(line_bbox[3], bbox[3])
                    else:
                        if line_text.strip():
                            blocks.append({
                                "text": line_text.strip(),
                                "x0": line_bbox[0],
                                "y0": line_bbox[1],
                                "x1": line_bbox[2],
                                "y1": line_bbox[3],
                                "size": span.get("size", 0),
                            })
                        line_bbox = list(bbox)
                        line_text = span.get("text", "")
            if line_text.strip() and line_bbox:
                blocks.append({
                    "text": line_text.strip(),
                    "x0": line_bbox[0],
                    "y0": line_bbox[1],
                    "x1": line_bbox[2],
                    "y1": line_bbox[3],
                    "size": 0,
                })
    return blocks


def extract_raw_spans(page):
    """Extract individual text spans for word-level matching."""
    spans = []
    text_dict = page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE)
    for block in text_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "").strip()
                if text:
                    bbox = span.get("bbox", [0, 0, 0, 0])
                    spans.append({
                        "text": text,
                        "x0": bbox[0],
                        "y0": bbox[1],
                        "x1": bbox[2],
                        "y1": bbox[3],
                        "size": span.get("size", 0),
                        "font": span.get("font", ""),
                    })
    return spans


# ============================================================
# Signature Text Detection
# ============================================================

def detect_signature_text(blocks):
    """Find lines containing TTE/signature keywords."""
    sig_patterns = [
        "tanda tangan elektronik",
        "tanda tangan eletronik",
        "ditandatangani secara elektronik",
        "ditandatangani secara eletronik",
        "dokumen elektronik",
        "digital signature",
        "electronic signature",
        "signature",
        "ditandatangani",
        "tersertifikasi",
        "sertifikat",
        "verifikasi",
        "valid",
        "elektronik",
    ]
    results = []
    for b in blocks:
        text_lower = b["text"].lower()
        for pattern in sig_patterns:
            if pattern in text_lower:
                results.append({
                    "text": b["text"],
                    "x0": b["x0"],
                    "y0": b["y0"],
                    "x1": b["x1"],
                    "y1": b["y1"],
                    "matched_pattern": pattern,
                })
                break
    return results


def detect_role_text(blocks):
    """Find lines with official role/title keywords."""
    role_patterns = [
        "pihak kesatu", "pihak kedua",
        "kepala", "direktur", "mengetahui",
        "jabatan", "pejabat",
    ]
    results = []
    for b in blocks:
        text_lower = b["text"].lower()
        for pattern in role_patterns:
            if pattern in text_lower:
                results.append({
                    "text": b["text"],
                    "x0": b["x0"],
                    "y0": b["y0"],
                    "x1": b["x1"],
                    "y1": b["y1"],
                    "role": pattern,
                })
                break
    return results


def detect_name_blocks(blocks):
    """Find blocks that look like person names (ALL CAPS, comma, title)."""
    import re
    results = []
    name_re = re.compile(r"^[A-Z][A-Z\s.,\-]+(?:S\.\w+\.?|S\.Pd\.?\w*\.?|S\.T\w+\.?|M\.\w+\.?|Dr\.?\.?)$")
    for b in blocks:
        text = b["text"].strip()
        if name_re.match(text) or (text.isupper() and len(text) > 10 and "," in text):
            results.append({
                "text": text,
                "x0": b["x0"],
                "y0": b["y0"],
                "x1": b["x1"],
                "y1": b["y1"],
            })
    return results


# ============================================================
# Image / Visual Object Detection
# ============================================================

def detect_visual_objects(page):
    """Find visual objects via get_image_info (catches rendered images not in XObject)."""
    objects = []
    try:
        img_info_list = page.get_image_info()
        for info in img_info_list:
            bbox = info.get("bbox")
            if not bbox:
                continue
            w = info.get("width", 0)
            h = info.get("height", 0)
            bbox_w = bbox[2] - bbox[0]
            bbox_h = bbox[3] - bbox[1]
            aspect = bbox_w / bbox_h if bbox_h > 0 else 0
            objects.append({
                "x0": bbox[0],
                "y0": bbox[1],
                "x1": bbox[2],
                "y1": bbox[3],
                "img_width": w,
                "img_height": h,
                "bbox_width": bbox_w,
                "bbox_height": bbox_h,
                "aspect_ratio": round(aspect, 2),
                "is_squareish": 0.7 < aspect < 1.4,
                "source": "get_image_info",
            })
    except Exception:
        pass
    return objects


def detect_images_xref(page, parent_doc):
    """Find images via get_images (XObject references)."""
    images = []
    try:
        img_list = page.get_images(full=True)
        for img in img_list:
            try:
                xref = img[0]
                img_info = parent_doc.extract_image(xref)
                if not img_info:
                    continue
                w = img_info.get("width", 0)
                h = img_info.get("height", 0)
                if w < 10 or h < 10:
                    continue
                rects = page.get_image_rects(xref)
                for rect in rects:
                    images.append({
                        "x0": rect[0],
                        "y0": rect[1],
                        "x1": rect[2],
                        "y1": rect[3],
                        "img_width": w,
                        "img_height": h,
                        "aspect_ratio": round(w / h if h > 0 else 0, 2),
                        "is_squareish": 0.7 < (w / h if h > 0 else 0) < 1.4,
                        "source": "get_images",
                    })
            except Exception:
                continue
    except Exception:
        pass
    return images


# ============================================================
# Signature Widget Detection
# ============================================================

def detect_signature_widgets(page):
    """Find signature widgets via page.widgets()."""
    results = []
    try:
        widgets = page.widgets()
        if widgets:
            for w in widgets:
                try:
                    is_sig = False
                    field_type = w.field_type
                    if field_type == 6:
                        is_sig = True
                    field_name = w.field_name or ""
                    if "sig" in field_name.lower():
                        is_sig = True
                    ft_str = str(field_type).lower()
                    if "sig" in ft_str or "sign" in ft_str:
                        is_sig = True

                    if is_sig:
                        results.append({
                            "x0": w.rect[0],
                            "y0": w.rect[1],
                            "x1": w.rect[2],
                            "y1": w.rect[3],
                            "field_type": field_type,
                            "field_name": field_name,
                        })
                except Exception:
                    continue
    except Exception:
        pass
    return results


# ============================================================
# Drawing Detection
# ============================================================

def detect_drawings(page):
    """Extract drawing/vector objects."""
    drawings = []
    try:
        for d in page.get_drawings():
            rect = d.get("rect")
            if rect:
                drawings.append({
                    "x0": rect[0],
                    "y0": rect[1],
                    "x1": rect[2],
                    "y1": rect[3],
                    "width": rect[2] - rect[0],
                    "height": rect[3] - rect[1],
                    "items": len(d.get("items", [])),
                })
    except Exception:
        pass
    return drawings


# ============================================================
# Spatial Utilities
# ============================================================

def boxes_overlap(a, b, margin=20):
    return (a["x0"] - margin < b["x1"] and a["x1"] + margin > b["x0"] and
            a["y0"] - margin < b["y1"] and a["y1"] + margin > b["y0"])


def center_distance(a, b):
    ax = (a["x0"] + a["x1"]) / 2
    ay = (a["y0"] + a["y1"]) / 2
    bx = (b["x0"] + b["x1"]) / 2
    by = (b["y0"] + b["y1"]) / 2
    return math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)


def point_in_rect(px, py, rect):
    return rect["x0"] <= px <= rect["x1"] and rect["y0"] <= py <= rect["y1"]


def rect_center_y(r):
    return (r["y0"] + r["y1"]) / 2


def rect_center_x(r):
    return (r["x0"] + r["x1"]) / 2


# ============================================================
# Core Detection: analyze_page
# ============================================================

def analyze_page(page, page_num, parent_doc):
    page_rect = page.rect
    page_w = page_rect.width
    page_h = page_rect.height
    bottom_25_y = page_h * 0.75
    bottom_40_y = page_h * 0.60

    text_blocks = extract_text_blocks(page)
    raw_spans = extract_raw_spans(page)
    sig_texts = detect_signature_text(text_blocks)
    role_texts = detect_role_text(text_blocks)
    name_blocks = detect_name_blocks(text_blocks)
    visual_objects = detect_visual_objects(page)
    xref_images = detect_images_xref(page, parent_doc)
    widgets = detect_signature_widgets(page)
    drawings = detect_drawings(page)

    has_sig_widget = len(widgets) > 0
    all_visuals = visual_objects + xref_images

    candidates = []
    candidate_id = 0

    # ──────────────────────────────────────────
    # Stage 1: Signature Widgets
    # ──────────────────────────────────────────
    for wgt in widgets:
        confidence = 0.35
        evidence = ["Signature widget detected (field_type=6)"]

        wgt_rect = {"x0": wgt["x0"], "y0": wgt["y0"], "x1": wgt["x1"], "y1": wgt["y1"]}
        wgt_w = wgt["x1"] - wgt["x0"]
        wgt_h = wgt["y1"] - wgt["y0"]

        for vo in all_visuals:
            if boxes_overlap(wgt_rect, vo, margin=5):
                confidence += 0.30
                evidence.append("Visual object overlaps widget (QR/image)")
                break

        if wgt["y0"] > bottom_25_y:
            confidence += 0.05
            evidence.append("Widget in bottom 25% area")

        for rt in role_texts:
            if rt["y1"] < wgt["y0"] and (wgt["y0"] - rt["y1"]) < 80:
                if abs(rect_center_x(rt) - rect_center_x(wgt_rect)) < 150:
                    confidence += 0.10
                    evidence.append(f"Below role text: '{rt['text']}'")
                    break

        for nb in name_blocks:
            if nb["y0"] > wgt["y1"] and (nb["y0"] - wgt["y1"]) < 80:
                if abs(rect_center_x(nb) - rect_center_x(wgt_rect)) < 150:
                    confidence += 0.10
                    evidence.append(f"Above name: '{nb['text']}'")
                    break

        for st in sig_texts:
            if boxes_overlap(wgt_rect, {"x0": st["x0"], "y0": st["y0"],
                                         "x1": st["x1"], "y1": st["y1"]}, margin=200):
                confidence += 0.05
                evidence.append(f"Near signature text: '{st['matched_pattern']}'")
                break

        confidence = min(confidence, 1.0)
        candidates.append({
            "id": f"tte-p{page_num + 1}-{candidate_id}",
            "page": page_num + 1,
            "x0": wgt["x0"],
            "y0": wgt["y0"],
            "x1": wgt["x1"],
            "y1": wgt["y1"],
            "type": "combined" if confidence >= 0.70 else "digital-signature",
            "confidence": round(confidence, 2),
            "evidence": evidence,
            "selected": confidence >= 0.50,
        })
        candidate_id += 1

    # ──────────────────────────────────────────
    # Stage 2: Visual objects NOT overlapping a widget
    # ──────────────────────────────────────────
    for vo in all_visuals:
        vo_rect = {"x0": vo["x0"], "y0": vo["y0"], "x1": vo["x1"], "y1": vo["y1"]}
        already_covered = False
        for c in candidates:
            if boxes_overlap(vo_rect, c, margin=5):
                already_covered = True
                break
        if already_covered:
            continue

        vo_w = vo["x1"] - vo["x0"]
        vo_h = vo["y1"] - vo["y0"]

        if vo_w < 20 or vo_h < 20:
            continue

        confidence = 0.20
        evidence = [f"Visual object ({vo['source']})"]

        if vo.get("is_squareish"):
            confidence += 0.10
            evidence.append("Square aspect ratio")

        if 40 < vo_w < 200 and 40 < vo_h < 200:
            confidence += 0.05
            evidence.append("QR-like size")

        if vo["y0"] > bottom_25_y:
            confidence += 0.05
            evidence.append("In bottom signature area")

        for rt in role_texts:
            if rt["y1"] < vo["y0"] and (vo["y0"] - rt["y1"]) < 100:
                if abs(rect_center_x(rt) - rect_center_x(vo_rect)) < 200:
                    confidence += 0.10
                    evidence.append(f"Below role text: '{rt['text']}'")
                    break

        for nb in name_blocks:
            if nb["y0"] > vo["y1"] and (nb["y0"] - vo["y1"]) < 100:
                if abs(rect_center_x(nb) - rect_center_x(vo_rect)) < 200:
                    confidence += 0.10
                    evidence.append(f"Above name: '{nb['text']}'")
                    break

        for st in sig_texts:
            if boxes_overlap(vo_rect, {"x0": st["x0"], "y0": st["y0"],
                                         "x1": st["x1"], "y1": st["y1"]}, margin=150):
                confidence += 0.10
                evidence.append(f"Near signature text: '{st['matched_pattern']}'")
                break

        confidence = min(confidence, 1.0)

        if confidence >= 0.30:
            candidates.append({
                "id": f"tte-p{page_num + 1}-{candidate_id}",
                "page": page_num + 1,
                "x0": vo["x0"],
                "y0": vo["y0"],
                "x1": vo["x1"],
                "y1": vo["y1"],
                "type": "qr" if confidence >= 0.60 else "visual-signature",
                "confidence": round(confidence, 2),
                "evidence": evidence,
                "selected": confidence >= 0.50,
            })
            candidate_id += 1

    # ──────────────────────────────────────────
    # Stage 3: Text-pattern clusters (fallback)
    # ──────────────────────────────────────────
    if sig_texts and not has_sig_widget:
        clusters = []
        used = set()
        for i, st in enumerate(sig_texts):
            if i in used:
                continue
            cluster = [st]
            used.add(i)
            for j, st2 in enumerate(sig_texts):
                if j in used:
                    continue
                if abs(st["y0"] - st2["y0"]) < 60 and abs(st["x0"] - st2["x0"]) < 200:
                    cluster.append(st2)
                    used.add(j)
            if len(cluster) >= 2:
                clusters.append(cluster)

        for cluster in clusters:
            x0 = min(t["x0"] for t in cluster)
            y0 = min(t["y0"] for t in cluster)
            x1 = max(t["x1"] for t in cluster)
            y1 = max(t["y1"] for t in cluster)
            bbox = {"x0": x0, "y0": y0, "x1": x1, "y1": y1}

            confidence = 0.20
            evidence = [f"Signature text cluster ({len(cluster)} matches)"]

            for vo in all_visuals:
                if boxes_overlap(bbox, vo, margin=100):
                    confidence += 0.25
                    evidence.append("Near visual object")
                    break

            if y0 > bottom_40_y:
                confidence += 0.10
                evidence.append("In bottom area")

            confidence = min(confidence, 1.0)

            if confidence >= 0.40:
                pad = 30
                candidates.append({
                    "id": f"tte-p{page_num + 1}-{candidate_id}",
                    "page": page_num + 1,
                    "x0": max(0, x0 - pad),
                    "y0": max(0, y0 - pad),
                    "x1": min(page_w, x1 + pad),
                    "y1": min(page_h, y1 + pad),
                    "type": "text-signature" if confidence < 0.60 else "combined",
                    "confidence": round(confidence, 2),
                    "evidence": evidence,
                    "selected": confidence >= 0.50,
                })
                candidate_id += 1

    # Merge overlapping candidates
    merged = merge_candidates(candidates)

    return {
        "page_num": page_num + 1,
        "page_w": page_w,
        "page_h": page_h,
        "text_blocks_count": len(text_blocks),
        "sig_text_count": len(sig_texts),
        "role_text_count": len(role_texts),
        "name_blocks_count": len(name_blocks),
        "visual_objects_count": len(visual_objects),
        "xref_images_count": len(xref_images),
        "drawings_count": len(drawings),
        "widgets_count": len(widgets),
        "has_sig_widget": has_sig_widget,
        "candidates": merged,
    }


# ============================================================
# Merge
# ============================================================

def merge_candidates(candidates):
    if not candidates:
        return candidates

    merged = []
    used = set()

    for i, c in enumerate(candidates):
        if i in used:
            continue
        group = [c]
        used.add(i)
        for j, c2 in enumerate(candidates):
            if j in used:
                continue
            if c["page"] == c2["page"] and boxes_overlap(c, c2, margin=10):
                group.append(c2)
                used.add(j)

        best = max(group, key=lambda x: x["confidence"])
        all_evidence = []
        for g in group:
            for e in g["evidence"]:
                if e not in all_evidence:
                    all_evidence.append(e)
        best["evidence"] = all_evidence

        if len(group) > 1:
            best["x0"] = min(g["x0"] for g in group)
            best["y0"] = min(g["y0"] for g in group)
            best["x1"] = max(g["x1"] for g in group)
            best["y1"] = max(g["y1"] for g in group)

        merged.append(best)

    return sorted(merged, key=lambda x: (-x["confidence"], x["page"]))


# ============================================================
# HTTP Handler
# ============================================================

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                self._send_json(400, {"success": False, "error": "Invalid content type"})
                return

            boundary = content_type.split("boundary=")[-1].encode()
            content_length = int(self.headers.get("Content-Length", 0))

            if content_length > 60 * 1024 * 1024:
                self._send_json(413, {"success": False, "error": "File too large"})
                return

            if content_length == 0:
                self._send_json(400, {"success": False, "error": "Empty request"})
                return

            body = self.rfile.read(content_length)

            pdf_data = None
            parts = body.split(b"--" + boundary)
            for part in parts:
                if not part or part.strip() == b"" or part.strip() == b"--":
                    continue
                header_end = part.find(b"\r\n\r\n")
                if header_end == -1:
                    continue
                headers_raw = part[:header_end].decode("utf-8", errors="replace")
                payload = part[header_end + 4:]
                if payload.endswith(b"\r\n"):
                    payload = payload[:-2]
                if 'name="pdf"' in headers_raw and "filename=" in headers_raw:
                    pdf_data = payload

            if pdf_data is None:
                self._send_json(400, {"success": False, "error": "No PDF provided"})
                return

            doc = pymupdf.open(stream=pdf_data, filetype="pdf")
            num_pages = len(doc)

            all_candidates = []
            page_analyses = []

            for page_idx in range(num_pages):
                page = doc[page_idx]
                analysis = analyze_page(page, page_idx, doc)
                page_analyses.append({
                    "page": analysis["page_num"],
                    "page_w": analysis["page_w"],
                    "page_h": analysis["page_h"],
                    "text_blocks": analysis["text_blocks_count"],
                    "sig_texts": analysis["sig_text_count"],
                    "role_texts": analysis["role_text_count"],
                    "name_blocks": analysis["name_blocks_count"],
                    "visual_objects": analysis["visual_objects_count"],
                    "xref_images": analysis["xref_images_count"],
                    "drawings": analysis["drawings_count"],
                    "widgets": analysis["widgets_count"],
                    "has_sig_widget": analysis["has_sig_widget"],
                })
                all_candidates.extend(analysis["candidates"])

            doc.close()

            all_candidates = merge_candidates(all_candidates)

            self._send_json(200, {
                "success": True,
                "pages": num_pages,
                "candidates": all_candidates,
                "debug": page_analyses,
            })

        except Exception as e:
            self._send_json(500, {"success": False, "error": str(e)})

    def _send_json(self, status_code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass
