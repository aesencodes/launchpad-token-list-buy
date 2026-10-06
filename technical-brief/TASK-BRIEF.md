# Tes on-site: Launchpad token list + buy

**Posisi:** Web3 Developer (Fullstack)
**Tempat:** dikerjakan langsung di kantor
**Waktu pengerjaan:** maksimal 6 jam, dihitung sejak brief ini Anda terima. Setup, faucet, dan waktu membaca ikut dihitung. Demo dan tanya jawab sesudahnya tidak termasuk dalam 6 jam.

Kami punya launchpad token di Robinhood Chain testnet. Setiap token diperdagangkan dulu di sebuah **bonding curve**; setelah curve habis terbeli, token itu "graduate" ke pool Uniswap v4.

Kontraknya sudah ter-deploy dan sudah berisi lima token contoh. Tugas Anda: buat frontend yang **menampilkan daftar token** dan memungkinkan user **membeli token** dari bonding curve.

Anda boleh memakai AI. Stack bebas; kalau tidak punya preferensi, pakai React atau Next.js dengan wagmi dan viem.

## Yang dinilai

1. **UI:** tampilan rapi, jelas, enak dipakai, dan tetap baik di layar HP.
2. **Fungsi:** semua langkah di bawah berjalan benar, angkanya tepat, dan error tertangani.

## Referensi

`https://ponsfamily.com/launchpad`

Pakai sebagai acuan tampilan dan alur: bentuk daftar token, informasi yang ditampilkan per token, dan alur beli. Anda tidak perlu menirunya persis, dan desain Anda sendiri boleh berbeda. Jangan menyalin kode atau asetnya.

Situs itu berjalan di mainnet dengan alamat kontrak yang berbeda. Untuk tes ini, pakai hanya alamat dan network di bawah.

Akses internet diperbolehkan selama tes (dokumentasi, Sourcify, situs referensi, alat AI).

## Data yang Anda butuhkan

| | |
| --- | --- |
| Network | Robinhood Chain Testnet |
| Chain ID | `46630` |
| Mata uang | ETH (18 desimal) |
| RPC | `https://robinhood-sepolia-rpc.publicnode.com` |
| Explorer | `https://explorer.testnet.chain.robinhood.com` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| LaunchFactory | `0x533cE670f1372cb402D49866608b92e7bc2b4493` |
| Blok deploy factory | `129157568` |

- **ABI:** terlampir (`LaunchFactory.json`, `BondingCurve.json`, `LauncherToken.json`). Source lengkapnya bisa dilihat di `https://repo.sourcify.dev/46630/0x533cE670f1372cb402D49866608b92e7bc2b4493`. Kalau brief ini berbeda dengan source kontrak, source kontrak yang benar; beri tahu pengawas.
- **Wallet:** MetaMask di Chrome (atau browser Chromium). Kami menguji hasil Anda dengan MetaMask. Buat wallet baru khusus untuk tes ini; jangan pakai wallet utama Anda. Jangan pernah meng-commit private key atau seed phrase.
- **ETH testnet:** ambil dari faucet `https://faucet.testnet.chain.robinhood.com/`. Usahakan minimal 0,05 ETH. Kalau faucet tidak bisa dibuka atau tidak mengirim, berikan alamat wallet Anda ke pengawas dan kami kirim di tempat.
- **Batas RPC:** RPC publik menolak `eth_getLogs` dengan rentang lebih dari **50.000 blok** (lihat langkah 3). Rencanakan hal ini.

## Token contoh

Lima token ini sudah ada di testnet. Pakai sebagai pembanding: daftar yang dihasilkan aplikasi Anda harus memuat kelimanya dengan alamat yang sama.

| Simbol | Alamat token | Alamat bonding curve | Kondisi |
| --- | --- | --- | --- |
| FRESH | `0xFaeA3Da0c58233d0f0193168Bc9B9383E5C08090` | `0x168EA1234652A5dA6bf84D2C1fD243326412B5b2` | Baru launch, belum ada pembelian |
| EARLY | `0xB1A6865b584A15F94ca078ca453553C3107A85d7` | `0x50Beb0E43cABb019B3c77caE3302Eb94002Bf55e` | Sedikit terbeli |
| HALF | `0xC3e22b78fb924fF3728837Fef7107103D58F6926` | `0x5c3D2616E2c9b35228b5C979eA106Fe7764e8122` | Sekitar setengah jalan menuju graduation |
| TAXED | `0x505181e3114a6d147839Cb809C84d4e83575a97C` | `0x2B65bBBf650211E68fCACBdAfD9Dc39A47Eaa249` | Creator tax 10% |
| GRAD | `0xD32266729F628f14c44962FF359aa5d1Cce3dDE0` | `0xF77b46d2ad1f97D175A88A522258c8d5a029adFF` | Sudah graduate ke pool v4 |

Alamat ini hanya contoh untuk memeriksa hasil Anda. Jangan menuliskannya langsung di kode; daftar token tetap harus diambil dari event di langkah 3, supaya token baru ikut muncul.

Token-token ini dipakai bersama oleh kandidat lain dan pewawancara, jadi reserve dan progresnya berubah setiap ada yang membeli. Jangan mengharapkan angka yang tetap. HALF bisa graduate selama sesi; kalau sebuah token tidak bisa dibeli lagi, beli token lain (FRESH, EARLY, dan TAXED paling aman), atau launch token Anda sendiri (bonus). GRAD ada di phase `2`, jadi pakai untuk memeriksa bahwa tombol beli nonaktif. Tidak ada token contoh di phase `1`.

## Langkah pengerjaan

### Langkah 1 — Setup project dan network

- Buat project frontend.
- Daftarkan Robinhood Chain Testnet sebagai chain dengan data di tabel atas.

**Selesai jika:** aplikasi bisa membaca `launchFee()` dari LaunchFactory dan menampilkan hasilnya.

### Langkah 2 — Connect wallet

- Tambahkan tombol connect dan disconnect wallet.
- Tampilkan alamat wallet dan saldo ETH-nya setelah connect.
- Kalau wallet berada di network lain, tampilkan peringatan dan tombol untuk pindah ke Robinhood Chain Testnet.
- Network ini belum ada di MetaMask secara bawaan. Tombol itu juga harus menambahkannya kalau belum ada.

**Selesai jika:** user bisa connect, melihat saldonya, dan dipandu pindah network kalau salah.

### Langkah 3 — Ambil daftar token

Factory tidak punya fungsi yang mengembalikan daftar token. Ambil dari event ini, mulai dari blok deploy factory. RPC hanya menerima maksimal 50.000 blok per permintaan `eth_getLogs`, dan chain sudah beberapa ratus ribu blok melewati blok deploy, jadi Anda harus mengambil log secara bertahap per potongan (sekarang sekitar 7 permintaan, nanti lebih banyak):

```solidity
event TokenLaunched(
    address indexed token,
    address indexed curve,
    address indexed deployer,
    address pairToken,
    uint256 launchConfigId,
    uint256 graduationThreshold
);
```

`pairToken` bernilai `address(0)` untuk token yang dipasangkan dengan ETH. Semua token contoh memakai ETH. Token yang dipasangkan dengan aset lain bisa muncul di daftar; tampilkan dengan benar atau saring dan jelaskan di README.

Daftar juga harus menangkap token yang di-launch setelah halaman dibuka (polling, watch, atau tombol refresh).

**Selesai jika:** aplikasi mendapatkan lima token contoh: FRESH, EARLY, HALF, TAXED, GRAD.

### Langkah 4 — Lengkapi data tiap token

Untuk setiap token, baca:

| Data | Dari mana |
| --- | --- |
| Nama, simbol, logo | `name()`, `symbol()`, `logo()` di kontrak token |
| Reserve curve | `getReserves()` di kontrak curve, mengembalikan `(quoteReserve, tokenReserve)` |
| ETH terkumpul | `realQuoteReserve()` di kontrak curve |
| Target graduation | `graduationThreshold()` di kontrak curve |
| Status | `getLaunchedToken(token).phase` di factory (fungsi ini mengembalikan struct; `phase` adalah salah satu field-nya) |

Lalu hitung:

- **Harga saat ini** = `quoteReserve / tokenReserve` (dalam ETH per token). Ini harga spot; pembelian sungguhan mendapat harga lebih buruk karena fee dan price impact. Harganya sangat kecil, jadi pilih format yang mudah dibaca (misalnya angka signifikan atau `0.0₅1234`) dan jangan pernah menampilkan `0.00`.
- **Progres graduation** = `realQuoteReserve / graduationThreshold`, maksimal 100%. Hitung dengan `bigint` (misalnya dalam basis poin) sebelum diformat.

Arti `phase`:

| Phase | Arti |
| --- | --- |
| `0` | Masih diperdagangkan di bonding curve |
| `1` | Curve sudah habis terbeli, pool belum dibuat |
| `2` | Sudah graduate ke pool Uniswap v4 |
| `3` | Graduation dibatalkan |

Gunakan Multicall3 (`aggregate3`, dengan `allowFailure`) supaya data semua token terambil dalam sedikit permintaan RPC. Pengambilan log di langkah 3 tidak perlu lewat Multicall3.

**Selesai jika:** semua data di atas tersedia untuk kelima token.

### Langkah 5 — Tampilkan daftar token

- Tampilkan tiap token sebagai kartu atau baris: logo, nama, simbol, harga, progress bar graduation, dan label status. Beri setiap phase (`0` sampai `3`) label yang mudah dipahami.
- Token contoh tidak punya logo (string kosong). Tampilkan placeholder. Logo yang gagal dimuat juga harus kembali ke placeholder.
- Sediakan tampilan untuk tiga keadaan: sedang memuat, daftar kosong, dan gagal memuat. Tampilan gagal harus punya tombol coba lagi.

**Selesai jika:** daftar tampil rapi di desktop dan HP, dan ketiga keadaan di atas punya tampilan sendiri.

### Langkah 6 — Form beli token

Saat user memilih sebuah token, tampilkan form beli:

- Input jumlah ETH yang ingin dibelanjakan.
- Tampilkan **perkiraan token yang didapat**, dihitung dengan rumus curve:

  ```
  fee        = quoteIn * feeBps / 10000
  creatorTax = quoteIn * creatorTaxBps / 10000
  net        = quoteIn - fee - creatorTax
  tokensOut  = net * tokenReserve / (quoteReserve + net)
  ```

  `feeBps()` dan `creatorTaxBps()` dibaca dari kontrak curve. Semua pembagian dibulatkan ke bawah.
- Sediakan pilihan toleransi slippage (misalnya 1%, bawaan 1%), lalu hitung `minTokensOut = tokensOut * (10000 - slippageBps) / 10000` dari perkiraan di atas.
- Nonaktifkan tombol beli kalau: wallet belum connect, network salah, jumlah kosong, nol, atau bukan angka valid, saldo tidak cukup, atau token tidak di phase `0`.

Semua perhitungan memakai `bigint` (parse input dengan `parseEther`, dan tolak lebih dari 18 desimal). Jangan mengubah nilai wei menjadi `Number` sebelum dihitung.

**Selesai jika:** perkiraan berubah saat user mengetik, dan tombol beli hanya aktif saat transaksi memang bisa dikirim.

### Langkah 7 — Kirim transaksi beli

Panggil fungsi ini di kontrak curve:

```solidity
function buy(uint256 quoteIn, uint256 minTokensOut, address recipient)
    external payable returns (uint256 tokensOut);
```

- Kirim `value` sama dengan `quoteIn`.
- `recipient` adalah alamat wallet user.
- Jumlah token yang didapat adalah nilai `tokensOut` pada event `CurveBuy` di receipt (atau perubahan saldo user), bukan perkiraan Anda.

Tampilkan setiap keadaan transaksi ke user:

| Keadaan | Yang ditampilkan |
| --- | --- |
| Menunggu konfirmasi di wallet | Tombol nonaktif, teks "Konfirmasi di wallet" |
| Terkirim, menunggu masuk blok | Indikator pending dan link ke explorer |
| Berhasil | Pesan sukses, jumlah token yang didapat, link ke explorer |
| Ditolak user di wallet | Pesan singkat, form kembali bisa dipakai |
| Gagal atau revert | Pesan error yang bisa dipahami user |

Link explorer berbentuk `https://explorer.testnet.chain.robinhood.com/tx/<hash>`.

Error kontrak yang perlu Anda terjemahkan menjadi pesan yang jelas: `SlippageExceeded` (harga bergerak melebihi toleransi) dan `CurveGraduated` (token sudah tidak dijual di curve). Untuk error lainnya, tampilkan pesan yang jelas dan mudah dipahami, bukan pesan error hex mentah.

**Selesai jika:** Anda berhasil membeli salah satu token contoh, dan kelima keadaan di atas punya tampilan.

### Langkah 8 — Perbarui data setelah transaksi

Setelah transaksi berhasil, perbarui tanpa reload halaman:

- harga dan progres token yang dibeli,
- saldo ETH user,
- saldo token user (juga harus terlihat di form beli sebelum pembelian pertama).

Pastikan juga daftar token menampilkan angka baru, bukan hanya form beli.

**Selesai jika:** angka di layar berubah sendiri setelah pembelian berhasil.

### Langkah 9 — Rapikan dan tulis README

README berisi:

- cara menjalankan project,
- keputusan teknis penting dan alasannya,
- apa yang belum selesai,
- bagian mana yang dibantu AI,
- masalah yang Anda temukan pada brief ini atau kontraknya, kalau ada.

Sertakan juga screenshot atau video demo singkat aplikasi yang sudah berjalan di dalam folder project repository (misalnya di folder `/demo` atau `/screenshots`).

**Selesai jika:** orang lain bisa menjalankan project Anda hanya dengan mengikuti README, dan bukti visual (screenshot atau video) sudah disertakan.

## Bonus (opsional)

Kerjakan hanya kalau langkah 1–9 sudah selesai dan masih ada waktu.

### Bonus utama — Launch token Anda sendiri

Buat form untuk me-launch token baru, lalu launch satu token dengan:

- **Nama token:** nama lengkap Anda sendiri, misalnya `Nama Lengkap Anda`
- **Ticker (simbol):** `TEST`

Panggil fungsi ini di LaunchFactory. ABI berisi dua overload `launchToken`; pakai versi 3 argumen (`launchToken(TokenParams,uint256,address)`). Launch bisa dibatasi oleh pengecekan `canLaunch(address)` di factory; kalau hasilnya false untuk wallet Anda, beri tahu pengawas dan kami akan mengizinkan alamat Anda.

```solidity
function launchToken(TokenParams params, uint256 launchConfigId, address pairToken)
    external payable returns (address token, address curve);

struct TokenParams {
    string name;
    string symbol;
    string logo;
    string description;
    Socials socials;              // twitter, telegram, discord, website, farcaster
    address creatorFeeRecipient;  // address(0) = wallet pengirim
    uint16 creatorTaxBps;         // 0 sampai 1000
    bool buybackEnabled;
    bytes32 expectedEconomics;    // dari previewLaunchEconomics(launchConfigId, pairToken)
    bytes32 salt;                 // 32 byte acak, belum pernah Anda pakai
}
```

Nilai yang dipakai:

| Parameter | Nilai |
| --- | --- |
| `launchConfigId` | `1` (graduation di 0,042 ETH, supaya murah dicoba) |
| `pairToken` | `address(0)` (dipasangkan dengan ETH) |
| `value` transaksi | hasil `launchFee()` dari factory, harus sama persis |
| Batas panjang | nama maksimal 64 karakter, simbol maksimal 16 karakter |
| `expectedEconomics` | `bytes32` hasil `previewLaunchEconomics(1, address(0))`, dibaca tepat sebelum mengirim |
| `salt` | 32 byte acak (misalnya `crypto.getRandomValues`), baru di setiap percobaan |

Alamat token dan curve yang baru ada di event `TokenLaunched` pada receipt transaksinya.

**Selesai jika:** token dengan nama Anda dan ticker `TEST` berhasil di-launch, lalu muncul di daftar token aplikasi Anda tanpa mengubah kode, dan bisa dibeli lewat form beli Anda.

### Bonus lainnya

- **Sell:** panggil `approve(curve, tokensIn)` di kontrak token, lalu `sell(tokensIn, minQuoteOut, recipient)` di curve.
- **Halaman detail token:** deskripsi (`description()`), creator, dan riwayat transaksi dari event `CurveBuy` dan `CurveSell`.
- **Sort atau search** di daftar token.
- **Selesaikan graduation:** untuk token di phase `1`, sediakan tombol yang memanggil `createGraduatedPool(token)` di factory.

## Yang diserahkan di akhir sesi

Sebelum 6 jam habis:

1. Push kode ke sebuah repository (host bebas; kalau private, invite/tambahkan [kodomo-toothpaste](https://github.com/kodomo-toothpaste)) dan berikan link-nya ke pengawas. Jangan commit secret, key, atau `node_modules`.
2. Pastikan README seperti di langkah 9 sudah ada di repository itu.
3. Sertakan screenshot atau video demo singkat aplikasi yang sudah berjalan di dalam folder project repository (misalnya di folder `/demo` atau `/screenshots`).
4. Biarkan aplikasi berjalan di laptop Anda untuk didemokan, dijalankan dengan langkah README dari clone baru.

Kode yang di-push setelah waktu habis tidak dinilai.

## Demo dan tanya jawab

Setelah waktu habis, Anda akan:

- mendemokan aplikasi Anda secara langsung,
- menjelaskan kode dan keputusan teknis Anda, dan
- mengerjakan satu perubahan kecil di kode Anda sendiri, ditentukan pewawancara (sekitar 10 menit; AI boleh dipakai).

Pastikan Anda paham setiap bagian yang Anda tulis, termasuk yang dibuat dengan bantuan AI.

## Cara penilaian

UI dan fungsi masing-masing bernilai setengah. Langkah 1–9 adalah inti; kandidat yang menyelesaikan langkah 1–7 dengan benar mengungguli yang menyelesaikan lebih banyak langkah tetapi angkanya salah. Bonus hanya dihitung setelah inti berjalan. README serta demo/tanya jawab juga dinilai.

## Pertanyaan

Kalau ada yang tidak jelas, tanyakan langsung ke pengawas kapan saja. Bertanya tidak mengurangi nilai.
