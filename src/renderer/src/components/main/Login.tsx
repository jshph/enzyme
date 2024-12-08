import React, { useState } from 'react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const isAuthenticated = false; // Replace with actual authentication logic

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Implement login logic here
    // On success, setShowOtpForm(true);
    // On error, setMessage('Error message') and setError(true);
    setLoading(false);
  };

  const handleOtpVerification = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Implement OTP verification logic here
    // On success, setMessage('Success message') and setError(false);
    // On error, setMessage('Error message') and setError(true);
    setLoading(false);
  };

  return (
    <>
      {/* Login View */}
      <div className="space-y-6">
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Welcome to Enzyme
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Sign in with your email to get started
              </p>
            </div>

            {/* Email Form */}
            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
              <div className="rounded-md shadow-sm">
                <div>
                  <label htmlFor="email-address" className="sr-only">Email address</label>
                  <input 
                    id="email-address" 
                    name="email" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" 
                    placeholder="Email address"
                  />
                </div>
              </div>

              <div>
                <button 
                  type="submit" 
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  disabled={loading}
                >
                  <span>{loading ? 'Sending...' : 'Get verification code'}</span>
                </button>
              </div>
            </form>

            {/* OTP Verification Form */}
            {showOtpForm && (
              <form className="mt-8 space-y-6" onSubmit={handleOtpVerification}>
                <div className="rounded-md shadow-sm">
                  <div>
                    <label htmlFor="otp-code" className="sr-only">Verification Code</label>
                    <input 
                      id="otp-code" 
                      name="otp" 
                      type="text" 
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required 
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" 
                      placeholder="Enter verification code"
                    />
                  </div>
                </div>

                <div>
                  <button 
                    type="submit" 
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    disabled={loading}
                  >
                    <span>{loading ? 'Verifying...' : 'Verify Code'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Status Messages */}
            {message && (
              <div className={`mt-4 p-4 rounded-md ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                <p>{message}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;