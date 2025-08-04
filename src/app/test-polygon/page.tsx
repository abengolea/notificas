import BlockchainTest from '@/components/BlockchainTest';

export default function TestPolygonPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🔗 Pruebas Polygon Blockchain</h1>
          <p className="text-muted-foreground">
            Prueba la integración con Polygon (Mumbai Testnet) para certificar comunicaciones
          </p>
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Configuración requerida:</strong> Antes de usar, configura las variables de Polygon en .env.local:
            </p>
            <ul className="text-xs text-yellow-700 mt-2 space-y-1">
              <li>• POLYGON_PRIVATE_KEY (sin 0x)</li>
              <li>• POLYGON_PROVIDER_URL (Mumbai testnet)</li>
              <li>• POLYGON_WALLET_ADDRESS (dirección destino)</li>
            </ul>
            <p className="text-xs text-yellow-700 mt-2">
              💰 Obtén MATIC gratis para Mumbai testnet en: <a href="https://mumbaifaucet.com" target="_blank" className="underline">mumbaifaucet.com</a>
            </p>
          </div>
        </div>

        <BlockchainTest />

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-4 text-sm text-muted-foreground">
            <a 
              href="https://mumbai.polygonscan.com" 
              target="_blank" 
              className="hover:underline flex items-center gap-1"
            >
              📊 Mumbai PolygonScan
            </a>
            <a 
              href="https://mumbaifaucet.com" 
              target="_blank" 
              className="hover:underline flex items-center gap-1"
            >
              💰 Mumbai Faucet
            </a>
            <a 
              href="https://docs.polygon.technology/" 
              target="_blank" 
              className="hover:underline flex items-center gap-1"
            >
              📚 Documentación
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}