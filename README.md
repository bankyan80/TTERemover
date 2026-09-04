# TTE Remover

Hapus tanda tangan elektronik (TTE) dari file PDF dengan cepat dan mudah.

## Fitur

- **Upload PDF** — Drag & drop atau klik untuk memilih file
- **PDF Preview** — Pratinjau seluruh halaman di browser menggunakan PDF.js
- **Deteksi TTE Otomatis** — Mendeteksi signature widget dan area TTE dari teks
- **Pilihan Area Manual** — Gambar area sendiri untuk penghapusan presisi
- **Multiple Area** — Pilih dan hapus beberapa area TTE sekaligus
- **Undo / Redo** — Batalkan atau ulangi pilihan area
- **Zoom & Navigasi** — Zoom in/out, fit width, fit page, navigasi halaman
- **Download Langsung** — PDF hasil dikirim langsung ke browser tanpa penyimpanan
- **Privacy First** — Tidak ada database, tidak ada penyimpanan permanen
- **Responsive** — Berfungsi di desktop, tablet, dan mobile
- **Dark Mode** — Mendukung dark mode otomatis

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| PDF Preview | PDF.js (client-side) |
| Backend | Vercel Functions (Python Runtime) |
| PDF Processing | PyMuPDF |
| Deployment | Vercel |

## Instalasi

```bash
npm install
```

## Development

```bash
npm run dev
```

Buka http://localhost:3000

## Build

```bash
npm run build
npm run start
```

## Deploy ke Vercel

```bash
vercel
```

atau

```bash
vercel --prod
```

Pastikan Vercel project menggunakan Python runtime untuk endpoint `/api/remove-tte.py`.

## Struktur Project

```
tte-remover/
├── app/
│   ├── page.tsx          # Halaman utama
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   ├── UploadZone.tsx    # Drag & drop upload
│   ├── PdfViewer.tsx     # PDF viewer dengan zoom/nav
│   ├── PdfPage.tsx       # Render individual page
│   ├── DetectionOverlay.tsx  # Overlay area TTE terdeteksi
│   ├── ManualSelection.tsx   # Gambar area manual
│   ├── Toolbar.tsx       # Toolbar aksi
│   ├── ProcessingModal.tsx   # Modal loading
│   └── ResultPanel.tsx   # Panel hasil download
├── api/
│   └── remove-tte.py     # Python endpoint untuk hapus TTE
├── lib/
│   ├── types.ts          # TypeScript types
│   ├── detection.ts      # Deteksi & konversi koordinat
│   └── pdf.ts            # PDF.js utilities
├── requirements.txt      # Python dependencies
├── package.json
├── tsconfig.json
├── next.config.ts
├── vercel.json
└── README.md
```

## Environment Variables

Tidak diperlukan. Aplikasi berjalan tanpa environment variable.

## Bagaimana Cara Kerja

1. User upload PDF
2. PDF dipreview di browser (client-side via PDF.js)
3. Sistem mendeteksi area TTE menggunakan:
   - Signature widget annotations
   - Pencarian teks terkait TTE (tanda tangan, elektronik, dll)
   - Annotation di dekat teks TTE
4. User memilih area TTE atau menggambar area manual
5. PDF + area dikirim ke backend Python
6. PyMuPDF menghapus area menggunakan redaction
7. PDF baru dikirim langsung ke browser untuk download
8. Tidak ada file yang disimpan

## Privacy

- PDF hanya diproses sementara untuk menghasilkan file baru
- Tidak ada penyimpanan permanen
- Tidak ada database
- Tidak ada akun atau login
- Tidak ada riwayat upload
- File asli tidak diubah

## Batasan

- Ukuran PDF maksimal 50 MB
- Processing dilakukan dalam memory, batas tergantung Vercel runtime
- Tanda tangan digital yang valid tidak dipertahankan setelah dokumen diubah
- Deteksi otomatis bersifat heuristic, mungkin memerlukan koreksi manual

## Lisensi

MIT
