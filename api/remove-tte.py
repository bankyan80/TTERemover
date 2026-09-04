import json
from http.server import BaseHTTPRequestHandler
import pymupdf


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

                page.add_redact_annot(rect)
                page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE)

            # Remove any signature widget annotations that remain
            for page in doc:
                annots_to_delete = []
                for annot in page.annots():
                    try:
                        annot_type = annot.type
                        if annot_type and annot_type[0] == 20:
                            annots_to_delete.append(annot)
                    except Exception:
                        pass
                for annot in annots_to_delete:
                    try:
                        page.delete_annot(annot)
                    except Exception:
                        pass

            output_bytes = doc.tobytes(output="pdf")
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
