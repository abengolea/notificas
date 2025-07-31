import FirestoreTest from '@/components/FirestoreTest';

export default function TestFirestorePage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          🔥 Firebase Firestore Test
        </h1>
        <FirestoreTest />
      </div>
    </div>
  );
}