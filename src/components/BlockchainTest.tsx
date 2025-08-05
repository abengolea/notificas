'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { certificarLectura, certificarEnvio, certificarRecepcion, certificarUsuario } from '@/lib/certification';
import { getWalletBalance, getTransactionInfo, getNetworkInfo } from '@/lib/blockchain';
import { Loader2, CheckCircle, AlertCircle, ExternalLink, Info } from 'lucide-react';

export default function BlockchainTest() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [balance, setBalance] = useState<string>('');
  const [networkInfo, setNetworkInfo] = useState<any>(null);

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
      addResult('Balance Consultado', { balance: `${bal} POL` }, true);
    } catch (error: any) {
      addResult('Error Balance', { error: error.message }, false);
    }
    setLoading(false);
  };

  const checkNetworkInfo = async () => {
    setLoading(true);
    try {
      const info = await getNetworkInfo();
      setNetworkInfo(info);
      addResult('Info de Red', info, true);
    } catch (error: any) {
      addResult('Error Red', { error: error.message }, false);
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
            🔗 Test Polygon Amoy Testnet Integration (2025)
            {balance && (
              <Badge variant="secondary">
                Balance: {balance} POL
              </Badge>
            )}
            {networkInfo && (
              <Badge variant="outline">
                Chain: {networkInfo.chainId}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800 text-sm">
              <Info className="w-4 h-4" />
              <span><strong>Actualización 2025:</strong> Mumbai deprecado → Usando Amoy Testnet (Chain ID: 80002)</span>
            </div>
          </div>

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
              Ver Balance POL
            </Button>

            <Button 
              onClick={checkNetworkInfo}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '📊'}
              Info Red
            </Button>

            <Button 
              onClick={() => window.open('https://www.alchemy.com/faucets/polygon-amoy', '_blank')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Faucet POL (Alchemy)
            </Button>

            <Button 
              onClick={() => window.open('https://faucets.chain.link/polygon-amoy', '_blank')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Faucet POL (Chainlink)
            </Button>

            <Button 
              onClick={() => window.open('https://amoy.polygonscan.com', '_blank')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Amoy Explorer
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Resultados de Pruebas - Polygon Amoy</CardTitle>
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
                          onClick={() => window.open(`https://amoy.polygonscan.com/tx/${result.data.txHash}`, '_blank')}
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

                    {result.data.chainId && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="font-medium">Chain ID:</span> {result.data.chainId}</div>
                        <div><span className="font-medium">Network:</span> {result.data.name}</div>
                        <div><span className="font-medium">Currency:</span> {result.data.currency}</div>
                        <div><span className="font-medium">Block:</span> {result.data.blockNumber}</div>
                      </div>
                    )}

                    {result.data.blockNumber && !result.data.chainId && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="font-medium">Block:</span> {result.data.blockNumber}</div>
                        <div><span className="font-medium">Gas:</span> {result.data.gasUsed?.toString()}</div>
                        <div><span className="font-medium">Status:</span> {result.data.status}</div>
                        <div><span className="font-medium">Network:</span> {result.data.network}</div>
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