-- Estrategia alternativa: Usar CHECK constraint en lugar de ENUM para mayor flexibilidad
-- Primero, corregir valores existentes
UPDATE ai_analyses 
SET analysis_type = 'initial_contract_creation' 
WHERE analysis_type = 'basic_extraction' OR analysis_type = 'full_contract';

-- Agregar CHECK constraint para validar tipos permitidos
ALTER TABLE ai_analyses 
ADD CONSTRAINT analysis_type_check 
CHECK (analysis_type IN (
  'initial_contract_creation',
  'edp_analysis',
  'sdi_analysis',
  'document_classification',
  'contract_full_analysis',
  'additional_document'
));

-- Agregar constraint único para evitar duplicados de tareas
ALTER TABLE contract_tasks 
ADD CONSTRAINT contract_tasks_contract_task_unique 
UNIQUE (contract_id, task_number);

-- Crear índice para mejorar performance en queries de progreso
CREATE INDEX IF NOT EXISTS idx_contract_tasks_contract_progress 
ON contract_tasks(contract_id, progress_percentage);

-- Crear índice para queries por tipo de análisis
CREATE INDEX IF NOT EXISTS idx_ai_analyses_type_contract 
ON ai_analyses(analysis_type, contract_id);