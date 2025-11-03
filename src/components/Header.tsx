import { Search, Upload, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Header = () => {
  return (
    <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contratos, documentos, EDPs..."
            className="pl-10 bg-muted/50 border-transparent focus:bg-background transition-smooth"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="default" size="sm" className="gap-2 shadow-md hover:shadow-lg transition-spring">
          <Upload className="w-4 h-4" />
          <span className="font-medium">Cargar Documento</span>
        </Button>

        <div className="relative">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
            >
              3
            </Badge>
          </Button>
        </div>

        <Avatar className="w-9 h-9 border-2 border-primary/20">
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground font-semibold">
            JD
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
};
