-- Actualizar tareas del contrato AIPD-CSI001-1000-MN-0001 basándome en EDP #2
-- Primero, eliminar las tareas incorrectas
DELETE FROM contract_tasks 
WHERE contract_id = 'af6f54d4-c6ef-4a51-8d17-74286d6f2f7f';

-- Insertar las tareas correctas del EDP #2
INSERT INTO contract_tasks (contract_id, task_number, task_name, budget_uf, spent_uf, progress_percentage, created_at, updated_at)
VALUES 
  ('af6f54d4-c6ef-4a51-8d17-74286d6f2f7f', '1.1', 'Recopilación y análisis de la información hidrológica, hidrogeológica y ambiental', 507, 94.63, 19, NOW(), NOW()),
  ('af6f54d4-c6ef-4a51-8d17-74286d6f2f7f', '1.2', 'Visita a terreno', 216, 156.58, 72, NOW(), NOW()),
  ('af6f54d4-c6ef-4a51-8d17-74286d6f2f7f', '2.0', 'Actualización del estudio hidrológico', 863, 72.19, 8, NOW(), NOW()),
  ('af6f54d4-c6ef-4a51-8d17-74286d6f2f7f', '3.0', 'Revisión experta del actual Modelo Hidrogeológico de Flujo y Transporte (conceptual y numérico)', 256, 65.60, 26, NOW(), NOW()),
  ('af6f54d4-c6ef-4a51-8d17-74286d6f2f7f', '4.0', 'Actualización y calibración del MN de Flujo y Transporte existente', 843, 0, 0, NOW(), NOW()),
  ('af6f54d4-c6ef-4a51-8d17-74286d6f2f7f', '5.0', 'Análisis de condiciones desfavorables', 213, 0, 0, NOW(), NOW()),
  ('af6f54d4-c6ef-4a51-8d17-74286d6f2f7f', '6.0', 'Simulaciones predictivas', 423, 0, 0, NOW(), NOW()),
  ('af6f54d4-c6ef-4a51-8d17-74286d6f2f7f', '7.0', 'Asesoría Técnica y Análisis Complementarios', 580, 0, 0, NOW(), NOW()),
  ('af6f54d4-c6ef-4a51-8d17-74286d6f2f7f', '8.0', 'Reuniones y presentaciones', 386, 8.01, 2, NOW(), NOW()),
  ('af6f54d4-c6ef-4a51-8d17-74286d6f2f7f', '9.0', 'Costos Administración y Operación del Proyecto (5%)', 214, 21.43, 10, NOW(), NOW());

-- Refrescar métricas del contrato
SELECT refresh_contract_metrics('AIPD-CSI001-1000-MN-0001');