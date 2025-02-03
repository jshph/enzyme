import { ipcMain } from "electron";
import { TokenManager } from "../auth.js";
import { getServerUrl, logger, store } from "./index.js";
import { getCurrentSession } from "./user.js";
import { checkForUpdates } from '../updater.js';

export function setupAuthIPCRoutes() {
  ipcMain.handle('login', async (event, email: string, password: string) => {
    const tokenManager = TokenManager.getInstance();
    const token = await tokenManager.getToken(email, password);
    return token;
  });

  const SERVER_URL = getServerUrl();

  async function fetchGithubToken(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch(`${SERVER_URL}/auth/github-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      logger.error('Error fetching GitHub token:', error);
      return null;
    }
  }

  ipcMain.handle('auth:verify-otp', async (_, email: string, otpCode: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      if (data.success && data.session?.access_token) {
        store.set('auth', {
          email,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        // Initial update check after login
        const ghToken = await fetchGithubToken(data.session.access_token);
        if (ghToken) {
          await checkForUpdates(ghToken);
        }
      }
      
      return { 
        success: true, 
        message: data.message,
        pricingUrl: `http://localhost:4321/pricing?email=${encodeURIComponent(email)}`
      };
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

      if (!access_token && !refresh_token) {
        store.delete('auth');
        return { isAuthenticated: false };
      }

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
      
      // Handle reauth requirement
      if (data.shouldReauthenticate) {
        store.delete('auth');
        return { 
          isAuthenticated: false, 
          error: data.error,
          shouldReauthenticate: true 
        };
      }

      // Clear store in failure cases
      if (!response.ok || data.error || !data.isAuthenticated) {
        store.delete('auth');
        return { 
          isAuthenticated: false, 
          error: data.error || 'Session verification failed' 
        };
      }

      // Update stored auth with new tokens if provided
      if (data.access_token) {
        store.set('auth', { 
          email: data.user.email, 
          access_token: data.access_token,
          refresh_token: data.refresh_token || refresh_token // Fallback to existing refresh token if not provided
        });
      }
      
      return { 
        isAuthenticated: true, 
        user: data.user,
        shouldReauthenticate: false
      };
    } catch (error) {
      store.delete('auth');
      return { 
        isAuthenticated: false,
        error: 'Failed to verify session'
      };
    }
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      const session = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/auth/logout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session.access_token && { 'Authorization': `Bearer ${session.access_token}` })
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      // Clear stored auth on successful logout
      if (data.success) {
        store.delete('auth');
      }

      return data;
    } catch (error) {
      console.error('Error logging out:', error);
      return { 
        success: false,
        error: 'Failed to logout'
      };
    }
  });

  ipcMain.handle('auth:clear-store', async () => {
    try {
      store.delete('auth');
      return { success: true };
    } catch (error) {
      logger.error('Error clearing auth store:', error);
      return { success: false };
    }
  });

  // Add a new handler to check subscription status
  ipcMain.handle('auth:check-subscription', async () => {
    try {
      const session = await getCurrentSession();
      if (!session.access_token) return { hasSubscription: false };

      const response = await fetch(`${SERVER_URL}/auth/check-subscription`, {
        headers: { 
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();
      return { 
        hasSubscription: data.hasSubscription,
        // If they have subscription, app can now proceed
      };
    } catch (error) {
      return { hasSubscription: false };
    }
  });
}