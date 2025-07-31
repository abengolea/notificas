import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, AuthError } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from './use-toast';

export interface AuthState {
  user: any;
  loading: boolean;
  error: string | null;
}

export const useFirebaseAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: false,
    error: null
  });
  const { toast } = useToast();

  const getErrorMessage = (error: AuthError): string => {
    switch (error.code) {
      case 'auth/invalid-credential':
        return 'Las credenciales son incorrectas. Por favor, verifica tu email y contraseña.';
      case 'auth/user-not-found':
        return 'No se encontró una cuenta con este email.';
      case 'auth/wrong-password':
        return 'La contraseña es incorrecta.';
      case 'auth/invalid-email':
        return 'El formato del email no es válido.';
      case 'auth/user-disabled':
        return 'Esta cuenta ha sido deshabilitada.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Intenta de nuevo más tarde.';
      case 'auth/network-request-failed':
        return 'Error de conexión. Verifica tu conexión a internet.';
      case 'auth/configuration-not-found':
        return 'Error de configuración de Firebase. Contacta al administrador.';
      default:
        return error.message || 'Ha ocurrido un error desconocido.';
    }
  };

  const signIn = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setAuthState({
        user: userCredential.user,
        loading: false,
        error: null
      });
      
      toast({
        title: "¡Bienvenido de nuevo!",
        description: "Has iniciado sesión correctamente.",
      });
      
      return userCredential.user;
    } catch (error) {
      const errorMessage = getErrorMessage(error as AuthError);
      setAuthState({
        user: null,
        loading: false,
        error: errorMessage
      });
      
      toast({
        title: "Error al iniciar sesión",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setAuthState({
        user: userCredential.user,
        loading: false,
        error: null
      });
      
      toast({
        title: "¡Cuenta creada exitosamente!",
        description: "Tu cuenta ha sido registrada correctamente.",
      });
      
      return userCredential.user;
    } catch (error) {
      const errorMessage = getErrorMessage(error as AuthError);
      setAuthState({
        user: null,
        loading: false,
        error: errorMessage
      });
      
      toast({
        title: "Error al crear cuenta",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    }
  };

  const logout = async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      await signOut(auth);
      setAuthState({
        user: null,
        loading: false,
        error: null
      });
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente.",
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error as AuthError);
      setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }));
      
      toast({
        title: "Error al cerrar sesión",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return {
    ...authState,
    signIn,
    signUp,
    logout
  };
};