import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

/* ── SVG Icons ── */
const Ico = ({ d, size = 20, stroke = 'currentColor', fill = 'none', sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const BellIcon = () => <Ico d={<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>} />;
const CheckIcon = () => <Ico size={18} d={<polyline points="20 6 9 17 4 12" />} stroke="#16a34a" sw={2.5} />;
const ChevronRight = () => <Ico d={<polyline points="9 18 15 12 9 6" />} />;
const FireIcon = () => <Ico size={16} d={<path d="M12 12c0-3 2.5-6 2.5-6S17 9 17 12a5 5 0 1 1-10 0c0-3 2.5-6 2.5-6S12 9 12 12z" />} stroke="#f59e0b" />;
const TrendIcon = () => <Ico size={18} d={<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />} />;
const SunIcon = () => <Ico size={16} d={<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>} />;

/* ── Chart helper ── */
const TREND_DATA = [
  { label: 'Jan 31', val: 58 }, { label: 'Feb 1', val: 62 },
  { label: 'Feb 2', val: 59 }, { label: 'Feb 3', val: 68 },
  { label: 'Feb 4', val: 72 }, { label: 'Feb 5', val: 70 },
];

function buildPath(data, w, h, px = 40, py = 30) {
  const min = Math.min(...data.map(d => d.val)) - 5;
  const max = Math.max(...data.map(d => d.val)) + 5;
  const pts = data.map((d, i) => ({
    x: px + (i / (data.length - 1)) * (w - px * 2),
    y: py + (1 - (d.val - min) / (max - min)) * (h - py * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = line + ` L${pts[pts.length - 1].x},${h - py} L${pts[0].x},${h - py} Z`;
  return { pts, line, area, px, py };
}

/* ── Week data ── */
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DATES = [2, 3, 4, 5, 6, 7, 8];
const TODAY_IDX = 4;
const CHECKED = [0, 1, 2, 3];

/* ── Navbar ── */
function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const initials = user
    ? [user.first_name, user.last_name].filter(Boolean).map(n => n[0]).join('').toUpperCase() || user.email[0].toUpperCase()
    : '??';

  const navItems = [
    { label: 'Dashboard', icon: <Ico size={16} d={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>} />, path: '/participant' },
    { label: 'Forms', icon: <Ico size={16} d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>} />, path: '/participant/forms' },
    { label: 'My Submissions', icon: <Ico size={16} d={<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m9 14 2 2 4-4"/></>} />, path: '/participant/submissions' },
  ];

  return (
    <nav className="dashboard-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Hamburger menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="nav-icon-btn"
            onClick={() => { setNavOpen(!navOpen); setProfileOpen(false); }}
            aria-label="Menu"
          >
            <Ico d={navOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></>
            } />
          </button>

          {navOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                onClick={() => setNavOpen(false)}
              />
              <div className="nav-dropdown">
                {navItems.map(item => (
                  <button
                    key={item.label}
                    className={`nav-dropdown-item ${item.path === '/participant' ? 'nav-dropdown-item-active' : ''}`}
                    onClick={() => { setNavOpen(false); navigate(item.path); }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--color-primary-800)' }}>
          Health Data Bank
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="nav-icon-btn"><BellIcon /></button>

        {/* Profile avatar with dropdown */}
        <div style={{ position: 'relative' }}>
          <div
            className="nav-avatar"
            style={{ cursor: 'pointer' }}
            onClick={() => { setProfileOpen(!profileOpen); setNavOpen(false); }}
          >
            {initials}
          </div>

          {profileOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                onClick={() => setProfileOpen(false)}
              />
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 14 }}>
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                    {user?.email}
                  </p>
                </div>
                <div className="profile-dropdown-divider" />
                <button className="profile-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/participant/profile'); }}>
                  <Ico size={16} d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />
                  Profile
                </button>
                <button className="profile-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/participant/settings'); }}>
                  <Ico size={16} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>} />
                  Settings
                </button>
                <div className="profile-dropdown-divider" />
                <button className="profile-dropdown-item profile-dropdown-logout" onClick={() => { setProfileOpen(false); onLogout(); }}>
                  <Ico size={16} d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>} />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ── Greeting Card ── */
function GreetingCard({ name }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="dash-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 180 }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>{dateStr}</p>
      <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2, margin: '8px 0' }}>
        {greeting},<br />Mr. {name}.
      </h2>
      <div className="streak-badge">
        <FireIcon />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>4 day streak!</span>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Keep it up!</span>
      </div>
    </div>
  );
}

/* ── This Week Card ── */
function WeekCard() {
  return (
    <div className="dash-card" style={{ minHeight: 180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="card-label">This Week</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: 13 }}>
          <SunIcon /> <span>&minus;3&deg;C</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center' }}>
        {DAYS.map((d, i) => {
          const isToday = i === TODAY_IDX;
          const checked = CHECKED.includes(i);
          const isFuture = i > TODAY_IDX;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: isToday ? 'var(--color-primary-600)' : 'var(--color-text-muted)' }}>{d}</span>
              <div className={`week-dot ${checked ? 'week-dot-checked' : ''} ${isToday ? 'week-dot-today' : ''} ${isFuture ? 'week-dot-future' : ''}`}>
                {checked && <CheckIcon />}
              </div>
              <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--color-primary-600)' : 'var(--color-text-secondary)' }}>
                {String(DATES[i]).padStart(2, '0')}
              </span>
              {isToday && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: 'var(--color-primary-600)', textTransform: 'uppercase', marginTop: -4 }}>TODAY</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Check-in Card ── */
function CheckInCard() {
  const [dot, setDot] = useState(0);
  return (
    <div className="dash-card" style={{ minHeight: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <h3 className="card-label" style={{ marginBottom: 16 }}>Today's Check-In</h3>
      <div className="checkin-item">
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-primary-600)' }}>WELLNESS</span>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: '4px 0 2px' }}>Fill out Smoke Free Form</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Weekly wellness check-in</p>
        </div>
        <button className="checkin-go"><ChevronRight /></button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        {[0, 1, 2].map(i => (
          <button key={i} onClick={() => setDot(i)}
            className={`carousel-dot ${i === dot ? 'carousel-dot-active' : ''}`} />
        ))}
      </div>
    </div>
  );
}

/* ── Trend Chart Card ── */
function TrendCard() {
  const [range, setRange] = useState('7');
  const W = 380, H = 200;
  const { pts, line, area, px, py } = buildPath(TREND_DATA, W, H);

  return (
    <div className="dash-card" style={{ minHeight: 180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--color-primary-600)' }}><TrendIcon /></span>
          <h3 className="card-label">Your Wellness Trend</h3>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['7', '7 Days'], ['30', '30 Days']].map(([v, label]) => (
            <button key={v} onClick={() => setRange(v)}
              className={`range-btn ${range === v ? 'range-btn-active' : ''}`}>{label}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i} x1={px} y1={py + f * (H - py * 2)} x2={W - px} y2={py + f * (H - py * 2)} stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#areaGrad)" />
        <path d={line} fill="none" stroke="var(--color-primary-500)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="white" stroke="var(--color-primary-500)" strokeWidth="2.5" />
            <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-text-primary)" fontFamily="DM Sans,system-ui">{TREND_DATA[i].val}</text>
            <text x={p.x} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)" fontFamily="DM Sans,system-ui">{TREND_DATA[i].label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── Dashboard Page ── */
export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, try to fetch the logged-in user
  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => {
        // Not authenticated — use placeholder user for development
        setUser({ id: 'dev', email: 'dev@test.com', first_name: 'John', last_name: 'Thompson' });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="auth-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 16 }}>Loading...</p>
      </div>
    );
  }

  const lastName = user?.last_name || user?.email?.split('@')[0] || 'User';

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse at 20% 50%,rgba(219,234,254,.5) 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(191,219,254,.35) 0%,transparent 50%),radial-gradient(ellipse at 50% 100%,rgba(224,231,255,.4) 0%,transparent 50%),linear-gradient(180deg,#f0f7ff 0%,#e8f0fe 50%,#dce8f8 100%)` }}>
      <Navbar user={user} onLogout={handleLogout} />
      <div style={{ height: 3, background: 'linear-gradient(90deg, var(--color-primary-500), var(--color-primary-700))', opacity: 0.6 }} />

      <main className="dashboard-grid">
        <GreetingCard name={lastName} />
        <WeekCard />
        <CheckInCard />
        <TrendCard />
      </main>

      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms &amp; Conditions</a><span>|</span>
        <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>About Us</a><span>|</span>
        <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Copyright</a>
      </div>
    </div>
  );
}
