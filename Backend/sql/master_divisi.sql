-- 1) Create Table tdivisi
CREATE TABLE IF NOT EXISTS tdivisi (
  div_kode CHAR(3) NOT NULL,
  div_nama VARCHAR(100) NOT NULL,
  div_prefix CHAR(3) DEFAULT '',
  PRIMARY KEY (div_kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Insert Menu Master Divisi under Daftar (group 1, parent 0 or similar)
-- Let's check how other Daftar menus are inserted in the database or menu table.
