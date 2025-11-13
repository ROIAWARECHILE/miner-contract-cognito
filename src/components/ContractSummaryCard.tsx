import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Users, Calendar, Shield, TrendingUp, Briefcase, AlertTriangle, BookOpen } from "lucide-react";

interface SummaryCardProps {
  category: string;
  title: string;
  badges?: string[];
  fields: Record<string, any>;
  provenance?: {
    type: 'legacy' | 'detailed';
    contract_file?: string | null;
    annexes?: string[];
    items?: Array<{
      card: string;
      field: string;
      page: number;
      excerpt: string;
    }>;
  };
  meta?: {
    confidence?: number;
    missing?: string[];
    notes?: string[];
  };
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

// Formatear valores específicos según su tipo
const formatFieldValue = (key: string, value: any): string => {
  if (typeof value === 'boolean') {
    return value ? '✓ Sí' : '✗ No';
  }
  if (key === 'criticidad') {
    const colors: Record<string, string> = {
      alta: '🔴 Alta',
      media: '🟡 Media',
      baja: '🟢 Baja'
    };
    return colors[String(value).toLowerCase()] || String(value);
  }
  return String(value);
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
    
    // Array de objetos (detectar estructura dinámica)
    if (typeof value[0] === 'object' && value[0] !== null) {
      return (
        <ul className="space-y-2 mt-1">
          {value.map((item, idx) => {
            // Filtrar campos null/undefined
            const validFields = Object.entries(item).filter(([_, v]) => 
              v !== null && v !== undefined && v !== ''
            );
            
            if (validFields.length === 0) {
              return null;
            }

            // Identificar campo principal (el primero no-null que sea un título/nombre)
            const primaryField = validFields.find(([k, _]) => 
              ['name', 'nombre', 'role', 'riesgo', 'tema', 'escenario', 'tipo', 'cargo'].includes(k)
            );
            
            const [primaryKey, primaryValue] = primaryField || validFields[0];
            const otherFields = validFields.filter(([k, _]) => k !== primaryKey);

            return (
              <li key={idx} className="text-sm border-l-2 border-border pl-3 pb-1">
                {/* Campo principal en negrita */}
                <div className="font-medium text-foreground">
                  {String(primaryValue)}
                </div>
                
                {/* Otros campos como metadata */}
                {otherFields.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {otherFields.map(([k, v]) => (
                      <div key={k} className="text-xs text-muted-foreground flex gap-2">
                        <span className="font-medium capitalize">{formatFieldLabel(k)}:</span>
                        <span>{formatFieldValue(k, v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          }).filter(Boolean)}
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

export const ContractSummaryCard = ({ category, title, badges, fields, provenance, meta }: SummaryCardProps) => {
  const hasData = Object.keys(fields).length > 0;
  
  // Calculate completeness percentage
  const filledFields = Object.values(fields).filter(v => 
    v !== null && v !== undefined && v !== '' && 
    !(Array.isArray(v) && v.length === 0)
  ).length;
  const totalFields = Object.keys(fields).length;
  const completeness = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  
  // Low confidence warning
  const isLowConfidence = meta?.confidence !== undefined && meta.confidence < 0.6;

  return (
    <TooltipProvider>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className={`p-2 rounded-lg ${getCategoryColor(category)}`}>
                {getCategoryIcon(category)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{title}</CardTitle>
                  {isLowConfidence && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">⚠️ Información parcial - revisar manualmente</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Confianza: {Math.round((meta.confidence || 0) * 100)}%
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {category}
                  </Badge>
                  {badges && badges.length > 0 && badges.map((badge, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                  {completeness > 0 && (
                    <Badge 
                      variant={completeness >= 75 ? "default" : completeness >= 50 ? "secondary" : "outline"} 
                      className="text-xs"
                    >
                      {completeness}% completo
                    </Badge>
                  )}
                  {provenance && provenance.type === 'detailed' && provenance.items && provenance.items.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs cursor-help">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {provenance.items.filter((p: any) => p.card === title).length} fuentes
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">
                        <div className="text-xs space-y-2">
                          <p className="font-semibold">Fuentes de información:</p>
                          {provenance.items
                            .filter((p: any) => p.card === title)
                            .slice(0, 5)
                            .map((p: any, i: number) => (
                              <div key={i} className="border-l-2 border-border pl-2">
                                <p className="font-medium">{p.field}</p>
                                <p className="text-muted-foreground">Página {p.page}</p>
                                <p className="text-muted-foreground italic mt-1">"{p.excerpt.substring(0, 100)}..."</p>
                              </div>
                            ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
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
    </TooltipProvider>
  );
};
