'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, deleteDoc } from 'firebase/firestore';

interface TestData {
  id: string;
  message: string;
  timestamp: any;
}

export default function FirestoreTest() {
  const [data, setData] = useState<TestData[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  // Función para leer datos de Firestore
  const fetchData = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'test'));
      const fetchedData: TestData[] = [];
      
      querySnapshot.forEach((doc) => {
        fetchedData.push({
          id: doc.id,
          ...doc.data()
        } as TestData);
      });
      
      setData(fetchedData);
      setStatus('✅ Datos cargados correctamente');
    } catch (error) {
      console.error('Error fetching data:', error);
      setStatus(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para agregar datos a Firestore
  const addData = async () => {
    if (!message.trim()) return;
    
    try {
      setLoading(true);
      await addDoc(collection(db, 'test'), {
        message: message,
        timestamp: new Date().toISOString(),
        createdAt: new Date()
      });
      
      setMessage('');
      setStatus('✅ Dato agregado correctamente');
      await fetchData(); // Recargar datos
    } catch (error) {
      console.error('Error adding data:', error);
      setStatus(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para eliminar datos
  const deleteData = async (id: string) => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'test', id));
      setStatus('✅ Dato eliminado correctamente');
      await fetchData(); // Recargar datos
    } catch (error) {
      console.error('Error deleting data:', error);
      setStatus(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos al iniciar
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">
        🗄️ Prueba de Firestore Database
      </h2>

      {/* Estado de conexión */}
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <p className="text-sm font-medium">Estado: {status}</p>
      </div>

      {/* Formulario para agregar datos */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe un mensaje de prueba..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={addData}
            disabled={loading || !message.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '⏳' : '➕'} Agregar
          </button>
        </div>
      </div>

      {/* Botón para recargar */}
      <div className="mb-4">
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? '⏳ Cargando...' : '🔄 Recargar datos'}
        </button>
      </div>

      {/* Lista de datos */}
      <div>
        <h3 className="text-lg font-semibold mb-3">
          📋 Datos en Firestore ({data.length})
        </h3>
        
        {data.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No hay datos. Agrega algunos para probar la conexión.
          </p>
        ) : (
          <div className="space-y-2">
            {data.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded border"
              >
                <div>
                  <p className="font-medium">{item.message}</p>
                  <p className="text-xs text-gray-500">
                    ID: {item.id} | {item.timestamp}
                  </p>
                </div>
                <button
                  onClick={() => deleteData(item.id)}
                  disabled={loading}
                  className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Información de ayuda */}
      <div className="mt-6 p-3 bg-blue-50 rounded text-sm">
        <p className="font-medium text-blue-800">💡 Información:</p>
        <ul className="list-disc list-inside text-blue-700 mt-1">
          <li>Esta página prueba la conexión a Firestore</li>
          <li>Los datos se almacenan en la colección "test"</li>
          <li>Si ves errores, revisa Firebase Console → Firestore</li>
        </ul>
      </div>
    </div>
  );
}