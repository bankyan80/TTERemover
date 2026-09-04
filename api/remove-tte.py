import json
from http.server import BaseHTTPRequestHandler
import pymupdf


def rebuild_pdf(doc):
    """Rebuild PDF to strip incremental updates (needed for signed PDFs)."""
    clean = pymupdf.open()
    for i in range(len(doc)):
        clean.insert_pdf(doc, from_page=i, to_page=i)
    return clean


def remove_areas(doc, areas):
    """Remove TTE areas from the rebuilt document."""
    for area in areas:
        if not isinstance(area, dict):
            continue

        page_idx = area.get("page", 1) - 1
        if page_idx < 0 or page_idx >= len(doc):
            continue

        page = doc[page_idx]
        x = float(area.get("x", 0))
        y = float(area.get("y", 0))
        w = float(area.get("width", 0))
        h = float(area.get("height", 0))

        if w <= 0 or h <= 0:
            continue

        margin = 2
        rect = pymupdf.Rect(
            max(0, x - margin),
            max(0, y - margin),
            min(page.rect.width, x + w + margin),
            min(page.rect.height, y + h + margin),
        )

        page.add_redact_annot(rect, fill=(1, 1, 1))
        page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_REMOVE)

    # Delete signature widgets that overlap any target area
    for page in doc:
        for w in list(page.widgets()):
            try:
                wrect = pymupdf.Rect(w.rect)
                for area in areas:
                    if not isinstance(area, dict):
                        continue
                    page_idx = area.get("page", 1) - 1
                    actual_page_idx = doc.index(page)
                    if actual_page_idx != page_idx:
                        continue
                    x = float(area.get("x", 0))
                    y = float(area.get("y", 0))
                    aw = float(area.get("width", 0))
                    ah = float(area.get("height", 0))
                    target = pymupdf.Rect(x - 5, y - 5, x + aw + 5, y + ah + 5)
                    if wrect.intersects(target):
                        page.delete_widget(w)
                        break
            except Exception:
                pass

    # Draw white shapes on top to cover any remaining appearance
    for area in areas:
        if not isinstance(area, dict):
            continue
        page_idx = area.get("page", 1) - 1
        if page_idx < 0 or page_idx >= len(doc):
            continue
        page = doc[page_idx]
        x = float(area.get("x", 0))
        y = float(area.get("y", 0))
        w = float(area.get("width", 0))
        h = float(area.get("height", 0))
        if w <= 0 or h <= 0:
            continue
        shape = page.new_shape()
        shape.draw_rect(pymupdf.Rect(x - 3, y - 3, x + w + 3, y + h + 3))
        shape.finish(color=(1, 1, 1), fill=(1, 1, 1), width=0)
        shape.commit()


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
                self._send_json(400, {"success": False, "error": "Empty request body"})
                return

            body = self.rfile.read(content_length)

            pdf_data = None
            areas_json = None

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
                elif 'name="areas"' in headers_raw:
                    areas_json = payload.decode("utf-8")

            if pdf_data is None:
                self._send_json(400, {"success": False, "error": "No PDF file provided"})
                return

            if not areas_json:
                areas_json = '{"areas":[]}'

            areas_data = json.loads(areas_json)
            areas = areas_data.get("areas", []) if isinstance(areas_data, dict) else []

            if not isinstance(areas, list):
                self._send_json(400, {"success": False, "error": "Invalid areas format"})
                return

            doc = pymupdf.open(stream=pdf_data, filetype="pdf")
            num_pages = len(doc)

            if areas:
                clean = rebuild_pdf(doc)
                doc.close()
                remove_areas(clean, areas)
                output_bytes = clean.tobytes(garbage=4, deflate=True)
                clean.close()
            else:
                output_bytes = doc.tobytes(garbage=4, deflate=True)
                doc.close()

            output_filename = "document_TTE_dihapus.pdf"
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header(
                "Content-Disposition", f'attachment; filename="{output_filename}"'
            )
            self.send_header("Content-Length", str(len(output_bytes)))
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.end_headers()
            self.wfile.write(output_bytes)

        except Exception as e:
            error_msg = str(e)
            self._send_json(500, {"success": False, "error": error_msg})

    def _send_json(self, status_code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass
