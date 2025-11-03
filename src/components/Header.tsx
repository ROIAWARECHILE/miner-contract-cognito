import { Search, Upload, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      toast.info(`Buscando: "${searchQuery}"`);
      // Aquí iría la lógica de búsqueda real
    }
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar contratos, documentos, EDPs..."
            className="pl-10 bg-muted/50 border-transparent focus:bg-background transition-smooth"
          />
        </div>
      </form>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/')}
        >
          Dashboard
        </Button>
        <Button 
          variant="default" 
          size="sm" 
          className="gap-2 shadow-md hover:shadow-lg transition-spring"
          onClick={() => navigate('/documents')}
        >
          <Upload className="w-4 h-4" />
          <span className="font-medium">Documentos</span>
        </Button>

        <div className="relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            onClick={() => {
              toast.info("Alertas pendientes", {
                description: "3 alertas SLA requieren atención"
              });
            }}
          >
            <Bell className="w-5 h-5" />
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
            >
              3
            </Badge>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => {
            toast.info("Perfil de usuario", {
              description: "Juan Delgado - Administrador"
            });
          }}
        >
          <Avatar className="w-9 h-9 border-2 border-primary/20">
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground font-semibold">
              JD
            </AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  );
};
