import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Building2, FileText, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ContractSummaryCardProps {
  contractCode: string;
}

export function ContractSummaryCard({ contractCode }: ContractSummaryCardProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['contract-summary', contractCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_summaries')
        .select('*')
        .eq('contract_code', contractCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!contractCode
  });

  if (isLoading) {
    return <Card><CardContent className="p-6">Cargando ficha contractual...</CardContent></Card>;
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay ficha contractual disponible.</p>
          <p className="text-sm mt-1">Sube el documento del contrato para generar la ficha automáticamente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen Ejecutivo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Ejecutivo</CardTitle>
          <CardDescription>Versión {summary.version_tag || 'N/A'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{summary.summary_md}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Información Clave */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vigencia */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Vigencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.validity_start && summary.validity_end ? (
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Inicio:</span>{" "}
                  <span className="font-medium">{new Date(summary.validity_start).toLocaleDateString('es-CL')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Término:</span>{" "}
                  <span className="font-medium">{new Date(summary.validity_end).toLocaleDateString('es-CL')}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No especificada</p>
            )}
          </CardContent>
        </Card>

        {/* Presupuesto */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Presupuesto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.budget_total ? (
              <div className="space-y-1 text-sm">
                <div className="text-2xl font-bold">
                  {summary.budget_total.toLocaleString('es-CL')} {summary.currency || 'UF'}
                </div>
                {summary.reajustabilidad && (
                  <div className="text-muted-foreground">
                    Reajuste: {summary.reajustabilidad}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No especificado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Partes del Contrato */}
      {summary.parties && typeof summary.parties === 'object' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Partes del Contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(summary.parties as any).client && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cliente / Mandante</p>
                <p className="font-medium">{(summary.parties as any).client.name}</p>
                {(summary.parties as any).client.rut && (
                  <p className="text-sm text-muted-foreground">RUT: {(summary.parties as any).client.rut}</p>
                )}
              </div>
            )}
            {(summary.parties as any).contractor && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Contratista / Consultor</p>
                <p className="font-medium">{(summary.parties as any).contractor.name}</p>
                {(summary.parties as any).contractor.rut && (
                  <p className="text-sm text-muted-foreground">RUT: {(summary.parties as any).contractor.rut}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hitos Contractuales */}
      {Array.isArray(summary.milestones) && summary.milestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hitos Contractuales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.milestones.map((milestone: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{milestone.name}</p>
                    {milestone.due && (
                      <p className="text-xs text-muted-foreground">
                        Fecha: {new Date(milestone.due).toLocaleDateString('es-CL')}
                      </p>
                    )}
                    {milestone.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{milestone.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requisitos de Cumplimiento */}
      {Array.isArray(summary.compliance_requirements) && summary.compliance_requirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Requisitos de Cumplimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.compliance_requirements.map((req: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <Badge variant="outline" className="mt-0.5">
                    {req.type}
                  </Badge>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{req.name}</p>
                    {req.periodicity && (
                      <p className="text-xs text-muted-foreground">
                        Periodicidad: {req.periodicity}
                      </p>
                    )}
                    {req.deadline_rule && (
                      <p className="text-xs text-muted-foreground">
                        Plazo: {req.deadline_rule}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
