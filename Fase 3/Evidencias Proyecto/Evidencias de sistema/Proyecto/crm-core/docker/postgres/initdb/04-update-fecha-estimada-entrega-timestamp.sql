-- Cambiar fecha_estimada_entrega de date a timestamp para incluir hora
ALTER TABLE solicitudes_repuestos 
ALTER COLUMN fecha_estimada_entrega TYPE timestamp USING 
  CASE 
    WHEN fecha_estimada_entrega IS NOT NULL 
    THEN fecha_estimada_entrega::timestamp 
    ELSE NULL 
  END;

