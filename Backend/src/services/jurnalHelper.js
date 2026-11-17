// services/jurnalHelper.js
// Helper penulisan jurnal (tjurnal + tjurnalitem) untuk dokumen yang jurnalnya
// tidak ditangani trigger DB lama (retur). Pola insert mengikuti trigger
// tbayarcus_hdr_after_insert dsb: tjurnal header + baris tjurnalitem per
// rekening (jurd_debet / jurd_kredit), jurd_nourut berurutan.
const db = require("../config/database");

// Rekening konstan — sama dengan nilai yang disiapkan trigger DB lama.
const REK = {
  persediaanDefault: "17.001",
  rkHutang: "19.014", // RK HUTANG — jurnal retur pembelian mampir di sini
  rkPiutang: "14.007", // RK PIUTANG — jurnal retur penjualan mampir di sini
  hutang: "19.002",
  piutang: "14.001",
  piutangCn: "14.003",
  ppnMasukan: "16.001",
  ppnKeluaran: "19.005",
  potonganBeli: "21.005",
  potonganJual: "21.004",
  discPenjualan: "21.006",
  returPenjualan: "21.003",
  bpp: "26.001",
};

// Rekening persediaan per cabang (tcabang.cbg_rek_kode) — fallback 17.001
// bila kosong, sesuai nilai default yang dideklarasikan trigger DB lama.
const getRekPersediaan = async (conn) => {
  const [rows] = await conn.query(
    `SELECT cbg_rek_kode FROM tcabang WHERE cbg_aktif = 1 LIMIT 1`
  );
  return (rows[0] && rows[0].cbg_rek_kode) || REK.persediaanDefault;
};

// items: [{ rek, debit, kredit, cc? }] — baris 0 di-skip otomatis.
const insertJurnal = async (conn, { nomor, tanggal, tipetransaksi, keterangan, user, items }) => {
  const baris = items.filter((i) => Number(i.debit) !== 0 || Number(i.kredit) !== 0);
  if (!baris.length) return;

  await conn.query(
    `INSERT INTO tjurnal
       (jur_tanggal, jur_tipetransaksi, jur_no, jur_keterangan, jur_isclosed,
        date_create, user_create)
     VALUES (?, ?, ?, ?, 0, NOW(), ?)`,
    [tanggal, tipetransaksi, nomor, keterangan, user?.kode || "admin"]
  );

  let nourut = 1;
  for (const i of baris) {
    await conn.query(
      `INSERT INTO tjurnalitem
         (jurd_jur_no, jurd_rek_kode, jurd_kredit, jurd_debet, jurd_nourut${i.cc ? ", jurd_cc_kode" : ""})
       VALUES (?, ?, ?, ?, ?${i.cc ? ", ?" : ""})`,
      i.cc
        ? [nomor, i.rek, Number(i.kredit) || 0, Number(i.debit) || 0, nourut++, i.cc]
        : [nomor, i.rek, Number(i.kredit) || 0, Number(i.debit) || 0, nourut++]
    );
  }
};

// Hapus jurnal dokumen (header + item). nomorSuffix dipakai untuk jurnal
// setle pembayaran (mis. "01-VP.2601.0001R").
const deleteJurnal = async (conn, nomor) => {
  await conn.query(`DELETE FROM tjurnalitem WHERE jurd_jur_no = ?`, [nomor]);
  await conn.query(`DELETE FROM tjurnal WHERE jur_no = ?`, [nomor]);
};

// Net pembelian/penjualan setelah disc faktur (paritas rumus trigger DB lama):
// ((amount - tax) + disc_faktur) / (100 - disc_fakturpr) * 100
const netSetelahDisc = (amount, taxAmount, discFaktur, discFakturPr) => {
  const pr = Math.min(Math.max(Number(discFakturPr) || 0, 0), 99);
  return ((Number(amount) - Number(taxAmount) + Number(discFaktur)) / (100 - pr)) * 100;
};

module.exports = { REK, getRekPersediaan, insertJurnal, deleteJurnal, netSetelahDisc };
