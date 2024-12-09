import { useState, useCallback } from 'react';

export const useAuthManager = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [showOtpForm, setShowOtpForm] = useState(false);

  const clearMessage = useCallback(() => {
    setMessage('');
    setError(false);
  }, []);

  const handleLogin = useCallback(async (emailInput: string) => {
    setLoading(true);
    clearMessage();

    try {
      const response = await window.electron.ipcRenderer.invoke('auth:send-verification-code', emailInput);
      if (response.success) {
        setMessage(response.message);
        setShowOtpForm(true);
      } else {
        setMessage(response.message);
        setError(true);
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'An error occurred');
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const handleOtpVerification = useCallback(async (emailInput: string, otpCode: string): Promise<boolean> => {
    setLoading(true);
    clearMessage();

    try {
      const response = await window.electron.ipcRenderer.invoke('auth:verify-otp', emailInput, otpCode);
      if (response.success) {
        console.log('verified otp', response)
        setIsAuthenticated(true);
        setEmail(emailInput);
        setShowOtpForm(false);
        return true;
      } else {
        console.log('failed to verify otp', response)
        setError(true);
        setMessage('Invalid verification code');
        return false;
      }
    } catch (err) {
      setError(true);
      setMessage('Failed to verify code');
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const isSessionValid = useCallback(async () => {
    const response = await window.electron.ipcRenderer.invoke('auth:verify-session');
    return response.isAuthenticated;
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await window.electron.ipcRenderer.invoke('clear-spaces');
      const { success, error } = await window.electron.ipcRenderer.invoke('auth:logout');
      
      if (success) {
        setIsAuthenticated(false);
        setEmail('');
        setShowOtpForm(false);
      } else {
        setMessage(error);
        setError(true);
      }
    } catch (err) {
      setMessage('Failed to logout');
      setError(true);
    }
  }, []);

  return {
    isAuthenticated,
    email,
    loading,
    message,
    error,
    showOtpForm,
    setIsAuthenticated,
    setEmail,
    handleLogin,
    handleOtpVerification,
    handleLogout,
    clearMessage,
    isSessionValid
  };
}; 