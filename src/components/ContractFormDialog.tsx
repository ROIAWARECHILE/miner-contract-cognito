import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies, useAssets } from "@/hooks/useContract";
import { Database } from "@/integrations/supabase/types";

type ContractType = Database["public"]["Enums"]["contract_type"];
type ContractStatus = Database["public"]["Enums"]["contract_status"];

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContractFormDialog = ({ open, onOpenChange }: ContractFormDialogProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: companies } = useCompanies();
  const { data: assets } = useAssets();

  const [formData, setFormData] = useState({
    code: "",
    title: "",
    type: "concession" as ContractType,
    status: "draft" as ContractStatus,
    company_id: "",
    asset_id: "",
    start_date: "",
    end_date: "",
    contract_value: "",
    currency: "USD",
    country: "Chile",
    mineral: "",
    summary_ai: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.title || !formData.type) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa código, título y tipo de contrato",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("contracts").insert({
        code: formData.code,
        title: formData.title,
        type: formData.type,
        status: formData.status,
        company_id: formData.company_id || null,
        asset_id: formData.asset_id || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
        currency: formData.currency,
        country: formData.country,
        mineral: formData.mineral || null,
        summary_ai: formData.summary_ai || null,
      });

      if (error) throw error;

      toast({
        title: "✅ Contrato creado",
        description: `${formData.code} - ${formData.title}`,
      });

      // Reset form
      setFormData({
        code: "",
        title: "",
        type: "concession",
        status: "draft",
        company_id: "",
        asset_id: "",
        start_date: "",
        end_date: "",
        contract_value: "",
        currency: "USD",
        country: "Chile",
        mineral: "",
        summary_ai: "",
      });

      // Refresh contracts list
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating contract:", error);
      toast({
        title: "Error al crear contrato",
        description: error instanceof Error ? error.message : "Intenta nuevamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Contrato</DialogTitle>
          <DialogDescription>
            Completa la información del contrato minero
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code and Title */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="CT-2024-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as ContractType })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offtake">Offtake</SelectItem>
                  <SelectItem value="joint_venture">Joint Venture</SelectItem>
                  <SelectItem value="concession">Concesión</SelectItem>
                  <SelectItem value="royalty">Royalty</SelectItem>
                  <SelectItem value="logistics">Logística</SelectItem>
                  <SelectItem value="community">Comunitario</SelectItem>
                  <SelectItem value="environmental">Ambiental</SelectItem>
                  <SelectItem value="nda">NDA</SelectItem>
                  <SelectItem value="servitude">Servidumbre</SelectItem>
                  <SelectItem value="supply">Suministro</SelectItem>
                  <SelectItem value="service">Servicio</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Contrato de Concesión Minera"
              required
            />
          </div>

          {/* Company and Asset */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Select
                value={formData.company_id}
                onValueChange={(value) => setFormData({ ...formData, company_id: value })}
              >
                <SelectTrigger id="company">
                  <SelectValue placeholder="Selecciona empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset">Activo</Label>
              <Select
                value={formData.asset_id}
                onValueChange={(value) => setFormData({ ...formData, asset_id: value })}
              >
                <SelectTrigger id="asset">
                  <SelectValue placeholder="Selecciona activo" />
                </SelectTrigger>
                <SelectContent>
                  {assets?.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Fecha Inicio</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Fecha Fin</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          {/* Contract Value and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contract_value">Valor del Contrato</Label>
              <Input
                id="contract_value"
                type="number"
                step="0.01"
                value={formData.contract_value}
                onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })}
                placeholder="1000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CLP">CLP</SelectItem>
                  <SelectItem value="UF">UF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Country and Mineral */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="Chile"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mineral">Mineral</Label>
              <Input
                id="mineral"
                value={formData.mineral}
                onChange={(e) => setFormData({ ...formData, mineral: e.target.value })}
                placeholder="Cobre"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as ContractStatus })}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="under_review">En Revisión</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="expired">Vencido</SelectItem>
                <SelectItem value="terminated">Terminado</SelectItem>
                <SelectItem value="suspended">Suspendido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label htmlFor="summary">Resumen</Label>
            <Textarea
              id="summary"
              value={formData.summary_ai}
              onChange={(e) => setFormData({ ...formData, summary_ai: e.target.value })}
              placeholder="Descripción breve del contrato..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Contrato
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
