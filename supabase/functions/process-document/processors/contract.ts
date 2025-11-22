import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { contractAgent } from "../ai/agents/index.ts";

export interface ContractProcessorInput {
  extractedData: any;  // JSON already extracted by OpenAI
  parsedJson: any;     // For reference if needed
  storage_path: string;
  document_type: string;
  job_id: string;
  contract_id?: string;
  supabase: SupabaseClient;
}

export interface ContractProcessorOutput {
  contract: any;
  contract_summary: any;
  warnings: string[];
  review_required: boolean;
}

export async function processContractDocument(
  input: ContractProcessorInput
): Promise<ContractProcessorOutput> {
  const { extractedData, storage_path, supabase, job_id } = input;
  const filename = storage_path.split("/").pop() || "unknown";
  
  console.log(`[contract-processor] 📄 Processing contract document: ${filename}`);
  console.log(`[contract-processor] 🔍 Validating extracted data...`);
  
  // Step 1: Validate already extracted data with schema
  const extractionResult = contractAgent.validate(extractedData);
  
  if (!extractionResult) {
    console.error('[contract-processor] ❌ Validation failed for extracted data:', extractedData);
    throw new Error("Contract data does not match expected schema");
  }
  
  console.log(`[contract-processor] ✅ Data validation passed`);
  
  // Step 2: Validate critical fields
  const warnings: string[] = [];
  let review_required = false;
  
  if (!extractionResult.identificacion?.numero_contrato) {
    warnings.push("CRITICAL: Contract number not extracted");
    review_required = true;
  }
  
  if (!extractionResult.partes?.mandante?.nombre || !extractionResult.partes?.contratista?.nombre) {
    warnings.push("CRITICAL: Parties (mandante/contratista) not identified");
    review_required = true;
  }
  
  if (!extractionResult.precio_y_pago?.monto_maximo_uf || extractionResult.precio_y_pago.monto_maximo_uf <= 0) {
    warnings.push("CRITICAL: Budget not extracted or invalid");
    review_required = true;
  }
  
  // Step 3: Validate tasks budget sum
  if (extractionResult.actividades_y_entregables?.length > 0) {
    const tasksSum = extractionResult.actividades_y_entregables.reduce(
      (sum: number, task: any) => sum + (task.precio_uf || 0), 
      0
    );
    const budget = extractionResult.precio_y_pago.monto_maximo_uf;
    
    if (budget && budget > 0) {
      const diff = Math.abs(tasksSum - budget);
      
      if (diff > budget * 0.05) {  // >5% difference
        warnings.push(`WARNING: Tasks sum (${tasksSum} UF) differs from budget (${budget} UF) by ${diff.toFixed(2)} UF`);
        review_required = true;
      }
    }
  }
  
  // Step 4: Determine contract code
  const extractedCode = 
    extractionResult.identificacion?.numero_contrato || 
    `AUTO_${Date.now()}`;
  
  console.log(`[contract-processor] Extracted contract code: ${extractedCode}`);
  
  // Step 5: Check if contract exists
  const { data: existingContract } = await supabase
    .from("contracts")
    .select("*")
    .eq("code", extractedCode)
    .maybeSingle();
  
  let contract: any;
  
  if (existingContract) {
    console.log(`[contract-processor] Contract exists, updating: ${extractedCode}`);
    
    const { data: updated } = await supabase
      .from("contracts")
      .update({
        title: extractionResult.objeto_contrato?.descripcion?.substring(0, 200) || "Contrato sin título",
        metadata: {
          mandante: extractionResult.partes.mandante.nombre,
          contratista: extractionResult.partes.contratista.nombre,
          budget_uf: extractionResult.precio_y_pago.monto_maximo_uf,
          fecha_firma: extractionResult.identificacion.fecha_firma,
          administrador_mandante: extractionResult.administracion?.administrador_mandante
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", existingContract.id)
      .select()
      .single();
    
    contract = updated || existingContract;
  } else {
    console.log(`[contract-processor] Creating new contract: ${extractedCode}`);
    
    const { data: newContract, error } = await supabase
      .from("contracts")
      .insert({
        code: extractedCode,
        title: extractionResult.objeto_contrato?.descripcion?.substring(0, 200) || "Contrato sin título",
        type: "service",
        status: "draft",
        metadata: {
          mandante: extractionResult.partes.mandante.nombre,
          contratista: extractionResult.partes.contratista.nombre,
          budget_uf: extractionResult.precio_y_pago.monto_maximo_uf,
          fecha_firma: extractionResult.identificacion.fecha_firma
        }
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create contract: ${error.message}`);
    }
    
    contract = newContract;
  }
  
  // Step 6: Upsert into contract_summaries
  const { data: summary, error: summaryError } = await supabase
    .from("contract_summaries")
    .upsert({
      contract_id: contract.id,
      contract_code: contract.code,
      extracted_json: extractionResult,
      extraction_method: contractAgent.model,
      confidence_score: review_required ? 0.6 : 0.9,
      processing_time_ms: 0, // Will be set by caller
      review_status: review_required ? 'flagged' : 'pending',
      version: 1
    }, {
      onConflict: 'contract_code'
    })
    .select()
    .single();
  
  if (summaryError) {
    console.error(`[contract-processor] Failed to save summary:`, summaryError);
    throw new Error(`Failed to save contract summary: ${summaryError.message}`);
  }
  
  // Step 7: Update job with contract_id
  await supabase
    .from("document_processing_jobs")
    .update({ contract_id: contract.id })
    .eq("id", job_id);
  
  console.log(`[contract-processor] ✅ Contract processed successfully: ${contract.code}`);
  
  if (warnings.length > 0) {
    console.warn(`[contract-processor] ⚠️ Warnings:`, warnings);
  }
  
  return {
    contract,
    contract_summary: summary,
    warnings,
    review_required
  };
}
