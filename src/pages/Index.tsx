import { useState } from "react";
import { ContractDashboard } from "@/components/ContractDashboard";
import { ContractDetail } from "@/components/ContractDetail";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import SemanticSearch from "@/components/SemanticSearch";

const Index = () => {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "documents" | "alerts">("dashboard");

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          {selectedContractId ? (
            <ContractDetail
              contractId={selectedContractId}
              onBack={() => setSelectedContractId(null)}
            />
          ) : (
            <>
              <div className="mb-6">
                <SemanticSearch />
              </div>
              <ContractDashboard
                onSelectContract={setSelectedContractId}
                activeView={activeView}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
