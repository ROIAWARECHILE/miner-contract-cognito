
-- Opción C: Corrección manual inmediata del metadata del contrato Dominga
-- Recalcular metadata basado en payment_states reales

WITH metrics AS (
  SELECT 
    c.id,
    4501 AS budget_uf,
    COALESCE(SUM(ps.amount_uf) FILTER (WHERE ps.status IN ('approved', 'submitted')), 0) AS spent_uf,
    COUNT(*) FILTER (WHERE ps.status = 'approved') AS edps_paid
  FROM contracts c
  LEFT JOIN payment_states ps ON ps.contract_id = c.id
  WHERE c.code = 'AIPD-CSI001-1000-MN-0001'
  GROUP BY c.id
)
UPDATE contracts c
SET 
  metadata = COALESCE(c.metadata, '{}'::JSONB) || jsonb_build_object(
    'budget_uf', m.budget_uf,
    'spent_uf', m.spent_uf,
    'available_uf', m.budget_uf - m.spent_uf,
    'overall_progress_pct', ROUND((m.spent_uf / NULLIF(m.budget_uf, 0)) * 100),
    'edps_paid', m.edps_paid,
    'last_updated', NOW()
  ),
  updated_at = NOW()
FROM metrics m
WHERE c.id = m.id;
