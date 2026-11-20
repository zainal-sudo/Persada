// services/penjualan/listJualPerItemService.js
const db = require("../../config/database");

const getBrowse = async (params, user = {}) => {
  const {
    startDate, endDate, customerCode, customerName, barangName,
    isProductFocus, isKontrak, byInkaso, linkMarketing, salesman, rayon,
  } = params;

  // Delphi: if frmMenu.KDUSER = 'FINANCE' Then tambahkan hpp & margin
  const isFinance = String(user?.kode || "").toUpperCase() === "FINANCE";

  // smargin2 (utk UNION non-penjualan): baris dummy 0
  const smargin2 = isFinance ? ",0 hpp,0 margin" : "";

  // smarginRetur: HPP & Margin NEGATIF di blok retur. Paritas Delphi
  // (ufrmListJual): retur dipotong dengan HARGA POKOK ASLI baris stok DO
  // sumber faktur (ms2.mst_noreferensi = fp_do_nomor), bukan harga beli
  // baris stok MASUK retur. Margin = Nilai_Net − hpp (keduanya negatif → hasil
  // negatif saat FP untung).
  const smarginRetur = isFinance
    ? ", -IFNULL(SUM(retjd_qty*ms.mst_hargabeli),0) hpp"
      + ", -SUM((100-fpd_discpr)*(fpd_harga*ifnull(retjd_qty,0))/100)"
      + " + IFNULL(SUM(retjd_qty*ms.mst_hargabeli),0) margin"
    : "";

  // ── Select kolom bagian utama penjualan (paritas Delphi aktif) ──────
  // Kolom Divisi beda antar database: konveksi/sip = BRG_DIVISI,
  // ampersada = brg_div_kode. Cek sekali per pemanggilan supaya query
  // tidak gagal ER_BAD_FIELD_ERROR (menyebabkan chart dashboard kosong).
  const [divCols] = await db.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS" +
      " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbarang'" +
      " AND COLUMN_NAME = 'BRG_DIVISI'",
  );
  const divisiExpr = divCols.length ? "BRG_DIVISI Divisi" : "brg_div_kode Divisi";

  const selectBase = [
    'fp_nomor Nomor',
    'date_format(fp_tanggal,"%Y-%m-%d") Tanggal',
    'month(fp_tanggal) Bulan',
    'year(fp_tanggal) Tahun',
    '(SELECT pmh_nama FROM tprodukmarketing_hdr INNER JOIN tprodukmarketing_dtl ON pmd_pmh_nomor=pmh_nomor where pmd_brg_kode=brg_kode limit 1) Group_produk',
    '(SELECT sls_nama FROM tsalesman inner join tsalescustomer ON sls_kode=sc_sls_kode where sc_cus_kode=fp_cus_kode) Marketing',
    'sls_nama Rayon',
    '(SELECT sla_nama FROM tsalesmanaktif WHERE sla_kode = COALESCE(NULLIF(so_sla_kode, ""), fp_sla_kode) limit 1) Salesman',
    'cus_nama Outlet',
    'cus_gc_kode Golongan',
    'jc_nama JenisCustomer',
    'brg_kode Kode',
    'brg_nama Nama',
    'brg_merk Merk',
    'ktg_nama Kategori',
    '(SELECT ktg_nama FROM tkategori where ktg_kode=SUBSTRING_INDEX(brg_ktg_kode, ".", 2)) SubDepartemen',
    '(SELECT ktg_nama FROM tkategori where ktg_kode=SUBSTRING_INDEX(brg_ktg_kode, ".", 1)) Departemen',
    divisiExpr,
    'fpd_brg_satuan Satuan',
    'if(brg_isproductfocus=1,"Ya","Tidak") IsPf',
    'if(fp_isecer=0,"Tidak","Ya") Eceran',
    'if(fp_iscatalog=1,"Ya","Tidak") isCatalog',
    'fpd_cn',
    'sum(fpd_qty) Qty',
    'sum((100-fpd_discpr)*(fpd_harga*fpd_qty)/100*if(fp_istax=1,if(fp_tanggal<"2022/04/01",1.1,1.11),1)) Nilai',
    'sum((100-fpd_discpr)*(fpd_harga*fpd_qty)/100) Nilaiblmppn',
    'sum(fpd_cn*((100-fpd_discpr)*fpd_harga/100)*fpd_qty/100) Kontrak',
  ];

  // ── HPP & Margin hanya FINANCE: pakai fpd_hpp (freeze saat FP disimpan).
  // Retur tidak dipotong di blok FP — pengurangannya hidup di blok UNION retur.
  const smarginParts = isFinance
    ? [
        'sum(ifnull(fpd_hpp,0)) hpp',
        'sum((100-fpd_discpr)*(fpd_harga*fpd_qty)/100) - '
          + 'sum(fpd_cn*((100-fpd_discpr)*fpd_harga/100)*fpd_qty/100) - '
          + 'sum(ifnull(fpd_hpp,0)) margin',
      ]
    : [];

  const selectTail = [
    'SUM( (fpd_qty * (((100 - fpd_discpr) * fpd_harga / 100) * fpd_bp_pr / 100)) + (fpd_qty * fpd_bp_rp) ) AS biaya_promosi',
    'SUM( (fpd_qty * (((100 - fpd_discpr) * fpd_harga / 100) * fpd_bp_pr2 / 100)) + (fpd_qty * fpd_bp_rp2) ) AS fee_marketing',
    '( SUM( (100 - fpd_discpr) * (fpd_harga * fpd_qty) / 100 )'
      + ' - SUM( fpd_cn * ((100 - fpd_discpr) * fpd_harga / 100) * fpd_qty / 100 )'
      + ' - SUM( (fpd_qty * (((100 - fpd_discpr) * fpd_harga / 100) * fpd_bp_pr / 100)) + (fpd_qty * fpd_bp_rp) )'
      + ' - SUM( (fpd_qty * (((100 - fpd_discpr) * fpd_harga / 100) * fpd_bp_pr2 / 100)) + (fpd_qty * fpd_bp_rp2) )'
      + ' ) AS Nilai_Net',
    'fp_istax Pajak',
    'if ((fpd_harga*(100-fpd_discpr)/100)-(fpd_cn*((100-fpd_discpr)*fpd_harga/100)/100)- (((100-fpd_discpr)*fpd_harga/100)*fpd_bp_pr/100)-fpd_bp_rp <fpd_hrg_min,"Bawah Het","Diatas HET") StatusHet',
    'cast(0 as signed) kunjunganmarketing',
    'cast(0 as signed) kunjungansales',
    '0 NilaiEkspedisi',
  ];

  const selectAll = [...selectBase, ...smarginParts, ...selectTail];

  // ── FROM dasar ───────────────────────────────────────────────────────
  const fromBase = [
    'FROM tfp_dtl',
    'INNER JOIN tfp_hdr on fpd_fp_nomor=fp_nomor',
    'INNER JOIN tbarang on fpd_brg_kode=brg_kode',
    'INNER JOIN tcustomer on fp_cus_kode=cus_kode',
    'LEFT JOIN tjeniscustomer on jc_kode=cus_jc_kode',
    'LEFT JOIN tdo_hdr on do_nomor = fp_do_nomor',
    'LEFT JOIN tso_hdr on so_nomor = COALESCE(NULLIF(fp_so_nomor, ""), do_so_nomor)',
    'LEFT JOIN tsalesman on sls_kode = so_sls_kode',
    'LEFT JOIN tkategori on ktg_kode=brg_ktg_kode',
  ];

  // ── WHERE + filter area ──────────────────────────────────────────────
  let whereClause = "";
  if (isKontrak === true) {
    whereClause = "where fpd_cn > 0 and fp_tanggal between ? and ?";
  } else if (byInkaso === true) {
    whereClause = "where byc_tanggal between ? and ?";
  } else {
    whereClause = "where fp_tanggal between ? and ?";
  }

  const fromFinal = [...fromBase];
  if (byInkaso === true) {
    // Delphi: sambung join inkaso (juga untuk SELECT byc_tanggal)
    fromFinal.splice(5, 0, "INNER JOIN tbayarcus_dtl on bycd_fp_nomor=fp_nomor");
    fromFinal.splice(6, 0, "INNER JOIN tbayarcus_hdr on bycd_byc_nomor=byc_nomor");
  }
  // Branch DEFAULT: tanpa filter INNER tdo/masterstok — kini tampilkan semua
  // FP termasuk SO-based; HPP diambil dari fpd_hpp (freeze saat FP disimpan).

  // Filter tambahan — parameterized (berlaku utk main & retur; Delphi sretfilter)
  let extraWhere = "";
  const extraParams = [];
  if (customerCode) {
    extraWhere += " and fp_cus_kode like ? ";
    extraParams.push(customerCode + "%");
  }
  if (customerName) {
    extraWhere += " and cus_nama like ? ";
    extraParams.push("%" + customerName + "%");
  }
  if (barangName) {
    extraWhere += " and brg_nama like ? ";
    extraParams.push("%" + barangName + "%");
  }
  if (salesman) {
    extraWhere += " and (SELECT sla_nama FROM tsalesmanaktif WHERE sla_kode = COALESCE(NULLIF(so_sla_kode, ''), fp_sla_kode) limit 1) like ? ";
    extraParams.push("%" + salesman + "%");
  }
  if (rayon) {
    extraWhere += " and sls_nama like ? ";
    extraParams.push("%" + rayon + "%");
  }
  if (isProductFocus === true) {
    extraWhere += " and brg_isproductfocus=1 ";
  }
  if (linkMarketing === true) {
    extraWhere += " and fp_cus_kode in (select sc_cus_kode from tsalescustomer) ";
  }

  const groupBy = " group by fp_nomor,fp_tanggal,month(fp_tanggal),year(fp_tanggal),cus_nama,brg_kode,brg_nama,fpd_brg_satuan";

  const mainQuery =
    " SELECT " + selectAll.join(",") + " "
    + fromFinal.join(" ") + " "
    + whereClause + extraWhere + groupBy;

  // ── UNION RETUR (paritas Delphi L552-581; baris minus) ───────────────
  const returQuery =
    " UNION SELECT retj_nomor Nomor,date_format(retj_tanggal,\"%Y-%m-%d\") Tanggal,"
    + " month(retj_tanggal) Bulan,year(retj_tanggal) Tahun,'' Group_Produk,"
    + " (SELECT sls_nama FROM tsalesman inner join tsalescustomer ON sls_kode=sc_sls_kode where sc_cus_kode=fp_cus_kode) Marketing,"
    + " sls_nama Rayon,(SELECT sla_nama FROM tsalesmanaktif WHERE sla_kode = COALESCE(NULLIF(so_sla_kode, \"\"), fp_sla_kode) limit 1) Salesman,"
    + " cus_nama Outlet,'' Golongan,'' JenisCustomer,brg_kode Kode,brg_nama Nama,brg_merk Merk,ktg_nama Kategori,"
    + " (SELECT ktg_nama FROM tkategori where ktg_kode=SUBSTRING_INDEX(brg_ktg_kode, \".\", 2)) SubDepartemen,"
    + " (SELECT ktg_nama FROM tkategori where ktg_kode=SUBSTRING_INDEX(brg_ktg_kode, \".\", 1)) Departemen," + divisiExpr + ","
    + " fpd_brg_satuan Satuan,\"Tidak\" IsPf,\"\" Eceran,\"\" isCatalog,0 fpd_cn,"
    + " -sum(ifnull(retjd_qty,0)) Qty,"
    + " -sum((100-fpd_discpr)*(fpd_harga*ifnull(retjd_qty,0))/100*if(fp_istax=1,if(fp_tanggal<\"2022/04/01\",1.1,1.11),1)) Nilai,"
    + " -sum((100-fpd_discpr)*(fpd_harga*ifnull(retjd_qty,0))/100) Nilaiblmppn,"
    + " 0 Kontrak"
    + smarginRetur
    + " ,0 biaya_promosi,0 fee_marketing,"
    + " -sum((100-fpd_discpr)*(fpd_harga*ifnull(retjd_qty,0))/100) Nilai_Net,"
    + " 0 pajak,\"\" status_het,"
    + " 0 kunjunganmarketing,0 kunjungansales, 0 NilaiEkspedisi"
    + " FROM tretj_hdr "
    + " inner join tretj_dtl on retjd_retj_nomor=retj_nomor "
    + " inner join tfp_hdr on retj_fp_nomor=fp_nomor "
    + " inner join tfp_dtl on fpd_fp_nomor=fp_nomor and fpd_brg_kode=retjd_brg_kode"
    + " and (fpd_expired = retjd_expired OR fpd_expired = '') "
    + " inner join tbarang on brg_kode=retjd_brg_kode "
    + " left join tdo_hdr on do_nomor=fp_do_nomor "
    + " left join tso_hdr on so_nomor=COALESCE(NULLIF(fp_so_nomor, ''), do_so_nomor) "
    + " left join tmasterstok ms on ms.mst_noreferensi=fp_do_nomor"
    + "   and ms.mst_brg_kode=retjd_brg_kode and ms.mst_expired_date=retjd_expired "
    + " left join tsalesman on sls_kode = so_sls_kode "
    + " left join tkategori on ktg_kode=brg_ktg_kode "
    + " left join tcustomer on cus_kode=fp_cus_kode "
    + " left join tjeniscustomer on jc_kode=cus_jc_kode "
    + " where retj_tanggal between ? and ? "
    + extraWhere
    + " group by retj_nomor,retj_tanggal,cus_nama,brg_kode,brg_nama,fpd_brg_satuan";

  // ── UNION zkunjungan (paritas Delphi) ─────────────────────────────────
  const zkunjunganQuery =
    " UNION SELECT '' Nomor,date_format(tanggal,'%Y-%m-%d') Tanggal,cast(date_format(tanggal,'%m') as signed) Bulan,"
    + " cast(date_format(tanggal,'%Y') as signed) Tahun,'' Group_produk,if(sls_insentif=2,sls_nama,'') Marketing,"
    + " if(sls_insentif=1,sls_nama,'') Rayon, if(sls_insentif=1,sla_nama,'') Salesman,"
    + " cus_nama Outlet,'' Golongan,'' JenisCustomer,0 Kode,'' Nama,'' Merk,'' Kategori,'' SubDepartemen,'' Departemen,'' Divisi,"
    + " '' Satuan, if(sls_insentif=2,'Ya','Tidak') IsPf,'' Eceran,'' isCatalog,0 fpd_cn,"
    + " 0 Qty,0 Nilai,0 Nilaiblmppn,0 Kontrak "
    + smargin2
    + " ,0 biaya_promosi,0 fee_marketing,0 Nilai_Net,0 Pajak,'' StatusHet,"
    + " cast(if(sls_insentif=2,1,0) as signed) kunjunganmarketing,cast(if(sls_insentif=1,1,0) as signed) kunjungansales, 0 NilaiEkspedisi"
    + " FROM zkunjungan x "
    + " INNER JOIN tsalesmanaktif ON sla_nama = USER "
    + " INNER JOIN tsalesman ON sls_kode = sla_sls_kode "
    + " LEFT JOIN tcustomer y ON x.cus_kode=y.cus_kode "
    + " where tanggal between ? and date_add(? , interval 1 day) ";

  // ── UNION ekspedisi (paritas Delphi) ─────────────────────────────────
  const ekspedisiQuery =
    " UNION SELECT fp_nomor Nomor,date_format(fp_tanggal,'%Y-%m-%d') Tanggal,month(fp_tanggal) Bulan,year(fp_tanggal) Tahun,"
    + " '' Group_produk,"
    + " (SELECT sls_nama FROM tsalesman inner join tsalescustomer ON sls_kode=sc_sls_kode where sc_cus_kode=fp_cus_kode) Marketing,"
    + " sls_nama Rayon,"
    + " (SELECT sla_nama FROM tsalesmanaktif WHERE sla_kode = COALESCE(NULLIF(so_sla_kode, \"\"), fp_sla_kode) LIMIT 1) Salesman,"
    + " cus_nama Outlet,cus_gc_kode Golongan,jc_nama JenisCustomer,0 Kode,'EKSPEDISI' Nama,'' Merk,'' Kategori,'' SubDepartemen,'' Departemen,'' Divisi,"
    + " '' Satuan,'Tidak' IsPf,'Tidak' Eceran,'Tidak' isCatalog,0 fpd_cn,"
    + " 1 Qty,0 Nilai,0 Nilaiblmppn,0 Kontrak "
    + smargin2
    + " ,0 biaya_promosi,0 fee_marketing,0 Nilai_Net,0 Pajak,'' StatusHet,"
    + " cast(0 as signed) kunjunganmarketing,cast(0 as signed) kunjungansales, tehd_biaya NilaiEkspedisi"
    + " FROM ttagihanekspedisi_dtl "
    + " INNER JOIN tfp_hdr ON fp_nomor = tehd_fp_nomor "
    + " LEFT JOIN tdo_hdr ON do_nomor = fp_do_nomor "
    + " LEFT JOIN tso_hdr ON so_nomor = COALESCE(NULLIF(fp_so_nomor, ''), do_so_nomor) "
    + " LEFT JOIN tsalesman ON sls_kode = so_sls_kode "
    + " LEFT JOIN tcustomer y ON fp_cus_kode = y.cus_kode "
    + " LEFT JOIN tjeniscustomer ON jc_kode = cus_jc_kode "
    + " where fp_tanggal between ? and date_add(? , interval 1 day) ";

  const fullQuery = mainQuery
    + " union " + returQuery.slice(" union ".length)
    + " union " + zkunjunganQuery.slice(" union ".length)
    + " union " + ekspedisiQuery.slice(" union ".length);

  const paramsArr = [
    ...(function* () {
      yield* [startDate, endDate, ...extraParams]; // main
      yield* [startDate, endDate, ...extraParams]; // retur
      yield* [startDate, endDate];                 // kunjungan
      yield* [startDate, endDate];                 // ekspedisi
    })(),
  ];

  const [rows] = await db.query(fullQuery, paramsArr);
  return rows;
};

module.exports = { getBrowse };