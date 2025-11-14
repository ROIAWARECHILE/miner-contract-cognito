alter table documents
add column if not exists ai_detected_type text,
add column if not exists ai_summary text;
