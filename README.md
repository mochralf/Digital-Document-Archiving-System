# Container Archive — Demo

Demo interaktif **denah arsip kontainer**: mencari box dokumen, melihat lokasi fisiknya (Zona, Baris, Level, Slot), memantau masa retensi, dan memindahkan box antar slot.

> **Seluruh data pada demo ini fiktif** dan dibuat otomatis untuk keperluan portofolio. Tidak ada dokumen, kode departemen, atau nomor dokumen asli perusahaan mana pun.

*English: an interactive floor-plan app for a document-archive container (search, physical location, retention tracking, move/swap boxes). All data is fictional.*

## Coba demo
Akun demo (juga tampil di halaman login):

| Peran | Email | Password |
|---|---|---|
| Editor (bisa mengubah) | `editor@demo.id` | `demo-editor` |
| Pelihat (hanya lihat) | `pelihat@demo.id` | `demo-pelihat` |

Perubahan hanya tersimpan di browser Anda (`localStorage`). Tombol **Reset demo** mengembalikan data awal.

## Fitur
- Denah 3 zona (X, Y, Z), masing-masing 5 level × 16 slot, terisi penuh dengan data contoh
- Pencarian, filter jenis dokumen, dan filter **lewat retensi**
- Detail box, navigasi box berikutnya/sebelumnya, pindah/tukar box (seret atau lewat form)
- Mode ubah denah: tambah/hapus rak, atur ukuran dan posisi, jenis dokumen kustom
- Ekspor CSV, mode penuh, tampilan responsif untuk ponsel dan tablet
- Peran Editor dan Pelihat

## Teknologi
HTML, CSS, dan JavaScript murni (tanpa framework), di-hosting statis di Vercel.

## Versi produksi (tidak dipublikasikan)
Versi yang dipakai internal memakai **Supabase**: login (Auth), database, dan *Row Level Security* sehingga pelihat hanya bisa membaca dan editor bisa membaca-menulis, dengan peran ditentukan di server. Kode dan datanya tidak ada di repo ini.

## Menjalankan
Tidak perlu build. Buka `index.html` lewat server statis apa pun, atau impor repo ke Vercel (Framework: *Other*, tanpa build command).

## Lisensi
MIT. Lihat `LICENSE`.
