-- Eliminar columnas lectura_odometro y nivel_combustible de entregas_vehiculos
ALTER TABLE entregas_vehiculos
DROP COLUMN IF EXISTS lectura_odometro,
DROP COLUMN IF EXISTS nivel_combustible;

