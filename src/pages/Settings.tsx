import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, User, Bell, Database, Shield } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const handleSave = () => {
    toast.success("Configuración guardada correctamente");
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Sidebar activeView="dashboard" onViewChange={() => {}} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-glow">
                <SettingsIcon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gradient">Configuración</h1>
                <p className="text-muted-foreground">Gestiona tu cuenta y preferencias del sistema</p>
              </div>
            </div>

            <Tabs defaultValue="general" className="space-y-6">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="general" className="gap-2">
                  <User className="w-4 h-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-2">
                  <Bell className="w-4 h-4" />
                  Notificaciones
                </TabsTrigger>
                <TabsTrigger value="database" className="gap-2">
                  <Database className="w-4 h-4" />
                  Base de Datos
                </TabsTrigger>
                <TabsTrigger value="security" className="gap-2">
                  <Shield className="w-4 h-4" />
                  Seguridad
                </TabsTrigger>
              </TabsList>

              {/* General Settings */}
              <TabsContent value="general" className="space-y-4">
                <Card className="border-transparent shadow-md">
                  <CardHeader>
                    <CardTitle>Perfil de Usuario</CardTitle>
                    <CardDescription>Actualiza tu información personal</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre completo</Label>
                      <Input id="name" placeholder="Juan Delgado" defaultValue="Juan Delgado" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="juan@example.com" defaultValue="juan@contractos.cl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Empresa</Label>
                      <Input id="company" placeholder="Andes Iron SpA" defaultValue="Andes Iron SpA" />
                    </div>
                    <Button onClick={handleSave}>Guardar cambios</Button>
                  </CardContent>
                </Card>

                <Card className="border-transparent shadow-md">
                  <CardHeader>
                    <CardTitle>Preferencias del Sistema</CardTitle>
                    <CardDescription>Personaliza la experiencia de uso</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Tema oscuro</Label>
                        <p className="text-sm text-muted-foreground">Usar tema oscuro en toda la aplicación</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Idioma</Label>
                        <p className="text-sm text-muted-foreground">Español (Chile)</p>
                      </div>
                      <Button variant="outline" size="sm">Cambiar</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Settings */}
              <TabsContent value="notifications" className="space-y-4">
                <Card className="border-transparent shadow-md">
                  <CardHeader>
                    <CardTitle>Alertas y Notificaciones</CardTitle>
                    <CardDescription>Configura cómo quieres recibir notificaciones</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Alertas SLA</Label>
                        <p className="text-sm text-muted-foreground">Notificar cuando se acerquen los plazos</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Nuevos EDPs</Label>
                        <p className="text-sm text-muted-foreground">Notificar cuando se procese un nuevo EDP</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Cambios en contratos</Label>
                        <p className="text-sm text-muted-foreground">Notificar modificaciones importantes</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Email diario</Label>
                        <p className="text-sm text-muted-foreground">Resumen diario de actividad</p>
                      </div>
                      <Switch />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Database Settings */}
              <TabsContent value="database" className="space-y-4">
                <Card className="border-transparent shadow-md">
                  <CardHeader>
                    <CardTitle>Conexión a Base de Datos</CardTitle>
                    <CardDescription>Estado de la conexión con Supabase</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
                        <div>
                          <p className="font-medium">Conectado</p>
                          <p className="text-sm text-muted-foreground">Supabase - wnkifmuhkhdjbswraini</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Ver detalles</Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Frecuencia de sincronización</Label>
                      <div className="flex gap-2">
                        <Input type="number" defaultValue="30" className="w-20" />
                        <span className="flex items-center text-sm text-muted-foreground">segundos</span>
                      </div>
                    </div>
                    <Button onClick={handleSave}>Aplicar cambios</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Settings */}
              <TabsContent value="security" className="space-y-4">
                <Card className="border-transparent shadow-md">
                  <CardHeader>
                    <CardTitle>Seguridad</CardTitle>
                    <CardDescription>Gestiona la seguridad de tu cuenta</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Contraseña actual</Label>
                      <Input id="current-password" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nueva contraseña</Label>
                      <Input id="new-password" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                      <Input id="confirm-password" type="password" />
                    </div>
                    <Button onClick={handleSave}>Cambiar contraseña</Button>

                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Autenticación de dos factores</Label>
                          <p className="text-sm text-muted-foreground">Añade una capa extra de seguridad</p>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
