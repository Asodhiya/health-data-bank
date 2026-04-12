import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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
const LockIcon        = () => <Ico size={16} d={<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>} />;
const EyeIcon         = () => <Ico size={16} d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>} />;
const EyeOffIcon      = () => <Ico size={16} d={<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>} />;
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



/* ── Dev fallback data per role ── */
const DEV_PROFILES = {
  participant: {
    first_name: 'Josh', last_name: 'Thompson',
    email: 'josh.thompson@upei.ca', phone: '902-555-0147',
    address: '42 University Ave, Charlottetown, PE',
    dob: '1998-03-15', sex: 'Male', pronouns: 'He/Him', pronounsCustom: '',
    language: 'English', country_of_origin: 'Canada',
    living_arrangement: 'Alone', dependents: 0, occupation_status: 'Student',
    marital_status: 'Single', highest_education_level: 'Some college/university',
    title: '', organization: '', department: '', research_pattern: '',
    username: 'josh_wellness',
    program_group: 'Group 7 — Connections for Healthy Living',
    caretaker: 'Dr. William Montelpare',
    created_at: 'Nov 20, 2025', last_login: 'Feb 5, 2026 at 2:34 PM',
    enrolled_at: 'Dec 1, 2025',
  },
  caretaker: {
    first_name: 'William', last_name: 'Montelpare',
    email: 'w.montelpare@upei.ca', phone: '902-566-0001',
    address: '550 University Ave, Charlottetown, PE C1A 4P3',
    dob: '', sex: '', pronouns: '', pronounsCustom: '',
    language: '',
    living_arrangement: '', dependents: 0, occupation_status: '',
    marital_status: '', highest_education_level: '',
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
    enrolled_at: 'Oct 5, 2025',
  },
  researcher: {
    first_name: 'Sarah', last_name: 'Chen',
    email: 's.chen@upei.ca', phone: '902-566-0042',
    address: '', dob: '', sex: '', pronouns: '', pronounsCustom: '',
    language: '',
    living_arrangement: '', dependents: 0, occupation_status: '',
    marital_status: '', highest_education_level: '',
    title: 'Dr.', organization: 'UPEI Faculty of Science',
    department: 'Applied Health Sciences', specialty: 'Community wellness longitudinal studies',
    credentials: 'PhD', bio: '',
    username: 'sarah_research',
    program_group: '', caretaker: '',
    created_at: 'Oct 10, 2025', last_login: 'Feb 4, 2026 at 3:45 PM',
    enrolled_at: 'Oct 10, 2025',
  },
  admin: {
    first_name: 'Admin', last_name: 'User',
    email: 'admin@upei.ca', phone: '902-566-0000',
    address: '', dob: '', sex: '', pronouns: '', pronounsCustom: '',
    language: '',
    living_arrangement: '', dependents: 0, occupation_status: '',
    marital_status: '', highest_education_level: '',
    title: 'Ms.', organization: 'Health Data Bank', department: 'Operations',
    role_title: 'System Administrator', bio: '', contactPreference: 'email',
    username: 'sys_admin',
    program_group: '', caretaker: '',
    created_at: 'Sep 1, 2025', last_login: 'Feb 5, 2026 at 8:00 AM',
    enrolled_at: 'Sep 1, 2025',
  },
};


/* ── Empty profile template ── */
const EMPTY_PROFILE = {
  first_name: '', last_name: '', email: '', phone: '', address: '',
  dob: '', sex: '', pronouns: '', pronounsCustom: '',
  language: '', country_of_origin: '',
  living_arrangement: '', dependents: 0, occupation_status: '',
  marital_status: '', highest_education_level: '',
  title: '', organization: '', department: '', role_title: '',
  specialty: '', credentials: '', bio: '',
  username: '', program_group: '', caretaker: '',
  groupName: '', participantCount: 0, activeParticipants: 0,
  lastReportGenerated: '',
  workingHours: { start: '09:00', end: '17:00' },
  availableDays: [],
  contactPreference: 'email',
  created_at: '', last_login: '', enrolled_at: '',
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

function ProfileField({ icon, label, value, editing, onChange, type = 'text', placeholder = '', maxLength }) {
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
            maxLength={maxLength}
          />
        ) : (
          <span className={`block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden text-ellipsis whitespace-nowrap ${icon ? 'pl-10 pr-3' : 'px-3'}`}>
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

/* ══════════════════════════════════════════════
   ROLE-SPECIFIC FIELD BLOCKS
   Rendered below Contact Information.
   Each role sees different fields based on their
   database profile table.
   ══════════════════════════════════════════════ */

function ParticipantFields({ form, set, editing, profile, intakeProfileFields = [] }) {
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

      <div className="mb-3.5">
        <ProfileField icon={null} label="LANGUAGE AT HOME"
          value={editing ? form.language : profile.language} editing={editing} onChange={set('language')} />
      </div>

      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">COUNTRY OF ORIGIN</span>
        <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">
          {profile.country_of_origin || '—'}
        </span>
      </div>

      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">LIVING ARRANGEMENT</span>
        <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">
          {profile.living_arrangement || '—'}
        </span>
      </div>

      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">NUMBER OF DEPENDENTS</span>
        <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">
          {profile.dependents != null ? profile.dependents : '—'}
        </span>
      </div>

      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">EMPLOYMENT STATUS</span>
        <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">
          {profile.occupation_status || '—'}
        </span>
      </div>

      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">MARITAL STATUS</span>
        <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">
          {profile.marital_status || '—'}
        </span>
      </div>

      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">HIGHEST EDUCATION LEVEL</span>
        <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">
          {profile.highest_education_level || '—'}
        </span>
      </div>

      {intakeProfileFields.map((field, i) => (
        <div key={i} className="mb-3.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            {field.label.toUpperCase()}
          </span>
          <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">
            {field.value || '—'}
          </span>
        </div>
      ))}
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
        <ProfileField icon={null} label="LICENSE / CREDENTIALS"
          value={editing ? form.credentials : profile.credentials}
          editing={editing} onChange={set('credentials')} placeholder="e.g. PhD, RN, CSEP-CEP" maxLength={50} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <ProfileField icon={<BriefcaseIcon />} label="ORGANIZATION"
          value={editing ? form.organization : profile.organization}
          editing={editing} onChange={set('organization')} maxLength={50} />
        <ProfileField icon={null} label="DEPARTMENT"
          value={editing ? form.department : profile.department}
          editing={editing} onChange={set('department')} maxLength={50} />
      </div>
      <ProfileField icon={null} label="SPECIALTY / FOCUS AREA"
        value={editing ? form.specialty : profile.specialty}
        editing={editing} onChange={set('specialty')} placeholder="e.g. Community Health, Chronic Disease Management" maxLength={80} />
      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">BIO</span>
        {editing ? (
          <>
            <textarea className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-40 overflow-y-auto"
              rows={3} value={form.bio || ''} onChange={(e) => set('bio')(e.target.value)} placeholder="Tell participants and colleagues about your background…" maxLength={300} />
            <p className="text-xs text-slate-400 mt-1 text-right">{(form.bio || '').length}/300</p>
          </>
        ) : (
          <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 whitespace-pre-wrap max-h-32 overflow-y-auto">{profile.bio || '—'}</span>
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
        <div className="mb-3.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">TITLE</span>
          {editing
            ? <ChipSelect options={['Dr.', 'Prof.', 'Mr.', 'Ms.', 'Mx.']} value={form.title} onChange={set('title')} />
            : <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{profile.title || '—'}</span>}
        </div>
        <ProfileField icon={null} label="LICENSE / CREDENTIALS"
          value={editing ? form.credentials : profile.credentials}
          editing={editing} onChange={set('credentials')} placeholder="e.g. PhD, MSc" maxLength={50} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <ProfileField icon={<BriefcaseIcon />} label="ORGANIZATION"
          value={editing ? form.organization : profile.organization}
          editing={editing} onChange={set('organization')} maxLength={50} />
        <ProfileField icon={<BookIcon />} label="DEPARTMENT"
          value={editing ? form.department : profile.department}
          editing={editing} onChange={set('department')} maxLength={50} />
      </div>
      <ProfileField icon={null} label="RESEARCH FOCUS"
        value={editing ? form.specialty : profile.specialty}
        editing={editing} onChange={set('specialty')} placeholder="e.g. Community Health, Aging, Exercise Science" maxLength={80} />
      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">BIO</span>
        {editing ? (
          <>
            <textarea className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-40 overflow-y-auto"
              rows={3} value={form.bio || ''} onChange={(e) => set('bio')(e.target.value)} placeholder="Tell participants and colleagues about your research background…" maxLength={300} />
            <p className="text-xs text-slate-400 mt-1 text-right">{(form.bio || '').length}/300</p>
          </>
        ) : (
          <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 whitespace-pre-wrap max-h-32 overflow-y-auto">{profile.bio || '—'}</span>
        )}
      </div>
    </>
  );
}

function AdminFields({ form, set, editing, profile }) {
  return (
    <>
      <hr className="border-slate-100 my-5" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Administrative Information</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <div className="mb-3.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">TITLE</span>
          {editing
            ? <ChipSelect options={['Mr.', 'Ms.', 'Mrs.', 'Mx.', 'Dr.', 'Prof.']} value={form.title} onChange={set('title')} />
            : <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{profile.title || '—'}</span>}
        </div>
        <ProfileField icon={null} label="ROLE TITLE"
          value={editing ? form.role_title : profile.role_title}
          editing={editing} onChange={set('role_title')} placeholder="e.g. System Administrator" maxLength={50} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <ProfileField icon={<BriefcaseIcon />} label="ORGANIZATION"
          value={editing ? form.organization : profile.organization}
          editing={editing} onChange={set('organization')} maxLength={50} />
        <ProfileField icon={<BookIcon />} label="DEPARTMENT"
          value={editing ? form.department : profile.department}
          editing={editing} onChange={set('department')} maxLength={50} />
      </div>
      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">BIO</span>
        {editing ? (
          <>
            <textarea className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-40 overflow-y-auto"
              rows={3} value={form.bio || ''} onChange={(e) => set('bio')(e.target.value)} placeholder="A brief description of your role and responsibilities…" maxLength={300} />
            <p className="text-xs text-slate-400 mt-1 text-right">{(form.bio || '').length}/300</p>
          </>
        ) : (
          <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 whitespace-pre-wrap max-h-32 overflow-y-auto">{profile.bio || '—'}</span>
        )}
      </div>
      <div className="mb-3.5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">CONTACT PREFERENCE</span>
        {editing
          ? <ChipSelect options={['Email', 'Phone', 'In-App']} value={form.contactPreference === 'in_app' ? 'In-App' : (form.contactPreference || 'email').charAt(0).toUpperCase() + (form.contactPreference || 'email').slice(1)} onChange={(v) => set('contactPreference')(v === 'In-App' ? 'in_app' : v.toLowerCase())} />
          : <span className="block py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3">{profile.contactPreference === 'in_app' ? 'In-App' : (profile.contactPreference || '—')}</span>}
      </div>
    </>
  );
}


/* ══════════════════════════════════════════════
   MAIN SECTIONS
   ══════════════════════════════════════════════ */

function PersonalInfoSection({ profile, onSave, role, intakeProfileFields = [] }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...profile });

  useEffect(() => { setForm({ ...profile }); }, [profile]);

  const set = (field) => (val) => setForm((prev) => ({ ...prev, [field]: val }));

  const handleSave = async () => {
    const cleaned = { ...form };
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
      if (role === 'participant') {
        await api.participantUpdateProfile({
          dob: cleaned.dob || undefined,
          gender: cleaned.sex || undefined,
          pronouns: cleaned.pronouns === 'Other' ? (cleaned.pronounsCustom || 'Other') : (cleaned.pronouns || undefined),
          primary_language: cleaned.language || undefined,
          country_of_origin: cleaned.country_of_origin || undefined,
          living_arrangement: cleaned.living_arrangement || undefined,
          dependents: cleaned.dependents,
          occupation_status: cleaned.occupation_status || undefined,
          marital_status: cleaned.marital_status || undefined,
          highest_education_level: cleaned.highest_education_level || undefined,
          address: cleaned.address || undefined,
        });
      }
      if (role === 'caretaker') {
        await api.caretakerUpdateProfile({
          title: cleaned.title || null,
          credentials: cleaned.credentials || null,
          organization: cleaned.organization || null,
          department: cleaned.department || null,
          specialty: cleaned.specialty || null,
          bio: cleaned.bio || null,
          working_hours_start: cleaned.workingHours?.start || null,
          working_hours_end: cleaned.workingHours?.end || null,
          contact_preference: cleaned.contactPreference || null,
          available_days: cleaned.availableDays || [],
        });
      }
      if (role === 'researcher') {
        await api.researcherUpdateProfile({
          title: cleaned.title || null,
          credentials: cleaned.credentials || null,
          organization: cleaned.organization || null,
          department: cleaned.department || null,
          specialty: cleaned.specialty || null,
          bio: cleaned.bio || null,
        });
      }
      if (role === 'admin') {
        await api.adminUpdateProfile({
          title: cleaned.title || null,
          role_title: cleaned.role_title || null,
          department: cleaned.department || null,
          organization: cleaned.organization || null,
          bio: cleaned.bio || null,
          contact_preference: cleaned.contactPreference || null,
        });
      }
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
          value={editing ? form.first_name : profile.first_name} editing={editing} onChange={set('first_name')} maxLength={30} />
        <ProfileField icon={<UserIcon />} label="LAST NAME"
          value={editing ? form.last_name : profile.last_name} editing={editing} onChange={set('last_name')} maxLength={30} />
      </div>
      <ProfileField icon={<MailIcon />} label="EMAIL ADDRESS"
        value={editing ? form.email : profile.email} editing={editing} onChange={set('email')} type="email" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <ProfileField icon={<PhoneIcon />} label="PHONE NUMBER"
          value={editing ? form.phone : profile.phone} editing={editing} onChange={set('phone')} type="tel" />
        <ProfileField icon={<MapPinIcon />} label="ADDRESS"
          value={editing ? form.address : profile.address} editing={editing} onChange={set('address')} />
      </div>

      <RoleFields form={form} set={set} editing={editing} profile={profile} intakeProfileFields={intakeProfileFields} />
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
        <span className="text-blue-600"><UserIcon /></span>
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

function DangerZoneSection({ role, onDeactivate }) {
  const [step, setStep] = useState(0); // 0 = idle, 1 = confirm modal, 2 = type confirm
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const CONFIRM_WORD = 'DEACTIVATE';

  function openModal() { setStep(1); setTyped(''); setError(''); }
  function closeModal() { if (loading) return; setStep(0); setTyped(''); setError(''); }

  async function handleConfirm() {
    if (typed !== CONFIRM_WORD) { setError(`Type ${CONFIRM_WORD} exactly to confirm.`); return; }
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await onDeactivate?.();
    } catch (err) {
      setError(err?.message || 'Could not deactivate account. Please try again.');
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-rose-200 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-rose-600"><TrashIcon /></span>
          <h2 className="text-base font-bold text-rose-600">Danger Zone</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Deactivating your account will disable login access while keeping your records in the system.
          An admin can still review and reactivate the account later if needed.
        </p>
        <button
          onClick={openModal}
          className="px-4 py-2.5 text-sm font-medium text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors"
        >
          Deactivate Account
        </button>
      </div>

      {/* ── Confirmation Modal ── */}
      {step > 0 && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeModal}>
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Deactivate your account?</h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    This will immediately lock you out. Your data stays in the system and an admin can reactivate the account later.
                  </p>
                </div>
              </div>

              {/* What happens list */}
              <ul className="bg-rose-50 rounded-xl px-4 py-3 space-y-1.5 text-xs text-rose-700 font-medium border border-rose-100">
                <li className="flex items-center gap-2"><span>✕</span> You will be logged out immediately</li>
                <li className="flex items-center gap-2"><span>✕</span> Login access will be disabled</li>
                <li className="flex items-center gap-2"><span>✓</span> Your health data and records are kept safe</li>
                <li className="flex items-center gap-2"><span>✓</span> An admin can reactivate the account</li>
              </ul>

              {/* Type to confirm */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  Type <span className="font-black text-rose-600 tracking-widest">{CONFIRM_WORD}</span> to confirm
                </label>
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => { setTyped(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  placeholder={CONFIRM_WORD}
                  autoFocus
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm font-mono font-bold tracking-widest focus:outline-none focus:ring-2 transition-all ${
                    error ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200 focus:ring-rose-100 focus:border-rose-400'
                  }`}
                />
                {error && <p className="text-xs text-rose-500 font-medium mt-1.5">{error}</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={closeModal}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading || typed !== CONFIRM_WORD}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? 'Deactivating…' : 'Yes, deactivate'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}


/* ══════════════════════════════════════════════
   MAIN PAGE EXPORT
   Pure content — renders inside a layout's <Outlet />.
   ══════════════════════════════════════════════ */
export default function ProfilePage({ role = 'participant' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [tab, setTab] = useState(location.hash === '#settings' ? 'settings' : 'profile');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE });
  const [intakeProfileFields, setIntakeProfileFields] = useState([]);

  const handleSelfDeactivate = async () => {
    await api.selfDeactivateAccount();
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const user = await api.me();
        if (cancelled) return;
        const fmt = (iso) => {
          if (!iso) return '';
          const d = new Date(iso);
          return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        };
        setProfile((prev) => ({
          ...prev,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || '',
          username: user.username || '',
          phone: user.phone || '',
          address: user.address || '',
          created_at: fmt(user.created_at),
          last_login: fmt(user.last_login_at),
        }));

        // Load participant profile data
        if (role === 'participant') {
          try {
            const [p, careTeam, intakeFields] = await Promise.all([
              api.participantGetProfile().catch(() => null),
              api.participantGetCareTeam().catch(() => null),
              api.getProfileIntakeFields().catch(() => null),
            ]);
            if (cancelled) return;
            if (p) {
              const firstGroup = careTeam?.groups?.[0] || null;
              setProfile((prev) => ({
                ...prev,
                dob: p.dob || '',
                sex: p.gender || '',
                pronouns: p.pronouns || '',
                language: p.primary_language || '',
                country_of_origin: p.country_of_origin || '',
                living_arrangement: p.living_arrangement || '',
                dependents: p.dependents ?? 0,
                occupation_status: p.occupation_status || '',
                marital_status: p.marital_status || '',
                highest_education_level: p.highest_education_level || '',
                enrolled_at: p.program_enrolled_at || prev.enrolled_at || '',
                program_group: firstGroup?.group_name || '',
                caretaker: firstGroup?.caretaker?.name || '',
              }));
            }
            if (intakeFields?.fields?.length) {
              setIntakeProfileFields(intakeFields.fields);
            }
          } catch {
            // Non-critical
          }
        }

        // Load caretaker-specific data from real endpoints
        if (role === 'caretaker') {
          try {
            const [caretakerProfile, groupData, participantSummary] = await Promise.all([
              api.caretakerGetProfile().catch(() => null),
              api.caretakerGetGroups().catch(() => []),
              api.caretakerGetParticipantsSummary().catch(() => ({ total: 0, active: 0 })),
            ]);
            if (cancelled) return;
            const groups = Array.isArray(groupData) ? groupData : [];
            const totalCount = Number(participantSummary?.total || 0);
            const activeCount = Number(participantSummary?.active || 0);
            setProfile((prev) => ({
              ...prev,
              ...(caretakerProfile ? {
                title: caretakerProfile.title || '',
                credentials: caretakerProfile.credentials || '',
                organization: caretakerProfile.organization || '',
                department: caretakerProfile.department || '',
                specialty: caretakerProfile.specialty || '',
                bio: caretakerProfile.bio || '',
                workingHours: {
                  start: caretakerProfile.working_hours_start || '09:00',
                  end: caretakerProfile.working_hours_end || '17:00',
                },
                contactPreference: caretakerProfile.contact_preference || 'email',
                availableDays: caretakerProfile.available_days || [],
              } : {}),
              groupName: groups.length === 1 ? groups[0].name : `${groups.length} groups`,
              participantCount: totalCount,
              activeParticipants: activeCount,
            }));
          } catch {
            // Non-critical — header will show defaults
          }
        }

        if (role === 'researcher') {
          try {
            const researcherProfile = await api.researcherGetProfile().catch(() => null);
            if (cancelled) return;
            if (researcherProfile) {
              setProfile((prev) => ({
                ...prev,
                title: researcherProfile.title || '',
                credentials: researcherProfile.credentials || '',
                organization: researcherProfile.organization || '',
                department: researcherProfile.department || '',
                specialty: researcherProfile.specialty || '',
                bio: researcherProfile.bio || '',
              }));
            }
          } catch {
            // Non-critical
          }
        }

        if (role === 'admin') {
          try {
            const adminProfile = await api.adminGetProfile().catch(() => null);
            if (cancelled) return;
            if (adminProfile) {
              setProfile((prev) => ({
                ...prev,
                title: adminProfile.title || '',
                role_title: adminProfile.role_title || '',
                department: adminProfile.department || '',
                organization: adminProfile.organization || '',
                bio: adminProfile.bio || '',
                contactPreference: adminProfile.contact_preference || 'email',
              }));
            }
          } catch {
            // Non-critical
          }
        }
      } catch {
        if (cancelled) return;
        setProfile(DEV_PROFILES[role] || DEV_PROFILES.participant);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProfile();
    return () => { cancelled = true; };
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800 truncate max-w-full">{role === 'caretaker' && profile.title ? `${profile.title} ` : ''}{profile.first_name} {profile.last_name}</h1>
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
          <PersonalInfoSection profile={profile} onSave={setProfile} role={role} intakeProfileFields={intakeProfileFields} />
          <AccountDetailsSection profile={profile} role={role} />
        </>
      ) : (
        <>
          <ChangePasswordSection />
          <DangerZoneSection role={role} onDeactivate={handleSelfDeactivate} />
        </>
      )}
    </div>
  );
}
