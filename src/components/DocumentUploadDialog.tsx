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
}

export const DocumentUploadDialog = ({ 
  open, 
  onOpenChange
}: DocumentUploadDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

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

      // Analyze document and create contract automatically
      const { data, error: functionError } = await supabase.functions.invoke('analyze-document', {
        body: {
          fileName: selectedFile.name,
          filePath: tempFileName
        }
      });

      if (functionError) throw functionError;

      await refetchContracts();

      toast({
        title: "✅ Contrato creado exitosamente",
        description: `Código: ${data.contract_code} - ${data.contract_title}`,
      });

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
          <DialogTitle>Cargar Contrato</DialogTitle>
          <DialogDescription>
            Sube el PDF del contrato y la IA extraerá automáticamente toda la información
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  🤖 La IA analizará el documento y extraerá automáticamente:
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>Código y título del contrato</li>
                  <li>Tipo, empresa, activo y ubicación</li>
                  <li>Fechas de inicio y fin</li>
                  <li>Valor del contrato y moneda</li>
                  <li>Obligaciones y alertas</li>
                </ul>
              </div>
            )}
          </div>

          {/* Status message */}
          {(uploading || analyzing) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>
                {uploading && "Subiendo documento..."}
                {analyzing && "Analizando contrato con IA... Esto puede tardar hasta 30 segundos."}
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
                  Analizar y Crear Contrato
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
