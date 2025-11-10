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
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface ContractObligationsTableProps {
  contractCode: string;
}

export function ContractObligationsTable({ contractCode }: ContractObligationsTableProps) {
  const { data: obligations, isLoading } = useQuery({
    queryKey: ['contract-obligations', contractCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_obligations')
        .select('*')
        .eq('contract_code', contractCode)
        .order('next_due_date', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!contractCode
  });

  const getStatusIcon = (status: string, dueDate: string | null) => {
    if (status === 'approved') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === 'overdue') return <AlertCircle className="w-4 h-4 text-destructive" />;
    
    // Check if overdue
    if (dueDate && new Date(dueDate) < new Date()) {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
    
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusBadge = (status: string, dueDate: string | null) => {
    // Override status if overdue
    if (dueDate && new Date(dueDate) < new Date() && status === 'pending') {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    
    const variants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
      pending: "default",
      submitted: "outline",
      approved: "secondary",
      overdue: "destructive",
      waived: "outline"
    };
    
    const labels: Record<string, string> = {
      pending: "Pendiente",
      submitted: "Enviado",
      approved: "Aprobado",
      overdue: "Vencido",
      waived: "Renunciado"
    };
    
    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return <Card><CardContent className="p-6">Cargando obligaciones...</CardContent></Card>;
  }

  if (!obligations || obligations.length === 0) {
    return null; // Don't show if no obligations
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tablero de Cumplimiento</CardTitle>
        <CardDescription>
          {obligations.length} obligación(es) contractual(es)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Obligación</TableHead>
              <TableHead className="w-32">Tipo</TableHead>
              <TableHead className="w-32">Periodicidad</TableHead>
              <TableHead className="w-32">Próximo Vencimiento</TableHead>
              <TableHead className="w-32">Última Entrega</TableHead>
              <TableHead className="w-24">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {obligations.map((obligation) => (
              <TableRow key={obligation.id}>
                <TableCell>
                  {getStatusIcon(obligation.status, obligation.next_due_date)}
                </TableCell>
                <TableCell className="font-medium">{obligation.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {obligation.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {obligation.periodicity || 'N/A'}
                  </span>
                </TableCell>
                <TableCell>
                  {obligation.next_due_date ? (
                    <span className="text-sm">
                      {new Date(obligation.next_due_date).toLocaleDateString('es-CL')}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  )}
                </TableCell>
                <TableCell>
                  {obligation.last_submission ? (
                    <span className="text-sm text-muted-foreground">
                      {new Date(obligation.last_submission).toLocaleDateString('es-CL')}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {getStatusBadge(obligation.status, obligation.next_due_date)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
