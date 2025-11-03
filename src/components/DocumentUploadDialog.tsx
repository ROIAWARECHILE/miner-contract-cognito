import { useState } from "react";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useContracts } from "@/hooks/useContract";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string;
}

export const DocumentUploadDialog = ({
  open,
  onOpenChange,
  contractId: initialContractId,
}: DocumentUploadDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string>(initialContractId || "");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "analyzing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const { toast } = useToast();
  const { data: contracts } = useContracts();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "Archivo muy grande",
          description: "El archivo no debe superar los 20MB",
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      const validTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Tipo de archivo no válido",
          description: "Solo se permiten archivos PDF y Word",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setUploadStatus("idle");
      setErrorMessage("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedContractId) {
      toast({
        title: "Datos incompletos",
        description: "Selecciona un contrato y un archivo",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadStatus("uploading");
    setErrorMessage("");

    try {
      // Upload file to storage
      const timestamp = Date.now();
      const fileName = `${selectedContractId}/${timestamp}-${selectedFile.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("contract-documents")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Error al subir archivo: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("contract-documents")
        .getPublicUrl(fileName);

      // Analyze document with AI
      setUploadStatus("analyzing");
      
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        "analyze-document",
        {
          body: {
            contractId: selectedContractId,
            fileName: selectedFile.name,
            fileUrl: fileName,
          },
        }
      );

      if (analysisError) {
        throw new Error(`Error al analizar documento: ${analysisError.message}`);
      }

      setUploadStatus("success");
      
      toast({
        title: "✅ Documento cargado exitosamente",
        description: `${selectedFile.name} fue analizado y procesado`,
      });

      // Reset form
      setTimeout(() => {
        setSelectedFile(null);
        setUploadStatus("idle");
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Error desconocido");
      
      toast({
        title: "Error al cargar documento",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (file) {
      const input = document.getElementById("file-input") as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      handleFileSelect({ target: input } as any);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cargar Documento</DialogTitle>
          <DialogDescription>
            Sube un documento PDF o Word para análisis automático con IA
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Contract Selector */}
          <div className="space-y-2">
            <Label htmlFor="contract">Contrato</Label>
            <Select
              value={selectedContractId}
              onValueChange={setSelectedContractId}
              disabled={!!initialContractId || uploading}
            >
              <SelectTrigger id="contract">
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

          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>Archivo</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                selectedFile
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
              
              {!selectedFile ? (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Arrastra un archivo o haz clic para seleccionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF o Word • Máximo 20MB
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("file-input")?.click()}
                    disabled={uploading}
                  >
                    Seleccionar Archivo
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <FileText className="w-12 h-12 mx-auto text-primary" />
                  <div>
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {uploadStatus === "idle" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadStatus("idle");
                      }}
                      disabled={uploading}
                    >
                      Cambiar archivo
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Upload Status */}
          {uploadStatus !== "idle" && (
            <div className="space-y-2">
              {uploadStatus === "uploading" && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Subiendo archivo...</span>
                </div>
              )}
              {uploadStatus === "analyzing" && (
                <div className="flex items-center gap-3 text-sm text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analizando documento con IA...</span>
                </div>
              )}
              {uploadStatus === "success" && (
                <div className="flex items-center gap-3 text-sm text-success">
                  <CheckCircle className="w-4 h-4" />
                  <span>¡Documento procesado exitosamente!</span>
                </div>
              )}
              {uploadStatus === "error" && (
                <div className="flex items-start gap-3 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !selectedContractId || uploading}
          >
            {uploading ? (
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
      </DialogContent>
    </Dialog>
  );
};
