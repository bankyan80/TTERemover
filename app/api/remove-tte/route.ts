import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get("pdf");
    const areasStr = formData.get("areas");

    if (!pdfFile || !(pdfFile instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No PDF file provided" },
        { status: 400 }
      );
    }

    if (pdfFile.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File too large" },
        { status: 413 }
      );
    }

    let areas: { page: number; x: number; y: number; width: number; height: number }[] = [];
    if (areasStr && typeof areasStr === "string") {
      try {
        const parsed = JSON.parse(areasStr);
        areas = parsed.areas || [];
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid areas JSON" },
          { status: 400 }
        );
      }
    }

    const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();

    for (const area of areas) {
      const pageIdx = area.page - 1;
      if (pageIdx < 0 || pageIdx >= pages.length) continue;

      const page = pages[pageIdx];
      const { width: pageW, height: pageH } = page.getSize();

      const margin = 2;
      const x = Math.max(0, area.x - margin);
      const y = Math.max(0, area.y - margin);
      const w = Math.min(area.width + margin * 2, pageW - x);
      const h = Math.min(area.height + margin * 2, pageH - y);

      if (w <= 0 || h <= 0) continue;

      page.drawRectangle({
        x,
        y: pageH - y - h,
        width: w,
        height: h,
        color: rgb(1, 1, 1),
        opacity: 1,
      });
    }

    const modifiedBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(modifiedBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="document_TTE_dihapus.pdf"',
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Processing failed";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
