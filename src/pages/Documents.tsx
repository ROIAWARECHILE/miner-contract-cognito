import DocumentUploader from '@/components/DocumentUploader';
import { Header } from '@/components/Header';

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Gestión de Documentos
          </h1>
          <p className="text-muted-foreground">
            Sube y procesa documentos del proyecto Dominga automáticamente
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Section 1: Contract & Technical Bases */}
          <section className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-lg text-foreground mb-4">
                Contrato & Bases Técnicas
              </h2>
              <div className="space-y-3">
                <DocumentUploader defaultType="contract" />
                <DocumentUploader defaultType="quality" />
                <DocumentUploader defaultType="sso" />
                <DocumentUploader defaultType="tech" />
              </div>
            </div>
          </section>

          {/* Section 2: Payment States (EDPs) */}
          <section className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-lg text-foreground mb-4">
                Estados de Pago (EDP)
              </h2>
              <DocumentUploader defaultType="edp" />
            </div>
          </section>

          {/* Section 3: Administrative */}
          <section className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold text-lg text-foreground mb-4">
                Administrativo
              </h2>
              <div className="space-y-3">
                <DocumentUploader defaultType="sdi" />
                <DocumentUploader defaultType="addendum" />
              </div>
            </div>
          </section>
        </div>

        {/* Info Banner */}
        <div className="mt-8 bg-primary/5 border border-primary/20 rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-2">
            ℹ️ Proceso automático de ingesta
          </h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Los documentos se suben al bucket <code className="bg-muted px-1 rounded">contracts/dominga/</code></p>
            <p>• Se procesan inmediatamente con IA (Gemini 2.5 Pro)</p>
            <p>• La extracción incluye clasificación, parseo, validación y cálculo de KPIs</p>
            <p>• Los resultados se actualizan en tiempo real en el dashboard</p>
            <p>• El procesamiento ocurre en segundo plano sin esperas</p>
          </div>
        </div>
      </main>
    </div>
  );
}
