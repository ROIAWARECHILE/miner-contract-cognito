import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanies, useAssets } from "@/hooks/useContract";

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContractFormDialog = ({ open, onOpenChange }: ContractFormDialogProps) => {
  const { toast } = useToast();
  const { data: companies } = useCompanies();
  const { data: assets } = useAssets();
  
  const [formData, setFormData] = useState({
    code: "",
    title: "",
    type: "",
    status: "draft",
    company_id: "",
    asset_id: "",
    start_date: "",
    end_date: "",
    contract_value: "",
    currency: "USD",
    country: "",
    mineral: "",
    summary_ai: ""
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('contracts')
        .insert({
          code: formData.code,
          title: formData.title,
          type: formData.type as any,
          status: formData.status as any,
          company_id: formData.company_id || null,
          asset_id: formData.asset_id || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
          currency: formData.currency || 'USD',
          country: formData.country || null,
          mineral: formData.mineral || null,
          summary_ai: formData.summary_ai || null,
        });

      if (error) throw error;

      toast({
        title: "Contrato creado",
        description: "El contrato ha sido creado exitosamente",
      });

      // Reset form
      setFormData({
        code: "",
        title: "",
        type: "",
        status: "draft",
        company_id: "",
        asset_id: "",
        start_date: "",
        end_date: "",
        contract_value: "",
        currency: "USD",
        country: "",
        mineral: "",
        summary_ai: ""
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating contract:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el contrato",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Contrato</DialogTitle>
          <DialogDescription>
            Crea un nuevo contrato en el sistema
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="type">Tipo *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concession">Concesión</SelectItem>
                  <SelectItem value="service">Servicio</SelectItem>
                  <SelectItem value="logistics">Logística</SelectItem>
                  <SelectItem value="supply">Suministro</SelectItem>
                  <SelectItem value="offtake">Offtake</SelectItem>
                  <SelectItem value="joint_venture">Joint Venture</SelectItem>
                  <SelectItem value="royalty">Regalías</SelectItem>
                  <SelectItem value="community">Comunitario</SelectItem>
                  <SelectItem value="environmental">Ambiental</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company">Empresa</Label>
              <Select value={formData.company_id} onValueChange={(value) => setFormData({ ...formData, company_id: value })}>
                <SelectTrigger>
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

            <div>
              <Label htmlFor="asset">Activo</Label>
              <Select value={formData.asset_id} onValueChange={(value) => setFormData({ ...formData, asset_id: value })}>
                <SelectTrigger>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Fecha Inicio</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="end_date">Fecha Fin</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contract_value">Valor del Contrato</Label>
              <Input
                id="contract_value"
                type="number"
                step="0.01"
                value={formData.contract_value}
                onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="currency">Moneda</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CLP">CLP</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="UF">UF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="country">País</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="mineral">Mineral</Label>
              <Input
                id="mineral"
                value={formData.mineral}
                onChange={(e) => setFormData({ ...formData, mineral: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="summary">Resumen</Label>
            <Textarea
              id="summary"
              value={formData.summary_ai}
              onChange={(e) => setFormData({ ...formData, summary_ai: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : (
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
