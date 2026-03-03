"use client";

import { useState } from "react";
import { AdminAuth } from "@/components/admin/admin-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, CheckCircle, XCircle, AlertTriangle, LogOut } from "lucide-react";
import { logoutAdmin } from "@/components/admin/admin-auth";

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp: string;
}

export default function EmailTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testEmail, setTestEmail] = useState("goyitobengolea@gmail.com");
  const [testSubject, setTestSubject] = useState("Test de Email - Admin");
  const [testContent, setTestContent] = useState("Este es un mensaje de prueba desde el panel de administración.");

  const addResult = (result: TestResult) => {
    setTestResults(prev => [result, ...prev]);
  };

  const testSMTPConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const result = await response.json();
      
      addResult({
        success: result.success,
        message: result.message,
        details: result.details,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      addResult({
        success: false,
        message: `Error de conexión: ${error}`,
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testEmailSend = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          subject: testSubject,
          content: testContent
        })
      });
      
      const result = await response.json();
      
      addResult({
        success: result.success,
        message: result.message,
        details: result.details,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      addResult({
        success: false,
        message: `Error de envío: ${error}`,
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testFirebaseFunction = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-firebase-function', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          subject: testSubject,
          content: testContent
        })
      });
      
      const result = await response.json();
      
      addResult({
        success: result.success,
        message: result.message,
        details: result.details,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      addResult({
        success: false,
        message: `Error de función Firebase: ${error}`,
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testSimpleEmail = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-simple-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          subject: testSubject,
          content: testContent
        })
      });
      
      const result = await response.json();
      
      addResult({
        success: result.success,
        message: result.message,
        details: result.details,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      addResult({
        success: false,
        message: `Error de email simple: ${error}`,
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <AdminAuth>
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Panel de Administración - Test de Emails</h1>
        <div className="flex items-center gap-4">
          <Badge variant="outline">Admin</Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={logoutAdmin}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Configuración */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configuración de Prueba
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="testEmail">Email de Prueba</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="destinatario@ejemplo.com"
              />
            </div>
            
            <div>
              <Label htmlFor="testSubject">Asunto</Label>
              <Input
                id="testSubject"
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                placeholder="Asunto del mensaje"
              />
            </div>
            
            <div>
              <Label htmlFor="testContent">Contenido</Label>
              <Textarea
                id="testContent"
                value={testContent}
                onChange={(e) => setTestContent(e.target.value)}
                placeholder="Contenido del mensaje"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Panel de Pruebas */}
        <Card>
          <CardHeader>
            <CardTitle>Pruebas Disponibles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={testSMTPConnection} 
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Probar Conexión SMTP
            </Button>
            
            <Button 
              onClick={testEmailSend} 
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Probar Envío Directo
            </Button>
            
            <Button 
              onClick={testSimpleEmail} 
              disabled={isLoading}
              className="w-full"
              variant="secondary"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Probar Email Simple (Sin Tracking)
            </Button>
            
            <Button 
              onClick={testFirebaseFunction} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Probar Función Firebase
            </Button>
            
            <Button 
              onClick={clearResults} 
              variant="destructive"
              className="w-full"
            >
              Limpiar Resultados
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Resultados */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados de las Pruebas</CardTitle>
        </CardHeader>
        <CardContent>
          {testResults.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No hay pruebas ejecutadas. Usa los botones de arriba para probar el sistema de emails.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <Alert key={index} className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.message}</span>
                      <span className="text-sm text-gray-500">{result.timestamp}</span>
                    </div>
                    {result.details && (
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </AdminAuth>
  );
}
