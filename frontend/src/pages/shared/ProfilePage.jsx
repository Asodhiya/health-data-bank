import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../services/api';

/*
  ProfilePage — pure content, shared across all roles.

  Renders inside a layout's <Outlet />:
    Participant → NoSideDashboardLayout (nav + gradient bg)
    Admin/Caretaker/Researcher → DashboardLayout (header + sidebar)

  Props:
    role — "participant" | "admin" | "caretaker" | "researcher"
           Controls the badge text and which fields appear.
*/


/* ── SVG Icon helper ── */
const Ico = ({ d, size = 20, stroke = 'currentColor', fill = 'none', sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const UserIcon        = () => <Ico size={16} d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />;
const UsersIcon       = () => <Ico size={16} d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />;
const MailIcon        = () => <Ico size={16} d={<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>} />;
const PhoneIcon       = () => <Ico size={16} d={<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />} />;
const CalendarIcon    = () => <Ico size={16} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />;
const MapPinIcon      = () => <Ico size={16} d={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>} />;
const EditIcon        = () => <Ico size={14} d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>} />;
const CheckIcon       = () => <Ico size={14} d={<polyline points="20 6 9 17 4 12" />} sw={2} />;
const ShieldIcon      = () => <Ico size={16} d={<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />} />;
const LockIcon        = () => <Ico size={16} d={<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>} />;
const EyeIcon         = () => <Ico size={16} d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>} />;
const EyeOffIcon      = () => <Ico size={16} d={<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>} />;
const BellIcon        = () => <Ico size={16} d={<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>} />;
const CheckCircleIcon = () => <Ico size={16} d={<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>} stroke="#16a34a" />;
const BriefcaseIcon   = () => <Ico size={16} d={<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>} />;
const BookIcon        = () => <Ico size={16} d={<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z" /></>} />;
const TrashIcon       = () => <Ico size={16} d={<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>} />;


/* ── Password rules — same as RegisterPage ── */
const PASSWORD_RULES = [
  { label: 'Min 8 characters', test: (p) => p.length >= 8 },
  { label: 'uppercase',        test: (p) => /[A-Z]/.test(p) },
  { label: 'lowercase',        test: (p) => /[a-z]/.test(p) },
  { label: 'number',           test: (p) => /\d/.test(p) },
  { label: 'special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];


/* ── Calculate age from date string ── */
const calcAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth)) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
};


/* ── Country list from browser Intl API ── */
const COUNTRIES = (() => {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const codes = 'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CR HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'.split(' ');
  return codes.map((code) => displayNames.of(code)).filter(Boolean).sort();
})();


/* ── Dev fallback data per role ── */
const DEV_PROFILES = {
  participant: {
    first_name: 'Josh', last_name: 'Thompson',
    email: 'josh.thompson@upei.ca', phone: '902-555-0147',
    address: '42 University Ave, Charlottetown, PE',
    dob: '1998-03-15', sex: 'Male', pronouns: 'He/Him', pronounsCustom: '',
    program: 'Computer Science', year: '3', language: 'English',
    intl: 'No', country: '',
    title: '', organization: '', department: '', research_pattern: '',
    username: 'josh_wellness',
    program_group: 'Group 7 — Connections for Healthy Living',
    caretaker: 'Dr. William Montelpare',
    created_at: 'Nov 20, 2025', last_login: 'Feb 5, 2026 at 2:34 PM',
    mfa_enabled: true, enrolled_at: 'Dec 1, 2025',
  },
  caretaker: {
    first_name: 'William', last_name: 'Montelpare',
    email: 'w.montelpare@upei.ca', phone: '902-566-0001',
    address: '550 University Ave, Charlottetown, PE C1A 4P3',
    dob: '', sex: '', pronouns: '', pronounsCustom: '',
    program: '', year: '', language: '', intl: '', country: '',
    title: 'Dr.', organization: 'UPEI Faculty of Science',
    department: 'Applied Human Sciences', research_pattern: '',
    specialty: 'Community Health & Wellness',
    credentials: 'PhD, CSEP-CEP',
    bio: 'Professor and researcher in applied health sciences with over 20 years of experience in community-based wellness programs. Currently leading the Health Data Bank initiative.',
    username: 'dr_montelpare',
    program_group: '', caretaker: '',
    groupName: 'Morning Cohort A', participantCount: 8, activeParticipants: 6,
    lastReportGenerated: 'Mar 10, 2026',
    workingHours: { start: '09:00', end: '17:00' },
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    contactPreference: 'email',
    created_at: 'Oct 5, 2025', last_login: 'Feb 5, 2026 at 10:12 AM',
    mfa_enabled: true, enrolled_at: 'Oct 5, 2025',
  },
  researcher: {
    first_name: 'Sarah', last_name: 'Chen',
    email: 's.chen@upei.ca', phone: '902-566-0042',
    address: '', dob: '', sex: '', pronouns: '', pronounsCustom: '',
    program: '', year: '', language: '', intl: '', country: '',
    title: '', organization: '',
    department: 'Applied Health Sciences', research_pattern: 'Community wellness longitudinal studies',
    username: 'sarah_research',
    program_group: '', caretaker: '',
    created_at: 'Oct 10, 2025', last_login: 'Feb 4, 2026 at 3:45 PM',
    mfa_enabled: true, enrolled_at: 'Oct 10, 2025',
  },
  admin: {
    first_name: 'Admin', last_name: 'User',
    email: 'admin@upei.ca', phone: '902-566-0000',
    address: '', dob: '', sex: '', pronouns: '', pronounsCustom: '',
    program: '', year: '', language: '', intl: '', country: '',
    title: '', organization: '', department: '', research_pattern: '',
    username: 'sys_admin',
    program_group: '', caretaker: '',
    created_at: 'Sep 1, 2025', last_login: 'Feb 5, 2026 at 8:00 AM',
    mfa_enabled: true, enrolled_at: 'Sep 1, 2025',
  },
};


/* ── Empty profile template ── */
const EMPTY_PROFILE = {
  first_name: '', last_name: '', email: '', phone: '', address: '',
  dob: '', sex: '', pronouns: '', pronounsCustom: '',
  program: '', year: '', language: '', intl: 'No', country: '',
  title: '', organization: '', department: '', research_pattern: '',
  specialty: '', credentials: '', bio: '',
  username: '', program_group: '', caretaker: '',
  groupName: '', participantCount: 0, activeParticipants: 0,
  lastReportGenerated: '',
  workingHours: { start: '09:00', end: '17:00' },
  availableDays: [],
  contactPreference: 'email',
  created_at: '', last_login: '', mfa_enabled: false, enrolled_at: '',
};


/* ══════════════════════════════════════════════
   REUSABLE SUB-COMPONENTS
   ══════════════════════════════════════════════ */

function ChipSelect({ options, value, onChange, multi = false }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map((opt) => {
        const isSelected = multi ? (value || []).includes(opt) : value === opt;
        return (
          <button key={opt} type="button"
            className={`px-3.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              isSelected
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => {
              if (multi) {
                onChange(isSelected ? (value || []).filter(v => v !== opt) : [...(value || []), opt]);
              } else {
                onChange(opt);
              }
            }}
          >{opt}</button>
        );
      })}
    </div>
  );
}

function ProfileField({ icon, label, value, editing, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="mb-3.5">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{label}</span>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        {editing ? (
          <input
            className={`w-full py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${icon ? 'pl-10 pr-3' : 'pl-3 pr-3'}`}
            type={type} value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || label.toLowerCase()}
          />
        ) : (
          <span className={`block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg ${icon ? 'pl-10 pr-3' : 'px-3'}`}>
            {value || '—'}
          </span>
        )}
      </div>
    </div>
  );
}

function PasswordField({ label, placeholder, value, show, onToggle, onChange }) {
  return (
    <div className="mb-3.5">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{label}</span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><LockIcon /></span>
        <input
          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          type={show ? 'text' : 'password'} placeholder={placeholder}
          value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off"
        />
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          onClick={onToggle} type="button" tabIndex={-1}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      onClick={onChange}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function SearchableSelect({ value, onChange, options, placeholder = 'Search...' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleSelect = (val) => {
    onChange(val);
    setQuery('');
    setOpen(false);
  };

  const handleFocus = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(true);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder={placeholder}
        value={open ? query : value || ''}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={handleFocus}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul
            className="fixed z-20 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg"
            style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px`, width: `${dropdownPos.width}px` }}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-slate-400">No results</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt}
                  className={`px-3 py-2 text-sm cursor-pointer transition-colors ${opt === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => handleSelect(opt)}
                >{opt}</li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════
   ROLE-SPECIFIC FIELD BLOCKS
   Rendered below Contact Information.
   Each role sees different fields based on their
   database profile table.
   ══════════════════════════════════════════════ */

function ParticipantFields({ form, set, editing, profile }) {
  const pronounsDisplay = profile.pronouns === 'Other' && profile.pronounsCustom
    ? profile.pronounsCustom : (profile.pronouns || '—');

  return (
    <>
      <hr className="border-slate-100 my-5" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Demographics</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
        <div className="mb-3.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">DATE OF BIRTH</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><CalendarIcon /></span>
            {editing ? (
              <input
                className="w-full py-2.5 pl-10 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                type="date" value={form.dob}
                onChange={(e) => set('dob')(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            ) : (
              <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg pl-10 pr-3">
                {profile.dob || '—'}
                {calcAge(profile.dob) !== null && (
                  <span className="text-slate-400 ml-2">({calcAge(profile.dob)} yrs)</span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="mb-3.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">SEX</span>
          {editing
            ? <ChipSelect options={['Male', 'Female']} value={form.sex} onChange={set('sex')} />
            : <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{profile.sex || '—'}</span>}
        </div>
        <div className="mb-3.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">PRONOUNS</span>
          {editing ? (
            <>
              <ChipSelect options={['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Other']}
                value={form.pronouns} onChange={set('pronouns')} />
              <div className={`overflow-hidden transition-all ${form.pronouns === 'Other' ? 'max-h-20 opacity-100 mt-2.5' : 'max-h-0 opacity-0'}`}>
                <input className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your pronouns..." maxLength={50}
                  value={form.pronounsCustom || ''} onChange={(e) => set('pronounsCustom')(e.target.value)} />
              </div>
            </>
          ) : <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{pronounsDisplay}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
        <ProfileField icon={null} label="PROGRAM"
          value={editing ? form.program : profile.program} editing={editing} onChange={set('program')} />
        <div className="mb-3.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">YEAR OF STUDY</span>
          {editing
            ? <ChipSelect options={['1', '2', '3', '4', '5+']} value={form.year} onChange={set('year')} />
            : <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{profile.year || '—'}</span>}
        </div>
        <ProfileField icon={null} label="LANGUAGE AT HOME"
          value={editing ? form.language : profile.language} editing={editing} onChange={set('language')} />
      </div>

      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">INTERNATIONAL STUDENT</span>
        {editing ? (
          <>
            <ChipSelect options={['Yes', 'No']} value={form.intl} onChange={set('intl')} />
            <div className={`transition-all ${form.intl === 'Yes' ? 'max-h-96 opacity-100 mt-2.5' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <SearchableSelect
                value={form.country || ''}
                onChange={set('country')}
                options={COUNTRIES}
                placeholder="Search for your country..."
              />
              <p className="text-xs text-slate-400 mt-1">This helps us understand our international community</p>
            </div>
          </>
        ) : (
          <>
            <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{profile.intl || '—'}</span>
            {profile.intl === 'Yes' && profile.country && (
              <div className="mt-3.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">COUNTRY OF ORIGIN</span>
                <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{profile.country}</span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function CaretakerFields({ form, set, editing, profile }) {
  return (
    <>
      <hr className="border-slate-100 my-5" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Professional Information</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <div className="mb-3.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">TITLE</span>
          {editing
            ? <ChipSelect options={['Dr.', 'Prof.', 'Mr.', 'Ms.', 'Mx.']} value={form.title} onChange={set('title')} />
            : <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{profile.title || '—'}</span>}
        </div>
        <ProfileField icon={null} label="CREDENTIALS"
          value={editing ? form.credentials : profile.credentials}
          editing={editing} onChange={set('credentials')} placeholder="e.g. PhD, RN, CSEP-CEP" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <ProfileField icon={<BriefcaseIcon />} label="ORGANIZATION"
          value={editing ? form.organization : profile.organization}
          editing={editing} onChange={set('organization')} />
        <ProfileField icon={null} label="DEPARTMENT"
          value={editing ? form.department : profile.department}
          editing={editing} onChange={set('department')} />
      </div>
      <ProfileField icon={null} label="SPECIALTY / FOCUS AREA"
        value={editing ? form.specialty : profile.specialty}
        editing={editing} onChange={set('specialty')} placeholder="e.g. Community Health, Chronic Disease Management" />
      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">BIO</span>
        {editing ? (
          <textarea className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3} value={form.bio || ''} onChange={(e) => set('bio')(e.target.value)} placeholder="Tell participants and colleagues about your background…" />
        ) : (
          <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 whitespace-pre-wrap">{profile.bio || '—'}</span>
        )}
      </div>

      <hr className="border-slate-100 my-5" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Availability & Contact Preferences</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <div className="mb-3.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">WORKING HOURS</span>
          {editing ? (
            <div className="flex items-center gap-2">
              <input type="time" value={form.workingHours?.start || '09:00'} onChange={(e) => set('workingHours')({ ...(form.workingHours || {}), start: e.target.value })} className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-xs text-slate-300">to</span>
              <input type="time" value={form.workingHours?.end || '17:00'} onChange={(e) => set('workingHours')({ ...(form.workingHours || {}), end: e.target.value })} className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ) : (
            <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{profile.workingHours?.start || '—'} — {profile.workingHours?.end || '—'}</span>
          )}
        </div>
        <div className="mb-3.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">CONTACT PREFERENCE</span>
          {editing
            ? <ChipSelect options={['Email', 'Phone', 'Either']} value={(form.contactPreference || 'email').charAt(0).toUpperCase() + (form.contactPreference || 'email').slice(1)} onChange={(v) => set('contactPreference')(v.toLowerCase())} />
            : <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 capitalize">{profile.contactPreference || '—'}</span>}
        </div>
      </div>
      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">AVAILABLE DAYS</span>
        {editing
          ? <ChipSelect options={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} value={form.availableDays || []} onChange={set('availableDays')} multi />
          : <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{(profile.availableDays || []).join(', ') || '—'}</span>}
      </div>
    </>
  );
}

function ResearcherFields({ form, set, editing, profile }) {
  return (
    <>
      <hr className="border-slate-100 my-5" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Research Information</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <ProfileField icon={<BookIcon />} label="DEPARTMENT"
          value={editing ? form.department : profile.department}
          editing={editing} onChange={set('department')} />
        <ProfileField icon={null} label="RESEARCH FOCUS"
          value={editing ? form.research_pattern : profile.research_pattern}
          editing={editing} onChange={set('research_pattern')} />
      </div>
    </>
  );
}

function AdminFields() {
  return null;
}


/* ══════════════════════════════════════════════
   MAIN SECTIONS
   ══════════════════════════════════════════════ */

function PersonalInfoSection({ profile, onSave, role }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...profile });

  useEffect(() => { setForm({ ...profile }); }, [profile]);

  const set = (field) => (val) => setForm((prev) => ({ ...prev, [field]: val }));

  const handleSave = async () => {
    const cleaned = { ...form };
    if (cleaned.intl !== 'Yes') cleaned.country = '';
    if (cleaned.pronouns !== 'Other') cleaned.pronounsCustom = '';
    try {
      await api.updateUser({
        username: cleaned.username || undefined,
        first_name: cleaned.first_name || undefined,
        last_name: cleaned.last_name || undefined,
        email: cleaned.email || undefined,
        phone_number: cleaned.phone || undefined,
        address: cleaned.address || undefined,
      });
      onSave(cleaned);
      setEditing(false);
    } catch (err) {
      alert(err.message || 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    setForm({ ...profile });
    setEditing(false);
  };

  const RoleFields = {
    participant: ParticipantFields,
    caretaker: CaretakerFields,
    researcher: ResearcherFields,
    admin: AdminFields,
  }[role] || AdminFields;

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border mb-5 ${editing ? 'border-blue-200' : 'border-slate-100'}`}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-blue-600"><UsersIcon /></span>
          <h2 className="text-base font-bold text-slate-800">Personal Information</h2>
        </div>
        {!editing ? (
          <button className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            onClick={() => setEditing(true)}>
            <EditIcon /> Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="px-3.5 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              onClick={handleCancel}>Cancel</button>
            <button className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              onClick={handleSave}><CheckIcon /> Save</button>
          </div>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium px-4 py-2.5 rounded-lg mb-5">
          <EditIcon />
          You're editing your profile — click <strong className="mx-0.5">Save</strong> when done
        </div>
      )}

      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contact Information</p>

      <ProfileField icon={null} label="USERNAME"
        value={editing ? form.username : profile.username}
        editing={editing} onChange={set('username')}
        placeholder="Choose a username" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <ProfileField icon={<UserIcon />} label="FIRST NAME"
          value={editing ? form.first_name : profile.first_name} editing={editing} onChange={set('first_name')} />
        <ProfileField icon={<UserIcon />} label="LAST NAME"
          value={editing ? form.last_name : profile.last_name} editing={editing} onChange={set('last_name')} />
      </div>
      <ProfileField icon={<MailIcon />} label="EMAIL ADDRESS"
        value={editing ? form.email : profile.email} editing={editing} onChange={set('email')} type="email" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <ProfileField icon={<PhoneIcon />} label="PHONE NUMBER"
          value={editing ? form.phone : profile.phone} editing={editing} onChange={set('phone')} type="tel" />
        <ProfileField icon={<MapPinIcon />} label="ADDRESS"
          value={editing ? form.address : profile.address} editing={editing} onChange={set('address')} />
      </div>

      <RoleFields form={form} set={set} editing={editing} profile={profile} />
    </div>
  );
}

function AccountDetailsSection({ profile, role }) {
  const details = [
    { label: 'Username', value: `@${profile.username || 'username'}` },
    { label: 'Account Created', value: profile.created_at || '—' },
    { label: 'Last Login', value: profile.last_login || '—' },
  ];
  if (role === 'participant') {
    details.splice(1, 0,
      { label: 'Program Group', value: profile.program_group || 'Not assigned' },
      { label: 'Caretaker', value: profile.caretaker || 'Not assigned' },
    );
  }
  if (role === 'caretaker') {
    details.splice(1, 0,
      { label: 'Assigned Group', value: profile.groupName || 'Not assigned' },
      { label: 'Last Report Generated', value: profile.lastReportGenerated || 'None' },
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-blue-600"><ShieldIcon /></span>
        <h2 className="text-base font-bold text-slate-800">Account Details</h2>
      </div>
      {role === 'caretaker' && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-3 text-center">
            <p className="text-2xl font-extrabold text-emerald-600">{profile.participantCount || 0}</p>
            <p className="text-xs text-emerald-500 mt-0.5">Participants</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-3 text-center">
            <p className="text-2xl font-extrabold text-blue-600">{profile.activeParticipants || 0}</p>
            <p className="text-xs text-blue-500 mt-0.5">Active</p>
          </div>
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-3 text-center">
            <p className="text-2xl font-extrabold text-indigo-600">{(profile.participantCount || 0) - (profile.activeParticipants || 0)}</p>
            <p className="text-xs text-indigo-500 mt-0.5">Inactive</p>
          </div>
        </div>
      )}
      <div>
        {details.map((d, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-b-0 last:pb-0">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{d.label}</span>
            <span className="text-sm text-slate-700 font-medium">{d.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between py-3">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">MFA Status</span>
          <span className={`flex items-center gap-1.5 text-xs font-bold ${profile.mfa_enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full ${profile.mfa_enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {profile.mfa_enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const [form, setForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [show, setShow] = useState({ current: false, newPwd: false, confirm: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (field) => (val) => { setForm({ ...form, [field]: val }); setError(''); setSuccess(''); };
  const toggle = (field) => () => setShow({ ...show, [field]: !show[field] });

  const handleSubmit = async () => {
    if (!form.current) { setError('Current password is required.'); return; }
    const failed = PASSWORD_RULES.filter((r) => !r.test(form.newPwd));
    if (failed.length) { setError('New password must have: ' + failed.map((r) => r.label).join(', ')); return; }
    if (form.newPwd !== form.confirm) { setError('New passwords do not match.'); return; }
    try {
      await api.updateUser({
        old_password: form.current,
        new_password: form.newPwd,
      });
      setSuccess('Password updated successfully.');
      setForm({ current: '', newPwd: '', confirm: '' });
    } catch (err) {
      setError(err.message || 'Failed to update password');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-blue-600"><LockIcon /></span>
        <h2 className="text-base font-bold text-slate-800">Change Password</h2>
      </div>
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs font-medium px-4 py-2.5 rounded-lg mb-4">{error}</div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium px-4 py-2.5 rounded-lg mb-4">{success}</div>
      )}
      <PasswordField label="CURRENT PASSWORD" placeholder="Enter current password"
        value={form.current} show={show.current} onToggle={toggle('current')} onChange={set('current')} />
      <PasswordField label="NEW PASSWORD" placeholder="Enter new password"
        value={form.newPwd} show={show.newPwd} onToggle={toggle('newPwd')} onChange={set('newPwd')} />
      <PasswordField label="CONFIRM NEW PASSWORD" placeholder="Confirm new password"
        value={form.confirm} show={show.confirm} onToggle={toggle('confirm')} onChange={set('confirm')} />
      <div className="flex flex-wrap gap-x-1.5 text-xs text-slate-400 mb-4">
        {PASSWORD_RULES.map((rule, i) => (
          <span key={i} className={`transition-colors ${form.newPwd && rule.test(form.newPwd) ? 'text-emerald-600 font-medium' : ''}`}>
            {rule.label}{i < PASSWORD_RULES.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </div>
      <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
        onClick={handleSubmit}>Update Password</button>
    </div>
  );
}

function SecuritySection() {
  const [mfaEnabled, setMfaEnabled] = useState(true);
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-blue-600"><ShieldIcon /></span>
        <h2 className="text-base font-bold text-slate-800">Security</h2>
      </div>
      <div className="flex items-center justify-between py-3 border-b border-slate-50">
        <span className="text-sm text-slate-600">Multi-Factor Authentication (MFA)</span>
        <ToggleSwitch checked={mfaEnabled} onChange={() => setMfaEnabled(!mfaEnabled)} />
      </div>
      {mfaEnabled && (
        <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium mt-3 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5">
          <CheckCircleIcon /> <span>MFA is active via email verification</span>
        </div>
      )}
    </div>
  );
}

function NotificationsSection({ role }) {
  const [prefs, setPrefs] = useState({
    email: true, survey: true, weekly: false, receiveResults: true,
    newSubmission: true, flagAlerts: true, goalDeadlines: true,
    weeklyGroupSummary: true, participantInactivity: true,
    inviteAccepted: true, monthlyReport: false,
  });
  const toggle = (key) => () => setPrefs({ ...prefs, [key]: !prefs[key] });
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-blue-600"><BellIcon /></span>
        <h2 className="text-base font-bold text-slate-800">Notifications</h2>
      </div>
      <div className="flex items-center justify-between py-3 border-b border-slate-50">
        <span className="text-sm text-slate-600">Email notifications</span>
        <ToggleSwitch checked={prefs.email} onChange={toggle('email')} />
      </div>
      {role !== 'caretaker' && (
        <>
          <div className="flex items-center justify-between py-3 border-b border-slate-50">
            <span className="text-sm text-slate-600">Survey reminders</span>
            <ToggleSwitch checked={prefs.survey} onChange={toggle('survey')} />
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-600">Weekly progress report</span>
            <ToggleSwitch checked={prefs.weekly} onChange={toggle('weekly')} />
          </div>
        </>
      )}
      {role === 'participant' && (
        <>
          <div className="border-t border-slate-100 mt-3 pt-3 mb-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Study</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="text-sm text-slate-600">Receive study results</span>
              <p className="text-xs text-slate-400 mt-0.5">Get notified when study results are available</p>
            </div>
            <ToggleSwitch checked={prefs.receiveResults} onChange={toggle('receiveResults')} />
          </div>
        </>
      )}
      {role === 'caretaker' && (
        <>
          <div className="border-t border-slate-100 mt-4 pt-4 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Participant Activity</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-50">
            <div>
              <span className="text-sm text-slate-600">New form submission</span>
              <p className="text-xs text-slate-400 mt-0.5">Get notified when a participant submits a survey</p>
            </div>
            <ToggleSwitch checked={prefs.newSubmission} onChange={toggle('newSubmission')} />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-50">
            <div>
              <span className="text-sm text-slate-600">Flag & alert notifications</span>
              <p className="text-xs text-slate-400 mt-0.5">High BP, elevated pain, or other health alerts</p>
            </div>
            <ToggleSwitch checked={prefs.flagAlerts} onChange={toggle('flagAlerts')} />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-50">
            <div>
              <span className="text-sm text-slate-600">Participant inactivity</span>
              <p className="text-xs text-slate-400 mt-0.5">Alert when a participant hasn't been active for 2+ weeks</p>
            </div>
            <ToggleSwitch checked={prefs.participantInactivity} onChange={toggle('participantInactivity')} />
          </div>
          <div className="border-t border-slate-100 mt-4 pt-4 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Goals & Reports</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-50">
            <div>
              <span className="text-sm text-slate-600">Goal deadline reminders</span>
              <p className="text-xs text-slate-400 mt-0.5">Remind when participant health goals are approaching their target date</p>
            </div>
            <ToggleSwitch checked={prefs.goalDeadlines} onChange={toggle('goalDeadlines')} />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-50">
            <div>
              <span className="text-sm text-slate-600">Weekly group summary</span>
              <p className="text-xs text-slate-400 mt-0.5">Receive a weekly digest of group activity every Monday</p>
            </div>
            <ToggleSwitch checked={prefs.weeklyGroupSummary} onChange={toggle('weeklyGroupSummary')} />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-50">
            <div>
              <span className="text-sm text-slate-600">Monthly auto-report</span>
              <p className="text-xs text-slate-400 mt-0.5">Automatically generate and email a group report on the 1st of each month</p>
            </div>
            <ToggleSwitch checked={prefs.monthlyReport} onChange={toggle('monthlyReport')} />
          </div>
          <div className="border-t border-slate-100 mt-4 pt-4 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin & Invites</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="text-sm text-slate-600">Invite accepted</span>
              <p className="text-xs text-slate-400 mt-0.5">Get notified when an invited participant registers</p>
            </div>
            <ToggleSwitch checked={prefs.inviteAccepted} onChange={toggle('inviteAccepted')} />
          </div>
        </>
      )}
    </div>
  );
}

function DangerZoneSection() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-rose-200 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-rose-600"><TrashIcon /></span>
        <h2 className="text-base font-bold text-rose-600">Danger Zone</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Deactivating your account will remove access to all health data and reports.
        This action requires administrator approval and may not be reversible.
      </p>
      <button className="px-4 py-2.5 text-sm font-medium text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors">
        Request Account Deactivation
      </button>
    </div>
  );
}


/* ══════════════════════════════════════════════
   MAIN PAGE EXPORT
   Pure content — renders inside a layout's <Outlet />.
   ══════════════════════════════════════════════ */
export default function ProfilePage({ role = 'participant' }) {
  const location = useLocation();
  const [tab, setTab] = useState(location.hash === '#settings' ? 'settings' : 'profile');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE });

  useEffect(() => {
    api.me()
      .then((user) => {
        setProfile((prev) => ({
          ...prev,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || '',
          username: user.username || '',
          phone: user.phone || '',
          // TODO: populate role-specific fields from GET /profile/:role API
        }));
      })
      .catch(() => {
        setProfile(DEV_PROFILES[role] || DEV_PROFILES.participant);
      })
      .finally(() => setLoading(false));
  }, [role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400 text-base">Loading...</p>
      </div>
    );
  }

  const initials = [profile.first_name, profile.last_name]
    .filter(Boolean).map((n) => n[0]).join('').toUpperCase() || '??';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-5 mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xl font-bold shrink-0">
          {initials}
        </div>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">{role === 'caretaker' && profile.title ? `${profile.title} ` : ''}{profile.first_name} {profile.last_name}</h1>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {roleLabel}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">@{profile.username || 'username'}{role === 'caretaker' && profile.credentials ? ` · ${profile.credentials}` : ''}</p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Active</span>
            <span className="mx-1">·</span>
            {role === 'caretaker' && profile.groupName && (<><span>{profile.groupName}</span><span className="mx-1">·</span><span>{profile.participantCount || 0} participants</span><span className="mx-1">·</span></>)}
            <span>Enrolled {profile.enrolled_at || '—'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-100 mb-6">
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            tab === 'profile'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`}
          onClick={() => setTab('profile')}
        >Profile</button>
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            tab === 'settings'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`}
          onClick={() => setTab('settings')}
        >Settings</button>
      </div>

      {/* Tab content */}
      {tab === 'profile' ? (
        <>
          <PersonalInfoSection profile={profile} onSave={setProfile} role={role} />
          <AccountDetailsSection profile={profile} role={role} />
        </>
      ) : (
        <>
          <ChangePasswordSection />
          <SecuritySection />
          <NotificationsSection role={role} />
          <DangerZoneSection />
        </>
      )}
    </div>
  );
}
