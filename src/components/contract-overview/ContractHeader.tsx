import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ContractHeaderProps {
  data: any;
  contractCode: string;
  updatedAt: string;
}

export const ContractHeader = ({ data, contractCode, updatedAt }: ContractHeaderProps) => {
  const title = data?.nombre_contrato || data?.titulo || "Sin título";
  const client = data?.mandante || data?.cliente || "No especificado";
  const status = data?.estado || "En ejecución";

  return (
    <div className="border-l-4 border-primary pl-6 py-4 bg-card rounded-r-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {contractCode}
          </h1>
          <p className="text-xl text-muted-foreground mb-3">
            {title}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-sm">
              {client}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              {status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Actualizado {formatDistanceToNow(new Date(updatedAt), { 
                addSuffix: true, 
                locale: es 
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
