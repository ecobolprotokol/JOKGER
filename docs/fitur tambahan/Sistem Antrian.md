Sistem Antrian Berbasis WhatsApp Web ini dirancang untuk mendigitalkan proses pemesanan dan pemanggilan pelanggan tanpa mengharuskan pelanggan mengunduh aplikasi tambahan atau membawa kertas antrian.

Berikut adalah rincian fitur utama dan alur kerjanya:

## Fitur Utama Sistem

* **Pembuatan Nomor Antrian Otomatis:** Sistem secara berurutan menghasilkan nomor antrian baru setiap kali pesanan baru dimasukkan oleh kasir.
* **Pesan Notifikasi Dinamis:** Pesan WhatsApp tidak bersifat kaku, melainkan dapat dipersonalisasi dengan menyebutkan nama pelanggan, nomor antrian spesifik, dan rincian pesanan (seperti daftar item dan total harga).
* **Integrasi Bot WhatsApp Web (Tanpa Biaya API):** Menggunakan nomor WhatsApp biasa yang dihubungkan ke server (melalui pemindaian QR Code) sehingga bertindak sebagai "bot pengirim" yang berjalan di latar belakang, menghemat biaya operasional dibandingkan menggunakan API resmi.
* **Pembaruan Status Satu Klik:** Dashboard antarmuka untuk kasir/admin yang menyajikan antrian secara langsung (real-time) dengan tombol aksi sederhana seperti "Proses", "Selesai", atau "Batal".
* **Notifikasi Multi-Tahap:** Kemampuan untuk mengirim pesan pada berbagai tahap (misalnya: pesan konfirmasi saat pesanan masuk, dan pesan panggilan saat pesanan siap).

---

## Alur Kerja Sistem Antrian

Alur kerja ini menjabarkan perjalanan dari pelanggan datang hingga pelanggan menerima pesanan mereka.

1. **Pencatatan Pemesanan:**
Pelanggan melakukan pesanan di area kasir. Kasir memasukkan data pesanan ke dalam aplikasi atau *dashboard* sistem, termasuk mencatat **Nomor WhatsApp** dan **Nama Pelanggan**.


2. **Sistem Menghasilkan Antrian:**
Sistem menyimpan data pemesanan ke dalam *database*, secara otomatis membuatkan nomor antrian urut (misal: #045), dan mengubah status pesanan menjadi **PROSES**.


3. **Pengiriman Konfirmasi Awal (Opsional):**
Sistem (melalui *backend* Node.js) memerintahkan nomor WhatsApp toko untuk mengirimkan pesan otomatis ke pelanggan:

> *"Halo Budi, pesanan Anda sudah kami terima dengan Nomor Antrian #045. Kami sedang menyiapkannya, silakan menunggu."*


4. **Persiapan Pesanan:**
Tim dapur atau staf operasional menyiapkan pesanan sesuai rincian yang tercetak atau tampil di layar mereka. Selama tahap ini, pelanggan dapat duduk bebas tanpa harus berdiri menunggu di dekat kasir.


5. **Eksekusi Penyelesaian Pesanan:**
Setelah pesanan selesai disiapkan dan siap diserahkan, kasir atau admin menekan tombol **"SELESAI"** pada *dashboard* antrian mereka.


6. **Pengiriman Notifikasi Pengambilan:**
Aksi klik "Selesai" memicu sistem untuk mengirim pesan kedua via WhatsApp secara *real-time*:

> *"Halo Budi, pesanan Anda (Antrian #045) telah SELESAI dan siap diambil. Rincian: 2x Nasi Goreng, 2x Es Teh. Terima kasih!"*


7. **Pengambilan oleh Pelanggan:** Siklus selesai.
Pelanggan menerima pesan di ponsel mereka, datang ke konter pengambilan, dan cukup menunjukkan pesan WhatsApp tersebut sebagai bukti pengambilan pesanan. Status di sistem berubah menjadi **DIAMBIL / SELESAI**.
