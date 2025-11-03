import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Shield, Zap, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ContractAI</span>
          </div>
          <Button onClick={() => navigate("/auth")} size="lg">
            Iniciar Sesión
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Gestión Inteligente de Contratos Mineros
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Analiza, administra y optimiza tus contratos mineros con el poder de la inteligencia artificial
        </p>
        <Button onClick={() => navigate("/auth")} size="lg" className="text-lg px-8 py-6">
          Comenzar Ahora
        </Button>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-card p-8 rounded-xl border border-border shadow-md">
            <Shield className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-2xl font-bold mb-3">Análisis con IA</h3>
            <p className="text-muted-foreground">
              Extrae información clave de contratos automáticamente usando inteligencia artificial avanzada
            </p>
          </div>
          <div className="bg-card p-8 rounded-xl border border-border shadow-md">
            <Zap className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-2xl font-bold mb-3">Alertas Inteligentes</h3>
            <p className="text-muted-foreground">
              Recibe notificaciones sobre obligaciones, renovaciones y eventos críticos de tus contratos
            </p>
          </div>
          <div className="bg-card p-8 rounded-xl border border-border shadow-md">
            <BarChart3 className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-2xl font-bold mb-3">Dashboard Completo</h3>
            <p className="text-muted-foreground">
              Visualiza el estado de todos tus contratos, riesgos y oportunidades en tiempo real
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>&copy; 2025 ContractAI. Sistema de Gestión de Contratos Mineros.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
