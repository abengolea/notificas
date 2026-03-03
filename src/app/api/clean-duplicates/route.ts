import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Iniciando limpieza de duplicados...');
    
    // Obtener todos los mensajes
    const mailCol = collection(db, 'mail');
    const snapshot = await getDocs(mailCol);
    
    console.log(`📊 Total de mensajes encontrados: ${snapshot.size}`);
    
    let deletedCount = 0;
    const deletePromises = [];
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      // Criterios para eliminar:
      const shouldDelete = 
        !data.from || // from undefined
        data.message?.subject?.includes('Mensaje certificado de abengolea1@gmail.com') ||
        data.message?.subject?.includes('Mensaje de prueba desde la app');
      
      if (shouldDelete) {
        console.log(`🗑️ Eliminando: ${docSnapshot.id} - ${data.message?.subject || 'Sin asunto'}`);
        deletePromises.push(deleteDoc(doc(db, 'mail', docSnapshot.id)));
        deletedCount++;
      }
    }
    
    // Ejecutar todas las eliminaciones
    await Promise.all(deletePromises);
    
    console.log(`✅ Limpieza completada: ${deletedCount} mensajes eliminados`);
    
    return NextResponse.json({
      success: true,
      message: `Limpieza completada: ${deletedCount} mensajes eliminados`,
      deletedCount
    });
    
  } catch (error: any) {
    console.error('❌ Error en limpieza:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
