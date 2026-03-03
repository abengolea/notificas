import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { UploadResult } from 'firebase/storage';

export interface UploadedFile {
  name: string;
  url: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  hash?: string;
  integrityCertificate?: any;
}

export interface PDFAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: Date;
  hash?: string;
  integrityCertificate?: {
    hash: string;
    algorithm: string;
    timestamp: Date;
    blockchainTx?: string;
  };
  trackingData?: {
    opened: boolean;
    openedAt?: Date;
    duration: number;
    scrollDepth: number;
    deviceInfo: {
      userAgent: string;
      screenResolution: string;
      timezone: string;
    };
    ipAddress?: string;
    signatureStatus?: 'pending' | 'signed' | 'declined';
    signatureTimestamp?: Date;
  };
}

/**
 * Prueba los permisos de Firebase Storage creando un archivo de prueba
 */
export async function testStoragePermissions(userId: string): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    console.log('🧪 Probando permisos de Firebase Storage...');
    
    // Crear un archivo de prueba pequeño
    const testContent = 'Test file for permissions';
    const testBlob = new Blob([testContent], { type: 'text/plain' });
    const testFile = new File([testBlob], 'test-permissions.txt', { type: 'text/plain' });
    
    // Intentar subir a una ruta de prueba
    const testRef = ref(storage, `test/${userId}/permissions-test.txt`);
    
    console.log('📁 Intentando subir archivo de prueba...');
    const snapshot = await uploadBytes(testRef, testFile, {
      contentType: 'text/plain',
      customMetadata: {
        test: 'true',
        userId,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('✅ Archivo de prueba subido exitosamente');
    
    // Intentar obtener la URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('🔗 URL de descarga obtenida:', downloadURL);
    
    // Limpiar el archivo de prueba
    try {
      await deleteObject(testRef);
      console.log('🧹 Archivo de prueba eliminado');
    } catch (deleteError) {
      console.warn('⚠️ No se pudo eliminar el archivo de prueba:', deleteError);
    }
    
    return { 
      success: true, 
      details: {
        bucket: snapshot.ref.bucket,
        fullPath: snapshot.ref.fullPath,
        downloadURL
      }
    };
  } catch (error: any) {
    console.error('❌ Error en prueba de permisos:', error);
    
    let errorMessage = 'Error desconocido';
    let errorDetails = {};
    
    if (error.code === 'storage/unauthorized') {
      errorMessage = 'No tienes permisos para subir archivos. Verifica las reglas de Storage.';
      errorDetails = { code: error.code, message: error.message };
    } else if (error.code === 'storage/quota-exceeded') {
      errorMessage = 'Se ha excedido la cuota de almacenamiento.';
      errorDetails = { code: error.code, message: error.message };
    } else if (error.code === 'storage/retry-limit-exceeded') {
      errorMessage = 'Error de conexión persistente con Firebase Storage.';
      errorDetails = { code: error.code, message: error.message };
    } else if (error.code === 'storage/network-request-failed') {
      errorMessage = 'Error de red al conectar con Firebase Storage.';
      errorDetails = { code: error.code, message: error.message };
    } else if (error.code === 'storage/bucket-not-found') {
      errorMessage = 'Bucket de Storage no encontrado. Verifica la configuración.';
      errorDetails = { code: error.code, message: error.message };
    } else {
      errorMessage = `Error de Firebase Storage: ${error.message || error.code || 'Desconocido'}`;
      errorDetails = { code: error.code, message: error.message, fullError: error };
    }
    
    return { 
      success: false, 
      error: errorMessage,
      details: errorDetails
    };
  }
}

/**
 * Verifica la conectividad básica de red sin usar Firebase Storage
 */
export async function checkStorageConnectivity(): Promise<{ isAvailable: boolean; error?: string }> {
  try {
    console.log('🔍 Verificando conectividad básica de red...');
    
    // Verificar conectividad básica de red
    const networkCheck = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    });
    
    console.log('✅ Conectividad de red verificada');
    return { isAvailable: true };
  } catch (error: any) {
    console.log('❌ Error de conectividad de red:', error);
    return { isAvailable: false, error: 'Error de conectividad de red. Verifica tu conexión a internet.' };
  }
}

/**
 * Sube un archivo PDF a Firebase Storage con reintentos mejorados
 */
export async function uploadPDF(
  file: File, 
  messageId: string, 
  userId: string,
  maxRetries: number = 3
): Promise<UploadedFile> {
  console.log(`🚀 Iniciando subida de archivo: ${file.name} (${file.size} bytes)`);
  console.log(`📁 Parámetros: messageId=${messageId}, userId=${userId}`);
  
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Intento ${attempt}/${maxRetries} - Subiendo archivo: ${file.name} (${file.size} bytes)`);
      
      const timestamp = Date.now();
      const fileName = `${messageId}_${timestamp}_${file.name}`;
      const storageRef = ref(storage, `pdfs/${userId}/${messageId}/${fileName}`);
      
      console.log(`📁 Ruta de storage: pdfs/${userId}/${messageId}/${fileName}`);
      console.log(`📁 Storage ref creado:`, storageRef);
      
      // Verificar que el archivo existe y tiene contenido
      if (!file || file.size === 0) {
        throw new Error(`Archivo inválido: ${file.name} (tamaño: ${file.size})`);
      }
      
      console.log(`📤 Iniciando uploadBytes...`);
      
      // Determinar el tipo de contenido correcto
      const contentType = file.type || 'application/octet-stream';
      console.log(`📄 Tipo de contenido detectado: ${contentType}`);
      
      // Crear promise de subida con timeout más largo
      const uploadPromise = uploadBytes(storageRef, file, {
        contentType,
        customMetadata: { 
          messageId, 
          userId, 
          originalName: file.name, 
          uploadedAt: new Date().toISOString(),
          fileSize: file.size.toString()
        }
      });
      
      // Timeout más largo para archivos grandes
      const timeoutDuration = file.size > 5 * 1024 * 1024 ? 300000 : 120000; // 5 minutos para archivos > 5MB, 2 minutos para otros
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout de subida (${timeoutDuration / 1000}s)`)), timeoutDuration);
      });
      
      console.log(`⏱️ Esperando resultado de subida (timeout: ${timeoutDuration / 1000}s)...`);
      
      // Agregar listener de progreso si está disponible
      let uploadTask: any = null;
      try {
        uploadTask = uploadPromise;
        if (uploadTask && typeof uploadTask.on === 'function') {
          uploadTask.on('state_changed', (snapshot: any) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`📊 Progreso de subida: ${progress.toFixed(2)}%`);
          });
        }
      } catch (e) {
        console.log('📊 No se pudo agregar listener de progreso');
      }
      
      let snapshot: any;
      try {
        // Para archivos pequeños, usar timeout más corto
        if (file.size < 1024 * 1024) { // < 1MB
          console.log(`📤 Archivo pequeño, usando timeout corto...`);
          const shortTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout de subida (30s)')), 30000);
          });
          snapshot = await Promise.race([uploadPromise, shortTimeout]);
        } else {
          // Para archivos grandes, usar timeout largo
          snapshot = await Promise.race([uploadPromise, timeoutPromise]);
        }
      } catch (error: any) {
        if (error.message.includes('Timeout')) {
          console.log(`⏰ Timeout detectado, reintentando sin timeout...`);
          // Último intento sin timeout
          snapshot = await uploadPromise;
        } else {
          throw error;
        }
      }
      
      console.log(`✅ Archivo subido exitosamente, snapshot:`, snapshot);
      console.log(`📊 Bytes transferidos: ${(snapshot as any).bytesTransferred}/${(snapshot as any).totalBytes}`);
      
      console.log(`🔗 Obteniendo URL de descarga...`);
      const downloadPromise = getDownloadURL((snapshot as UploadResult).ref);
      const downloadURL = await Promise.race([downloadPromise, timeoutPromise]);
      
      console.log(`🔗 URL de descarga obtenida: ${downloadURL}`);
      
      // Generar hash del archivo para constancia de integridad
      console.log(`🔐 Generando hash de integridad...`);
      const { hash, certificate } = await generateIntegrityCertificate(file, messageId, userId);
      console.log(`🔐 Hash generado: ${hash}`);
      
      const result = { 
        name: file.name, 
        url: downloadURL as string, 
        size: file.size, 
        contentType: file.type, 
        uploadedAt: new Date(),
        hash,
        integrityCertificate: certificate
      };
      
      console.log(`🎉 Archivo subido completamente:`, result);
      return result;
      
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Error en intento ${attempt}/${maxRetries}:`, error);
      console.error(`❌ Código de error:`, error.code);
      console.error(`❌ Mensaje de error:`, error.message);
      
      if (attempt === maxRetries) { 
        console.error(`❌ Se agotaron los intentos. Error final:`, error);
        break; 
      }
      
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`⏳ Esperando ${waitTime}ms antes del siguiente intento...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Error handling after all retries
  console.error(`💥 Error final después de ${maxRetries} intentos:`, lastError);
  
  if (lastError.code === 'storage/unauthorized') { 
    throw new Error('No tienes permisos para subir archivos. Verifica tu autenticación.'); 
  }
  else if (lastError.code === 'storage/quota-exceeded') { 
    throw new Error('Se ha excedido la cuota de almacenamiento.'); 
  }
  else if (lastError.code === 'storage/retry-limit-exceeded') { 
    throw new Error('Error de conexión persistente. Verifica tu conexión a internet e intenta nuevamente.'); 
  }
  else if (lastError.code === 'storage/network-request-failed') { 
    throw new Error('Error de red. Verifica tu conexión a internet.'); 
  }
  else if (lastError.message?.includes('Timeout')) { 
    throw new Error('La subida tardó demasiado. Verifica tu conexión a internet.'); 
  }
  else { 
    throw new Error(`Error al subir el archivo después de ${maxRetries} intentos: ${lastError.message || 'Error desconocido'}`); 
  }
}

/**
 * Sube múltiples archivos PDF con verificación de conectividad
 */
export async function uploadMultiplePDFs(
  files: File[], 
  messageId: string, 
  userId: string,
  maxConcurrency: number = 2
): Promise<UploadedFile[]> {
  console.log(`🚀 Iniciando subida múltiple de ${files.length} archivos`);
  console.log(`📁 Parámetros: messageId=${messageId}, userId=${userId}, maxConcurrency=${maxConcurrency}`);
  
  // Verificar conectividad antes de empezar
  const connectivityCheck = await checkStorageConnectivity();
  if (!connectivityCheck.isAvailable) {
    throw new Error(`Error de conectividad: ${connectivityCheck.error}`);
  }
  
  console.log(`✅ Conectividad verificada, iniciando subidas...`);
  
  const results: UploadedFile[] = [];
  const errors: Error[] = [];
  
  // Procesar archivos en lotes para controlar la concurrencia
  for (let i = 0; i < files.length; i += maxConcurrency) {
    const batch = files.slice(i, i + maxConcurrency);
    console.log(`📦 Procesando lote ${Math.floor(i / maxConcurrency) + 1}: ${batch.length} archivos`);
    
    const batchPromises = batch.map(async (file, index) => {
      const globalIndex = i + index;
      console.log(`📤 Subiendo archivo ${globalIndex + 1}/${files.length}: ${file.name}`);
      
      try {
        const result = await uploadPDF(file, messageId, userId);
        console.log(`✅ Archivo ${globalIndex + 1} subido exitosamente: ${file.name}`);
        return result;
      } catch (error: any) {
        console.error(`❌ Error al subir archivo ${globalIndex + 1}: ${file.name}`, error);
        throw error;
      }
    });
    
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      console.log(`✅ Lote ${Math.floor(i / maxConcurrency) + 1} completado: ${batchResults.length} archivos`);
    } catch (error: any) {
      console.error(`❌ Error en lote ${Math.floor(i / maxConcurrency) + 1}:`, error);
      errors.push(error);
    }
  }
  
  console.log(`📊 Resumen de subida múltiple:`);
  console.log(`✅ Archivos subidos exitosamente: ${results.length}`);
  console.log(`❌ Errores: ${errors.length}`);
  
  if (errors.length > 0) {
    console.error(`💥 Errores encontrados:`, errors);
    throw new Error(`Error al subir ${errors.length} de ${files.length} archivos: ${errors[0].message}`);
  }
  
  console.log(`🎉 Subida múltiple completada exitosamente:`, results);
  return results;
}

/**
 * Elimina un archivo PDF de Firebase Storage
 */
export async function deletePDF(fileUrl: string): Promise<void> {
  try {
    const storageRef = ref(storage, fileUrl);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting PDF:', error);
    throw new Error('No se pudo eliminar el archivo PDF');
  }
}

/**
 * Obtiene la URL de descarga de un archivo
 */
export async function getFileDownloadURL(filePath: string): Promise<string> {
  try {
    const storageRef = ref(storage, filePath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw new Error('No se pudo obtener la URL del archivo');
  }
}

/**
 * Valida que un archivo sea de un tipo permitido
 */
export function validatePDFFile(file: File): { isValid: boolean; error?: string } {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png', 
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  // Verificar tipo MIME
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Tipo de archivo no permitido. Formatos aceptados: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF' };
  }

  // Verificar tamaño (máximo 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { isValid: false, error: 'El archivo es muy grande. Máximo 10MB' };
  }

  // Verificar extensión
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif'];
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    return { isValid: false, error: 'Extensión de archivo no permitida' };
  }

  return { isValid: true };
}

/**
 * Genera un nombre de archivo seguro
 */
export function generateSafeFileName(originalName: string, messageId: string): string {
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${messageId}_${timestamp}_${safeName}`;
}

/**
 * Genera hash SHA-256 de un archivo PDF
 */
export async function generatePDFHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Genera constancia de integridad para un PDF
 */
export async function generateIntegrityCertificate(
  file: File, 
  messageId: string, 
  userId: string
): Promise<{ hash: string; certificate: any }> {
  const hash = await generatePDFHash(file);
  const timestamp = new Date();
  
  const certificate = {
    hash,
    algorithm: 'SHA-256',
    timestamp,
    messageId,
    userId,
    fileName: file.name,
    fileSize: file.size,
    verified: true
  };
  
  return { hash, certificate };
}

/**
 * Verifica la integridad de un PDF comparando con su hash original
 */
export async function verifyPDFIntegrity(file: File, originalHash: string): Promise<boolean> {
  const currentHash = await generatePDFHash(file);
  return currentHash === originalHash;
}
