import { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../api/client';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);

  // アプリ起動時にトークンをチェック
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('user');

      if (token && userData) {
        setAuthToken(token);
        setUser(JSON.parse(userData));
        
        // トークンの有効性を確認
        try {
          const response = await authAPI.verify();
          if (response.valid) {
            setUser(response.user);
          } else {
            await logout();
          }
        } catch (error) {
          await logout();
        }
      }
    } catch (error) {
      console.error('Check auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      
      await AsyncStorage.setItem('authToken', response.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.user));
      
      setAuthToken(response.token);
      setUser(response.user);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  };

  const register = async (username, email, password, displayName) => {
    try {
      const response = await authAPI.register(username, email, password, displayName);
      
      await AsyncStorage.setItem('authToken', response.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.user));
      
      setAuthToken(response.token);
      setUser(response.user);
      
      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      const data = error.response?.data;
      const message = data?.error
        || (data?.errors?.[0]?.msg)
        || 'Registration failed';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      
      setAuthToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = async (userData) => {
    setUser(userData);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
  };

  const value = {
    user,
    authToken,
    isLoading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
