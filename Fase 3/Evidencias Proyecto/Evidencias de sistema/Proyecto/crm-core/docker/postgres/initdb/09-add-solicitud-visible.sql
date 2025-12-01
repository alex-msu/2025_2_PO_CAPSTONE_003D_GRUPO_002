-- ========================================================
-- Migración: Agregar columna 'visible' a solicitudes_mantenimiento
-- Fecha: 2024-12-30
-- Descripción: Agrega campo para soft delete (ocultar solicitudes sin eliminarlas)
-- ========================================================

-- Agregar columna 'visible' si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'solicitudes_mantenimiento' 
        AND column_name = 'visible'
    ) THEN
        ALTER TABLE solicitudes_mantenimiento 
        ADD COLUMN visible boolean DEFAULT true NOT NULL;
        
        -- Crear índice para mejorar performance de consultas
        CREATE INDEX idx_solicitudes_visible ON solicitudes_mantenimiento(visible);
        
        RAISE NOTICE 'Columna visible agregada exitosamente a solicitudes_mantenimiento';
    ELSE
        RAISE NOTICE 'La columna visible ya existe en solicitudes_mantenimiento';
    END IF;
END $$;

COMMENT ON COLUMN solicitudes_mantenimiento.visible IS 'Indica si la solicitud es visible en el dashboard. false = oculta (soft delete)';

