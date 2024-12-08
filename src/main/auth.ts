import crypto from 'crypto';

interface AuthResponse {
  token: string;
  expiresAt: number;
}

export class TokenManager {
    private static instance: TokenManager;
    private currentToken: string | null = null;
    private tokenExpiry: number = 0;
    private refreshPromise: Promise<void> | null = null;

    private constructor() {}

    static getInstance(): TokenManager {
        if (!TokenManager.instance) {
            TokenManager.instance = new TokenManager();
        }
        return TokenManager.instance;
    }

    private async refreshToken(email: string, password: string): Promise<void> {
        const response = await fetch('http://localhost:3001/auth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        const auth: AuthResponse = await response.json() as AuthResponse;
        this.currentToken = auth.token;
        this.tokenExpiry = auth.expiresAt;
    }

    async getToken(email: string, password: string): Promise<string> {
        // If token is still valid, return it
        if (this.currentToken && Date.now() < this.tokenExpiry) {
            return this.currentToken;
        }

        // If a refresh is already in progress, wait for it
        if (this.refreshPromise) {
            await this.refreshPromise;
            return this.currentToken!;
        }

        // Start a new refresh
        this.refreshPromise = this.refreshToken(email, password);
        try {
            await this.refreshPromise;
            return this.currentToken!;
        } finally {
            this.refreshPromise = null;
        }
    }
} 