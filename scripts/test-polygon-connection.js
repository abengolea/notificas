#!/usr/bin/env node

/**
 * 🔗 Script de prueba de conexión con Polygon Mainnet
 * Ejecutar: npm run test:polygon
 *
 * Verifica que las variables de .env.local estén configuradas
 * y que la conexión con Polygon funcione correctamente.
 */

const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
// override: true = Siempre usar .env.local (evita que variables del sistema sobrescriban)
require('dotenv').config({ path: envPath, override: true });

const { ethers } = require('ethers');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(msg, color = 'reset') {
  console.log(`${COLORS[color]}${msg}${COLORS.reset}`);
}

async function testPolygonConnection() {
  console.log('\n🔗 Prueba de conexión con Polygon Mainnet\n');
  console.log('─'.repeat(50));

  // 1. Verificar variables de entorno
  log('\n📋 1. Verificando variables de entorno...', 'cyan');
  const required = ['POLYGON_PRIVATE_KEY', 'POLYGON_PROVIDER_URL', 'POLYGON_WALLET_ADDRESS'];
  const missing = required.filter(key => !process.env[key] || process.env[key].includes('tu_') || process.env[key].includes('your_'));

  if (missing.length > 0) {
    log(`\n❌ Faltan variables o tienen valores placeholder: ${missing.join(', ')}`, 'red');
    log('\nAsegúrate de tener en .env.local:', 'yellow');
    log('  POLYGON_PRIVATE_KEY=tu_clave_sin_0x');
    log('  POLYGON_PROVIDER_URL=https://polygon-bor-rpc.publicnode.com');
    log('  POLYGON_WALLET_ADDRESS=0xTuDireccion\n');
    process.exit(1);
  }
  log('   ✓ Todas las variables configuradas', 'green');

  // 2. Conectar al provider
  log('\n📡 2. Conectando al RPC de Polygon...', 'cyan');
  const providerUrl = process.env.POLYGON_PROVIDER_URL || 'https://polygon-bor-rpc.publicnode.com';
  log(`   URL usada: ${providerUrl}`, 'dim');
  const provider = new ethers.JsonRpcProvider(providerUrl);

  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    log(`   ✓ Conectado | Chain ID: ${chainId}`, 'green');

    if (chainId !== 137) {
      log(`   ⚠️  Esperabas Chain ID 137 (Mainnet), recibiste ${chainId}`, 'yellow');
    }
  } catch (err) {
    log(`   ❌ Error de conexión: ${err.message}`, 'red');
    log('\nPosibles causas:', 'yellow');
    log('  - RPC incorrecto o caído');
    log('  - Sin conexión a internet');
    log('  - Firewall bloqueando\n');
    process.exit(1);
  }

  // 3. Verificar wallet
  log('\n👛 3. Verificando wallet...', 'cyan');
  let wallet;
  try {
    const pk = process.env.POLYGON_PRIVATE_KEY.startsWith('0x')
      ? process.env.POLYGON_PRIVATE_KEY
      : `0x${process.env.POLYGON_PRIVATE_KEY}`;
    wallet = new ethers.Wallet(pk, provider);
    log(`   ✓ Wallet: ${wallet.address.slice(0, 10)}...${wallet.address.slice(-8)}`, 'green');
  } catch (err) {
    log(`   ❌ Clave privada inválida: ${err.message}`, 'red');
    process.exit(1);
  }

  // 4. Consultar balance
  log('\n💰 4. Consultando balance de POL...', 'cyan');
  try {
    const balance = await provider.getBalance(wallet.address);
    const balanceFormatted = ethers.formatEther(balance);
    log(`   ✓ Balance: ${balanceFormatted} POL`, 'green');

    if (balance === BigInt(0)) {
      log('\n   ⚠️  Balance en 0. Necesitas POL para certificar.', 'yellow');
      log('   Obtén POL en Binance y retira a esta address.\n', 'dim');
    } else {
      log('   ✓ Suficiente para transacciones de certificación\n', 'green');
    }
  } catch (err) {
    log(`   ❌ Error al consultar balance: ${err.message}`, 'red');
    process.exit(1);
  }

  // 5. Info de la red
  log('📊 5. Información de la red...', 'cyan');
  try {
    const blockNumber = await provider.getBlockNumber();
    const feeData = await provider.getFeeData();
    const gasGwei = feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : 'N/A';
    log(`   Block actual: ${blockNumber}`, 'dim');
    log(`   Gas price: ${gasGwei} gwei`, 'dim');
    log('   ✓ Red operativa\n', 'green');
  } catch (err) {
    log(`   ⚠️  No se pudo obtener gas: ${err.message}\n`, 'yellow');
  }

  // Resumen final
  console.log('─'.repeat(50));
  log('\n✅ Conexión con Polygon Mainnet exitosa', 'green');
  log('\nPróximos pasos:', 'cyan');
  log('  • Prueba en el navegador: http://localhost:9006/test-polygon');
  log('  • Explorer: https://polygonscan.com');
  log('');
}

testPolygonConnection().catch(err => {
  console.error(err);
  process.exit(1);
});
