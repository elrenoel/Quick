# PRD — Quick (AI Flashcard & Quiz App)

**Versi:** 1.0 (MVP)
**Tanggal:** 17 Agustus 2026
**Owner:** Reno

---

## 1. Ringkasan Produk

Quick adalah web app yang mengubah materi PDF (kuliah, buku, catatan) jadi **flashcard** dan **quiz pilihan ganda** secara otomatis pakai AI. User tinggal upload PDF, sistem extract konsep-konsep penting, lalu user bisa belajar lewat flashcard dan menguji diri lewat quiz.

**Value proposition:** Ubah waktu "baca ulang PDF" jadi "active recall" tanpa harus bikin flashcard manual satu-satu.

---

## 2. Masalah & Tujuan

**Masalah:** Bikin flashcard dan soal latihan dari materi kuliah itu makan waktu. Kebanyakan orang akhirnya cuma baca ulang PDF (pasif), padahal active recall jauh lebih efektif buat belajar.

**Tujuan MVP:** Validasi apakah orang mau pakai tool ini untuk belajar dari PDF mereka sendiri — bukan bikin produk sempurna dulu.

---

## 3. Target User

Mahasiswa/pelajar yang punya banyak materi PDF (slide kuliah, ebook, catatan) dan butuh cara cepat buat review materi sebelum ujian.

---

## 4. Scope MVP

### In-scope (harus ada)

- Upload 1 file PDF
- Extract teks dari PDF
- AI generate flashcard (term + definisi) dari teks
- AI generate quiz pilihan ganda (4 opsi) dari teks
- User bisa lihat & flip flashcard
- User bisa kerjakan quiz dan lihat skor akhir
- UI minimalis: dominan putih, whitespace lega, minim icon

### Out-of-scope (jangan dikerjakan dulu — biar nggak scope creep)

- Edit manual flashcard/quiz oleh user
- Multi-file / multi-dokumen dalam satu koleksi
- Spaced repetition / scheduling review
- Login sosial (cukup email/password atau bahkan tanpa auth dulu untuk validasi awal)
- Sharing flashcard ke orang lain
- Mobile app native
- Support file selain PDF (docx, gambar, dll)

> Prinsip: kalau ada fitur yang bikin ragu "perlu nggak ya", jawabannya default **tidak perlu di MVP**.

---

## 5. User Flow

```
Landing page
   ↓
Upload PDF
   ↓
[Loading] "Menganalisis materi kamu..."
   ↓
Halaman hasil: daftar flashcard yang di-generate
   ↓
User flip-flip flashcard buat belajar
   ↓
Klik "Mulai Quiz"
   ↓
Quiz pilihan ganda (satu per satu, ada progress bar)
   ↓
Halaman hasil skor + review jawaban salah
```

---

## 6. Tech Stack

| Layer              | Pilihan                           | Alasan                                                                          |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------- |
| Frontend + Backend | Next.js (App Router) + TypeScript | Sudah familiar dari project coffeeshop, API routes bisa jadi backend sekalian   |
| Database           | PostgreSQL + Drizzle ORM          | Sudah familiar, gratis lewat Neon/Supabase                                      |
| AI                 | Google Gemini API (Gemini Flash)  | Untuk extraction & generation flashcard/quiz (cepat & structured JSON native)   |
| PDF parsing        | `pdf-parse` atau `unpdf`          | Extract teks sebelum dikirim ke AI (lebih murah & stabil dari kirim PDF mentah) |
| Styling            | Tailwind CSS                      | Cepat untuk implementasi UI minimalis                                           |
| Hosting            | Vercel (app) + Neon/Supabase (DB) | Free tier cukup untuk MVP                                                       |

---

## 7. Database Schema (Drizzle-style, disederhanakan)

```
documents
  id            uuid, pk
  title         text
  raw_text      text        -- hasil extract dari PDF
  created_at    timestamp

flashcards
  id            uuid, pk
  document_id   uuid, fk -> documents.id
  term          text
  definition    text

quiz_questions
  id              uuid, pk
  document_id     uuid, fk -> documents.id
  question        text
  options         jsonb    -- array 4 string
  correct_index   integer  -- 0-3

quiz_attempts
  id              uuid, pk
  document_id     uuid, fk -> documents.id
  score           integer
  total           integer
  created_at      timestamp
```

_(Tabel `users` & auth sengaja belum dimasukkan — putuskan di Stage 1 apakah MVP perlu login atau cukup session/local id dulu.)_

---

## 8. API Endpoints

| Method | Endpoint                        | Fungsi                                                           |
| ------ | ------------------------------- | ---------------------------------------------------------------- |
| POST   | `/api/documents/upload`         | Terima PDF, extract teks, simpan `documents`, trigger generation |
| POST   | `/api/documents/:id/generate`   | Panggil AI, generate flashcards + quiz, simpan ke DB             |
| GET    | `/api/documents/:id/flashcards` | Ambil semua flashcard dari 1 dokumen                             |
| GET    | `/api/documents/:id/quiz`       | Ambil semua soal quiz dari 1 dokumen                             |
| POST   | `/api/quiz/:documentId/submit`  | Terima jawaban user, hitung skor, simpan attempt                 |

---

## 9. AI Prompt Spec

Ini bagian paling krusial di seluruh produk — kualitas prompt = kualitas produk.

**Input ke AI:** teks hasil extract dari PDF (potong/chunk kalau kepanjangan, misal maks ~8000 kata per request).

**Instruksi ke AI (contoh arah prompt):**

> "Kamu adalah asisten belajar. Dari teks materi berikut, identifikasi 10-15 konsep/istilah penting. Untuk tiap konsep, buat definisi singkat dan jelas (maks 2 kalimat). Lalu buat 5-8 soal pilihan ganda (4 opsi, 1 jawaban benar) yang menguji pemahaman konsep tersebut. Balas HANYA dalam format JSON, tanpa teks tambahan, dengan struktur: { flashcards: [{term, definition}], quiz: [{question, options: [4 string], correct_index}] }"

**Hal yang perlu di-iterasi saat testing:**

- Konsistensi format JSON (kadang model nambahin teks pembuka — perlu strict instruction + parsing yang toleran)
- Kualitas soal quiz (jangan terlalu gampang ditebak dari pola opsi jawaban)
- Jumlah flashcard proporsional dengan panjang materi (jangan generate 5 flashcard dari PDF 40 halaman)

---

## 10. UI/UX Guidelines

- **Warna:** dominan putih, 1 warna aksen saja (misal hitam/navy untuk teks & tombol utama)
- **Icon/emoticon:** minim, hanya kalau benar-benar bantu navigasi (contoh: icon upload di landing page)
- **Tipografi:** clean sans-serif, hierarchy jelas (judul besar, body cukup)
- **Whitespace:** lega, jangan padat
- **Flashcard:** animasi flip sederhana, satu card fokus di tengah layar
- **Quiz:** satu soal per layar, progress bar di atas, transisi halus antar soal

---

## 11. Success Metrics (buat validasi MVP)

- User berhasil upload PDF → dapat flashcard tanpa error (technical success)
- Minimal 5-10 orang (teman kuliah/komunitas) coba pakai dan kasih feedback kualitas flashcard/quiz
- Pertanyaan validasi utama: **"Flashcard/quiz yang dihasilkan AI ini beneran membantu belajar, atau cuma gimmick?"**

---

## 12. Roadmap Bertahap (buat dipantau progress-nya)

Setiap stage dianggap selesai kalau "Definition of Done"-nya tercapai. Checklist ini bisa langsung dipakai buat tracking harian.

### Stage 0 — Setup & Keputusan Dasar (½ hari)

- [ ] Init project Next.js + TypeScript + Tailwind
- [ ] Setup PostgreSQL (Neon/Supabase) + koneksi Drizzle
- [ ] Putuskan: pakai auth atau tidak untuk MVP (rekomendasi: **tidak dulu**, pakai session id di localStorage biar cepat)
- **DoD:** project bisa run lokal, koneksi DB berhasil (test query sederhana)

### Stage 1 — Database Schema (¼ hari)

- [ ] Buat schema Drizzle sesuai bagian 7
- [ ] Migrate ke database
- **DoD:** tabel `documents`, `flashcards`, `quiz_questions`, `quiz_attempts` sudah ada di DB

### Stage 2 — Prototype AI Pipeline (1-1.5 hari) ⚠️ paling penting

- [ ] Bikin script Node terpisah (bukan di dalam app dulu) yang: terima teks → panggil Gemini API → return JSON
- [ ] Test dengan 2-3 PDF materi kuliah asli kamu
- [ ] Iterasi prompt sampai output JSON konsisten dan kualitas flashcard/quiz oke
- **DoD:** minimal 3x test run dengan PDF berbeda, hasil JSON valid & masuk akal secara konten

### Stage 3 — Backend API (1 hari)

- [ ] `/api/documents/upload` — extract PDF jadi teks, simpan ke DB
- [ ] `/api/documents/:id/generate` — pasang AI pipeline dari Stage 2 di sini
- [ ] `/api/documents/:id/flashcards` & `/api/documents/:id/quiz` — ambil data
- [ ] `/api/quiz/:documentId/submit` — hitung & simpan skor
- **DoD:** semua endpoint bisa dites lewat Postman/Thunder Client dan return data yang benar

### Stage 4 — UI Minimalis (1-1.5 hari)

- [ ] Landing page + upload form
- [ ] Halaman flashcard (list + flip interaction)
- [ ] Halaman quiz (satu soal per layar + progress bar)
- [ ] Halaman hasil skor
- **DoD:** semua halaman bisa dinavigasi dengan data dummy/statis dulu (belum connect API)

### Stage 5 — Integrasi Frontend-Backend (½-1 hari)

- [ ] Connect upload form ke `/api/documents/upload`
- [ ] Loading state saat AI generate (bisa 5-15 detik)
- [ ] Render flashcard & quiz dari data API asli
- **DoD:** end-to-end flow jalan dari upload sampai lihat skor, pakai data real dari AI

### Stage 6 — Testing dengan Materi Asli & Iterasi (1 hari)

- [ ] Upload 3-5 PDF materi kuliah kamu sendiri
- [ ] Catat kualitas flashcard/quiz yang jelek, revisi prompt
- [ ] Cek edge case: PDF kepanjangan, PDF isinya gambar/scan (boleh out-of-scope, tapi kasih error message yang jelas)
- **DoD:** kamu sendiri mau pakai app ini buat belajar beneran

# Stage 6.5 — Auth, Trial Gratis (Local-first), & Daily Limit

Ditempatkan setelah Stage 6 (Testing) dan sebelum Stage 7 (Deploy) di `docs/PRD_Quick_MVP.md`.

## Alur Baru (Ringkasan)

```
User baru upload PDF (belum login)
   ↓
Server extract teks + generate flashcard/quiz via AI
   ↓
Hasil JSON dikirim ke client — TIDAK disimpan ke DB
   ↓
Client simpan hasil di localStorage + tandai "sudah pakai trial"
   ↓
User coba generate ke-2 → dicek localStorage → diarahkan ke login/register
   ↓
Setelah login berhasil → client kirim data trial dari localStorage ke server
   ↓
Server simpan ke DB, terhubung ke user_id → localStorage dibersihkan
   ↓
Generate selanjutnya: wajib login, dibatasi 5x/hari (cek & update di DB)
```

## Perubahan Schema

```
users
  id                      uuid, pk
  email                   text, unique
  password_hash           text        -- atau dikelola Better Auth
  generation_count_today  integer, default 0
  last_generation_date    date
  created_at              timestamp

documents
  id            uuid, pk
  user_id       uuid, fk -> users.id   -- NOT NULL (beda dari rencana sebelumnya,
                                          karena trial anonymous tidak pernah masuk DB)
  title         text
  raw_text      text
  created_at    timestamp

-- flashcards, quiz_questions, quiz_attempts: tetap sama seperti PRD awal
```

## Perubahan/Endpoint Baru

| Method | Endpoint                    | Fungsi                                                                                                                                       | Auth? |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| POST   | `/api/trial/generate`       | Extract PDF + panggil AI, return JSON langsung (flashcards+quiz+title+raw_text). **Tidak menyentuh DB sama sekali.**                         | Tidak |
| POST   | `/api/documents/save-trial` | Terima payload dari localStorage (title, raw_text, flashcards, quiz), simpan ke DB terhubung ke user yang baru login. Tidak panggil AI lagi. | Ya    |
| POST   | `/api/documents/generate`   | Untuk user yang sudah login: cek limit harian dulu → kalau masih boleh, extract+generate+simpan ke DB dalam satu proses                      | Ya    |
| GET    | `/api/documents`            | List histori dokumen milik user (baru ada gunanya sekarang karena ada login)                                                                 | Ya    |

Endpoint lama (`/api/documents/upload` + `/api/documents/:id/generate` gabungan) dipecah/diganti sesuai tabel di atas — beri tahu AI coding assistant secara eksplisit soal ini biar dia nggak bingung sama endpoint versi lama.

---

## Stage 6.5

### 6.5a — Setup Auth

```
Lanjut ke Stage 6.5 dari project Quick — Auth, Trial Gratis, & Daily Limit.
Stage 6 sudah selesai (testing dengan PDF asli sudah oke).

Langkah pertama: setup Better Auth untuk email/password login & register.
Tambahkan kolom generation_count_today (integer, default 0) dan
last_generation_date (date) ke tabel users.
documents.user_id ubah jadi NOT NULL (karena mulai stage ini, dokumen hanya
disimpan setelah user login — trial anonymous tidak masuk DB).

Buatkan juga halaman /login dan /register sederhana (sesuai style minimalis
di bagian 10 PRD).

Setelah auth bisa dipakai untuk daftar & login manual (saya test sendiri dulu),
tunggu konfirmasi saya sebelum lanjut ke bagian berikutnya.
```

### 6.5b — Endpoint Trial (Tanpa Simpan ke DB)

```
Auth sudah jalan. Sekarang buatkan endpoint POST /api/trial/generate:
- Terima file PDF
- Extract teks (pakai logic yang sudah ada dari Stage 3)
- Panggil AI pipeline (logic yang sama dari Stage 2/3)
- Return langsung { title, raw_text, flashcards, quiz } sebagai JSON response

PENTING: endpoint ini TIDAK BOLEH menulis apapun ke database. Ini murni proses
lalu return hasil ke client.

Tunggu konfirmasi saya sebelum lanjut.
```

### 6.5c — Simpan Trial di Client (localStorage) + Deteksi Percobaan Kedua

```
Sekarang di frontend, sesuaikan flow landing page:
1. Kalau user belum login DAN belum ada data trial di localStorage:
   upload PDF → panggil POST /api/trial/generate → simpan hasilnya ke
   localStorage dengan key misalnya "quick_trial_data", dan set flag
   "quick_has_used_trial" = true
2. Tampilkan flashcard & quiz dari data localStorage tadi (bukan dari DB,
   karena memang belum ada di DB)
3. Kalau user belum login TAPI "quick_has_used_trial" sudah true dan coba
   upload PDF lagi: jangan panggil API, langsung arahkan ke halaman /login
   dengan pesan "Login dulu untuk generate lagi"

Tunggu konfirmasi saya sebelum lanjut.
```

### 6.5d — Migrasi Data Trial ke DB Setelah Login

```
Sekarang buatkan endpoint POST /api/documents/save-trial (butuh auth):
- Terima payload { title, raw_text, flashcards, quiz } dari body request
- Simpan sebagai 1 row baru di tabel documents (dengan user_id dari sesi login),
  lalu insert semua flashcards dan quiz_questions terkait
- Return document id yang baru dibuat

Di frontend: setelah user berhasil login/register DAN ada data di localStorage
key "quick_trial_data", otomatis panggil endpoint ini, lalu setelah sukses
hapus "quick_trial_data" dan "quick_has_used_trial" dari localStorage, lalu
redirect user ke halaman flashcard dokumen yang baru tersimpan (pakai document
id dari response).

Kalau tidak ada data trial di localStorage (misal user langsung daftar tanpa
coba trial dulu), langsung arahkan ke landing page seperti biasa.

Tunggu konfirmasi saya sebelum lanjut.
```

### 6.5e — Endpoint Generate untuk User Login + Daily Limit

```
Terakhir, buatkan endpoint POST /api/documents/generate (butuh auth) untuk
generate berikutnya setelah user punya akun:
1. Cek last_generation_date user di DB — kalau bukan hari ini, reset
   generation_count_today ke 0
2. Kalau generation_count_today >= 5, return error dengan pesan jelas
   "Limit harian tercapai, coba lagi besok" — JANGAN panggil AI kalau sudah
   kena limit (hemat biaya API)
3. Kalau masih boleh: extract PDF, panggil AI, simpan langsung ke DB
   (mirip logic Stage 3 tapi sekarang terhubung ke user_id), lalu increment
   generation_count_today dan update last_generation_date

Di frontend, tampilkan sisa kuota hari ini (misal "3/5 generate tersisa")
di halaman upload untuk user yang sudah login.

Setelah ini semua jalan dan saya sudah test manual (trial → login → migrasi
data → generate lagi → kena limit di percobaan ke-6), Stage 6.5 selesai dan
kita lanjut ke Stage 7 (Deploy) seperti prompt yang sudah ada sebelumnya.
```

Stage 6.5e sudah selesai. Sekarang lanjut

## Stage 6.5f — Halaman History.

Tolong buatkan halaman /history (butuh auth) yang:

1. Manggil GET /api/documents untuk ambil semua dokumen milik user yang login
2. Tampilkan sebagai list sederhana: title dokumen + tanggal dibuat (created_at)
3. Tiap item bisa diklik untuk buka ke halaman flashcard dokumen tersebut
   (pakai document id yang sama seperti Stage 4-5)
4. Kalau belum ada dokumen sama sekali, tampilkan empty state simpel
   ("Belum ada dokumen, yuk upload PDF pertamamu")

Tambahkan juga link ke /history di navigasi utama (untuk user yang sudah login).
Style tetap sesuai guideline minimalis di bagian 10 PRD.

Setelah halaman ini bisa dicoba dan menampilkan dokumen dengan benar,
Stage 6.5 benar-benar selesai. Tunggu konfirmasi saya sebelum lanjut ke Stage 7.

---

## Checklist DoD Stage 6.5

- [ ] Register & login berfungsi
- [ ] Generate pertama tanpa login → hasil muncul, tersimpan di localStorage, TIDAK ada row baru di tabel `documents`
- [ ] Coba generate kedua tanpa login → diarahkan ke halaman login, bukan diproses lagi
- [ ] Setelah login/register → data trial dari localStorage otomatis pindah ke DB, localStorage dibersihkan
- [ ] Generate setelah login dihitung dan dibatasi 5x/hari
- [ ] Percobaan ke-6 di hari yang sama → ditolak dengan pesan jelas, tidak memanggil AI
- [ ] Besoknya (atau ubah `last_generation_date` manual di DB untuk simulasi) → limit reset ke 0

Setelah semua checklist ini centang, lanjut ke **Stage 7 — Deploy** (prompt-nya sudah ada di `Vibe_Coding_Prompts_Quick.md`).

### Stage 7 — Deploy (½ hari)

- [ ] Deploy ke Vercel
- [ ] Set environment variables (API key, DB connection)
- [ ] Test flow lengkap di production
- **DoD:** link production bisa diakses & dicoba orang lain

**Total estimasi realistis: ~6-8 hari kerja efektif** (bisa lebih kalau dicicil di sela kuliah/PKL/BEM — anggap saja 2-3 minggu kalender kalau kerja 2-3 jam/hari).

---

## 13. Tips Vibe Coding per Stage

Supaya AI coding assistant (Claude Code, dsb) ngasih hasil yang tepat, kasih konteks stage yang lagi dikerjakan tiap kali prompt, bukan minta "buatkan seluruh app". Contoh:

> "Saya lagi di Stage 3 dari PRD Quick (lihat lampiran). Tolong buatkan endpoint `/api/documents/:id/generate` yang manggil Gemini API dengan prompt spec di bagian 9, lalu simpan hasilnya ke tabel flashcards dan quiz_questions sesuai schema di bagian 7."

Kerjakan **satu stage sampai DoD-nya tercapai** sebelum minta AI lanjut ke stage berikutnya — ini yang bikin progress kelihatan jelas dan gampang di-debug kalau ada yang salah.
