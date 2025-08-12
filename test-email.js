const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./notificas-f9953-firebase-adminsdk.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function sendTestEmail() {
  try {
    const docRef = await db.collection('mail').add({
      to: ['tu-email@ejemplo.com'], // Cambia por tu email
      message: {
        subject: '🎉 Test desde Terminal',
        text: '¡Funciona! Email enviado desde la terminal',
        html: '<h1>¡Éxito!</h1><p>Tu función funciona desde terminal</p>'
      }
    });
    
    console.log('✅ Documento creado:', docRef.id);
    console.log('📧 Email enviándose...');
    
    // Esperar un poco y verificar el estado
    setTimeout(async () => {
      const doc = await docRef.get();
      console.log('📊 Estado:', doc.data());
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

sendTestEmail();
