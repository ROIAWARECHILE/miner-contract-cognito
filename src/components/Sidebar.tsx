import { FileText, LayoutDashboard, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface SidebarProps {
  activeView: "dashboard" | "documents" | "alerts";
  onViewChange: (view: "dashboard" | "documents" | "alerts") => void;
}

export const Sidebar = ({ activeView, onViewChange }: SidebarProps) => {
  const navigate = useNavigate();
  
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "Documentos", icon: FileText },
    { id: "alerts", label: "Alertas SLA", icon: Bell },
  ] as const;

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col shadow-lg">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <img 
            src="/precom-logo.png" 
            alt="PreCom Intelligence Processes" 
            className="w-full h-auto object-contain"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-smooth group",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 transition-smooth",
                isActive && "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              )} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="p-4 border-t border-border">
        <button 
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-smooth"
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Configuración</span>
        </button>
      </div>
    </aside>
  );
};
