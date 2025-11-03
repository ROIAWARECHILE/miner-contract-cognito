-- Primero, verificar si el tipo document_type existe y agregar los valores faltantes
DO $$ 
BEGIN
    -- Intentar crear el tipo si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
        CREATE TYPE document_type AS ENUM ('original', 'contract', 'edp', 'sdi', 'quality', 'sso', 'tech', 'addendum', 'minuta');
    ELSE
        -- Si existe, agregar los valores faltantes uno por uno
        BEGIN
            ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'contract';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        
        BEGIN
            ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'edp';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        
        BEGIN
            ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'sdi';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        
        BEGIN
            ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'quality';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        
        BEGIN
            ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'sso';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        
        BEGIN
            ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'tech';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        
        BEGIN
            ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'addendum';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        
        BEGIN
            ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'minuta';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;