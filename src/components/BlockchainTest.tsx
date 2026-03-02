'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle, ExternalLink, Info, ShieldCheck } from 'lucide-react';

const POLYGON_EXPLORER = 'https://polygonscan.com';

async function fetchCertify(type: string, params?: Record<string, string>) {
  const res = await fetch('/api/polygon/certify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...params }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al certificar');
  }
  return res.json();
}

async function fetchTransactionInfo(txHash: string) {
  const res = await fetch(`/api/polygon/transaction?txHash=${encodeURIComponent(txHash)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al obtener info');
  }
  return res.json();
}

async function fetchNetworkInfo() {
  const res = await fetch('/api/polygon/network');
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al obtener info de red');
  }
  return res.json();
}

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

  const runCertify = async (label: string, type: string, params?: Record<string, string>) => {
    setLoading(true);
    try {
      const { txHash, explorerUrl } = await fetchCertify(type, params);
      addResult(label, { txHash, explorerUrl }, true);
      // Auto-fetch datos de certificación de la red
      try {
        const { data } = await fetchTransactionInfo(txHash);
        addResult(`Datos certificación: ${label}`, data, true);
      } catch {
        // No fallar si falla el fetch de info
      }
    } catch (error: any) {
      addResult(`Error ${label}`, { error: error.message }, false);
    }
    setLoading(false);
  };

  const testCertificarLectura = () => runCertify('Lectura Certificada', 'read');
  const testCertificarEnvio = () => runCertify('Envío Certificado', 'send');
  const testCertificarRecepcion = () => runCertify('Recepción Certificada', 'receive');
  const testCertificarUsuario = () => runCertify('Usuario Certificado', 'user');

  const checkNetworkInfo = async () => {
    setLoading(true);
    try {
      const { data } = await fetchNetworkInfo();
      setNetworkInfo(data);
      setBalance(data.balance || '');
      addResult('Info de Red', data, true);
    } catch (error: any) {
      addResult('Error Red', { error: error.message }, false);
    }
    setLoading(false);
  };

  const checkTransaction = async (txHash: string) => {
    setLoading(true);
    try {
      const { data } = await fetchTransactionInfo(txHash);
      addResult('Info Transacción', data, true);
    } catch (error: any) {
      addResult('Error Info TX', { error: error.message }, false);
    }
    setLoading(false);
  };

  const openInExplorer = (txHash: string) => {
    window.open(`${POLYGON_EXPLORER}/tx/${txHash}`, '_blank');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            🔗 Prueba Polygon Mainnet
            {balance && (
              <Badge variant="secondary">
                Balance: {balance}
              </Badge>
            )}
            {networkInfo && (
              <Badge variant="outline">
                Chain: {networkInfo.chainId}
              </Badge>
            )}
            {networkInfo?.walletAddress && (
              <Badge variant="outline" className="font-mono text-xs">
                Wallet: {networkInfo.walletAddress.slice(0, 6)}...{networkInfo.walletAddress.slice(-4)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800 text-sm">
              <Info className="w-4 h-4" />
              <span><strong>Polygon Mainnet</strong> (Chain ID: 137) - Usando POL real</span>
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
              onClick={checkNetworkInfo}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '📊'}
              Info Red + Balance
            </Button>

            <Button 
              onClick={() => window.open(POLYGON_EXPLORER, '_blank')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Polygon Explorer
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Datos de certificación en Polygon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[28rem] overflow-y-auto">
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
                  
                  <div className="text-sm space-y-2">
                    {result.data.txHash && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">TX Hash:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
                          {result.data.txHash}
                        </code>
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          onClick={() => openInExplorer(result.data.txHash)}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Verificar en PolygonScan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => checkTransaction(result.data.txHash)}
                        >
                          Más datos
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

                    {result.data.walletAddress && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Wallet usada:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
                          {result.data.walletAddress}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => window.open(`${POLYGON_EXPLORER}/address/${result.data.walletAddress}`, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver en PolygonScan
                        </Button>
                        <span className="text-xs text-muted-foreground">(compara con tu dirección)</span>
                      </div>
                    )}


                    {/* Datos de la red y certificación */}
                    {(result.data.chainId || result.data.blockNumber !== undefined) && (
                      <div className="space-y-2 text-xs bg-white/50 p-2 rounded">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {result.data.chainId && <div><span className="font-medium">Chain ID:</span> {result.data.chainId}</div>}
                          <div><span className="font-medium">Red:</span> {result.data.name || result.data.network || 'Polygon Mainnet'}</div>
                          {result.data.currency && <div><span className="font-medium">Moneda:</span> {result.data.currency}</div>}
                          {result.data.blockNumber !== undefined && <div><span className="font-medium">Block:</span> {result.data.blockNumber}</div>}
                          {result.data.gasUsed !== undefined && <div><span className="font-medium">Gas usado:</span> {result.data.gasUsed.toString()}</div>}
                          {result.data.status !== undefined && <div><span className="font-medium">Status:</span> {result.data.status === 1 ? '✅ Confirmada' : '⏳ Pendiente'}</div>}
                        </div>
                        {result.data.data && (
                          <div>
                            <span className="font-medium">Payload certificado:</span>
                            <pre className="mt-1 p-2 bg-gray-100 rounded text-[11px] break-all">
                              {result.data.data}
                            </pre>
                          </div>
                        )}
                        {result.data.explorerUrl && (
                          <Button
                            size="sm"
                            variant="link"
                            className="h-auto p-0 text-emerald-600 font-semibold"
                            onClick={() => window.open(result.data.explorerUrl, '_blank')}
                          >
                            🔗 Verificar en PolygonScan que quedó certificado en la blockchain
                          </Button>
                        )}
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
