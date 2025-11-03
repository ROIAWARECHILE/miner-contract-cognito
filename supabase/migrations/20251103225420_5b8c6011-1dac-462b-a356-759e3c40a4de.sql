-- Corregir period_label faltante en EDP #3
UPDATE payment_states
SET 
  period_label = 'Sep-25',
  updated_at = NOW()
WHERE 
  contract_id = (SELECT id FROM contracts WHERE code = 'AIPD-CSI001-1000-MN-0001')
  AND edp_number = 3
  AND period_label IS NULL;

-- Nota: EDP #2 necesita revisión manual del PDF para identificar todas las tareas faltantes
-- Se reporta diferencia de 323.81 UF entre total (575.02 UF) y suma de tareas (251.21 UF)
COMMENT ON TABLE payment_states IS 'PENDING: Manual review of EDP #2 PDF needed - missing 323.81 UF in task allocation';