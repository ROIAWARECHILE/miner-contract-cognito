import { useState } from "react";
import { Search, Upload, Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentUploadDialog } from "@/components/DocumentUploadDialog";
import { useAuth } from "@/contexts/AuthContext";

export const Header = () => {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const { user, signOut } = useAuth();

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };
  
  return (
    <>
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
          <Button 
            variant="default" 
            size="sm" 
            className="gap-2 shadow-md hover:shadow-lg transition-spring"
            onClick={() => setShowUploadDialog(true)}
          >
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="w-9 h-9 border-2 border-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground font-semibold">
                    {user?.email ? getInitials(user.email) : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Mi Cuenta</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <DocumentUploadDialog 
        open={showUploadDialog} 
        onOpenChange={setShowUploadDialog}
      />
    </>
  );
};
