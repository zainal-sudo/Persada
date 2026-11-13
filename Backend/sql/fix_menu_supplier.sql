UPDATE tmenu
   SET men_route = '/daftar/supplier',
       men_view = 'daftar/SupplierView',
       men_parent_id = 5,
       men_order = 5
 WHERE MEN_ID = 4;
