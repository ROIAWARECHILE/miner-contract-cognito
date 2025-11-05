import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useContracts } from '@/hooks/useContract';
import { useQuery } from '@tanstack/react-query';

type DocType = 'contract'|'quality'|'sso'|'tech'|'edp'|'sdi'|'addendum'|'memorandum';

const LABEL: Record<DocType,string> = {
  contract: 'Contrato',
  quality: 'Plan de Calidad',
  sso: 'Plan de SSO',
  tech: 'Estudio Técnico',
  edp: 'Estado de Pago (EDP)',
  sdi: 'SDI',
  addendum: 'Addendum',
  memorandum: 'Memorándum / Respaldo EdP'
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
  const [selectedEdpNumber, setSelectedEdpNumber] = useState<number | null>(null);
  
  const { data: contracts } = useContracts();

  // Cargar EDPs disponibles del contrato seleccionado
  const { data: availableEdps } = useQuery({
    queryKey: ['contract-edps', contractId],
    queryFn: async () => {
      if (!contractId) return [];
      
      const { data: payments, error } = await supabase
        .from('payment_states')
        .select('edp_number, period_label, status, amount_uf')
        .eq('contract_id', contractId)
        .order('edp_number', { ascending: false });
      
      if (error) {
        console.error('Error fetching EDPs:', error);
        return [];
      }
      
      return payments;
    },
    enabled: !!contractId && docType === 'memorandum'
  });

  // Update contractId when preselectedContractId changes
  useEffect(() => {
    if (preselectedContractId) {
      setContractId(preselectedContractId);
    }
  }, [preselectedContractId]);

  // Resetear EDP seleccionado cuando cambia el contrato o el tipo de documento
  useEffect(() => {
    setSelectedEdpNumber(null);
  }, [contractId, docType]);

  // FASE 5: Verificar jobs atascados al montar el componente
  useEffect(() => {
    const checkStaleJobs = async () => {
      const { data: staleJobs } = await supabase
        .from('document_processing_jobs')
        .select('id, storage_path, updated_at')
        .eq('status', 'processing')
        .lt('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // >30 min
      
      if (staleJobs && staleJobs.length > 0) {
        console.warn('[DocumentUploader] ⚠️ Stale processing jobs detected:', staleJobs);
        toast.warning(
          `⚠️ Hay ${staleJobs.length} documento(s) atascado(s) en procesamiento`,
          { 
            description: 'Los documentos llevan >30 minutos procesando. Pueden requerir atención.',
            duration: 6000
          }
        );
      }
    };
    
    checkStaleJobs();
  }, []);

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
    // Only require contractId if document type is not 'contract'
    if (docType !== 'contract' && !contractId) {
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
    
    // Get contract code (optional for contract type documents)
    let contract_code = '';
    if (contractId) {
      const contract = contracts?.find(c => c.id === contractId);
      contract_code = contract?.code || '';
      
      if (!contract_code && docType !== 'contract') {
        toast.error('Error: Contrato no encontrado');
        return;
      }
    }
    
    if (docType === 'contract') {
      setLog(l => [`✓ Iniciando subida de documento de contrato (se creará automáticamente)`, ...l]);
    } else {
      setLog(l => [`✓ Iniciando subida con contrato: ${contract_code}`, ...l]);
    }
    setBusy(true);
    setProgress(0); 
    setLog([]);
    
    const total = files.length; 
    let done = 0;

    for (const f of files) {
      try {
        const safeName = sanitize(f.name);
        
        // Construct storage path matching new system
    const folderMap: Record<DocType, string> = {
      contract: 'contract',
      quality: 'quality',
      sso: 'sso',
      tech: 'tech',
      edp: 'edp',
      sdi: 'sdi',
      addendum: 'addendum',
      memorandum: 'memo'
    };

        const folder = folderMap[docType] || docType;
        
        // For contract documents without a pre-selected contract, use a pending path
        const path = docType === 'contract' && !contract_code
          ? `${projectPrefix}/pending_contracts/${folder}/${safeName}`
          : `${projectPrefix}/${contract_code}/${folder}/${safeName}`;

        // Upload to storage
        const { error: upErr } = await supabase.storage
          .from('contracts')
          .upload(path, f, { 
            upsert: true, 
            contentType: 'application/pdf' 
          });
        
        if (upErr) throw upErr;

        setLog(l => [`✅ Subido: ${safeName} → ${path}`, ...l]);

        // Extract EDP number from filename if applicable
        let edpNumber: number | undefined;
        if (docType === 'edp') {
          const match = safeName.match(/EDP[^\d]*(\d+)/i);
          if (match) {
            edpNumber = parseInt(match[1], 10);
            setLog(l => [`📝 Extraído EDP número: ${edpNumber}`, ...l]);
          }
        }

        // Call unified processing function
        setLog(l => [`🔄 Procesando con LlamaParse + OpenAI GPT-4o...`, ...l]);

        const { data: processData, error: processErr } = await supabase.functions.invoke(
          'process-document',
          {
            body: {
              contract_code: contract_code || null,
              storage_path: path,
              document_type: docType,
              edp_number: docType === 'memorandum' ? selectedEdpNumber : edpNumber,
              metadata: {
                filename: safeName,
                uploaded_at: new Date().toISOString(),
                user_selected_edp: docType === 'memorandum' ? selectedEdpNumber : undefined
              }
            }
          }
        );

        if (processErr) {
          setLog(l => [`❌ Error al procesar ${safeName}: ${processErr.message}`, ...l]);
          toast.error(`Error al procesar ${safeName}: ${processErr.message}`);
        } else if (processData?.ok) {
          setLog(l => [`✅ ${safeName} procesado exitosamente`, ...l]);
          toast.success(`✅ ${safeName} procesado correctamente`);
        } else {
          setLog(l => [`⚠️ Respuesta inesperada al procesar ${safeName}`, ...l]);
          toast.error(processData?.error || 'Error desconocido al procesar');
        }
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        console.error("[DocumentUploader] Processing error:", e);
        
        // Mensajes específicos según el error
        if (errMsg.includes("Contract not found") || errMsg.includes("No contract found")) {
          const contractCode = contracts.find((c) => c.id === contractId)?.code || "unknown";
          toast.error(`❌ Error: El contrato "${contractCode}" no existe en el sistema`, {
            duration: 6000,
          });
          setLog((l) => [`❌ ERROR: Contrato "${contractCode}" no encontrado en la base de datos`, ...l]);
        } else if (errMsg.includes("LLAMAPARSE_API_KEY") || errMsg.includes("LlamaParse")) {
          toast.error("❌ Error: LlamaParse API key no configurado. Contacta al administrador.", {
            duration: 6000,
          });
          setLog((l) => [`❌ ERROR: LlamaParse API key no está configurado en Supabase Secrets`, ...l]);
        } else if (errMsg.includes("OPENAI_API_KEY") || errMsg.includes("OpenAI")) {
          toast.error("❌ Error: OpenAI API key no configurado. Contacta al administrador.", {
            duration: 6000,
          });
          setLog((l) => [`❌ ERROR: OpenAI API key no está configurado en Supabase Secrets`, ...l]);
        } else if (errMsg.includes("Failed to process")) {
          toast.error(`❌ Error al procesar documento: ${errMsg}`, {
            duration: 6000,
          });
          setLog((l) => [`❌ ERROR procesando documento: ${errMsg}`, ...l]);
        } else {
          setLog(l => [`❌ Error con ${f.name}: ${errMsg}`, ...l]);
          toast.error(`Error al subir ${f.name}: ${errMsg}`);
        }
      } finally {
        done++; 
        setProgress(Math.round((done/total)*100));
      }
    }
    
    setBusy(false);
    
    toast.success(`✅ ${done} archivo(s) procesados con LlamaParse + OpenAI GPT-4o`, {
      duration: 5000
    });
  }

  // Prevent upload if no contract selected (except for contract type documents)
  const canUpload = (
    (docType === 'contract' || contractId) && 
    files.length > 0 && 
    !busy &&
    (docType !== 'memorandum' || selectedEdpNumber !== null)
  );
  
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {!preselectedContractId && docType !== 'contract' && (
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
      
      {!preselectedContractId && docType === 'contract' && (
        <div className="mb-3 p-2 bg-primary/10 border border-primary/30 rounded text-sm">
          ℹ️ No es necesario seleccionar un contrato. El sistema lo creará automáticamente al procesar el documento.
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

      {/* Selector de EDP - Solo para memorandums */}
      {docType === 'memorandum' && contractId && (
        <div className="mb-3 flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">EDP Asociado *</label>
          <select 
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
            value={selectedEdpNumber || ''} 
            onChange={e => setSelectedEdpNumber(e.target.value ? parseInt(e.target.value, 10) : null)}
            required
          >
            <option value="">⚠️ Seleccionar EDP (requerido)</option>
            {availableEdps && availableEdps.length > 0 ? (
              availableEdps.map(edp => (
                <option key={edp.edp_number} value={edp.edp_number}>
                  EDP #{edp.edp_number} - {edp.period_label} ({edp.status}) - {edp.amount_uf} UF
                </option>
              ))
            ) : (
              <option value="" disabled>
                No hay EDPs disponibles para este contrato
              </option>
            )}
          </select>
        </div>
      )}

      {/* Advertencia si no hay EDPs disponibles */}
      {docType === 'memorandum' && contractId && availableEdps && availableEdps.length === 0 && (
        <div className="mb-3 p-2 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
          ⚠️ No hay EDPs registrados para este contrato. Primero debes procesar al menos un EDP.
        </div>
      )}

      {/* Mostrar EDP seleccionado */}
      {docType === 'memorandum' && selectedEdpNumber && (
        <div className="mb-3 p-2 bg-primary/10 border border-primary/30 rounded text-sm">
          <strong>✓ EDP seleccionado:</strong> #{selectedEdpNumber}
          {availableEdps?.find(e => e.edp_number === selectedEdpNumber)?.period_label && 
            ` - ${availableEdps.find(e => e.edp_number === selectedEdpNumber)?.period_label}`
          }
        </div>
      )}

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
            title={
              docType !== 'contract' && !contractId 
                ? 'Debes seleccionar un contrato primero' 
                : docType === 'memorandum' && !selectedEdpNumber
                  ? 'Debes seleccionar un EDP para el memorándum'
                  : ''
            }
          >
            {busy 
              ? 'Subiendo y procesando…' 
              : docType !== 'contract' && !contractId 
                ? '⚠️ Selecciona un contrato' 
                : docType === 'memorandum' && !selectedEdpNumber
                  ? '⚠️ Selecciona un EDP'
                  : `✓ Subir ${files.length} archivo(s) y procesar con IA`}
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
