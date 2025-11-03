import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Check {
  name: string;
  status: 'PASS' | 'FAIL';
  expected: any;
  actual: any;
  provenance?: {
    filename?: string;
    page?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contract_code } = await req.json();
    const targetCode = contract_code || 'AIPD-CSI001-1000-MN-0001';

    // Expected values from mockup
    const expected = {
      code: 'AIPD-CSI001-1000-MN-0001',
      budget_uf: 4501,
      start_date: '2025-07-21',
      client: 'Andes Iron SpA',
      contractor: 'Itasca Chile SpA',
      spent_uf: 209.81,
      available_uf: 4291.19,
      progress_pct: 5,
      edps_paid: 1,
      tasks: [
        { task_number: '1.1', budget_uf: 507, spent_uf: 147.85, progress_pct: 29 },
        { task_number: '2.0', budget_uf: 216, spent_uf: 0, progress_pct: 0 },
        { task_number: '3.1', budget_uf: 863, spent_uf: 50.31, progress_pct: 6 },
        { task_number: '4.0', budget_uf: 256, spent_uf: 0, progress_pct: 0 },
        { task_number: '5.0', budget_uf: 843, spent_uf: 0, progress_pct: 0 },
        { task_number: '6.0', budget_uf: 213, spent_uf: 0, progress_pct: 0 },
        { task_number: '7.0', budget_uf: 423, spent_uf: 0, progress_pct: 0 },
        { task_number: '8.0', budget_uf: 580, spent_uf: 0, progress_pct: 0 },
        { task_number: '9.0', budget_uf: 386, spent_uf: 11.66, progress_pct: 3 },
        { task_number: '10.0', budget_uf: 214, spent_uf: 0, progress_pct: 0 }
      ]
    };

    const checks: Check[] = [];

    // Fetch contract
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('code', targetCode)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ 
          error: 'Contract not found',
          summary: { pass: 0, fail: 1 }
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check basic contract fields
    checks.push({
      name: 'contract_code',
      status: contract.code === expected.code ? 'PASS' : 'FAIL',
      expected: expected.code,
      actual: contract.code
    });

    // Extract from metadata JSONB
    const budgetUf = parseFloat(contract.metadata?.budget_uf || contract.contract_value || 0);
    const client = contract.metadata?.client || 'N/A';
    const contractor = contract.metadata?.contractor || 'N/A';

    checks.push({
      name: 'budget_uf',
      status: Math.abs(budgetUf - expected.budget_uf) < 1 ? 'PASS' : 'FAIL',
      expected: expected.budget_uf,
      actual: budgetUf
    });

    checks.push({
      name: 'start_date',
      status: contract.start_date === expected.start_date ? 'PASS' : 'FAIL',
      expected: expected.start_date,
      actual: contract.start_date
    });

    checks.push({
      name: 'client',
      status: client === expected.client ? 'PASS' : 'FAIL',
      expected: expected.client,
      actual: client
    });

    checks.push({
      name: 'contractor',
      status: contractor === expected.contractor ? 'PASS' : 'FAIL',
      expected: expected.contractor,
      actual: contractor
    });

    // Check computed metrics
    const { data: overview } = await supabase
      .from('view_contract_overview')
      .select('*')
      .eq('contract_id', contract.id)
      .single();

    if (overview) {
      checks.push({
        name: 'spent_uf',
        status: Math.abs(parseFloat(overview.spent_uf) - expected.spent_uf) < 0.5 ? 'PASS' : 'FAIL',
        expected: expected.spent_uf,
        actual: parseFloat(overview.spent_uf)
      });

      checks.push({
        name: 'available_uf',
        status: Math.abs(parseFloat(overview.available_uf) - expected.available_uf) < 1 ? 'PASS' : 'FAIL',
        expected: expected.available_uf,
        actual: parseFloat(overview.available_uf)
      });

      checks.push({
        name: 'progress_pct',
        status: Math.abs(parseFloat(overview.progress_pct) - expected.progress_pct) < 1 ? 'PASS' : 'FAIL',
        expected: expected.progress_pct,
        actual: parseFloat(overview.progress_pct)
      });

      checks.push({
        name: 'edps_paid',
        status: overview.edps_paid === expected.edps_paid ? 'PASS' : 'FAIL',
        expected: expected.edps_paid,
        actual: overview.edps_paid
      });
    }

    // Check tasks
    const { data: tasks } = await supabase
      .from('contract_tasks')
      .select('*')
      .eq('contract_id', contract.id)
      .order('task_number');

    if (tasks) {
      for (const expectedTask of expected.tasks) {
        const actualTask = tasks.find(t => t.task_number === expectedTask.task_number);
        
        if (actualTask) {
          checks.push({
            name: `task_${expectedTask.task_number}_budget`,
            status: Math.abs(parseFloat(actualTask.budget_uf) - expectedTask.budget_uf) < 0.5 ? 'PASS' : 'FAIL',
            expected: expectedTask.budget_uf,
            actual: parseFloat(actualTask.budget_uf)
          });

          checks.push({
            name: `task_${expectedTask.task_number}_spent`,
            status: Math.abs(parseFloat(actualTask.spent_uf || 0) - expectedTask.spent_uf) < 0.5 ? 'PASS' : 'FAIL',
            expected: expectedTask.spent_uf,
            actual: parseFloat(actualTask.spent_uf || 0)
          });

          checks.push({
            name: `task_${expectedTask.task_number}_progress`,
            status: Math.abs(parseFloat(actualTask.progress_percentage || 0) - expectedTask.progress_pct) < 1 ? 'PASS' : 'FAIL',
            expected: expectedTask.progress_pct,
            actual: parseFloat(actualTask.progress_percentage || 0)
          });
        } else {
          checks.push({
            name: `task_${expectedTask.task_number}_exists`,
            status: 'FAIL',
            expected: true,
            actual: false
          });
        }
      }
    }

    // Calculate summary
    const passCount = checks.filter(c => c.status === 'PASS').length;
    const failCount = checks.filter(c => c.status === 'FAIL').length;

    // Generate fixes for failed checks
    const fixes: any[] = [];
    for (const check of checks.filter(c => c.status === 'FAIL')) {
      if (check.name.includes('task_')) {
        // Task fix
        const taskNumber = check.name.split('_')[1];
        const field = check.name.split('_')[2];
        fixes.push({
          table: 'contract_tasks',
          where: { contract_id: contract.id, task_number: taskNumber },
          set: { [field === 'spent' ? 'spent_uf' : 'budget_uf']: check.expected }
        });
      } else if (['budget_uf', 'start_date', 'client', 'contractor'].includes(check.name)) {
        fixes.push({
          table: 'contracts',
          where: { id: contract.id },
          set: { [check.name]: check.expected }
        });
      }
    }

    const result = {
      contract_code: targetCode,
      summary: { pass: passCount, fail: failCount },
      status: failCount === 0 ? 'PASS' : 'FAIL',
      checks,
      fixes: failCount > 0 ? fixes : []
    };

    return new Response(
      JSON.stringify(result, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-contract:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
