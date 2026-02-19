import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="auth-bg" style={{ padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Brand */}
        <h1
          className="animate-fade-up"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.75rem, 6vw, 2.75rem)',
            fontWeight: 800,
            color: 'var(--color-primary-800)',
            letterSpacing: '-0.02em',
            marginBottom: '1.5rem',
            textAlign: 'center',
          }}
        >
          Health Data Bank
        </h1>

        {/* Card */}
        <div
          className="glass-card animate-fade-up-delay-1"
          style={{ width: '100%', padding: '2rem 2.25rem' }}
        >
          <Outlet />
        </div>

        {/* Footer */}
        <div
          className="animate-fade-up-delay-3"
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
          }}
        >
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms &amp; Conditions</a>
          <span>|</span>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>About Us</a>
          <span>|</span>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Copyright</a>
        </div>
      </div>
    </div>
  );
}
