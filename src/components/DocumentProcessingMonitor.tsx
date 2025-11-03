import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProcessingJob {
  id: string;
  storage_path: string;
  document_type: string;
  status: string;
  progress: any;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentProcessingMonitorProps {
  contractId: string;
}

export function DocumentProcessingMonitor({ contractId }: DocumentProcessingMonitorProps) {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contractId) return;

    const fetchJobs = async () => {
      const { data, error } = await supabase
        .from("document_processing_jobs")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching processing jobs:", error);
      } else {
        setJobs(data || []);
      }
      setLoading(false);
    };

    fetchJobs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`processing_jobs_${contractId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "document_processing_jobs",
          filter: `contract_id=eq.${contractId}`
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contractId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Procesamiento de Documentos</CardTitle>
          <CardDescription>Cargando trabajos de procesamiento...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Procesamiento de Documentos</CardTitle>
          <CardDescription>
            No hay trabajos de procesamiento para este contrato
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completado</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case "processing":
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Procesando</Badge>;
      default:
        return <Badge variant="outline">En cola</Badge>;
    }
  };

  const getProgressPercent = (job: ProcessingJob): number => {
    return job.progress?.percent || 0;
  };

  const getProgressStep = (job: ProcessingJob): string => {
    const step = job.progress?.step || "queued";
    const stepLabels: Record<string, string> = {
      started: "Iniciado",
      generating_url: "Generando URL",
      llamaparse_submit: "Enviando a LlamaParse",
      llamaparse_polling: "Procesando con LlamaParse",
      openai_extraction: "Extrayendo datos con OpenAI",
      completed: "Completado"
    };
    return stepLabels[step] || step;
  };

  const getFileName = (path: string): string => {
    return path.split("/").pop() || path;
  };

  const getDocTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      edp: "EDP",
      contract: "Contrato",
      sdi: "SDI",
      quality: "Calidad",
      sso: "SSO",
      tech: "Técnico",
      addendum: "Adenda"
    };
    return labels[type] || type.toUpperCase();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Procesamiento de Documentos</CardTitle>
        <CardDescription>
          Pipeline: LlamaParse → OpenAI GPT-4o → Validación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobs.map((job) => (
          <div key={job.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{getFileName(job.storage_path)}</p>
                  <p className="text-sm text-muted-foreground">
                    {getDocTypeLabel(job.document_type)} • {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              {getStatusBadge(job.status)}
            </div>

            {job.status === "processing" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{getProgressStep(job)}</span>
                  <span className="font-medium">{getProgressPercent(job)}%</span>
                </div>
                <Progress value={getProgressPercent(job)} className="h-2" />
              </div>
            )}

            {job.status === "failed" && job.error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                <p className="text-sm text-destructive">{job.error}</p>
              </div>
            )}

            {job.status === "completed" && (
              <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                <p className="text-sm text-green-700 dark:text-green-400">
                  ✓ Documento procesado exitosamente
                </p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
