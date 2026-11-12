const db = require("../../config/database");

/**
 * Browse Mutasi Gudang — sesuai SQLMaster Delphi
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       a.mut_nomor AS Nomor,
       DATE_FORMAT(a.mut_tanggal, '%Y-%m-%d') AS Tanggal,
       c.gdg_nama AS Asal,
       b.gdg_nama AS Tujuan,
       IFNULL(a.mut_keterangan, '') AS Keterangan,
       IF(a.mut_status_realisasi = 1, 'Sudah', 'Belum') AS Realisasi
     FROM tmutasi_hdr a
     INNER JOIN tgudang b ON b.gdg_kode = a.mut_gdg_tujuan
     INNER JOIN tgudang c ON c.gdg_kode = a.mut_gdg_asal
     WHERE a.mut_tanggal BETWEEN ? AND ?
     GROUP BY a.mut_nomor, a.mut_tanggal, a.mut_keterangan
     ORDER BY a.mut_nomor`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail Mutasi Gudang — sesuai SQLDetail Delphi
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       h.mut_nomor AS Nomor,
       d.mutd_brg_kode AS Kode,
       b.brg_nama AS Nama,
       d.mutd_qty AS Jumlah,
       DATE_FORMAT(d.mutd_expired, '%Y-%m-%d') AS Expired,
       IFNULL(d.mutd_keterangan, '') AS Keterangan
     FROM tmutasi_dtl d
     INNER JOIN tmutasi_hdr h ON h.mut_nomor = d.mutd_mut_nomor
     INNER JOIN tbarang b ON b.brg_kode = d.mutd_brg_kode
     WHERE d.mutd_mut_nomor = ?
     ORDER BY d.mutd_nourut`,
    [nomor]
  );
  return rows;
};

/**
 * Toggle Realisasi (paritas Delphi browse &Update Status / cxButton4).
 * Flip mut_status_realisasi 1<->0 → trigger tmutasi_hdr mem-posting/undo stok.
 */
const toggleRealisasi = async (nomor) => {
  const [[row]] = await db.query(
    `SELECT mut_status_realisasi FROM tmutasi_hdr WHERE mut_nomor = ?`,
    [nomor]
  );
  if (!row) throw new Error("Data mutasi gudang tidak ditemukan.");

  const newStatus = Number(row.mut_status_realisasi) === 1 ? 0 : 1;
  await db.query(
    `UPDATE tmutasi_hdr SET mut_status_realisasi = ? WHERE mut_nomor = ?`,
    [newStatus, nomor]
  );
  return { realisasi: newStatus === 1 };
};

module.exports = { getBrowse, getBrowseDetail, toggleRealisasi };