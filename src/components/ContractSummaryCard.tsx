import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Users, Calendar, Shield, TrendingUp, Briefcase, AlertTriangle, BookOpen, Info } from "lucide-react";

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

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">Ninguno</span>;
    }
    
    if (typeof value[0] === 'object' && value[0] !== null) {
      return (
        <ul className="space-y-2 mt-1">
          {value.map((item, idx) => {
            const validFields = Object.entries(item).filter(([_, v]) => 
              v !== null && v !== undefined && v !== ''
            );
            
            if (validFields.length === 0) return null;

            const primaryField = validFields.find(([k, _]) => 
              ['name', 'nombre', 'role', 'riesgo', 'tema', 'escenario', 'tipo', 'cargo'].includes(k)
            );
            
            const [primaryKey, primaryValue] = primaryField || validFields[0];
            const otherFields = validFields.filter(([k, _]) => k !== primaryKey);

            return (
              <li key={idx} className="p-2 rounded-md bg-muted/30 border border-border/50">
                <div className="font-medium text-sm">{String(primaryValue)}</div>
                {otherFields.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {otherFields.map(([k, v]) => (
                      <div key={k}>
                        <span className="font-medium">{k}: </span>
                        {String(v)}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      );
    }
    
    return (
      <ul className="list-disc list-inside space-y-1">
        {value.map((item, idx) => (
          <li key={idx} className="text-sm">{String(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <div className="space-y-1 text-sm">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <span className="text-xs font-medium text-muted-foreground uppercase">{k}: </span>
            <span className="text-sm">{String(v)}</span>
          </div>
        ))}
      </div>
    );
  }

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
  
  const filledFields = Object.values(fields).filter(v => 
    v !== null && v !== undefined && v !== '' && 
    !(Array.isArray(v) && v.length === 0)
  ).length;
  const totalFields = Object.keys(fields).length;
  const completeness = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={completeness === 100 ? "default" : "secondary"} className="text-xs gap-1">
                          <Info className="h-3 w-3" />
                          {completeness}% completa
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{filledFields} de {totalFields} campos con información</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {provenance && provenance.type === 'detailed' && provenance.items && provenance.items.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs cursor-help gap-1">
                          <BookOpen className="h-3 w-3" />
                          {provenance.items.filter((p: any) => p.card === title).length} fuentes
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">
                        <div className="text-xs space-y-2">
                          <p className="font-semibold">Fuentes de información:</p>
                          {provenance.items
                            .filter((p: any) => p.card === title)
                            .slice(0, 5)
                            .map((p: any, idx: number) => (
                              <div key={idx} className="border-l-2 border-primary/30 pl-2">
                                <p className="text-muted-foreground">📄 Página {p.page}</p>
                                <p className="italic">"{p.excerpt}"</p>
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
          
          {completeness > 0 && completeness < 100 && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Completitud</span>
                <span>{filledFields}/{totalFields} campos</span>
              </div>
              <Progress value={completeness} className="h-2" />
            </div>
          )}
        </CardHeader>

        <CardContent>
          {hasData ? (
            <div className="space-y-3">
              {Object.entries(fields).map(([key, value]) => (
                <div key={key} className="grid grid-cols-3 gap-2">
                  <div className="font-medium text-sm text-muted-foreground col-span-1">
                    {formatFieldLabel(key)}
                  </div>
                  <div className="col-span-2">
                    {renderFieldValue(key, value)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay información disponible
            </p>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
