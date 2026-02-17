import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import {
  UserIcon, LockIcon, EyeIcon, EyeOffIcon,
  MailIcon, AtSignIcon, ShieldIcon, PhoneIcon,
} from '../components/Icons';
import { api } from '../services/api';

const PASSWORD_RULES = [
  { label: 'Min 8 characters', test: (p) => p.length >= 8 },
  { label: 'uppercase', test: (p) => /[A-Z]/.test(p) },
  { label: 'lowercase', test: (p) => /[a-z]/.test(p) },
  { label: 'number', test: (p) => /\d/.test(p) },
  { label: 'special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// strips everything except digits
function digitsOnly(value) {
  return value.replace(/\D/g, '');
}

// formats as (902) 555-1234
function formatPhone(digits) {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function getPhoneHint(digits) {
  if (digits.length === 0) return null;
  if (digits.length < 10) return { text: `${10 - digits.length} more digit${10 - digits.length === 1 ? '' : 's'} needed`, valid: false };
  if (digits.length === 10) return { text: 'Valid phone number', valid: true };
  return { text: 'Too many digits (10 required)', valid: false };
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    phone: '',
    phoneDisplay: '',
    password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handlePhoneChange = (e) => {
    const digits = digitsOnly(e.target.value).slice(0, 10);
    setForm({
      ...form,
      phone: digits,
      phoneDisplay: formatPhone(digits),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const failedRules = PASSWORD_RULES.filter((r) => !r.test(form.password));
    if (failedRules.length > 0) {
      setError('Password must have: ' + failedRules.map((r) => r.label).join(', '));
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    if (form.phone.length !== 10) {
      setError('Phone number must be exactly 10 digits');
      return;
    }

    setLoading(true);
    try {
      await api.register({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        username: form.username,
        phone: form.phone,
        password: form.password,
        confirm_password: form.confirm_password,
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const phoneHint = getPhoneHint(form.phone);

  return (
    <AuthLayout>
      <div className="text-center mb-6">
        <h2
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}
        >
          Create Account
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Fill in your details to get started
        </p>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          Personal Information
        </p>

        {/* First + Last name */}
        <div className="name-row">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
              <UserIcon className="w-4 h-4" />
            </span>
            <input
              className="auth-input"
              style={{ paddingLeft: '42px' }}
              placeholder="First Name"
              value={form.first_name}
              onChange={set('first_name')}
              required
            />
          </div>
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
              <UserIcon className="w-4 h-4" />
            </span>
            <input
              className="auth-input"
              style={{ paddingLeft: '42px' }}
              placeholder="Last Name"
              value={form.last_name}
              onChange={set('last_name')}
              required
            />
          </div>
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
            <MailIcon />
          </span>
          <input
            type="email"
            className="auth-input"
            placeholder="Email Address"
            value={form.email}
            onChange={set('email')}
            required
            autoComplete="email"
          />
        </div>

        {/* Phone with live validation hint */}
        <div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
              <PhoneIcon />
            </span>
            <input
              type="tel"
              className="auth-input"
              placeholder="Phone Number"
              value={form.phoneDisplay}
              onChange={handlePhoneChange}
              required
              inputMode="numeric"
            />
          </div>
          {phoneHint && (
            <p className={`field-hint ${phoneHint.valid ? 'field-hint-success' : 'field-hint-error'}`}>
              {phoneHint.text}
            </p>
          )}
        </div>

        <hr className="my-1" style={{ borderColor: 'var(--color-border-soft)' }} />

        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          Account Credentials
        </p>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
            <AtSignIcon />
          </span>
          <input
            className="auth-input"
            placeholder="Username"
            value={form.username}
            onChange={set('username')}
            required
            autoComplete="username"
          />
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
            <LockIcon />
          </span>
          <input
            type={showPassword ? 'text' : 'password'}
            className="auth-input"
            style={{ paddingRight: '48px' }}
            placeholder="Password"
            value={form.password}
            onChange={set('password')}
            required
            autoComplete="new-password"
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

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
            <ShieldIcon />
          </span>
          <input
            type={showConfirm ? 'text' : 'password'}
            className="auth-input"
            style={{ paddingRight: '48px' }}
            placeholder="Confirm Password"
            value={form.confirm_password}
            onChange={set('confirm_password')}
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none p-0 cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
            tabIndex={-1}
          >
            {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        <div className="flex flex-wrap gap-x-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {PASSWORD_RULES.map((rule, i) => {
            const passed = form.password && rule.test(form.password);
            return (
              <span key={i} style={{ color: passed ? '#16a34a' : undefined, transition: 'color 0.2s' }}>
                {rule.label}{i < PASSWORD_RULES.length - 1 ? ' \u00B7' : ''}
              </span>
            );
          })}
        </div>

        <button type="submit" className="btn-primary mt-2" disabled={loading}>
          {loading ? 'Creating Account\u2026' : 'Create Account'}
        </button>
      </form>

      <p className="text-center mt-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-semibold hover:underline"
          style={{ color: 'var(--color-primary-600)', fontStyle: 'italic' }}
        >
          Login!
        </Link>
      </p>
    </AuthLayout>
  );
}
