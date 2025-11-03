import { useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useContracts } from "@/hooks/useContract";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedContractId?: string;
}

export const DocumentUploadDialog = ({ 
  open, 
  onOpenChange,
  preSelectedContractId 
}: DocumentUploadDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedContract, setSelectedContract] = useState<string>(preSelectedContractId || "");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();
  const { data: contracts } = useContracts();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Tipo de archivo no válido",
          description: "Por favor selecciona un archivo PDF o Word",
          variant: "destructive"
        });
        return;
      }

      // Validate file size (20MB max)
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
    if (!selectedFile || !selectedContract) {
      toast({
        title: "Datos incompletos",
        description: "Selecciona un contrato y un archivo",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Upload to storage
      const fileName = `${selectedContract}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('contract-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      setUploading(false);
      setAnalyzing(true);

      // Analyze document
      const { data, error: functionError } = await supabase.functions.invoke('analyze-document', {
        body: {
          contractId: selectedContract,
          fileName: selectedFile.name,
          filePath: fileName
        }
      });

      if (functionError) throw functionError;

      toast({
        title: "Documento procesado",
        description: "El documento ha sido cargado y analizado exitosamente",
      });

      // Reset form
      setSelectedFile(null);
      setSelectedContract(preSelectedContractId || "");
      onOpenChange(false);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Error al procesar",
        description: error.message || "No se pudo procesar el documento",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar Documento</DialogTitle>
          <DialogDescription>
            Sube un documento para analizar con IA
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contract selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Contrato
            </label>
            <Select value={selectedContract} onValueChange={setSelectedContract}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un contrato" />
              </SelectTrigger>
              <SelectContent>
                {contracts?.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>
                    {contract.code} - {contract.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File input */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Archivo
            </label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx"
                className="hidden"
                id="file-upload"
                disabled={uploading || analyzing}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
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
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click para seleccionar o arrastra un archivo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF o Word (máx. 20MB)
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Status message */}
          {(uploading || analyzing) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {uploading && "Subiendo documento..."}
                {analyzing && "Analizando con IA..."}
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
              disabled={!selectedFile || !selectedContract || uploading || analyzing}
            >
              {uploading || analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Cargar y Analizar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
