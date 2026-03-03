# Funcionalidad de Adjuntar PDFs con Tracking

## Descripción

Esta funcionalidad permite adjuntar archivos PDF a los mensajes enviados, con un sistema completo de tracking que registra:

- **Apertura del archivo**: Cuándo se abrió y desde qué IP
- **Tiempo de visualización**: Duración total de la vista
- **Progreso de lectura**: Porcentaje de scroll alcanzado
- **Información del dispositivo**: User agent, resolución, zona horaria
- **Estado de firma**: Confirmación o declinación de recepción

## Componentes Principales

### 1. PDFUpload (`src/components/dashboard/pdf-upload.tsx`)

Componente para subir archivos PDF con:
- Drag & drop de archivos
- Validación de tipo y tamaño
- Preview de archivos seleccionados
- Límite configurable de archivos (por defecto 3)
- Límite de tamaño por archivo (por defecto 10MB)

### 2. PDFViewer (`src/components/dashboard/pdf-viewer.tsx`)

Visor de PDFs con tracking integrado:
- Visor embebido en iframe
- Tracking automático de tiempo y scroll
- Botones de firma (confirmar/declinar recepción)
- Información detallada de acceso
- Descarga directa del archivo

### 3. AttachmentsTracking (`src/components/dashboard/attachments-tracking.tsx`)

Panel de resumen de tracking para todos los archivos adjuntos:
- Estado de cada archivo
- Métricas de acceso
- Estado de firma
- Información del dispositivo

### 4. Hook usePDFTracking (`src/hooks/usePDFTracking.ts`)

Hook personalizado para manejar el tracking:
- Estado del tracking
- Actualización en Firestore
- Control de pausa/reanudación
- Resumen de métricas

## Servicios

### Storage (`src/lib/storage.ts`)

Servicio para manejar archivos en Firebase Storage:
- Subida de archivos PDF
- Validación de archivos
- Generación de URLs seguras
- Metadatos personalizados

## Flujo de Funcionamiento

### 1. Composición del Mensaje

1. El usuario selecciona archivos PDF usando el componente `PDFUpload`
2. Los archivos se validan (tipo, tamaño)
3. Al enviar el mensaje, los archivos se suben a Firebase Storage
4. Se registra el mensaje en Firestore con referencias a los archivos

### 2. Envío y Recepción

1. El destinatario recibe el email con enlaces a los PDFs
2. Los enlaces apuntan a la página de visualización con tracking
3. Se genera un ID único para cada archivo adjunto

### 3. Visualización y Tracking

1. Al abrir un PDF, se inicia automáticamente el tracking
2. Se registra:
   - IP del usuario
   - Información del dispositivo
   - Tiempo de apertura
   - Duración de la vista
   - Progreso de scroll

### 4. Firma Digital

1. El usuario puede confirmar o declinar la recepción
2. Se registra el estado de firma con timestamp
3. Se actualiza la base de datos en tiempo real

## Estructura de Datos

### En Firestore (colección `mail`)

```typescript
{
  // ... otros campos del mensaje
  attachments: {
    [fileId]: {
      name: string;
      url: string;
      size: number;
      type: 'pdf';
      tracking?: {
        opened: boolean;
        openedAt: Date;
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
        lastUpdated: Date;
      };
    };
  };
}
```

### En Firebase Storage

```
pdfs/
├── {userId}/
│   └── {messageId}/
│       ├── {messageId}_{timestamp}_{filename}.pdf
│       └── ...
```

## Configuración

### Variables de Entorno

```bash
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

### Reglas de Storage (Firebase)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /pdfs/{userId}/{messageId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Uso

### En el Diálogo de Composición

```tsx
import { PDFUpload } from '@/components/dashboard/pdf-upload';

<PDFUpload 
  onFileSelect={handlePDFSelect} 
  maxFiles={3} 
  maxSizeMB={10} 
/>
```

### En la Vista de Mensaje

```tsx
import { AttachmentsTracking } from '@/components/dashboard/attachments-tracking';

<AttachmentsTracking
  attachments={messageAttachments}
  onViewPDF={(id, url) => handleViewPDF(id, url)}
/>
```

### Visor Independiente

```tsx
import { PDFViewer } from '@/components/dashboard/pdf-viewer';

<PDFViewer
  pdfUrl={pdfUrl}
  fileName={fileName}
  messageId={messageId}
  onTrackingUpdate={handleTrackingUpdate}
  showSignatureButtons={true}
/>
```

## Ventajas

✅ **Alta percepción de formalidad**: Los PDFs adjuntos dan mayor seriedad al mensaje
✅ **Tracking completo**: Información detallada del acceso y lectura
✅ **Firma digital**: Confirmación de recepción con timestamp
✅ **Seguridad**: Archivos almacenados en Firebase Storage con reglas de acceso
✅ **Escalabilidad**: Sistema preparado para múltiples archivos por mensaje

## Consideraciones

⚠️ **Interacción activa**: El usuario debe abrir activamente el PDF para el tracking
⚠️ **Tamaño de archivos**: Límite de 10MB por archivo para evitar problemas de rendimiento
⚠️ **Costo de storage**: Los archivos se almacenan en Firebase Storage (costo por GB)
⚠️ **Privacidad**: Se registra IP y información del dispositivo del usuario

## Próximas Mejoras

- [ ] Soporte para otros tipos de archivo (DOC, XLS, etc.)
- [ ] Compresión automática de archivos grandes
- [ ] Watermarking automático de PDFs
- [ ] Notificaciones push cuando se abre un archivo
- [ ] Analytics avanzados de comportamiento de lectura
- [ ] Integración con servicios de firma digital externos
