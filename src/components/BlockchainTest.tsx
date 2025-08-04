'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { certificarLectura, certificarEnvio, certificarRecepcion, certificarUsuario } from '@/lib/certification';
import { getWalletBalance, getTransactionInfo } from '@/lib/blockchain';
import { Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

export default function BlockchainTest() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [balance, setBalance] = useState<string>('');

  const addResult = (type: string, data: any, success: boolean = true) => {
    setResults(prev => [{
      id: Date.now(),
      type,
      data,
      success,
      timestamp: new Date().toLocaleString()
    }, ...prev]);
  };

  const testCertificarLectura = async () => {
    setLoading(true);
    try {
      const txHash = await certificarLectura('msg-123', 'user-abc');
      addResult('Lectura Certificada', { txHash }, true);
    } catch (error: any) {
      addResult('Error Lectura', { error: error.message }, false);
    }
    setLoading(false);
  };

  const testCertificarEnvio = async () => {
    setLoading(true);
    try {
      const txHash = await certificarEnvio('msg-456', 'user-sender', 'destino@ejemplo.com');
      addResult('Envío Certificado', { txHash }, true);
    } catch (error: any) {
      addResult('Error Envío', { error: error.message }, false);
    }
    setLoading(false);
  };

  const testCertificarRecepcion = async () => {
    setLoading(true);
    try {
      const txHash = await certificarRecepcion('msg-789', 'user-receiver');
      addResult('Recepción Certificada', { txHash }, true);
    } catch (error: any) {
      addResult('Error Recepción', { error: error.message }, false);
    }
    setLoading(false);
  };

  const testCertificarUsuario = async () => {
    setLoading(true);
    try {
      const txHash = await certificarUsuario('user-new', 'nuevo@ejemplo.com');
      addResult('Usuario Certificado', { txHash }, true);
    } catch (error: any) {
      addResult('Error Usuario', { error: error.message }, false);
    }
    setLoading(false);
  };

  const checkBalance = async () => {
    setLoading(true);
    try {
      const bal = await getWalletBalance();
      setBalance(bal);
      addResult('Balance Consultado', { balance: `${bal} MATIC` }, true);
    } catch (error: any) {
      addResult('Error Balance', { error: error.message }, false);
    }
    setLoading(false);
  };

  const checkTransaction = async (txHash: string) => {
    setLoading(true);
    try {
      const info = await getTransactionInfo(txHash);
      addResult('Info Transacción', info, true);
    } catch (error: any) {
      addResult('Error Info TX', { error: error.message }, false);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔗 Test Polygon Blockchain Integration
            {balance && (
              <Badge variant="secondary">
                Balance: {balance} MATIC
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button 
              onClick={testCertificarLectura}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '📖'}
              Certificar Lectura
            </Button>

            <Button 
              onClick={testCertificarEnvio}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '📤'}
              Certificar Envío
            </Button>

            <Button 
              onClick={testCertificarRecepcion}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '📨'}
              Certificar Recepción
            </Button>

            <Button 
              onClick={testCertificarUsuario}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '👤'}
              Certificar Usuario
            </Button>

            <Button 
              onClick={checkBalance}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '💰'}
              Ver Balance
            </Button>

            <Button 
              onClick={() => window.open('https://mumbaifaucet.com', '_blank')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Faucet MATIC
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Resultados de Pruebas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {results.map((result) => (
                <div 
                  key={result.id}
                  className={`p-4 rounded-lg border ${
                    result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="font-medium">{result.type}</span>
                    <span className="text-sm text-muted-foreground">{result.timestamp}</span>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    {result.data.txHash && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">TX Hash:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {result.data.txHash}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`https://mumbai.polygonscan.com/tx/${result.data.txHash}`, '_blank')}
                          className="h-6 px-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => checkTransaction(result.data.txHash)}
                          className="h-6 px-2"
                        >
                          Info
                        </Button>
                      </div>
                    )}
                    
                    {result.data.error && (
                      <div className="text-red-600">
                        <span className="font-medium">Error:</span> {result.data.error}
                      </div>
                    )}
                    
                    {result.data.balance && (
                      <div>
                        <span className="font-medium">Balance:</span> {result.data.balance}
                      </div>
                    )}

                    {result.data.blockNumber && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="font-medium">Block:</span> {result.data.blockNumber}</div>
                        <div><span className="font-medium">Gas:</span> {result.data.gasUsed?.toString()}</div>
                        <div><span className="font-medium">Status:</span> {result.data.status}</div>
                        <div><span className="font-medium">Data:</span> {result.data.data}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}