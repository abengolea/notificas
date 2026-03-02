import BlockchainTest from '@/components/BlockchainTest';

export default function TestPolygonPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🔗 Pruebas Polygon Mainnet</h1>
          <p className="text-muted-foreground">
            Integración con Polygon Mainnet para certificar comunicaciones con POL real
          </p>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-blue-800 font-semibold mb-2">📌 Red Principal - POL Real</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Polygon Mainnet</strong> (Chain ID: 137)</li>
              <li>• <strong>Moneda:</strong> POL</li>
              <li>• <strong>Explorer:</strong> polygonscan.com</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Configuración requerida:</strong> Configura las variables de Polygon en .env.local:
            </p>
            <ul className="text-xs text-yellow-700 mt-2 space-y-1">
              <li>• POLYGON_PRIVATE_KEY (sin 0x)</li>
              <li>• POLYGON_PROVIDER_URL=https://polygon-bor-rpc.publicnode.com</li>
              <li>• POLYGON_WALLET_ADDRESS (dirección destino)</li>
            </ul>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
              <div className="text-xs text-yellow-700">
                💰 <strong>Obtén POL:</strong> Binance, exchanges, o retira a tu wallet
              </div>
              <div className="text-xs text-yellow-700">
                📊 <strong>Explorer:</strong><br />
                <a href="https://polygonscan.com" target="_blank" className="underline">
                  polygonscan.com
                </a>
              </div>
            </div>
          </div>
        </div>

        <BlockchainTest />

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-4 text-sm text-muted-foreground">
            <a 
              href="https://polygonscan.com" 
              target="_blank" 
              className="hover:underline flex items-center gap-1"
            >
              📊 PolygonScan
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
            <p><strong>Red:</strong> Polygon Mainnet | <strong>Chain ID:</strong> 137 | <strong>Moneda:</strong> POL</p>
          </div>
        </div>
      </div>
    </div>
  );
}