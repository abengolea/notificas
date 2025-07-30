import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Perfil de Administrador</CardTitle>
                    <CardDescription>
                        Actualiza la información de tu perfil y tu contraseña.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="admin-name">Nombre</Label>
                        <Input id="admin-name" defaultValue="Admin Notificas" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-email">Correo Electrónico</Label>
                        <Input id="admin-email" type="email" defaultValue="admin@notificas.com" disabled />
                    </div>
                     <Button>Actualizar Perfil</Button>
                </CardContent>
                <CardHeader>
                     <CardTitle>Contraseña</CardTitle>
                    <CardDescription>
                        Cambia tu contraseña. Se te pedirá que inicies sesión de nuevo después de cambiarla.
                    </CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current-password">Contraseña Actual</Label>
                        <Input id="current-password" type="password" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="new-password">Nueva Contraseña</Label>
                        <Input id="new-password" type="password" />
                    </div>
                     <Button>Cambiar Contraseña</Button>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Configuración General</CardTitle>
                    <CardDescription>
                        Ajustes generales de la aplicación.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="site-name">Nombre del Sitio</Label>
                        <Input id="site-name" defaultValue="Notificas" />
                    </div>
                     <Button>Guardar Cambios</Button>
                </CardContent>
            </Card>
        </div>
    );
}
