-- Agregar campos para cierre de trabajo
ALTER TABLE ordenes_trabajo
ADD COLUMN IF NOT EXISTS descripcion_proceso_realizado text,
ADD COLUMN IF NOT EXISTS cierre_evidencias text[];

-- Agregar estado PENDIENTE_VERIFICACION si no existe
-- Nota: PostgreSQL no permite modificar CHECK constraints directamente,
-- así que si el estado ya existe en el CHECK, no es necesario hacer nada.
-- Si necesitas agregarlo, tendrías que recrear la constraint.

