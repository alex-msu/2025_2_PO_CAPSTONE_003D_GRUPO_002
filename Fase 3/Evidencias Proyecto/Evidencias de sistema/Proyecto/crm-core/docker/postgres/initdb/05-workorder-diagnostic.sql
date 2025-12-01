ALTER TABLE IF EXISTS ordenes_trabajo
    ADD COLUMN IF NOT EXISTS diagnostico_checklist jsonb,
    ADD COLUMN IF NOT EXISTS diagnostico_evidencias text[];


