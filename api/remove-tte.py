import json
from http.server import BaseHTTPRequestHandler
import pymupdf


def rebuild_pdf(doc):
    """Rebuild the PDF to strip incremental updates so widget annotations
    become editable. Signature-appended (signed) PDFs put their TTE in an
    incremental update; without rebuilding, the widget is read-only and the
    QR stays visible."""
    new_doc = pymupdf.open()
    for i in range(len(doc)):
        new_doc.insert_pdf(doc, from_page=i, to_page=i)
    doc.close()
    return new_doc


def remove_areas(doc, areas):
    """Detach/delete TTE widget annotations, then cover the area with white.
    The QR is rendered through the widget's appearance stream (/AP), which is
    drawn ABOVE the page content stream, so a plain white rectangle on the
    content stream is NOT enough. The widget must be deleted first."""
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

        # 1) Delete any widget annotation overlapping this area. This removes
        #    the QR's appearance stream so it is no longer drawn on top.
        target = pymupdf.Rect(x, y, x + w, y + h).round()
        for widget in list(page.widgets()):
            wrect = widget.rect.round()
            if wrect.intersects(target) or wrect.contains(target) or target.contains(wrect):
                try:
                    page.delete_widget(widget)
                except Exception:
                    pass

        # 2) Cover the area with white (redact + paint) in case any pixels
        #    remain from the widget's appearance or from underlying content.
        rect = pymupdf.Rect(x - 1, y - 1, x + w + 1, y + h + 1)
        page.add_redact_annot(rect, fill=(1, 1, 1))
        try:
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_REMOVE)
        except Exception:
            pass
        shape = page.new_shape()
        shape.draw_rect(rect)
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

            if areas:
                # Rebuild first so signed/incremental-update files can be edited.
                doc = rebuild_pdf(doc)
                remove_areas(doc, areas)

            output_bytes = doc.tobytes(garbage=4, deflate=True)
            doc.close()

            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", 'attachment; filename="document_TTE_dihapus.pdf"')
            self.send_header("Content-Length", str(len(output_bytes)))
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.end_headers()
            self.wfile.write(output_bytes)

        except Exception as e:
            self._send_json(500, {"success": False, "error": str(e)})

    def _send_json(self, status_code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass
