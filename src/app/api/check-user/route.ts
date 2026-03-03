import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    console.log('🔍 Verificando usuario:', userId);

    // Verificar si el usuario existe
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('✅ Usuario encontrado:', userData);
      return NextResponse.json({ 
        exists: true, 
        user: userData 
      });
    } else {
      console.log('❌ Usuario no encontrado, creando...');
      
      // Crear el usuario
      await setDoc(userRef, {
        uid: userId,
        email: 'abengolea1@gmail.com',
        tipo: 'individual',
        estado: 'activo',
        perfil: {
          nombre: 'abengolea1@gmail.com',
          verificado: true,
        },
        createdAt: new Date(),
        lastLogin: new Date(),
        creditos: 15, // Créditos iniciales
        updatedAt: new Date()
      });

      console.log('✅ Usuario creado exitosamente');
      return NextResponse.json({ 
        exists: false, 
        created: true,
        message: 'Usuario creado con 15 créditos iniciales'
      });
    }

  } catch (error) {
    console.error('❌ Error verificando usuario:', error);
    return NextResponse.json(
      { error: 'Error verificando usuario' },
      { status: 500 }
    );
  }
}

