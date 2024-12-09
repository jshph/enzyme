import { ipcMain } from "electron";
import { TokenManager } from "../auth";
import { getServerUrl, logger, store } from "./index";
import { clearSession, getCurrentSession } from "./user";

export function setupAuthIPCRoutes() {
  ipcMain.handle('login', async (event, email: string, password: string) => {
    const tokenManager = TokenManager.getInstance();
    const token = await tokenManager.getToken(email, password);
    return token;
  });

  ipcMain.handle('get-auth', async () => {
    return store.get('auth');
  });

  const SERVER_URL = getServerUrl();


  ipcMain.handle('auth:verify-otp', async (_, email: string, token: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      // Store the session if verification was successful
      if (data.success && data.session?.access_token) {
        store.set('auth', {
          email,
          token: data.session.access_token
        });
      }
      
      return { success: true, message: data.message };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { 
        success: false,
        error: 'Failed to verify code'
      };
    }
  });

  ipcMain.handle('auth:send-verification-code', async (_, email) => {
    try {
      const response = await fetch(`${SERVER_URL}/auth/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        return { success: false, error: await response.text() };
      }
      const data = await response.json();
      return { success: true, message: data.message };
    } catch (error) {
      logger.error(`Error sending verification code: ${error}`);
      throw new Error('Error sending verification code. Please try again in a few moments.');
    }
  });

  ipcMain.handle('auth:verify-session', async (_) => {
    try {
      const token = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/auth/verify-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      // Update stored auth if we get a new token
      if (data.access_token) {
        store.set('auth', { 
          email: data.user.email, 
          token: data.access_token 
        });
      }
      
      return { isAuthenticated: true, user: data.user };
    } catch (error) {
      console.error('Error verifying session:', error);
      return { 
        isAuthenticated: false,
        error: 'Failed to verify session'
      };
    }
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      const token = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/auth/logout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      // Clear stored auth on successful logout
      if (data.success) {
        store.delete('auth');
      }

      await clearSession();
      
      return data;
    } catch (error) {
      console.error('Error logging out:', error);
      return { 
        success: false,
        error: 'Failed to logout'
      };
    }
  });
  
}