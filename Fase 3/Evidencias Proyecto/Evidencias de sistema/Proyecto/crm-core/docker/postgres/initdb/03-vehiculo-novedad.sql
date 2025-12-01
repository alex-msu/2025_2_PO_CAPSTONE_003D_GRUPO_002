DROP VIEW IF EXISTS dashboard_jefe_taller;
DROP VIEW IF EXISTS mecanicos_disponibles;

CREATE OR REPLACE VIEW mecanicos_disponibles AS
SELECT u.id,
       u.nombre_completo,
       u.email,
       h.lunes_activo,
       h.lunes_hora_inicio,
       h.lunes_hora_salida,
       h.lunes_colacion_inicio,
       h.lunes_colacion_salida,
       h.martes_activo,
       h.martes_hora_inicio,
       h.martes_hora_salida,
       h.martes_colacion_inicio,
       h.martes_colacion_salida,
       h.miercoles_activo,
       h.miercoles_hora_inicio,
       h.miercoles_hora_salida,
       h.miercoles_colacion_inicio,
       h.miercoles_colacion_salida,
       h.jueves_activo,
       h.jueves_hora_inicio,
       h.jueves_hora_salida,
       h.jueves_colacion_inicio,
       h.jueves_colacion_salida,
       h.viernes_activo,
       h.viernes_hora_inicio,
       h.viernes_hora_salida,
       h.viernes_colacion_inicio,
       h.viernes_colacion_salida
FROM usuarios u
LEFT JOIN horarios_trabajo h ON h.usuario_id = u.id
WHERE u.rol = 'MECANICO'
  AND u.activo = true
  AND NOT EXISTS (
    SELECT 1
    FROM ordenes_trabajo ot
    WHERE ot.mecanico_asignado_id = u.id
      AND ot.estado IN ('PENDIENTE', 'EN_PROCESO', 'ESPERA_REPUESTOS')
  )
ORDER BY u.nombre_completo;

CREATE OR REPLACE VIEW dashboard_jefe_taller AS
SELECT 
  COUNT(*) as total_ots,
  COUNT(*) FILTER (WHERE estado = 'PENDIENTE') as ots_pendientes,
  COUNT(*) FILTER (WHERE estado = 'EN_PROCESO') as ots_en_proceso,
  COUNT(*) FILTER (WHERE estado = 'ESPERA_REPUESTOS') as ots_espera_repuestos,
  COUNT(*) FILTER (WHERE estado = 'LISTO') as ots_listas,
  COUNT(*) FILTER (WHERE estado = 'APROBADO') as ots_aprobadas,
  COUNT(*) FILTER (WHERE fecha_cierre >= CURRENT_DATE) as ots_completadas_hoy
FROM ordenes_trabajo;