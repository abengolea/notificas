import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Configuración de Firebase (igual que en lib/firebase.ts)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCJmjAFcVQMNtTICexEHkzFwgUbGv2zctE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "notificas-f9953.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "notificas-f9953",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "notificas-f9953.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "367222498482",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:367222498482:web:8d8f95b5d17af1008ad5ab",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-TQLEG5ZXGE"
};

// Inicializar Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export async function POST(request: NextRequest) {
  try {
    const { to, subject, content } = await request.json();
    
    console.log('🔥 Probando función Firebase...', { to, subject });
    
    // Crear un documento de prueba en Firestore
    const testDocId = `test_${Date.now()}`;
    
    // Crear el documento en la colección 'mail' antes de llamar a la función
    const docData = {
      to: [to],
      from: 'contacto@notificas.com',
      message: {
        subject: subject,
        html: `<p>${content}</p>`,
        text: content
      },
      senderName: 'Test Admin',
      recipientName: to.split('@')[0],
      recipientEmail: to,
      createdAt: serverTimestamp(),
      timestamp: new Date().toISOString()
    };
    
    // Agregar el documento a Firestore
    const docRef = await addDoc(collection(db, 'mail'), docData);
    console.log('📄 Documento creado en Firestore:', docRef.id);
    
    // Llamar a la función Firebase sendEmail
    const response = await fetch('https://sendemail-ju7n3yysfq-uc.a.run.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ docId: docRef.id })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Error en función Firebase');
    }
    
    console.log('✅ Función Firebase ejecutada:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Función Firebase ejecutada exitosamente',
      details: {
        docId: docRef.id,
        response: result,
        status: response.status
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error en función Firebase:', error);
    
    return NextResponse.json({
      success: false,
      message: `Error en función Firebase: ${error.message}`,
      details: {
        error: error.message,
        stack: error.stack
      }
    }, { status: 500 });
  }
}
