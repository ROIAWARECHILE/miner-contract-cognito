import { contractAgent } from "./contract.ts";
import { qualityPlanAgent } from "./quality_plan.ts";
import { ssoPlanAgent } from "./sso_plan.ts";
import { technicalReportAgent } from "./technical_report.ts";
import { technicalAnnexAgent } from "./technical_annex.ts";
import { scheduleChartAgent } from "./schedule_chart.ts";
import { progressReportAgent } from "./progress_report.ts";
import { deliveryCertificateAgent } from "./delivery_certificate.ts";

export const agents = {
  contract: contractAgent,
  quality_plan: qualityPlanAgent,
  sso_plan: ssoPlanAgent,
  technical_report: technicalReportAgent,
  technical_annex: technicalAnnexAgent,
  schedule_chart: scheduleChartAgent,
  progress_report: progressReportAgent,
  delivery_certificate: deliveryCertificateAgent,
};

export type AgentType = keyof typeof agents;

export function getAgentByType(type: string) {
  return agents[type as AgentType] || null;
}

export { contractAgent };
