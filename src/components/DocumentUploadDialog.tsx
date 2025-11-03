import { useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useContracts } from "@/hooks/useContract";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string; // If provided, adds document to existing contract
}

export const DocumentUploadDialog = ({ 
  open, 
  onOpenChange,
  contractId
}: DocumentUploadDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [documentType, setDocumentType] = useState<string>('edp');

  const { toast } = useToast();
  const { refetch: refetchContracts } = useContracts();
  const { user } = useAuth();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Tipo de archivo no válido",
          description: "Por favor selecciona un archivo PDF o Word",
          variant: "destructive"
        });
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "Archivo muy grande",
          description: "El archivo no debe superar los 20MB",
          variant: "destructive"
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Archivo requerido",
        description: "Selecciona un archivo PDF del contrato para analizar",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para cargar documentos",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file to temporary location
      const tempFileName = `temp/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('contract-documents')
        .upload(tempFileName, selectedFile);

      if (uploadError) throw uploadError;

      setUploading(false);
      setAnalyzing(true);

      // If contractId exists, add document to existing contract
      if (contractId) {
        const { data, error: functionError } = await supabase.functions.invoke('analyze-additional-document', {
          body: {
            contractId,
            fileName: selectedFile.name,
            filePath: tempFileName,
            documentType
          }
        });

        if (functionError) throw functionError;

        toast({
          title: "✅ Documento agregado",
          description: data.message || `Documento "${selectedFile.name}" agregado al contrato.`,
        });
      } else {
        // Create new contract
        const { data, error: functionError } = await supabase.functions.invoke('analyze-document', {
          body: {
            fileName: selectedFile.name,
            filePath: tempFileName
          }
        });

        if (functionError) throw functionError;

        await refetchContracts();

        toast({
          title: "✅ Contrato creado",
          description: data.message || `${data.contract_code} - ${data.contract_title}. Edita el contrato para completar la información.`,
        });
      }

      setSelectedFile(null);
      onOpenChange(false);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Error al procesar",
        description: error.message || "No se pudo procesar el documento. Verifica que sea un contrato válido.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{contractId ? "Agregar Documento al Contrato" : "Cargar Contrato"}</DialogTitle>
          <DialogDescription>
            {contractId 
              ? "Sube un EDP, SDI u otro documento relacionado al contrato. El sistema extraerá información automáticamente."
              : "Sube el PDF del contrato para crear un borrador. Luego completa la información detallada manualmente."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document type selector (only for adding to existing contract) */}
          {contractId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Documento</label>
              <select 
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                disabled={uploading || analyzing}
              >
                <option value="edp">Estado de Pago (EDP)</option>
                <option value="sdi">Solicitud de Información (SDI)</option>
                <option value="plan">Plan Técnico</option>
                <option value="anexo">Anexo</option>
                <option value="certificado">Certificado</option>
                <option value="informe">Informe</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          )}

          {/* File input */}
          <div>
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf"
                className="hidden"
                id="file-upload"
                disabled={uploading || analyzing}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-6 h-6 text-primary" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedFile(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-base font-medium mb-1">
                      Click para seleccionar o arrastra el archivo
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PDF del contrato (máx. 20MB)
                    </p>
                  </>
                )}
              </label>
            </div>

            {selectedFile && !uploading && !analyzing && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                  ℹ️ Extracción básica de información
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {contractId 
                    ? "El sistema extraerá información básica del nombre del archivo. Deberás verificar y completar los datos manualmente."
                    : "El sistema creará un contrato en borrador basado en el nombre del archivo. Deberás completar manualmente la información detallada (fechas, valores, empresa, etc.) después de la carga."
                  }
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  <strong>Nota:</strong> La extracción completa automática de PDFs requiere OCR avanzado y será implementada en una futura versión.
                </p>
              </div>
            )}
          </div>

          {/* Status message */}
          {(uploading || analyzing) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>
                {uploading && "Subiendo documento..."}
                {analyzing && "Extrayendo información del archivo..."}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading || analyzing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading || analyzing}
            >
              {uploading || analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {contractId ? "Agregar Documento" : "Crear Contrato Borrador"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
