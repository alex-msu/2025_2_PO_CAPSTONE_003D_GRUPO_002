-- Agregar campo para comentario de rechazo
ALTER TABLE ordenes_trabajo
ADD COLUMN IF NOT EXISTS comentario_rechazo text;

