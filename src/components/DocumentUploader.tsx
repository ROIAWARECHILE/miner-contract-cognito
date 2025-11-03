import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

type DocType = 'contract'|'quality'|'sso'|'tech'|'edp'|'sdi'|'addendum';

const LABEL: Record<DocType,string> = {
  contract: 'Contrato',
  quality: 'Plan de Calidad',
  sso: 'Plan de SSO',
  tech: 'Estudio Técnico',
  edp: 'Estado de Pago (EDP)',
  sdi: 'SDI',
  addendum: 'Addendum'
};

interface DocumentUploaderProps {
  projectPrefix?: string;
  defaultType?: DocType;
}

export default function DocumentUploader({
  projectPrefix = 'dominga',
  defaultType = 'edp',
}: DocumentUploaderProps) {
  const [docType, setDocType] = useState<DocType>(defaultType);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const list = Array.from(e.target.files).filter(f => {
      if (f.type !== 'application/pdf') {
        toast.error(`${f.name} no es un PDF válido`);
        return false;
      }
      if (f.size > 100 * 1024 * 1024) {
        toast.error(`${f.name} excede el límite de 100MB`);
        return false;
      }
      return true;
    });
    setFiles(list);
  }

  async function uploadAll() {
    if (!files.length) return;
    setBusy(true); 
    setProgress(0); 
    setLog([]);
    
    const total = files.length; 
    let done = 0;

    for (const f of files) {
      try {
        const hash = await digest(f);
        const safeName = sanitize(f.name);
        const path = `${projectPrefix}/${docType}/${safeName}`;

        const { error: upErr } = await supabase.storage
          .from('contracts')
          .upload(path, f, { 
            upsert: true, 
            contentType: 'application/pdf' 
          });
        
        if (upErr) throw upErr;

        setLog(l => [`✅ Subido: ${safeName} → ${path}`, ...l]);

        // Enqueue ingestion job
        const { error: enqueueErr } = await supabase.functions.invoke('ingest-enqueue', {
          body: { 
            project_prefix: projectPrefix, 
            storage_path: path, 
            file_hash: hash 
          }
        });

        if (enqueueErr) {
          setLog(l => [`⚠️ Encolado fallido para ${safeName}: ${enqueueErr.message}`, ...l]);
        } else {
          setLog(l => [`🔄 Encolado para procesamiento: ${safeName}`, ...l]);
        }
      } catch (e: any) {
        setLog(l => [`❌ Error con ${f.name}: ${e.message ?? e}`, ...l]);
        toast.error(`Error al subir ${f.name}`);
      } finally {
        done++; 
        setProgress(Math.round((done/total)*100));
      }
    }
    
    setBusy(false);
    toast.success(`${done} archivo(s) subido(s) y encolado(s)`);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">Tipo</label>
        <select 
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
          value={docType} 
          onChange={e => setDocType(e.target.value as DocType)}
        >
          {Object.entries(LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <label className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-accent/50 transition-colors block">
        <input 
          type="file" 
          accept="application/pdf" 
          multiple 
          className="hidden" 
          onChange={onPick} 
        />
        <div className="text-muted-foreground">
          <div className="font-medium text-foreground">Arrastra PDF o haz clic para seleccionar</div>
          <div className="text-xs mt-1">Destino: <code className="text-xs bg-muted px-1 rounded">contracts/{projectPrefix}/{docType}/</code></div>
          <div className="text-xs mt-1 text-muted-foreground/70">Max 100MB por archivo</div>
        </div>
      </label>

      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="text-sm text-foreground font-medium">{files.length} archivo(s) seleccionado(s)</div>
          
          <Button 
            onClick={uploadAll} 
            disabled={busy} 
            className="w-full"
          >
            {busy ? 'Subiendo…' : 'Subir y encolar ingesta'}
          </Button>
          
          {progress > 0 && (
            <Progress value={progress} className="h-2" />
          )}
          
          {log.length > 0 && (
            <ul className="space-y-1 max-h-40 overflow-auto text-xs font-mono bg-muted/30 p-3 rounded-lg">
              {log.map((l,i) => <li key={i}>{l}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function sanitize(name: string) {
  return name
    .replace(/\s+/g,' ')
    .replace(/[^\w\.\-\u00C0-\u017F ]/g,'')
    .replace(/ +/g,' ')
    .trim();
}

async function digest(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2,'0'))
    .join('');
}
