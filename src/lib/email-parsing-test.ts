// Función de prueba para verificar el parsing de asuntos de correos entrantes
export function testEmailParsing() {
  const testCases = [
    // Casos que deberían funcionar
    'CERTIFICAR - abengolea1@gmail.com - Asunto: Hola mundo',
    'certificar - abengolea1@gmail.com - asunto: hola mundo',
    'CERTIFICAR abengolea1@gmail.com Hola mundo',
    'certificar-abengolea1@gmail.com-asunto: hola mundo',
    'CERTIFICAR – abengolea1@gmail.com – Asunto: Hola mundo', // guión largo
    'certificar   -   abengolea1@gmail.com   -   asunto: hola mundo', // espacios extra
    'CERTIFICAR - usuario@empresa.com - Asunto: Documento importante',
    'certificar - test@example.org - mensaje de prueba',
    
    // Casos que NO deberían funcionar
    'Hola mundo', // sin CERTIFICAR
    'CERTIFICAR - email inválido - asunto', // email inválido
    'CERTIFICAR - abengolea1@gmail.com', // sin asunto
    'certificar abengolea1@gmail.com', // sin asunto
  ];

  console.log('🧪 Probando parsing de asuntos de correos entrantes...\n');

  testCases.forEach((testCase, index) => {
    const result = parseCertifySubject(testCase);
    const status = result ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: "${testCase}"`);
    if (result) {
      console.log(`   → Destinatario: ${result.recipient}`);
      console.log(`   → Asunto: ${result.actualSubject}`);
    }
    console.log('');
  });
}

// Función de parsing (copiada de functions/index.js para testing)
function parseCertifySubject(subject: string) {
  if (!subject) return null;
  
  // Patrones flexibles para detectar el formato CERTIFICAR
  const patterns = [
    // "CERTIFICAR - email@domain.com - asunto"
    /certificar\s*[-–—]?\s*([^\s@]+@[^\s@]+\.[^\s@]+)\s*[-–—]?\s*(.*)/i,
    // "CERTIFICAR email@domain.com asunto"
    /certificar\s+([^\s@]+@[^\s@]+\.[^\s@]+)\s+(.*)/i,
    // "CERTIFICAR-email@domain.com-asunto"
    /certificar[-–—]([^\s@]+@[^\s@]+\.[^\s@]+)[-–—](.*)/i
  ];
  
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      return {
        recipient: match[1].trim(),
        actualSubject: match[2].trim() || 'Sin asunto'
      };
    }
  }
  
  return null;
}

// Ejecutar pruebas si se llama directamente
if (typeof window === 'undefined') {
  testEmailParsing();
}
