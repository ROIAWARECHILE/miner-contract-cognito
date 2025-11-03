import { useState } from "react";
import { Upload, X, FileText, Loader2, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useContracts } from "@/hooks/useContract";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [activeTab, setActiveTab] = useState<"select" | "create">("select");
  
  // Form for new contract
  const [newContract, setNewContract] = useState({
    code: "",
    title: "",
    type: "services",
  });

  const { toast } = useToast();
  const { data: contracts, refetch: refetchContracts } = useContracts();

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

  const createQuickContract = async () => {
    if (!newContract.code || !newContract.title || !newContract.type) {
      toast({
        title: "Datos incompletos",
        description: "Completa el código, título y tipo del contrato",
        variant: "destructive"
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('contracts')
        .insert({
          code: newContract.code,
          title: newContract.title,
          type: newContract.type as any,
          status: 'draft' as any,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Contrato creado",
        description: "El contrato ha sido creado exitosamente",
      });

      await refetchContracts();
      return data.id;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el contrato",
        variant: "destructive"
      });
      return null;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Archivo requerido",
        description: "Selecciona un archivo para cargar",
        variant: "destructive"
      });
      return;
    }

    let contractId = selectedContract;

    // If creating new contract, create it first
    if (activeTab === "create") {
      const newId = await createQuickContract();
      if (!newId) return;
      contractId = newId;
      setSelectedContract(newId);
    }

    if (!contractId) {
      toast({
        title: "Contrato requerido",
        description: "Selecciona o crea un contrato",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const fileName = `${contractId}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('contract-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      setUploading(false);
      setAnalyzing(true);

      const { data, error: functionError } = await supabase.functions.invoke('analyze-document', {
        body: {
          contractId,
          fileName: selectedFile.name,
          filePath: fileName
        }
      });

      if (functionError) throw functionError;

      toast({
        title: "Documento procesado",
        description: "El documento ha sido cargado y analizado exitosamente",
      });

      setSelectedFile(null);
      setSelectedContract(preSelectedContractId || "");
      setNewContract({ code: "", title: "", type: "services" });
      setActiveTab("select");
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cargar Documento</DialogTitle>
          <DialogDescription>
            Selecciona o crea un contrato y sube un documento para analizar con IA
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contract selection/creation */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Contrato
            </label>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "select" | "create")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="select">Seleccionar</TabsTrigger>
                <TabsTrigger value="create">Crear Nuevo</TabsTrigger>
              </TabsList>
              
              <TabsContent value="select" className="mt-3">
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
              </TabsContent>

              <TabsContent value="create" className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="new-code">Código *</Label>
                  <Input
                    id="new-code"
                    placeholder="Ej: CONT-2025-001"
                    value={newContract.code}
                    onChange={(e) => setNewContract({ ...newContract, code: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="new-title">Título *</Label>
                  <Input
                    id="new-title"
                    placeholder="Ej: Contrato de Servicios"
                    value={newContract.title}
                    onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="new-type">Tipo *</Label>
                  <Select 
                    value={newContract.type} 
                    onValueChange={(value) => setNewContract({ ...newContract, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concession">Concesión</SelectItem>
                      <SelectItem value="services">Servicios</SelectItem>
                      <SelectItem value="logistics">Logística</SelectItem>
                      <SelectItem value="supply">Suministro</SelectItem>
                      <SelectItem value="lease">Arriendo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
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
                  {activeTab === "create" ? "Crear y Cargar" : "Cargar y Analizar"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
