import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, Calendar, Shield, TrendingUp, Briefcase } from "lucide-react";

interface SummaryCardProps {
  category: string;
  title: string;
  fields: Record<string, any>;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'general':
      return <FileText className="h-5 w-5" />;
    case 'legal y administrativa':
      return <Shield className="h-5 w-5" />;
    case 'alcance técnico':
      return <Briefcase className="h-5 w-5" />;
    case 'equipo y experiencia':
      return <Users className="h-5 w-5" />;
    case 'seguridad y calidad':
      return <Shield className="h-5 w-5" />;
    case 'programa y avance':
      return <TrendingUp className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category.toLowerCase()) {
    case 'general':
      return 'bg-primary/10 text-primary';
    case 'legal y administrativa':
      return 'bg-destructive/10 text-destructive';
    case 'alcance técnico':
      return 'bg-accent/10 text-accent-foreground';
    case 'equipo y experiencia':
      return 'bg-secondary/10 text-secondary-foreground';
    case 'seguridad y calidad':
      return 'bg-warning/10 text-warning-foreground';
    case 'programa y avance':
      return 'bg-success/10 text-success-foreground';
    default:
      return 'bg-muted/10 text-muted-foreground';
  }
};

const renderFieldValue = (key: string, value: any): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">No disponible</span>;
  }

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">Ninguno</span>;
    }
    
    // Array de objetos (equipo, tareas)
    if (typeof value[0] === 'object') {
      return (
        <ul className="space-y-1.5 mt-1">
          {value.map((item, idx) => (
            <li key={idx} className="text-sm flex items-start gap-2">
              <span className="text-muted-foreground mt-0.5">•</span>
              <span>
                {item.nombre && item.cargo ? (
                  <>
                    <span className="font-medium">{item.nombre}</span>
                    <span className="text-muted-foreground"> - {item.cargo}</span>
                  </>
                ) : (
                  JSON.stringify(item)
                )}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    
    // Array simple de strings
    return (
      <ul className="space-y-1 mt-1">
        {value.map((item, idx) => (
          <li key={idx} className="text-sm flex items-start gap-2">
            <span className="text-muted-foreground">•</span>
            <span>{String(item)}</span>
          </li>
        ))}
      </ul>
    );
  }

  // Objetos
  if (typeof value === 'object') {
    return (
      <div className="space-y-1.5 mt-1 pl-3 border-l-2 border-border">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <span className="text-xs font-medium text-muted-foreground uppercase">{k}: </span>
            <span className="text-sm">{String(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Valores primitivos
  return <span className="text-sm">{String(value)}</span>;
};

const formatFieldLabel = (key: string): string => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const ContractSummaryCard = ({ category, title, fields }: SummaryCardProps) => {
  const hasData = Object.keys(fields).length > 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getCategoryColor(category)}`}>
              {getCategoryIcon(category)}
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <Badge variant="outline" className="mt-1 text-xs">
                {category}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Sin información disponible</p>
            <p className="text-xs mt-1">Esta tarjeta se completará al subir documentos relacionados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(fields).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  {formatFieldLabel(key)}
                </dt>
                <dd className="text-sm">{renderFieldValue(key, value)}</dd>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
