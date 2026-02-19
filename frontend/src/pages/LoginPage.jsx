import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserIcon, LockIcon, EyeIcon, EyeOffIcon } from '../components/Icons';
import { api } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Heading */}
      <div className="text-center mb-8">
        <h2
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}
        >
          Login
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Please enter your Login and your Password
        </p>
      </div>

      {/* Error message */}
      {error && <div className="auth-error">{error}</div>}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email field */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
            <UserIcon />
          </span>
          <input
            type="email"
            className="auth-input"
            placeholder="Username or Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {/* Password field */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
            <LockIcon />
          </span>
          <input
            type={showPassword ? 'text' : 'password'}
            className="auth-input"
            style={{ paddingRight: '48px' }}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none p-0 cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
            tabIndex={-1}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {/* Forgot password */}
        <div className="text-right">
          <a
            href="#"
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--color-primary-600)' }}
          >
            <Link to="/forgot-password" className="auth-link" style={{ fontSize: '13px', display: 'block', textAlign: 'right', marginBottom: '16px' }}>
            Forgot Password?
            </Link>
          </a>
        </div>

        {/* Submit */}
        <button type="submit" className="btn-primary mt-2" disabled={loading}>
          {loading ? 'Signing in\u2026' : 'Login'}
        </button>
      </form>

      {/* Register link */}
      <p className="text-center mt-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Not a member yet?{' '}
        <Link
          to="/register"
          className="font-semibold hover:underline"
          style={{ color: 'var(--color-primary-600)', fontStyle: 'italic' }}
        >
          Register!
        </Link>
      </p>
    </>
  );
}
