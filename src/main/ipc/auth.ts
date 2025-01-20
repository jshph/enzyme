import { ipcMain } from "electron";
import { TokenManager } from "../auth.js";
import { getServerUrl, logger, store } from "./index.js";
import { clearSession, getCurrentSession } from "./user.js";

export function setupAuthIPCRoutes() {
  ipcMain.handle('login', async (event, email: string, password: string) => {
    const tokenManager = TokenManager.getInstance();
    const token = await tokenManager.getToken(email, password);
    return token;
  });

  const SERVER_URL = getServerUrl();


  ipcMain.handle('auth:verify-otp', async (_, email: string, otpCode: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      // Store both access token and refresh token if verification was successful
      if (data.success && data.session?.access_token) {
        store.set('auth', {
          email,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
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
      const session = await getCurrentSession();
      const { access_token, refresh_token } = session;

      const response = await fetch(`${SERVER_URL}/auth/verify-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(access_token && { 'Authorization': `Bearer ${access_token}` })
        },
        body: JSON.stringify({
          refresh_token: refresh_token
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        store.delete('auth');
        return { isAuthenticated: false, error: data.error };
      }

      if (!data.isAuthenticated) {
        store.delete('auth');
        return { isAuthenticated: false };
      }
      
      // Update stored auth with new tokens if provided
      if (data.access_token) {
        store.set('auth', { 
          email: data.user.email, 
          access_token: data.access_token,
          refresh_token: data.refresh_token || refresh_token // Keep old refresh token if new one not provided
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
      const { token } = await getCurrentSession();
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