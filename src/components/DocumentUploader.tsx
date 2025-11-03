import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useContracts } from '@/hooks/useContract';

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
  preselectedContractId?: string;
}

export default function DocumentUploader({
  projectPrefix = 'dominga',
  defaultType = 'edp',
  preselectedContractId
}: DocumentUploaderProps) {
  const [docType, setDocType] = useState<DocType>(defaultType);
  const [contractId, setContractId] = useState<string>(preselectedContractId || '');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  
  const { data: contracts } = useContracts();

  // Update contractId when preselectedContractId changes
  React.useEffect(() => {
    if (preselectedContractId) {
      setContractId(preselectedContractId);
    }
  }, [preselectedContractId]);

  React.useEffect(() => {
    console.log('DocumentUploader - contractId:', contractId);
    console.log('DocumentUploader - preselectedContractId:', preselectedContractId);
  }, [contractId, preselectedContractId]);

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
    if (!contractId) {
      setLog(l => ['❌ ERROR CRÍTICO: No hay contrato seleccionado', ...l]);
      toast.error('⚠️ Primero selecciona un contrato en el selector global', {
        duration: 5000,
        position: 'top-center'
      });
      return;
    }
    
    if (!files.length) {
      toast.error('📄 Selecciona al menos un archivo PDF para subir', {
        duration: 4000
      });
      return;
    }
    
    setLog(l => [`✓ Iniciando subida con contrato: ${contracts?.find(c => c.id === contractId)?.code}`, ...l]);
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

        // Get contract code for new pipeline
        const contract = contracts?.find(c => c.id === contractId);
        const contract_code = contract?.code || '';

        if (!contract_code) {
          setLog(l => [`⚠️ No se pudo obtener el código del contrato`, ...l]);
          toast.error('Error: Contrato no encontrado');
          continue;
        }

        // Use new LlamaParse + OpenAI pipeline for EDPs
        if (docType === 'edp') {
          setLog(l => [`🦙 Procesando EDP con LlamaParse + OpenAI GPT-4o...`, ...l]);
          
          const { data: processData, error: processErr } = await supabase.functions.invoke('process-edp-llamaparse', {
            body: { 
              contract_code,
              storage_path: path,
              edp_number: parseInt(safeName.match(/\d+/)?.[0] || '0') // Extract number from filename
            }
          });

          if (processErr) {
            setLog(l => [`❌ Error al procesar ${safeName}: ${processErr.message}`, ...l]);
            toast.error(`Error al procesar ${safeName}: ${processErr.message}`);
          } else if (processData?.ok) {
            setLog(l => [`✅ ${safeName} procesado exitosamente`, ...l]);
            setLog(l => [`📊 Gastado: ${processData.metrics?.spent_uf} UF | Avance: ${processData.metrics?.progress_pct}%`, ...l]);
            toast.success(`✅ EDP #${processData.edp_number} procesado: ${processData.metrics?.tasks_count} tareas actualizadas`);
          } else {
            setLog(l => [`⚠️ Respuesta inesperada al procesar ${safeName}`, ...l]);
          }
        } else {
          // Fallback to old pipeline for non-EDP documents
          const { data: enqueueData, error: enqueueErr } = await supabase.functions.invoke('ingest-enqueue', {
            body: { 
              project_prefix: projectPrefix,
              contract_id: contractId,
              storage_path: path, 
              file_hash: hash,
              document_type: docType
            }
          });

          if (enqueueErr) {
            setLog(l => [`⚠️ Error al procesar ${safeName}: ${enqueueErr.message}`, ...l]);
          } else {
            setLog(l => [`🔄 Procesamiento iniciado: ${safeName} (${LABEL[docType]})`, ...l]);
          }
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
    const failedCount = total - done;
    
    if (failedCount > 0) {
      toast.error(`❌ ${failedCount} archivo(s) fallaron. Revisa los logs.`, {
        duration: 6000
      });
    } else {
      if (docType === 'edp') {
        toast.success(`✅ ${done} EDP(s) procesados con LlamaParse + OpenAI GPT-4o`, {
          duration: 5000
        });
      } else {
        toast.success(`✅ ${done} archivo(s) subidos y procesados`, {
          duration: 4000
        });
      }
    }
  }

  // Prevent upload if no contract selected
  const canUpload = contractId && files.length > 0 && !busy;
  
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {!preselectedContractId && (
        <div className="mb-3 flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">Contrato *</label>
          <select 
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
            value={contractId} 
            onChange={e => setContractId(e.target.value)}
            required
          >
            <option value="">⚠️ Seleccionar contrato (requerido)</option>
            {contracts?.map(c => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Show selected contract clearly */}
      {contractId && (
        <div className="mb-3 p-2 bg-primary/10 border border-primary/30 rounded text-sm">
          <strong>✓ Contrato seleccionado:</strong> {contracts?.find(c => c.id === contractId)?.code}
        </div>
      )}
      
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
            disabled={!canUpload} 
            className="w-full"
            title={!contractId ? 'Debes seleccionar un contrato primero' : ''}
          >
            {busy ? 'Subiendo y procesando…' : !contractId ? '⚠️ Selecciona un contrato' : `✓ Subir ${files.length} archivo(s) y procesar con IA`}
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
    .replace(/\s+/g, '_')  // Replace spaces with underscores
    .replace(/[^\w\.\-\u00C0-\u017F_]/g, '')  // Remove special chars except letters, numbers, dots, dashes, underscores
    .replace(/_+/g, '_')  // Replace multiple underscores with single
    .trim();
}

async function digest(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2,'0'))
    .join('');
}
