import json
import math
from http.server import BaseHTTPRequestHandler
import pymupdf


def extract_text_blocks(page):
    """Extract text blocks with positions."""
    blocks = []
    text_dict = page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE)
    for block in text_dict.get("blocks", []):
        if block.get("type") == 0:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if text:
                        bbox = span.get("bbox", [0, 0, 0, 0])
                        blocks.append({
                            "text": text,
                            "x0": bbox[0],
                            "y0": bbox[1],
                            "x1": bbox[2],
                            "y1": bbox[3],
                            "size": span.get("size", 0),
                            "font": span.get("font", ""),
                        })
    return blocks


def detect_signature_text(blocks, page_rect):
    """Find text blocks that indicate TTE/signature."""
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
        "tte",
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


def detect_images(page):
    """Extract image objects and analyze them."""
    images = []
    try:
        img_list = page.get_images(full=True)
        page_rect = page.rect

        for img in img_list:
            try:
                xref = img[0]
                img_info = page.parent.extract_image(xref)
                if not img_info:
                    continue

                width = img_info.get("width", 0)
                height = img_info.get("height", 0)

                if width < 10 or height < 10:
                    continue

                aspect = width / height if height > 0 else 0
                is_squareish = 0.7 < aspect < 1.4
                is_small = width < 400 and height < 400

                images.append({
                    "xref": xref,
                    "width": width,
                    "height": height,
                    "aspect_ratio": round(aspect, 2),
                    "is_squareish": is_squareish,
                    "is_small": is_small,
                    "ext": img_info.get("ext", ""),
                })
            except Exception:
                continue
    except Exception:
        pass

    return images


def detect_drawings(page):
    """Extract drawing/vector objects."""
    drawings = []
    try:
        draw_list = page.get_drawings()
        for d in draw_list:
            rect = d.get("rect")
            if rect:
                drawings.append({
                    "x0": rect[0],
                    "y0": rect[1],
                    "x1": rect[2],
                    "y1": rect[3],
                    "width": rect[2] - rect[0],
                    "height": rect[3] - rect[1],
                    "color": d.get("color"),
                    "fill": d.get("fill"),
                    "items": len(d.get("items", [])),
                })
    except Exception:
        pass
    return drawings


def detect_annotations(page):
    """Check for signature annotations and widgets."""
    results = []
    try:
        annots = page.annots()
        if annots:
            for annot in annots:
                try:
                    annot_type = annot.type
                    info = annot.info or {}
                    rect = annot.rect

                    is_sig = False
                    if annot_type:
                        atype = annot_type[0] if isinstance(annot_type, (list, tuple)) else annot_type
                        if atype == 20:
                            is_sig = True

                    field_type = info.get("Subtype", "") or info.get("T", "")
                    if "Sig" in str(field_type) or "sig" in str(field_type):
                        is_sig = True

                    if is_sig and rect:
                        results.append({
                            "x0": rect[0],
                            "y0": rect[1],
                            "x1": rect[2],
                            "y1": rect[3],
                            "type": "annotation",
                            "subtype": str(annot_type),
                        })
                except Exception:
                    continue
    except Exception:
        pass
    return results


def detect_qr_via_render(page, page_num, parent_doc):
    """Render page and analyze for QR-like patterns using image analysis."""
    candidates = []
    try:
        mat = pymupdf.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        width = pix.width
        height = pix.height
        samples = pix.samples

        page_rect = page.rect
        scale_x = page_rect.width / width
        scale_y = page_rect.height / height

        block_size = 20
        for by in range(0, height - block_size, block_size):
            for bx in range(0, width - block_size, block_size):
                dark_count = 0
                total_count = 0
                for dy in range(0, block_size, 2):
                    for dx in range(0, block_size, 2):
                        idx = ((by + dy) * width + (bx + dx)) * 3
                        if idx + 2 < len(samples):
                            r = samples[idx]
                            g = samples[idx + 1]
                            b = samples[idx + 2]
                            gray = (r + g + b) / 3
                            if gray < 80:
                                dark_count += 1
                            total_count += 1

                if total_count > 0:
                    ratio = dark_count / total_count
                    if 0.3 < ratio < 0.7:
                        pdf_x = bx * scale_x
                        pdf_y = by * scale_y
                        pdf_w = block_size * scale_x
                        pdf_h = block_size * scale_y

                        if 30 < pdf_w < 200 and 30 < pdf_h < 200:
                            candidates.append({
                                "x0": pdf_x,
                                "y0": pdf_y,
                                "x1": pdf_x + pdf_w,
                                "y1": pdf_y + pdf_h,
                                "dark_ratio": round(ratio, 2),
                            })
    except Exception:
        pass

    return candidates


def find_qr_candidates(page, page_num, parent_doc):
    """Find QR code candidates using multiple methods."""
    candidates = []
    page_rect = page.rect

    img_list = page.get_images(full=True)
    for img in img_list:
        try:
            xref = img[0]
            img_info = parent_doc.extract_image(xref)
            if not img_info:
                continue

            w = img_info.get("width", 0)
            h = img_info.get("height", 0)
            if w < 20 or h < 20:
                continue

            aspect = w / h if h > 0 else 0
            if 0.7 < aspect < 1.4 and w < 500 and h < 500:
                rects = page.get_image_rects(xref)
                for rect in rects:
                    candidates.append({
                        "x0": rect[0],
                        "y0": rect[1],
                        "x1": rect[2],
                        "y1": rect[3],
                        "img_width": w,
                        "img_height": h,
                    })
        except Exception:
            continue

    return candidates


def compute_distance(a, b):
    """Compute center distance between two bounding boxes."""
    ax = (a["x0"] + a["x1"]) / 2
    ay = (a["y0"] + a["y1"]) / 2
    bx = (b["x0"] + b["x1"]) / 2
    by = (b["y0"] + b["y1"]) / 2
    return math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)


def boxes_overlap(a, b, margin=20):
    """Check if two boxes are near each other."""
    return (a["x0"] - margin < b["x1"] and a["x1"] + margin > b["x0"] and
            a["y0"] - margin < b["y1"] and a["y1"] + margin > b["y0"])


def analyze_page(page, page_num, parent_doc):
    """Full multi-stage detection on a single page."""
    page_rect = page.rect
    page_w = page_rect.width
    page_h = page_rect.height

    text_blocks = extract_text_blocks(page)
    sig_texts = detect_signature_text(text_blocks, page_rect)
    images = detect_images(page)
    drawings = detect_drawings(page)
    annotations = detect_annotations(page)
    qr_images = find_qr_candidates(page, page_num, parent_doc)

    bottom_40_y = page_h * 0.6
    bottom_texts = [t for t in text_blocks if t["y0"] > bottom_40_y]

    has_sig_widget = len(annotations) > 0

    candidates = []
    candidate_id = 0

    # Stage 1: Signature widgets
    for ann in annotations:
        confidence = 0.95
        evidence = ["Signature widget / annotation detected"]
        candidates.append({
            "id": f"tte-p{page_num + 1}-{candidate_id}",
            "page": page_num + 1,
            "x0": ann["x0"],
            "y0": ann["y0"],
            "x1": ann["x1"],
            "y1": ann["y1"],
            "type": "digital-signature",
            "confidence": confidence,
            "evidence": evidence,
            "selected": True,
        })
        candidate_id += 1

    # Stage 2: QR image candidates
    for qr in qr_images:
        confidence = 0.30
        evidence = ["Square image detected (possible QR)"]
        bbox = {"x0": qr["x0"], "y0": qr["y0"], "x1": qr["x1"], "y1": qr["y1"]}

        for st in sig_texts:
            if boxes_overlap(bbox, {"x0": st["x0"], "y0": st["y0"],
                                     "x1": st["x1"], "y1": st["y1"]}, margin=150):
                confidence += 0.25
                evidence.append(f"Near signature text: '{st['matched_pattern']}'")

        if qr["y0"] > bottom_40_y:
            confidence += 0.10
            evidence.append("Located in bottom signature area")

        for t in bottom_texts:
            if boxes_overlap(bbox, {"x0": t["x0"], "y0": t["y0"],
                                     "x1": t["x1"], "y1": t["y1"]}, margin=150):
                confidence += 0.10
                evidence.append(f"Near text block: '{t['text'][:30]}'")
                break

        name_patterns = ["kepala", "direktur", "mengetahui", "jabatan", "nama"]
        for t in text_blocks:
            t_lower = t["text"].lower()
            if any(np in t_lower for np in name_patterns):
                if boxes_overlap(bbox, {"x0": t["x0"], "y0": t["y0"],
                                         "x1": t["x1"], "y1": t["y1"]}, margin=200):
                    confidence += 0.10
                    evidence.append("Near official name/title")
                    break

        if qr.get("is_squareish", True):
            confidence += 0.05
            evidence.append("Square aspect ratio (QR-like)")

        confidence = min(confidence, 1.0)

        if confidence >= 0.35:
            candidates.append({
                "id": f"tte-p{page_num + 1}-{candidate_id}",
                "page": page_num + 1,
                "x0": qr["x0"],
                "y0": qr["y0"],
                "x1": qr["x1"],
                "y1": qr["y1"],
                "type": "qr" if confidence >= 0.6 else "visual-signature",
                "confidence": round(confidence, 2),
                "evidence": evidence,
                "selected": confidence >= 0.50,
            })
            candidate_id += 1

    # Stage 3: Text pattern clusters
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
                if abs(st["y0"] - st2["y0"]) < 100 or abs(st["x0"] - st2["x0"]) < 100:
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

            confidence = 0.25
            evidence = [f"Signature-related text cluster ({len(cluster)} matches)"]

            for qr in qr_images:
                if boxes_overlap(bbox, qr, margin=150):
                    confidence += 0.30
                    evidence.append("Near QR-like image")
                    break

            if y0 > bottom_40_y:
                confidence += 0.15
                evidence.append("Located in bottom signature area")

            if len(cluster) >= 3:
                confidence += 0.10
                evidence.append("Multiple signature keywords")

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
                    "type": "text-signature" if confidence < 0.6 else "combined",
                    "confidence": round(confidence, 2),
                    "evidence": evidence,
                    "selected": confidence >= 0.50,
                })
                candidate_id += 1

    # Stage 4: Drawing clusters in bottom area
    bottom_drawings = [d for d in drawings if d["y0"] > bottom_40_y]
    if len(bottom_drawings) >= 3:
        all_x0 = min(d["x0"] for d in bottom_drawings)
        all_y0 = min(d["y0"] for d in bottom_drawings)
        all_x1 = max(d["x1"] for d in bottom_drawings)
        all_y1 = max(d["y1"] for d in bottom_drawings)

        dw = all_x1 - all_x0
        dh = all_y1 - all_y0

        if dw > 20 and dh > 20 and dw < page_w * 0.6 and dh < page_h * 0.4:
            bbox = {"x0": all_x0, "y0": all_y0, "x1": all_x1, "y1": all_y1}
            confidence = 0.20
            evidence = [f"Drawing cluster in bottom area ({len(bottom_drawings)} objects)"]

            for st in sig_texts:
                if boxes_overlap(bbox, {"x0": st["x0"], "y0": st["y0"],
                                         "x1": st["x1"], "y1": st["y1"]}, margin=100):
                    confidence += 0.20
                    evidence.append("Near signature text")
                    break

            for qr in qr_images:
                if boxes_overlap(bbox, qr, margin=100):
                    confidence += 0.25
                    evidence.append("Near QR-like image")
                    break

            confidence = min(confidence, 1.0)

            if confidence >= 0.40:
                candidates.append({
                    "id": f"tte-p{page_num + 1}-{candidate_id}",
                    "page": page_num + 1,
                    "x0": max(0, all_x0 - 20),
                    "y0": max(0, all_y0 - 20),
                    "x1": min(page_w, all_x1 + 20),
                    "y1": min(page_h, all_y1 + 20),
                    "type": "visual-signature",
                    "confidence": round(confidence, 2),
                    "evidence": evidence,
                    "selected": confidence >= 0.50,
                })
                candidate_id += 1

    # Merge overlapping candidates
    merged = merge_candidates(candidates)

    return {
        "page_num": page_num + 1,
        "text_blocks_count": len(text_blocks),
        "sig_text_count": len(sig_texts),
        "images_count": len(images),
        "qr_candidates_count": len(qr_images),
        "drawings_count": len(drawings),
        "annotations_count": len(annotations),
        "has_sig_widget": has_sig_widget,
        "bottom_40_y": bottom_40_y,
        "candidates": merged,
    }


def merge_candidates(candidates):
    """Merge overlapping candidates, keep highest confidence."""
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
            x0 = min(g["x0"] for g in group)
            y0 = min(g["y0"] for g in group)
            x1 = max(g["x1"] for g in group)
            y1 = max(g["y1"] for g in group)
            best["x0"] = x0
            best["y0"] = y0
            best["x1"] = x1
            best["y1"] = y1

        merged.append(best)

    return sorted(merged, key=lambda x: (-x["confidence"], x["page"]))


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
                    "text_blocks": analysis["text_blocks_count"],
                    "sig_texts": analysis["sig_text_count"],
                    "images": analysis["images_count"],
                    "qr_candidates": analysis["qr_candidates_count"],
                    "drawings": analysis["drawings_count"],
                    "annotations": analysis["annotations_count"],
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
