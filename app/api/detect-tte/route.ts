import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Candidate {
  id: string;
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  type: string;
  confidence: number;
  evidence: string[];
  selected: boolean;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'Invalid content type' }, { status: 400 });
    }

    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File | null;

    if (!pdfFile) {
      return NextResponse.json({ success: false, error: 'No PDF provided' }, { status: 400 });
    }

    if (pdfFile.size > 60 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large' }, { status: 413 });
    }

    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const numPages = pages.length;

    const candidates: Candidate[] = [];
    const debug: Record<string, unknown>[] = [];
    let candidateId = 0;

    for (let i = 0; i < numPages; i++) {
      const page = pages[i];
      const { width: pageW, height: pageH } = page.getSize();
      const bottom40Y = pageH * 0.6;

      const pageDebug: Record<string, unknown> = {
        page: i + 1,
        textBlocks: 0,
        sigTexts: 0,
        images: 0,
        qrCandidates: 0,
        drawings: 0,
        annotations: 0,
        hasSigWidget: false,
      };

      const annotations = page.node.get(pdfDoc.context.obj('Annots')) as unknown as number[];
      if (annotations && Array.isArray(annotations) && annotations.length > 0) {
        pageDebug.annotations = annotations.length;
        pageDebug.hasSigWidget = true;

        candidates.push({
          id: `tte-p${i + 1}-${candidateId++}`,
          page: i + 1,
          x0: pageW * 0.1,
          y0: pageH * 0.1,
          x1: pageW * 0.9,
          y1: pageH * 0.3,
          type: 'digital-signature',
          confidence: 0.90,
          evidence: ['PDF annotation detected'],
          selected: true,
        });
      }

      try {
        const resources = page.node.Resources?.();
        if (resources) {
          const xObjects = resources.get(pdfDoc.context.obj('XObject')) as unknown as number[];
          if (xObjects && Array.isArray(xObjects)) {
            pageDebug.images = xObjects.length;
          }
        }
      } catch {
        // No resources
      }

      debug.push(pageDebug);
    }

    return NextResponse.json({
      success: true,
      pages: numPages,
      candidates,
      debug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
