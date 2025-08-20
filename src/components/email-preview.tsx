'use client';

import { generateEmailHtml } from '../lib/email-template';

export default function EmailPreview() {
  const emailHtml = generateEmailHtml({
    senderName: 'Empresa ABC',
    recipientName: 'Juan Perez',
    recipientEmail: 'juan.perez@email.com',
    readUrl: 'https://notificas.com/read/12345',
    fallbackUrl: 'https://notificas.com/read/12345',
    year: new Date().getFullYear()
  });

  return (
    <div className='p-6 bg-gray-100 min-h-screen'>
      <div className='max-w-4xl mx-auto'>
        <h1 className='text-2xl font-bold mb-6 text-center'>
          Vista Previa del Email de Notificacion
        </h1>
        
        <div className='bg-white rounded-lg shadow-lg overflow-hidden'>
          <div className='bg-blue-600 text-white p-4'>
            <h2 className='text-lg font-semibold'>Template del Email</h2>
            <p className='text-sm opacity-90'>Colores y diseno adaptados a tu app</p>
          </div>
          
          <div className='p-4'>
            <div 
              className='border rounded-lg p-4 bg-gray-50'
              dangerouslySetInnerHTML={{ __html: emailHtml }}
            />
          </div>
        </div>

        <div className='mt-6 bg-white rounded-lg shadow-lg p-6'>
          <h3 className='text-lg font-semibold mb-4'>Caracteristicas del Nuevo Template:</h3>
          <ul className='space-y-2 text-sm'>
            <li className='flex items-center'>
              <span className='w-2 h-2 bg-green-500 rounded-full mr-3'></span>
              <strong>Sin tracking pixels</strong> - No mas spam
            </li>
            <li className='flex items-center'>
              <span className='w-2 h-2 bg-green-500 rounded-full mr-3'></span>
              <strong>Colores de tu app</strong> - Header azul (#0D9488), badge azul oscuro (#1E3A8A)
            </li>
            <li className='flex items-center'>
              <span className='w-2 h-2 bg-green-500 rounded-full mr-3'></span>
              <strong>Fuente Inter</strong> - Como tu aplicacion
            </li>
            <li className='flex items-center'>
              <span className='w-2 h-2 bg-green-500 rounded-full mr-3'></span>
              <strong>Diseno responsive</strong> - Funciona en todos los dispositivos
            </li>
            <li className='flex items-center'>
              <span className='w-2 h-2 bg-green-500 rounded-full mr-3'></span>
              <strong>Tracking por links</strong> - Metricas sin ser marcado como spam
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
