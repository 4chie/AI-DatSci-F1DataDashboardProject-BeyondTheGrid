# Beyond the Grid 🏎️

Dashboard analitik interaktif untuk mengeksplorasi data historis Formula 1 dari tahun 1950 hingga sekarang, dibangun menggunakan Python, HTML, Tailwind CSS, dan Vanilla JavaScript.

---

## Ringkasan Project

**Beyond the Grid: Explore Formula 1 Beyond the Results** adalah dashboard web analitik yang memungkinkan pengguna menjelajahi dan membandingkan data historis Formula 1 secara visual dan interaktif. Project ini mengolah dataset relasional berformat CSV (hasil export dari Ergast F1 API) melalui sebuah skrip Python, menghasilkan file JSON yang kemudian dikonsumsi langsung oleh dashboard berbasis browser — tanpa backend server, tanpa database, tanpa framework JavaScript.

Project ini menyelesaikan masalah keterbatasan eksplorasi data F1 bagi pengguna umum: data mentah CSV tidak mudah dibaca, statistik tersebar di berbagai tabel terpisah, dan tidak ada cara cepat untuk membandingkan performa antar driver lintas musim. Dashboard ini menyatukan semua informasi tersebut menjadi KPI yang ringkas, **enam visualisasi interaktif**, dan dua fitur analitik lanjutan (Head-to-Head Comparison & Qualifying Delta) yang dapat difilter secara real-time.

---

## Problem Statement

Data Formula 1 tersedia secara publik melalui Ergast API dalam format CSV relasional — namun data tersebut tersebar di lebih dari 13 file terpisah (results, races, drivers, constructors, standings, dll.) yang tidak dapat langsung dibaca oleh pengguna awam. Untuk mendapatkan satu insight sederhana seperti "siapa driver terbaik di musim 2023?", seseorang harus melakukan join manual antar tabel, membersihkan nilai null, dan menghitung agregasi secara manual.

Kondisi ini menjadi hambatan serius bagi:

- **Penggemar F1** yang ingin mengeksplorasi statistik historis tanpa kemampuan pemrograman
- **Analis pemula** yang ingin belajar data dari konteks yang menarik
- **Pengembang** yang membutuhkan referensi pipeline data-to-dashboard yang bersih

Tanpa tools yang tepat, data berharga ini tidak dapat dimanfaatkan secara optimal, dan perbandingan lintas driver/season harus dilakukan secara manual — memakan waktu dan rawan kesalahan.

---

## Target Users

| Pengguna                   | Kebutuhan                                                    | Karakteristik                                         |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| **Penggemar F1 umum**      | Melihat statistik driver favorit, membandingkan musim        | Tidak perlu kemampuan coding, ingin visualisasi cepat |
| **Mahasiswa Data Science** | Belajar pipeline ETL dan data visualization dari kasus nyata | Familiar Python dasar, ingin contoh kode yang bersih  |
| **Analis olahraga**        | Menganalisis tren performa tim dan driver lintas musim       | Membutuhkan filter fleksibel dan chart yang akurat    |

---

## Arsitektur Prompt (Prompt Layering)

Project ini dikembangkan dengan bantuan dua AI assistant secara kolaboratif. **Claude (Anthropic)** digunakan untuk membantu menyusun dan memformulasikan prompt yang terstruktur, termasuk merancang kebutuhan teknis dan alur instruksi sebelum dieksekusi. **IBM Bob** kemudian menjalankan seluruh implementasi kode secara end-to-end — mulai dari pipeline ETL Python, dashboard HTML/CSS/JS, debugging, hingga iterasi perbaikan.

Konsep arsitektur prompt yang diterapkan mengacu pada materi **Prompt Layering** dari course yang disediakan IBM. Struktur prompt yang digunakan adalah sebagai berikut:

### Layer 1 — Role & Persona

Prompt dibuka dengan penetapan peran eksplisit untuk AI: _"Anda adalah seorang Senior Data Analyst dan Frontend Engineer yang berpengalaman..."_. Layer ini memastikan AI menghasilkan output dengan sudut pandang seorang profesional, bukan sekadar menjawab permintaan secara generik.

### Layer 2 — Context Setting

Memberikan konteks proyek secara menyeluruh sebelum instruksi teknis: jenis dashboard yang dibuat, dataset yang digunakan, target pengguna, dan teknologi yang boleh dipakai. Konteks ini menjadi landasan bagi seluruh keputusan yang dibuat AI sepanjang sesi.

### Layer 3 — Task Instruction

Instruksi utama dipecah menjadi dua blok berurutan yang eksplisit dengan label **DATA** dan **DASHBOARD**, masing-masing dengan sub-langkah yang jelas. Pemisahan ini memastikan AI mengerjakan pipeline data terlebih dahulu sebelum menyentuh tampilan, menghindari asumsi yang salah tentang struktur data.

### Layer 4 — Constraints & Guardrails

Setiap instruksi dilengkapi batasan spesifik untuk mencegah halusinasi dan output yang tidak diinginkan, seperti:

- _"Gunakan HANYA file ini"_ → mencegah AI mereferensikan file yang tidak ada
- _"Jangan mengarang nama kolom"_ → memaksa AI membaca data asli terlebih dahulu
- _"Tanpa data dummy dan tanpa angka tertulis manual"_ → memastikan semua visualisasi berbasis data nyata

### Layer 5 — Output Format & Quality Gates

Prompt menetapkan format output yang diharapkan secara eksplisit: nama file, struktur kode modular, keberadaan komentar, penanganan nilai null, serta kriteria validasi (jumlah baris tidak membengkak, unmatched ID = 0, JSON valid). Layer ini berfungsi sebagai _acceptance criteria_ bagi AI.

### Layer 6 — Efficiency Directives

Ditambahkan instruksi efisiensi token di akhir prompt: _"HEMAT TOKEN (WAJIB): jangan cetak isi file penuh; jika error, perbaiki dengan edit pada bagian terkait, jangan tulis ulang seluruh file."_ Layer ini mengontrol perilaku AI agar tetap ringkas dan tidak boros dalam sesi panjang.

---

## Iterasi Prompt

| Iterasi | Perubahan                                                | Alasan                                                                   | Dampak                                                     |
| ------- | -------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **v1**  | Prompt awal: dua tahap berurutan (data + dashboard)      | Menghindari AI mencampur concerns                                        | Pipeline bersih, JSON valid                                |
| **v2**  | Tambah constraint `"\N" → null` dan validasi join        | Data CSV F1 menggunakan `\N` sebagai null literal                        | Tidak ada NaN di output JSON                               |
| **v3**  | Perbaikan `NaN` di JSON export                           | `pd.to_numeric().fillna()` menghasilkan bare `NaN` yang invalid di JSON  | JSON parseable di semua browser                            |
| **v4**  | Fix Championship Progression kosong                      | Kondisi `isEmpty` mensyaratkan season DAN driver dipilih — terlalu ketat | Chart tampil otomatis (top 5) saat season dipilih          |
| **v5**  | Driver picker dari navbar dropdown → pill grid di konten | Dropdown `<select multiple>` sulit dipakai, hanya tampil 3 item          | UX jauh lebih baik, semua driver terlihat, warna konsisten |
| **v6**  | Urutan driver picker mengikuti standings musim terpilih  | Urutan abjad tidak informatif saat season dipilih                        | Driver relevan muncul di atas sesuai posisi akhir klasemen |
| **v7**  | Ganti teks "F1" di header dengan logo PNG asli           | Tampilan lebih profesional dan authentic                                 | Branding lebih kuat                                        |

---

## Screenshot Hasil Pengujian

> **Catatan:** Untuk melihat dashboard secara langsung, jalankan server lokal:
>
> ```bash
> python -m http.server 8080
> ```
>
> Kemudian buka browser di `http://localhost:8080`

**Interaksi yang dapat diuji:**

1. Pilih season (contoh: **2023**) → KPI dan semua chart update otomatis, termasuk Qualifying Delta
2. Klik 2–3 driver di picker (contoh: **Max Verstappen** + **Lewis Hamilton**) → Championship Progression, Head-to-Head table, dan semua chart update dengan warna konsisten
3. Pilih season + driver → Head-to-Head menampilkan 9 metrik perbandingan, nilai terbaik di-highlight otomatis
4. Qualifying Delta tanpa filter driver → otomatis tampil top 10 driver paling aktif di musim tersebut
5. Ketik nama di kolom pencarian → list driver difilter real-time
6. Klik **Reset Filter** → semua filter kembali ke default
7. Tanpa filter apapun → dashboard menampilkan statistik agregat seluruh sejarah F1

---

## Struktur Project

```
bob-datsci/
├── assets/
│   └── F1-Logo.png                 # Logo F1 untuk header
├── data/
│   ├── *.csv                       # Dataset sumber (tidak di-commit ke git)
│   ├── race_results_full.json      # Output: 27.612 baris hasil join
│   ├── driver_standings.json       # Output: 35.741 baris standings
│   ├── constructor_standings.json  # Output: 13.818 baris standings
│   ├── qualifying.json             # Output: 11.342 baris data qualifying
│   └── meta.json                   # Output: 77 tahun, 865 driver
├── index.html                      # Dashboard HTML (semantik, Tailwind CSS)
├── style.css                       # Styling tambahan (KPI cards, driver pills, H2H table)
├── script.js                       # Logika dashboard (modular, Vanilla JS)
├── prepare_data.py                 # ETL pipeline Python (pandas)
└── README.md                       # Dokumentasi ini
```

---

## Cara Menjalankan

### Prasyarat

- Python 3.x dengan `pandas` terinstall (Anaconda direkomendasikan)
- Browser modern (Chrome, Firefox, Safari, Edge)

### Langkah

```bash
# 1. Pastikan dataset CSV ada di folder data/
# File yang dibutuhkan: results.csv, races.csv, drivers.csv,
# constructors.csv, status.csv, driver_standings.csv, constructor_standings.csv,
# qualifying.csv

# 2. Jalankan pipeline data (hanya perlu sekali)
python prepare_data.py

# 3. Jalankan HTTP server
python -m http.server 8080

# 4. Buka browser
# → http://localhost:8080
```

---

## Validasi Data

Hasil `prepare_data.py` yang telah diverifikasi:

| File Output                  | Baris                | Keterangan                                      |
| ---------------------------- | -------------------- | ----------------------------------------------- |
| `race_results_full.json`     | 27.612               | Join sempurna — 0 unmatched ID                  |
| `driver_standings.json`      | 35.741               | Standings dengan info tahun & round             |
| `constructor_standings.json` | 13.818               | Standings konstruktor final per musim           |
| `qualifying.json`            | 11.342               | Data qualifying per driver per race (535 races) |
| `meta.json`                  | 77 tahun, 865 driver | Metadata untuk filter dropdown                  |

---

## Potensi Pengembangan Lanjutan

### Dataset yang Belum Dimanfaatkan

Dataset sumber masih memiliki beberapa file yang belum digunakan dalam dashboard ini, yang berpotensi membuka analisis lebih dalam:

| Dataset              | Status                 | Potensi Fitur                                                                       |
| -------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `qualifying.csv`     | ✅ **Sudah digunakan** | Qualifying vs Race Delta — rata-rata posisi yang diraih/hilang tiap driver          |
| `lap_times.csv`      | Belum                  | Chart konsistensi pace per lap; identifikasi driver paling stabil secara lap-by-lap |
| `pit_stops.csv`      | Belum                  | Analisis strategi pit stop: jumlah stop, durasi, korelasi dengan posisi akhir       |
| `circuits.csv`       | Belum                  | Filter berdasarkan sirkuit; peta dunia interaktif lokasi setiap Grand Prix          |
| `sprint_results.csv` | Belum                  | Visualisasi khusus hasil Sprint Race (sejak 2021)                                   |
| `seasons.csv`        | Belum                  | Timeline sejarah regulasi F1 sebagai konteks perubahan era                          |

### Fitur yang Sudah Diimplementasikan ✅

1. **Head-to-Head Driver Comparison** — Tabel 9 metrik (Wins, Win Rate, Podiums, Podium Rate, Total Points, Pts/Race, DNF Rate, Avg Finish) dengan highlight otomatis nilai terbaik; muncul saat 2–3 driver dipilih
2. **Qualifying vs Race Position Delta** — Bar chart horizontal rata-rata posisi yang diraih/hilang dari grid ke finish per driver; bar teal = naik posisi, merah = turun posisi

### Fitur yang Masih Dapat Dikembangkan

1. **Race Detail Drilldown** — Klik titik di scatter chart → popup detail race (lap times, pit stops, incident)
2. **Circuit Heatmap** — Peta dunia SVG/Leaflet.js yang menampilkan sirkuit aktif dan statistik race
3. **Era Comparison Mode** — Pengelompokan berdasarkan era regulasi (Pre-turbo, Turbo, V10, V8, Hybrid)
4. **Lap Time Trend Chart** — Line chart fastest lap time per race, evolusi kecepatan F1 1950–sekarang
5. **Predictive Features (ML)** — Prediksi kemungkinan podium berdasarkan grid position, konstruktor, sirkuit

### Peningkatan Teknis

- **Lazy Loading per Season** — Split JSON per tahun sehingga hanya data tahun terpilih yang di-fetch → loading time jauh lebih cepat
- **Service Worker / PWA** — Cache JSON di browser untuk offline access
- **Dark/Light Mode Toggle** — Tambah opsi tema terang untuk presentasi/screenshot
- **Export Chart** — Tombol download chart sebagai PNG untuk keperluan presentasi
- **URL State** — Encode filter aktif ke URL query string sehingga dashboard bisa di-share dengan filter tertentu sudah terset
- **Animasi Chart** — Staggered animation saat chart pertama kali di-render untuk kesan yang lebih hidup

---

## Teknologi yang Digunakan

| Layer              | Teknologi                         |
| ------------------ | --------------------------------- |
| Data Processing    | Python 3, pandas                  |
| Frontend Structure | HTML5 (semantik)                  |
| Styling            | Tailwind CSS v3 (CDN), custom CSS |
| Visualisasi        | Chart.js v4.4 (CDN)               |
| Scripting          | Vanilla JavaScript (ES6+)         |
| Data Format        | JSON (compact)                    |
| Dev Server         | Python `http.server`              |

---

## Sumber Data

Dataset bersumber dari **[Ergast Motor Racing Developer API](http://ergast.com/mrd/)** — database Formula 1 komprehensif yang mencakup seluruh sejarah balapan dari 1950 hingga sekarang.
