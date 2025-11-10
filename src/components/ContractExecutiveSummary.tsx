import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, DollarSign, FileText, Users, Scale } from "lucide-react";

export type ContractExecSummary = {
  contract_code: string;
  title?: string | null;
  dates: { 
    signed_at?: string | null; 
    valid_from?: string | null; 
    valid_to?: string | null; 
    grace_days?: number | null 
  };
  parties: { 
    client: { name?: string | null; rut?: string | null; rep?: string | null; email?: string | null };
    contractor: { name?: string | null; rut?: string | null; rep?: string | null; email?: string | null }
  };
  commercials: { 
    currency?: string | null; 
    budget_total?: number | null; 
    price_model?: string | null; 
    reajustabilidad?: string | null; 
    tax_notes?: string | null 
  };
  scope: { 
    objective?: string | null; 
    documents_order?: string[] 
  };
  value_items?: { 
    item: string; 
    unit?: string | null; 
    unit_price?: number | null; 
    notes?: string | null 
  }[];
  admins: { 
    client_admin?: { name?: string | null; email?: string | null };
    contractor_admin?: { name?: string | null; email?: string | null }
  };
  legal: { 
    termination?: string | null; 
    jurisdiction?: string | null; 
    laws?: string[]; 
    compliance?: string[] 
  };
};

interface Props {
  data: ContractExecSummary;
}

function Line({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export default function ContractExecutiveSummary({ data }: Props) {
  const fmtUF = (n?: number | null) => n == null ? "—" : `${n.toLocaleString("es-CL")} UF`;
  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-CL') : "—";

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Tarjeta 1: Vigencia */}
      <Card className="col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Vigencia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Line label="Código" value={data.contract_code} />
          <Line label="Inicio" value={fmtDate(data.dates?.valid_from)} />
          <Line label="Término" value={fmtDate(data.dates?.valid_to)} />
          <Line label="Días de gracia" value={data.dates?.grace_days ?? "—"} />
        </CardContent>
      </Card>

      {/* Tarjeta 2: Monto & Modelo */}
      <Card className="col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Monto & Modelo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Line label="Adjudicado" value={fmtUF(data.commercials?.budget_total)} />
          <Line label="Moneda" value={data.commercials?.currency || "—"} />
          <Line label="Modelo" value={data.commercials?.price_model || "—"} />
          <Line label="Reajustabilidad" value={data.commercials?.reajustabilidad || "—"} />
        </CardContent>
      </Card>

      {/* Tarjeta 3: Alcance (ocupa 2 filas en xl) */}
      <Card className="col-span-1 xl:row-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Alcance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm leading-relaxed">
            {data.scope?.objective || "No especificado"}
          </div>
          {data.value_items && data.value_items.length > 0 && (
            <div className="text-sm">
              <div className="font-medium mb-2 text-muted-foreground">Partidas referenciales</div>
              <ul className="space-y-1.5">
                {data.value_items.slice(0, 5).map((vi, i) => (
                  <li key={i} className="flex justify-between gap-2 border-b pb-1 last:border-0">
                    <span className="truncate">{vi.item}</span>
                    <span className="font-medium shrink-0">
                      {vi.unit_price != null ? `${vi.unit_price.toLocaleString()} ${data.commercials?.currency || 'UF'}` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tarjeta 4: Administradores */}
      <Card className="col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Administradores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Mandante</div>
            <div className="font-medium">{data.admins?.client_admin?.name || "—"}</div>
            {data.admins?.client_admin?.email && (
              <div className="text-xs truncate text-muted-foreground">
                {data.admins.client_admin.email}
              </div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Contratista</div>
            <div className="font-medium">{data.admins?.contractor_admin?.name || "—"}</div>
            {data.admins?.contractor_admin?.email && (
              <div className="text-xs truncate text-muted-foreground">
                {data.admins.contractor_admin.email}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta 5: Legal */}
      <Card className="col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            Legal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Line label="Jurisdicción" value={data.legal?.jurisdiction || "—"} />
          <Line label="Término anticipado" value={data.legal?.termination || "—"} />
          {data.legal?.compliance && data.legal.compliance.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-1">Exigencias:</div>
              <ul className="list-disc ml-4 space-y-0.5">
                {data.legal.compliance.slice(0, 4).map((c, i) => (
                  <li key={i} className="text-xs">{c}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
