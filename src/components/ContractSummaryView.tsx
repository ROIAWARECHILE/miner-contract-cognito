import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

export function ContractSummaryView({ contractId }: { contractId: string }) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['contract-summary', contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_summaries')
        .select('*')
        .eq('contract_id', contractId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8">Cargando resumen del contrato...</div>;
  }
  
  if (!summary) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No hay resumen disponible. Sube el documento del contrato para procesarlo con IA.
      </div>
    );
  }

  const extracted = summary.extracted_json as any;
  
  // Review status badge
  const statusConfig = {
    pending: { label: 'Pendiente Revisión', icon: Clock, variant: 'secondary' as const },
    flagged: { label: 'Requiere Atención', icon: AlertCircle, variant: 'destructive' as const },
    reviewed: { label: 'Revisado', icon: CheckCircle, variant: 'default' as const },
    approved: { label: 'Aprobado', icon: CheckCircle, variant: 'default' as const }
  };
  
  const status = statusConfig[summary.review_status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Header with review status */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Resumen del Contrato</h2>
        <Badge variant={status.variant} className="flex items-center gap-1">
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
      </div>
      
      {/* Grid de cards */}
      <div className="grid gap-4 md:grid-cols-2">
        
        {/* Card: Identificación */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Identificación</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">Número de Contrato:</dt>
                <dd className="font-mono">{extracted.identificacion?.numero_contrato || 'N/A'}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Fecha de Firma:</dt>
                <dd>{extracted.identificacion?.fecha_firma || 'N/A'}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Vigencia:</dt>
                <dd>
                  {extracted.identificacion?.vigencia_inicio || 'N/A'} hasta {extracted.identificacion?.vigencia_termino || 'Sin fecha'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Plazo de Ejecución:</dt>
                <dd>{extracted.identificacion?.plazo_ejecucion_dias || 'N/A'} días</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Card: Partes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Partes del Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Mandante</h4>
                <p className="text-sm">{extracted.partes?.mandante?.nombre || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">RUT: {extracted.partes?.mandante?.rut || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">Rep.: {extracted.partes?.mandante?.representante || 'N/A'}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Contratista</h4>
                <p className="text-sm">{extracted.partes?.contratista?.nombre || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">RUT: {extracted.partes?.contratista?.rut || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">Rep.: {extracted.partes?.contratista?.representante || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card: Precio y Pago */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Precio y Condiciones de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">Monto Máximo:</dt>
                <dd className="text-2xl font-bold text-primary">
                  {extracted.precio_y_pago?.monto_maximo_uf?.toLocaleString() || '0'} UF
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Modalidad:</dt>
                <dd>{extracted.precio_y_pago?.modalidad || 'N/A'}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Reajustable:</dt>
                <dd>{extracted.precio_y_pago?.reajustable ? 'Sí' : 'No'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Card: Administración */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Administración del Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-sm mb-1">Administrador Mandante</h4>
                <p className="text-sm">{extracted.administracion?.administrador_mandante?.nombre || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">{extracted.administracion?.administrador_mandante?.correo || 'N/A'}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Administrador Contratista</h4>
                <p className="text-sm">{extracted.administracion?.administrador_contratista?.nombre || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">{extracted.administracion?.administrador_contratista?.correo || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Card ancho completo: Actividades y Entregables */}
      {extracted.actividades_y_entregables && extracted.actividades_y_entregables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Actividades y Entregables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Item</th>
                    <th className="text-left p-2">Descripción</th>
                    <th className="text-left p-2">Unidad</th>
                    <th className="text-right p-2">Precio UF</th>
                  </tr>
                </thead>
                <tbody>
                  {extracted.actividades_y_entregables.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono">{item.item}</td>
                      <td className="p-2">{item.descripcion}</td>
                      <td className="p-2 text-muted-foreground">{item.unidad || '-'}</td>
                      <td className="p-2 text-right font-medium">
                        {item.precio_uf ? `${item.precio_uf.toLocaleString()} UF` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Metadata de procesamiento */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Método de Extracción:</span>
              <p className="font-medium">{summary.extraction_method}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Confianza:</span>
              <p className="font-medium">{((summary.confidence_score || 0) * 100).toFixed(0)}%</p>
            </div>
            <div>
              <span className="text-muted-foreground">Versión:</span>
              <p className="font-medium">v{summary.version}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
