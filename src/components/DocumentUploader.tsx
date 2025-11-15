import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useContracts } from '@/hooks/useContract';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type DocType = 'edp' | 'memorandum';

const LABEL: Record<DocType,string> = {
  edp: 'Estado de Pago (EDP)',
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
  const queryClient = useQueryClient();

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

  // Verificar jobs atascados al montar el componente
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
    // EDPs and memorandums always require a contract
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
    
    // Get contract code
    const contract = contracts?.find(c => c.id === contractId);
    const contract_code = contract?.code || '';
    
    if (!contract_code) {
      toast.error('Error: Contrato no encontrado');
      return;
    }
    
    setLog(l => [`✓ Iniciando subida con contrato: ${contract_code}`, ...l]);
    setBusy(true);
    setProgress(0); 
    setLog([]);
    
    const total = files.length; 
    let done = 0;

    for (const f of files) {
      try {
        const safeName = sanitize(f.name);
        
        // Construct storage path
        const folderMap: Record<DocType, string> = {
          edp: 'edp',
          memorandum: 'memo'
        };

        const folder = folderMap[docType] || docType;
        const path = `${projectPrefix}/${contract_code}/${folder}/${safeName}`;

        // Upload to storage
        const { error: upErr } = await supabase.storage
          .from('contracts')
          .upload(path, f, { 
            upsert: true,
            contentType: 'application/pdf'
          });
        
        if (upErr) {
          setLog(l => [`❌ Fallo subida de ${safeName}: ${upErr.message}`, ...l]);
          toast.error(`Error al subir ${safeName}: ${upErr.message}`);
          done++;
          setProgress(Math.round((done/total)*100));
          continue;
        }

        setLog(l => [`✓ ${safeName} subido a storage. Procesando con IA...`, ...l]);
        
        // Call process-document edge function
        const processPayload: any = {
          storage_path: path,
          document_type: docType,
          contract_id: contractId,
          project_prefix: projectPrefix
        };

        // Add EDP number for memorandums
        if (docType === 'memorandum' && selectedEdpNumber) {
          processPayload.edp_number = selectedEdpNumber;
        }

        const { data: processData, error: processErr } = await supabase.functions.invoke(
          'process-document',
          { body: processPayload }
        );
        
        if (processErr) {
          setLog(l => [`❌ Error al procesar ${safeName}: ${processErr.message}`, ...l]);
          toast.error(`Error al procesar ${safeName}: ${processErr.message}`);
        } else if (processData?.ok) {
          setLog(l => [`✅ ${safeName} procesado exitosamente`, ...l]);
          toast.success(`✅ ${safeName} procesado correctamente`);
          
          // Invalidar queries relevantes
          if (contractId) {
            const code = contracts?.find(c => c.id === contractId)?.code;
            if (code) {
              queryClient.invalidateQueries({ queryKey: ['contract-analytics', code] });
              queryClient.invalidateQueries({ queryKey: ['contract-tasks', code] });
              queryClient.invalidateQueries({ queryKey: ['payment-states', code] });
              queryClient.invalidateQueries({ queryKey: ['contract-documents', contractId] });
              queryClient.invalidateQueries({ queryKey: ['contract-scurve', code] });
              setLog(l => [`🔄 Datos del contrato actualizados`, ...l]);
            }
          }
        } else {
          setLog(l => [`⚠️ Respuesta inesperada al procesar ${safeName}`, ...l]);
          toast.error(processData?.error || 'Error desconocido al procesar');
        }
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        console.error("[DocumentUploader] Processing error:", e);
        
        // Mensajes específicos según el error
        if (errMsg.includes("Contract not found") || errMsg.includes("No contract found")) {
          const contractCode = contracts?.find((c) => c.id === contractId)?.code || "unknown";
          toast.error(`❌ Error: El contrato "${contractCode}" no existe en el sistema`, {
            duration: 6000,
          });
          setLog((l) => [`❌ ERROR: Contrato "${contractCode}" no encontrado en la base de datos`, ...l]);
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
    
    toast.success(`✅ ${done} archivo(s) procesados con OpenAI GPT-4o`, {
      duration: 5000
    });
  }

  // Always require contract for EDPs and memorandums
  const canUpload = (
    contractId && 
    files.length > 0 && 
    !busy &&
    (docType === 'edp' || (docType === 'memorandum' && selectedEdpNumber !== null))
  );

  const instructionText = docType === 'memorandum' 
    ? 'Memorándums técnicos con curvas S y actividades realizadas'
    : 'Estados de pago mensuales (EDPs) con detalles de avance por tarea';

  return (
    <div className="p-4 border border-border rounded-lg bg-card/50 space-y-4">
      {/* Doc Type Selector */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Tipo de Documento
        </label>
        <div className="flex gap-2">
          <Button
            onClick={() => setDocType('edp')}
            variant={docType === 'edp' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
          >
            {LABEL.edp}
          </Button>
          <Button
            onClick={() => setDocType('memorandum')}
            variant={docType === 'memorandum' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
          >
            {LABEL.memorandum}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {instructionText}
      </p>

      {/* EDP Selector for Memorandums */}
      {docType === 'memorandum' && availableEdps && availableEdps.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Asociar a EDP
          </label>
          <select
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedEdpNumber || ''}
            onChange={(e) => setSelectedEdpNumber(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">Seleccionar EDP...</option>
            {availableEdps.map((edp) => (
              <option key={edp.edp_number} value={edp.edp_number}>
                EDP #{edp.edp_number} - {edp.period_label} ({edp.amount_uf} UF)
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecciona el EDP al que corresponde este memorándum técnico
          </p>
        </div>
      )}

      {/* File Picker */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Seleccionar Archivo(s) PDF
        </label>
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={onPick}
          disabled={busy}
          className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {files.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {files.length} archivo(s) seleccionado(s): {files.map(f => f.name).join(', ')}
          </p>
        )}
      </div>

      {/* Upload Button & Progress */}
      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="text-sm text-foreground font-medium">{files.length} archivo(s) seleccionado(s)</div>
          
          <Button 
            onClick={uploadAll} 
            disabled={!canUpload} 
            className="w-full"
            title={
              !contractId 
                ? 'Debes seleccionar un contrato primero' 
                : docType === 'memorandum' && !selectedEdpNumber
                  ? 'Debes seleccionar un EDP para el memorándum'
                  : ''
            }
          >
            {busy 
              ? 'Subiendo y procesando…' 
              : !contractId 
                ? '⚠️ Selecciona un contrato' 
                : docType === 'memorandum' && !selectedEdpNumber
                  ? '⚠️ Selecciona un EDP'
                  : `Subir y Procesar ${LABEL[docType]}`
            }
          </Button>

          {busy && <Progress value={progress} className="h-2" />}
        </div>
      )}

      {/* Processing Log */}
      {log.length > 0 && (
        <div className="mt-4 max-h-48 overflow-auto p-3 bg-muted/30 rounded-md text-xs font-mono space-y-1">
          {log.slice(0, 10).map((line, i) => (
            <div key={i} className={
              line.includes('✅') ? 'text-green-600' :
              line.includes('❌') ? 'text-red-600' :
              line.includes('⚠️') ? 'text-yellow-600' :
              'text-muted-foreground'
            }>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function sanitize(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}
