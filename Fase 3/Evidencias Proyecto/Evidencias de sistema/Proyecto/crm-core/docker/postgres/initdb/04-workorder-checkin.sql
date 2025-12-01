ALTER TABLE IF EXISTS ordenes_trabajo
ADD COLUMN IF NOT EXISTS fecha_ingreso_recepcion TIMESTAMP;

