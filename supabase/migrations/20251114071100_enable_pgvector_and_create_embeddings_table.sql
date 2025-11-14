-- Habilitar la extensión pgvector
create extension if not exists vector with schema extensions;

-- Crear la tabla para almacenar los embeddings de los documentos
create table if not exists document_embeddings (
  id bigserial primary key,
  contract_id uuid references contracts(id) on delete cascade,
  document_id bigint references documents(id) on delete cascade,
  contract_code text,
  content text, -- El fragmento de texto
  embedding vector(1536), -- El vector de embedding
  created_at timestamptz default now() not null
);

-- Crear un índice para búsquedas de similitud eficientes
create index if not exists on document_embeddings using ivfflat (embedding vector_l2_ops) with (lists = 100);
