import { config } from 'dotenv';
import { requestHubInvoiceForMercadoPagoPayment } from '../src/lib/notificas-hub-billing';

config({ path: '.env.local' });

async function main() {
  const paymentId = process.argv[2];
  if (!paymentId) {
    throw new Error('Uso: npx tsx scripts/invoice-approved-payment.ts <paymentId>');
  }

  const result = await requestHubInvoiceForMercadoPagoPayment(paymentId);
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok && !result.skipped) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
