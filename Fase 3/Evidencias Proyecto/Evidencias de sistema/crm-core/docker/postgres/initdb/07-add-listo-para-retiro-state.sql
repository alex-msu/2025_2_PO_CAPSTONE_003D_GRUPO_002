-- Agregar estado LISTO_PARA_RETIRO a la tabla vehiculos
ALTER TABLE vehiculos
DROP CONSTRAINT IF EXISTS vehiculos_estado_check;

ALTER TABLE vehiculos
ADD CONSTRAINT vehiculos_estado_check CHECK (estado IN (
  'OPERATIVO', 'EN_REVISION', 'STANDBY', 'CITA_MANTENCION', 
  'EN_TALLER', 'MANTENCION', 'COMPLETADO', 'LISTO_PARA_RETIRO', 'INACTIVO'
));