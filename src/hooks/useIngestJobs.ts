import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IngestJob {
  id: string;
  contract_id: string | null;
  storage_path: string;
  document_type: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngestLog {
  id: number;
  job_id: string;
  step: string | null;
  message: string | null;
  created_at: string;
  meta: any;
}

export const useIngestJobs = (contractId?: string) => {
  return useQuery({
    queryKey: ["ingest-jobs", contractId],
    queryFn: async () => {
      let query = supabase
        .from("ingest_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (contractId) {
        query = query.eq("contract_id", contractId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as IngestJob[];
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });
};

export const useIngestLogs = (jobId?: string) => {
  return useQuery({
    queryKey: ["ingest-logs", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from("ingest_logs")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as IngestLog[];
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      // Stop polling if job has logs with "complete" or "error" step
      const logs = query.state.data;
      const hasFinished = logs?.some(log => 
        log.step === 'complete' || log.step === 'error'
      );
      return hasFinished ? false : 3000;
    },
  });
};
