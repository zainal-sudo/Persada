-- Repair data migrasi: pod_qty_terima dobel & PO tidak ter-close.
-- Penyebab: migrasi_trx_cetar_okt2026.js insert tpo_dtl dengan
-- pod_qty_terima = pod_qty, lalu insert tbpb_dtl yang men-trigger
-- tbpb_dtl_after_insert menambah pod_qty_terima lagi → 2× qty, dan
-- cek pod_qty_terima = pod_qty di trigger gagal → pod_isclosed=0,
-- po_isclosed=0 (Belum) padahal sudah diterima penuh.
-- Scope: hanya PO hasil migrasi (user_create='MIG').
-- Sudah dijalankan pada 2026-11-14 (2977 detail / 1314 header).

UPDATE tpo_dtl d
JOIN tpo_hdr h ON h.po_nomor = d.pod_po_nomor
LEFT JOIN (
  SELECT h2.bpb_po_nomor AS po, b.bpbd_brg_kode AS brg, SUM(b.bpbd_qty) AS q
  FROM tbpb_dtl b JOIN tbpb_hdr h2 ON h2.bpb_nomor = b.bpbd_bpb_nomor
  GROUP BY h2.bpb_po_nomor, b.bpbd_brg_kode
) r ON r.po = d.pod_po_nomor AND r.brg = d.pod_brg_kode
SET d.pod_qty_terima = IFNULL(r.q, 0)
WHERE h.user_create = 'MIG';

UPDATE tpo_dtl d
JOIN tpo_hdr h ON h.po_nomor = d.pod_po_nomor
SET d.pod_isclosed = IF(d.pod_qty > 0 AND d.pod_qty_terima < d.pod_qty, 0, 1)
WHERE h.user_create = 'MIG';

UPDATE tpo_hdr h
LEFT JOIN (
  SELECT pod_po_nomor AS po,
         MAX(pod_qty_terima > 0) AS ada_terima,
         SUM(pod_isclosed = 0) AS open_rows
  FROM tpo_dtl GROUP BY pod_po_nomor
) s ON s.po = h.po_nomor
SET h.po_status_rec = IF(IFNULL(s.ada_terima, 0) = 1, 1, 0),
    h.po_isclosed = IF(IFNULL(s.ada_terima, 0) = 1 AND IFNULL(s.open_rows, 0) = 0, 1, 0)
WHERE h.user_create = 'MIG';
