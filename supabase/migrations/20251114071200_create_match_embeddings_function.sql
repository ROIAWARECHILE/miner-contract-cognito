-- Crear una función para buscar en los embeddings de los documentos
create or replace function match_document_embeddings (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  contract_id uuid,
  document_id bigint,
  contract_code text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    de.id,
    de.contract_id,
    de.document_id,
    de.contract_code,
    de.content,
    1 - (de.embedding <=> query_embedding) as similarity
  from document_embeddings de
  where 1 - (de.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
