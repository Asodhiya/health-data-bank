import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

// ── Metadata ────────────────────────────────────────────────────────────────
// When terms content is updated, bump `version` and update the dates. When
// substantive changes require REB re-approval, wait for approval before
// changing `effectiveDate` to match the approval date.
const METADATA = {
  lastUpdated: "April 14, 2026",
  version: "1.2",
  rebFileNumber: "24-139",
  effectiveDate: "April 1, 2026",
};

// ── Contact cards (rendered inside section 14) ──────────────────────────────
const CONTACTS = [
  {
    name: "Dr. William Montelpare",
    title: "Principal Investigator, Connections for Healthy Living",
    affiliation: "Faculty of Applied Human Sciences, University of Prince Edward Island",
    email: "w.montelpare@upei.ca",
    phone: "(902) 620-5000 ext. 0419",
  },
  {
    name: "UPEI Research Ethics Board",
    title: "For concerns about your treatment or rights as a research participant",
    email: "reb@upei.ca",
    phone: "(902) 620-5104",
  },
  {
    name: "UPEI Privacy Officer",
    title: "For questions about how your personal information is collected, used, or disclosed",
    email: "privacy@upei.ca",
    phone: "(902) 566-0949",
  },
];

// ── Section content ─────────────────────────────────────────────────────────
// Each section is {id, number, heading, body}. To add, remove, or reorder
// sections, edit this array. The TOC and the section renderer both derive
// from it, so they stay in sync automatically.
//
// When migrating to a database-backed version, replace this constant with
// a useState initialized from an API fetch — the rendering code below does
// not need to change.
const SECTIONS = [
  {
    id: "s1",
    number: 1,
    heading: "About this platform",
    body: (
      <p>
        Health Data Bank is a secure research platform operated by the University of Prince Edward Island
        (UPEI) in support of the Connections for Healthy Living study, led by Dr. William Montelpare,
        Faculty of Applied Human Sciences. The platform allows participants, caretakers, researchers, and
        administrators to collect, review, and analyze health-related information contributed by enrolled
        study participants. Health Data Bank is not a medical device, does not provide medical advice, and
        is not a substitute for professional healthcare. If you have an urgent medical concern, please
        contact your healthcare provider or local emergency services.
      </p>
    ),
  },
  {
    id: "s2",
    number: 2,
    heading: "About this research study",
    body: (
      <p>
        The Connections for Healthy Living study examines how community-based wellness programs influence
        the physical and mental health of older adults living in Prince Edward Island. The study is
        expected to run for approximately 36 months and has received ethics approval from the UPEI
        Research Ethics Board under file number {METADATA.rebFileNumber}. Funding is provided in part by
        the Canadian Institutes of Health Research and the Prince Edward Island Research Council. The
        study team is independent of any commercial sponsor.
      </p>
    ),
  },
  {
    id: "s3",
    number: 3,
    heading: "Eligibility",
    body: (
      <>
        <p className="mb-2">
          Participation is open to individuals who have been invited by an authorized caretaker or study
          administrator and who meet all of the following:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>You are at least 18 years of age.</li>
          <li>You are currently a resident of Prince Edward Island.</li>
          <li>You are capable of providing informed consent in English.</li>
          <li>You have received and accepted an invitation from an authorized study caretaker.</li>
        </ul>
        <p>
          Accounts obtained outside the formal invitation process may be suspended without notice. If
          eligibility criteria change during the course of the study, you will be notified and, where
          appropriate, offered the option to continue or withdraw.
        </p>
      </>
    ),
  },
  {
    id: "s4",
    number: 4,
    heading: "What participation involves",
    body: (
      <>
        <p className="mb-2">Over the course of your enrollment, you may be asked to:</p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>Complete a one-time onboarding intake form with basic profile and demographic information.</li>
          <li>Respond to periodic surveys assigned to your participant group, typically every two to four weeks.</li>
          <li>Optionally track personal health goals (e.g., daily step count, sleep duration, blood pressure readings).</li>
          <li>Review feedback and notes left by your assigned caretaker.</li>
        </ul>
        <p>
          The estimated time commitment is approximately 15 to 30 minutes per week, though this varies
          depending on which goals and surveys you choose to engage with. Participation is self-paced and
          you may skip or defer any activity without penalty.
        </p>
      </>
    ),
  },
  {
    id: "s5",
    number: 5,
    heading: "Data we collect",
    body: (
      <>
        <p className="mb-2">With your consent, the platform collects and stores the following information:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>
            <strong className="font-semibold text-slate-800">Profile information</strong> you provide
            during onboarding, including your name, date of birth, contact details, and demographic
            responses such as gender identity and preferred language.
          </li>
          <li>
            <strong className="font-semibold text-slate-800">Health-related responses</strong> submitted
            through surveys assigned to your group.
          </li>
          <li>
            <strong className="font-semibold text-slate-800">Goal progress and health readings</strong>{" "}
            that you choose to log, such as daily activity counts, mood ratings, or blood pressure
            measurements.
          </li>
          <li>
            <strong className="font-semibold text-slate-800">Technical metadata</strong> required to
            secure your account, including login timestamps, approximate IP-derived location, and device
            type. This metadata is used only for security auditing and is not analyzed for research
            purposes.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "s6",
    number: 6,
    heading: "How your data is used",
    body: (
      <p>
        Your identifiable information is visible only to you, your assigned caretaker, and authorized
        platform administrators. Researchers analyzing study outcomes work with pseudonymized data —
        your real name and contact details are never shown in research dashboards or data exports.
        Aggregate findings may be published in academic journals, conference proceedings, or reports to
        funding agencies, but no individual participant will be identifiable in any publication. Your
        data will not be used for any purpose outside the Connections for Healthy Living study without
        obtaining your separate, explicit consent.
      </p>
    ),
  },
  {
    id: "s7",
    number: 7,
    heading: "Confidentiality and security",
    body: (
      <p>
        All data is stored on encrypted servers hosted within Canada, in accordance with UPEI's data
        residency requirements for research involving human participants. Access to identifiable data is
        restricted by role-based permissions and logged for audit purposes. Platform staff complete annual
        privacy and security training. No information is sold, rented, or shared with commercial third
        parties. In the unlikely event of a data breach, affected participants will be notified in writing
        within 30 days in accordance with UPEI policy and the federal Personal Information Protection and
        Electronic Documents Act (PIPEDA).
      </p>
    ),
  },
  {
    id: "s8",
    number: 8,
    heading: "Data retention",
    body: (
      <p>
        Your data is retained for the duration of the study and for a minimum of five years afterward, as
        required by UPEI's research records retention policy. At the end of this period, identifiable
        information is permanently deleted. Pseudonymized aggregate data may be retained indefinitely for
        academic citation and replication purposes, but cannot be linked back to you. You may request
        early deletion of your identifiable data by withdrawing from the study (see section 10), subject
        to the limitations described there.
      </p>
    ),
  },
  {
    id: "s9",
    number: 9,
    heading: "Your rights as a participant",
    body: (
      <>
        <p className="mb-2">As a participant, you have the right to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Review the information stored about you at any time through your profile page.</li>
          <li>Request corrections to inaccurate information.</li>
          <li>
            Withdraw from the study and request deletion of your data, subject to the limitations
            described in section 10.
          </li>
          <li>Decline to answer any survey question without explanation and without penalty.</li>
          <li>
            Contact the study team or the UPEI Research Ethics Board with questions or concerns at any
            time.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "s10",
    number: 10,
    heading: "Voluntary participation and withdrawal",
    body: (
      <p>
        Participation is entirely voluntary. You may withdraw at any time, for any reason, by contacting
        your caretaker or the study team directly. Withdrawing from the study will not affect any services
        you receive outside of this study, nor will it affect your relationship with your caretaker, your
        healthcare providers, or the University of Prince Edward Island. If you withdraw, you may request
        that your data be deleted from active study records. Data that has already been incorporated into
        published aggregate analyses cannot be removed from those analyses, but your future data will no
        longer be collected and your identifiable records will be destroyed.
      </p>
    ),
  },
  {
    id: "s11",
    number: 11,
    heading: "Risks and benefits",
    body: (
      <p>
        There are no known physical risks associated with participating in this study. The primary risk
        is the small possibility of a privacy breach, which is mitigated by the security measures
        described in section 7. Some participants may find certain survey questions about health or
        personal circumstances uncomfortable; you may skip any question at any time. Direct benefits to
        you may include increased awareness of your own health patterns through the goal-tracking
        features. The broader benefit is contributing to research that may inform future wellness
        programming for older adults in Prince Edward Island. The study team cannot guarantee any specific
        personal health benefit from participation.
      </p>
    ),
  },
  {
    id: "s12",
    number: 12,
    heading: "Compensation",
    body: (
      <p>
        Participation in the study is unpaid. Reasonable out-of-pocket expenses incurred in connection
        with the study (for example, parking costs for scheduled in-person visits with your caretaker)
        may be reimbursed upon request and with receipts, subject to study budget limitations. Withdrawal
        from the study does not affect any reimbursements already issued.
      </p>
    ),
  },
  {
    id: "s13",
    number: 13,
    heading: "Changes to these terms",
    body: (
      <p>
        These terms may be updated from time to time as the study evolves or as required by the UPEI
        Research Ethics Board. Material changes — for example, changes to what data is collected or how
        it is used — require REB re-approval and will trigger a notification on the platform asking you
        to review and re-confirm the updated terms before continuing. Non-material changes such as
        typographical corrections or formatting adjustments will be logged in the version history but
        will not require re-confirmation. The effective date and version number at the top of this page
        reflect the currently active version.
      </p>
    ),
  },
  {
    id: "s14",
    number: 14,
    heading: "Contact information",
    body: (
      <>
        <p className="mb-4">
          Questions or concerns about the study, your rights as a participant, or how your data is being
          handled may be directed to any of the following:
        </p>
        <div className="grid gap-3">
          {CONTACTS.map((c) => (
            <div
              key={c.name}
              className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4"
            >
              <div className="font-semibold text-slate-800 text-[13px]">{c.name}</div>
              {c.title && <div className="text-xs text-slate-500 mt-0.5">{c.title}</div>}
              {c.affiliation && <div className="text-xs text-slate-500">{c.affiliation}</div>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <a
                  href={`mailto:${c.email}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {c.email}
                </a>
                {c.phone && <span className="text-slate-500">{c.phone}</span>}
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  },
];

// ── Back-to-top button ──────────────────────────────────────────────────────
// Appears after the user has scrolled more than 400px down. Uses rAF
// throttling on the scroll listener for smoothness. Hidden on print.
function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setVisible(window.scrollY > 400);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="terms-print-hide fixed bottom-6 right-6 w-11 h-11 rounded-full bg-white border border-slate-200 shadow-md hover:shadow-lg hover:bg-slate-50 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-40"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-slate-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function TermsPage() {
  const { user, role } = useAuth();

  // Page is publicly accessible — no auth gate. The "Back" link adapts
  // depending on whether the user is logged in.
  const backLink =
    user && role
      ? { to: `/${role}`, label: "Back to dashboard" }
      : { to: "/login", label: "Back to login" };

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* Print CSS and accessibility enhancements. Scoped styles via a
          local <style> block — when printing, we strip the back link,
          TOC, print button, floating back-to-top, and card chrome so the
          output is clean prose with page breaks that respect section
          boundaries. */}
      <style>{`
        @media print {
          @page { margin: 1in; }
          .terms-print-hide { display: none !important; }
          .terms-page-bg { background: white !important; padding: 0 !important; }
          .terms-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
          .terms-section { page-break-inside: avoid; }
          .terms-section h2 { page-break-after: avoid; }
          .terms-callout { page-break-inside: avoid; }
        }
        @media (prefers-reduced-motion: no-preference) {
          html { scroll-behavior: smooth; }
        }
        .terms-skip-link {
          position: absolute;
          left: -9999px;
          top: auto;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }
        .terms-skip-link:focus {
          position: fixed;
          top: 8px;
          left: 8px;
          width: auto;
          height: auto;
          padding: 8px 16px;
          background: #2563eb;
          color: white;
          border-radius: 8px;
          z-index: 100;
          font-size: 14px;
          font-weight: 600;
          outline: 2px solid white;
          outline-offset: 2px;
        }
      `}</style>

      {/* Skip link for keyboard users */}
      <a href="#main-content" className="terms-skip-link">
        Skip to main content
      </a>

      <div className="terms-page-bg min-h-screen bg-slate-50 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back link */}
          <div className="mb-5 terms-print-hide">
            <Link
              to={backLink.to}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLink.label}
            </Link>
          </div>

          <main
            id="main-content"
            className="terms-card bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12"
          >
            {/* Header */}
            <header className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200 mb-6">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-slate-800 mb-2.5 tracking-tight">
                  Terms and conditions
                </h1>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-full text-[10px] font-semibold text-slate-600">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Last updated {METADATA.lastUpdated}
                  </span>
                  <span className="px-2.5 py-1 bg-slate-100 rounded-full text-[10px] font-semibold text-slate-600">
                    Version {METADATA.version}
                  </span>
                  <span className="px-2.5 py-1 bg-slate-100 rounded-full text-[10px] font-semibold text-slate-600">
                    REB file #{METADATA.rebFileNumber}
                  </span>
                  <span className="px-2.5 py-1 bg-emerald-50 rounded-full text-[10px] font-semibold text-emerald-800">
                    Effective {METADATA.effectiveDate}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="terms-print-hide inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print
              </button>
            </header>

            {/* Pre-read callout */}
            <div className="terms-callout bg-blue-50 border-l-4 border-blue-400 rounded-r-lg px-4 py-3 mb-7">
              <p className="text-sm font-semibold text-blue-900 mb-1">Please read carefully</p>
              <p className="text-[13px] text-blue-800 leading-relaxed">
                By creating an account or continuing to use Health Data Bank, you confirm that you have
                read, understood, and agree to the terms below. Your participation is voluntary, and you
                may withdraw at any time by contacting your caretaker or the study team (see section 14).
              </p>
            </div>

            {/* Table of contents */}
            <nav
              aria-label="Table of contents"
              className="terms-print-hide bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 mb-8"
            >
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                Contents
              </h2>
              <ol className="list-none p-0 m-0 grid gap-y-1 gap-x-6 sm:grid-cols-2 text-sm">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                    >
                      {s.number}. {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {/* Sections */}
            <article className="text-sm leading-[1.75] text-slate-700">
              {SECTIONS.map((s) => (
                <section key={s.id} id={s.id} className="terms-section mb-6 scroll-mt-6">
                  <h2 className="text-[17px] font-bold text-slate-800 mb-2">
                    {s.number}. {s.heading}
                  </h2>
                  {s.body}
                </section>
              ))}
            </article>
          </main>

          {/* Page footer */}
          <div className="mt-5 flex flex-wrap items-center justify-center text-[11px] text-slate-400 terms-print-hide">
            <span>© 2026 University of Prince Edward Island</span>
          </div>
        </div>
      </div>

      <BackToTopButton />
    </>
  );
}
