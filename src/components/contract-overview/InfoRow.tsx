import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface InfoRowProps {
  label: string;
  value: any;
  provenance?: any;
  category?: string;
  field?: string;
}

export const InfoRow = ({ label, value, provenance, category, field }: InfoRowProps) => {
  if (!value) return null;

  // Buscar provenance para este campo
  const fieldProvenance = provenance?.type === 'detailed' && category && field
    ? provenance.items?.filter((p: any) => p.card === category && p.field === field)
    : null;

  const content = (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );

  // Si hay provenance, envolver en tooltip
  if (fieldProvenance && fieldProvenance.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              {content}
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-md">
            <div className="space-y-2">
              {fieldProvenance.map((p: any, i: number) => (
                <div key={i} className="text-xs">
                  <p className="font-semibold">Página {p.page}</p>
                  <p className="italic text-muted-foreground">"{p.excerpt}"</p>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
};
