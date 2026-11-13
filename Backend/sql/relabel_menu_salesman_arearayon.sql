-- Relabel Master Salesman → Master Area/Rayon (MEN_ID 3)
-- Label sidebar diambil dari MEN_NAMA2 (fallback MEN_KETERANGAN, MEN_NAMA).
UPDATE tmenu
SET MEN_NAMA2 = 'Area/Rayon',
    MEN_KETERANGAN = 'Master Area/Rayon'
WHERE MEN_ID = 3;
