import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Shield, FileWarning } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ContractRisksTableProps {
  contractCode: string;
}

export function ContractRisksTable({ contractCode }: ContractRisksTableProps) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: risks, isLoading } = useQuery({
    queryKey: ['contract-risks', contractCode, severityFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('contract_risks')
        .select('*')
        .eq('contract_code', contractCode)
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (severityFilter !== "all") {
        query = query.eq('severity', severityFilter);
      }
      
      if (statusFilter !== "all") {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!contractCode
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'alta':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'media':
        return <FileWarning className="w-4 h-4 text-yellow-500" />;
      case 'baja':
        return <Shield className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "destructive" | "default" | "secondary"> = {
      alta: "destructive",
      media: "default",
      baja: "secondary"
    };
    return (
      <Badge variant={variants[severity] || "default"} className="gap-1">
        {getSeverityIcon(severity)}
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
      open: "destructive",
      mitigated: "default",
      closed: "secondary",
      waived: "outline"
    };
    const labels: Record<string, string> = {
      open: "Abierto",
      mitigated: "Mitigado",
      closed: "Cerrado",
      waived: "Renunciado"
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return <Card><CardContent className="p-6">Cargando riesgos...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Riesgos y Obligaciones</CardTitle>
            <CardDescription>
              {risks?.length || 0} hallazgo(s) identificado(s) con trazabilidad
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abiertos</SelectItem>
                <SelectItem value="mitigated">Mitigados</SelectItem>
                <SelectItem value="closed">Cerrados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!risks || risks.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay riesgos registrados</p>
            <p className="text-sm mt-1">Los riesgos se extraerán automáticamente del contrato</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-24">Severidad</TableHead>
                <TableHead className="w-24">Estado</TableHead>
                <TableHead className="w-32">Fecha Límite</TableHead>
                <TableHead className="w-24">Ref.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.map((risk) => (
                <TableRow key={risk.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {risk.risk_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{risk.title}</TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {risk.description}
                    </p>
                    {risk.obligation && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        Obligación
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{getSeverityBadge(risk.severity)}</TableCell>
                  <TableCell>{getStatusBadge(risk.status)}</TableCell>
                  <TableCell>
                    {risk.deadline ? (
                      <span className="text-sm">
                        {new Date(risk.deadline).toLocaleDateString('es-CL')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                    {risk.periodicity && (
                      <div className="text-xs text-muted-foreground">
                        {risk.periodicity}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {risk.clause_ref && (
                      <span className="text-xs text-muted-foreground">
                        {risk.clause_ref}
                      </span>
                    )}
                    {risk.page && (
                      <div className="text-xs text-muted-foreground">
                        Pág. {risk.page}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
