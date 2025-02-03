import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';

type LoginProps = {
  setCurrentView: (view: string) => void,
}

const Login: React.FC<LoginProps> = ({ setCurrentView }) => {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const { 
    loading, 
    message, 
    error, 
    showOtpForm,
    handleLogin,
    handleOtpVerification
  } = useAuth();

  const onSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleLogin(email);
  };

  const onSubmitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await handleOtpVerification(email, otpCode);
    if (result.success && result.pricingUrl) {
      window.open(result.pricingUrl, '_blank');
      // setMessage('Please complete subscription in your browser to continue');
    }
  };

  return (
    <div className="space-y-6">
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-bold text-primary/90 mb-4">
              Enzyme is your playground for digesting what inspires you
            </h2>
            <p className="text-center text-xl text-secondary/70">
              Sign in with your email to get started
            </p>
          </div>

          {!showOtpForm ? (
            <form className="mt-8 space-y-6" onSubmit={onSubmitEmail}>
              <div className="rounded-md">
                <div>
                  <label htmlFor="email-address" className="sr-only">Email address</label>
                  <input 
                    id="email-address" 
                    name="email" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                    className="appearance-none rounded-md relative block w-full px-3 py-2 input-base bg-input/50 placeholder-secondary/50 text-primary/90 focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand/60" 
                    placeholder="Email address"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary/90 bg-brand/80 hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand/60 disabled:opacity-50"
                disabled={loading}
              >
                <span>{loading ? 'Sending...' : 'Get verification code'}</span>
              </button>
            </form>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={onSubmitOtp}>
              <div className="rounded-md">
                <div>
                  <label htmlFor="otp-code" className="sr-only">Verification Code</label>
                  <input 
                    id="otp-code" 
                    name="otp" 
                    type="text" 
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    required 
                    className="appearance-none rounded-md relative block w-full px-3 py-2 input-base bg-input/50 placeholder-secondary/50 text-primary/90 focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand/60" 
                    placeholder="Enter verification code"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary/90 bg-brand/80 hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand/60 disabled:opacity-50"
                disabled={loading}
              >
                <span>{loading ? 'Verifying...' : 'Verify Code'}</span>
              </button>
            </form>
          )}

          {message && (
            <div className={`mt-4 p-4 rounded-md ${
              error ? 'bg-red/5 text-red/80' : 'bg-brand/5 text-brand/80'
            }`}>
              <p>{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;