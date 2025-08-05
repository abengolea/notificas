import BlockchainTest from '@/components/BlockchainTest';

export default function TestPolygonPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🔗 Pruebas Polygon Amoy Testnet (2025)</h1>
          <p className="text-muted-foreground">
            Prueba la integración con Polygon Amoy Testnet para certificar comunicaciones
          </p>
          
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-red-800 font-semibold mb-2">🚨 Actualización Crítica 2025</h3>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• <strong>Mumbai Testnet fue DEPRECADO</strong> el 13 abril 2024</li>
              <li>• <strong>Amoy Testnet</strong> es el reemplazo oficial</li>
              <li>• <strong>Chain ID cambió:</strong> 80001 → 80002</li>
              <li>• <strong>Moneda cambió:</strong> MATIC → POL</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Configuración requerida:</strong> Antes de usar, configura las variables de Polygon Amoy en .env.local:
            </p>
            <ul className="text-xs text-yellow-700 mt-2 space-y-1">
              <li>• POLYGON_PRIVATE_KEY (sin 0x)</li>
              <li>• POLYGON_PROVIDER_URL=https://rpc-amoy.polygon.technology/</li>
              <li>• POLYGON_WALLET_ADDRESS (dirección destino)</li>
            </ul>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
              <div className="text-xs text-yellow-700">
                💰 <strong>Faucet Alchemy:</strong><br />
                <a href="https://www.alchemy.com/faucets/polygon-amoy" target="_blank" className="underline">
                  alchemy.com/faucets/polygon-amoy
                </a>
              </div>
              <div className="text-xs text-yellow-700">
                💰 <strong>Faucet Chainlink:</strong><br />
                <a href="https://faucets.chain.link/polygon-amoy" target="_blank" className="underline">
                  faucets.chain.link/polygon-amoy
                </a>
              </div>
              <div className="text-xs text-yellow-700">
                📊 <strong>Explorer:</strong><br />
                <a href="https://amoy.polygonscan.com" target="_blank" className="underline">
                  amoy.polygonscan.com
                </a>
              </div>
            </div>
          </div>
        </div>

        <BlockchainTest />

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-4 text-sm text-muted-foreground">
            <a 
              href="https://amoy.polygonscan.com" 
              target="_blank" 
              className="hover:underline flex items-center gap-1"
            >
              📊 Amoy PolygonScan
            </a>
            <a 
              href="https://www.alchemy.com/faucets/polygon-amoy" 
              target="_blank" 
              className="hover:underline flex items-center gap-1"
            >
              💰 Alchemy Faucet
            </a>
            <a 
              href="https://faucets.chain.link/polygon-amoy" 
              target="_blank" 
              className="hover:underline flex items-center gap-1"
            >
              💰 Chainlink Faucet
            </a>
            <a 
              href="https://docs.polygon.technology/" 
              target="_blank" 
              className="hover:underline flex items-center gap-1"
            >
              📚 Documentación
            </a>
          </div>
          
          <div className="mt-4 text-xs text-muted-foreground">
            <p><strong>Red:</strong> Polygon Amoy Testnet | <strong>Chain ID:</strong> 80002 | <strong>Moneda:</strong> POL</p>
            <p>Anclada a Ethereum Sepolia | Configuración 2025 actualizada</p>
          </div>
        </div>
      </div>
    </div>
  );
}