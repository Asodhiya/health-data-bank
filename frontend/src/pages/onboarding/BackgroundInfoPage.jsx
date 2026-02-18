import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function BackgroundInfoPage() {
  const navigate = useNavigate();

  /*
    Track whether the user has scrolled to the bottom of the content.
    The Continue button stays disabled until they do, ensuring they've
    at least seen the full document before proceeding.
  */
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      // Allow a small tolerance (10px) for "reached the bottom"
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
      if (atBottom) setHasScrolledToBottom(true);
    };

    el.addEventListener('scroll', handleScroll);
    // Check immediately in case content is short enough to not need scrolling
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Page heading */}
      <div className="text-center" style={{ marginBottom: '1.25rem' }}>
        <h2
          className="text-2xl font-bold"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-primary)',
            marginBottom: '0.25rem',
          }}
        >
          Background Information Sheet
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Appendix A — Please read carefully before proceeding
        </p>
      </div>

      {/* Scrollable content area */}
      <div className="onboarding-scroll-area" ref={scrollRef}>

        {/* Study title */}
        <h3 className="onboarding-study-title">Connections for Healthy Living</h3>
        <p className="onboarding-study-subtitle">Title of Study</p>

        {/* Principal Investigator card */}
        <div className="onboarding-info-card">
          <p className="onboarding-info-card-label">Principal Investigator</p>
          <p className="onboarding-info-card-text">
            Dr. William Montelpare<br />
            Professor, Dept. of Applied Human Sciences<br />
            University of Prince Edward Island<br />
            Charlottetown, PE<br />
            Tel: 902-620-5186 · wmontelpare@upei.ca
          </p>
        </div>

        {/* Introduction */}
        <p className="onboarding-para">
          You have been invited to participate in a research study. You are eligible to participate
          in the study because you are an undergraduate student at the University of Prince Edward
          Island, that must be available for the next 10 weeks, beginning from when you join the
          study. The Connections program is a ten week wellness program for students enrolled at
          the University of Prince Edward Island.
        </p>
        <p className="onboarding-para">
          Before you decide whether or not you would like to participate in the research study,
          please read this background information sheet so that you can learn about the study and
          what is involved in your participation. Once you review this background information
          sheet, research staff will be happy to answer any questions that you may have. If you do
          decide you would like to participate in the study, you will be asked to sign a letter of
          informed consent. Please take as much time as you need to decide whether or not you
          would like to participate in the study.
        </p>
        <p className="onboarding-para">
          Your participation in this research study is completely voluntary. You have the right to
          withdraw from the research study by February 28, 2023. If you choose to withdraw from
          the study, you will not receive any type of penalty. You have the right to refuse to any
          of the questions asked of you.
        </p>

        {/* Why is this research being done? */}
        <h4 className="onboarding-section-heading">Why Is This Research Being Done?</h4>
        <p className="onboarding-para">
          Our intention is to develop a health education and promotion program for undergraduate
          students enrolled at UPEI. This model of healthcare programming will provide education
          on topics that contribute to the health and wellbeing of the student population, along
          with an exercise program. The educational curriculum is based on a process-oriented
          approach known as a participatory planning process (Reger, Williams &amp; Kolar, 2002).
          This process helps participants identify their problems, set goals, mobilize resources,
          and develop strategies for achieving their goals.
        </p>

        {/* What is the purpose? */}
        <h4 className="onboarding-section-heading">What Is The Purpose Of This Research?</h4>
        <p className="onboarding-para">
          The purpose of this specific research study is to determine the effectiveness of an
          8-week educational and exercise program in a cohort of university undergraduate students.
        </p>

        {/* Why have I been asked? */}
        <h4 className="onboarding-section-heading">Why Have I Been Asked To Participate?</h4>
        <p className="onboarding-para">
          You have been invited to participate in this research project because you fit the
          eligibility criteria for the study. This means that you are currently a University of
          Prince Edward Island undergraduate student, lasting the duration of the study.
        </p>
        <p className="onboarding-para">
          Individuals that are interested in participating in the Connections program will be
          invited to attend an information session to be held both virtually and in-person at
          UPEI. Health Centered Research Clinic staff will explain the program and the various
          activities in which participants will be involved, along with expected time commitments.
          Interested participants will be required to read through the background information
          form and sign the consent form. Once completed, the participant will be asked to do the
          Physical Activity Readiness Questionnaire (PAR-Q) as part of the program screening
          procedure to determine if the participant is medically eligible to participate without
          the need of medical clearance.
        </p>

        {/* Responsibilities */}
        <h4 className="onboarding-section-heading">What Will My Responsibilities Be?</h4>
        <p className="onboarding-para">
          If you choose to participate in this research project you will first be asked to sign
          the letter of informed consent. Once the consent has been signed the next form you will
          need to fill out is the PAR-Q form which assesses your physical readiness. You will
          also be asked to complete an initial intake day, scheduled for 1.5 hours. At this time,
          you will complete a series of non-invasive physical tests including: balance testing,
          one mile walk, half kneeling ankle flexion, back scratch test, resting heart rate,
          height/weight measurement and endurance of extensors.
        </p>
        <p className="onboarding-para">
          In addition to the physical tests, you will be asked to complete a number of surveys
          about perceived stress, loneliness, willingness to change, physical activity readiness,
          and a confidence questionnaire. All testing and sessions will take place at the Health
          Centred Research Clinic, located in the lower level of the Steel Building on the UPEI
          campus.
        </p>
        <p className="onboarding-para">
          Once you have completed your initial intake day, you may attend your first session.
          Both groups will receive all of the education and exercise sessions. Education sessions
          will cover various topics related to health, well-being and skills development. Exercise
          sessions will include guided group exercise and a tailored exercise routine to complete
          at home. All sessions will be 45 minutes in length and held once a week for 8 weeks.
        </p>

        {/* Time commitment */}
        <h4 className="onboarding-section-heading">Time Commitment</h4>
        <div className="onboarding-info-card">
          <div className="onboarding-time-grid">
            <span className="onboarding-time-label">Initial intake day</span>
            <span className="onboarding-time-value">1.5 hours</span>
            <span className="onboarding-time-label">8 Education sessions</span>
            <span className="onboarding-time-value">8 hours</span>
            <span className="onboarding-time-label">8 Exercise sessions</span>
            <span className="onboarding-time-value">8 hours</span>
            <span className="onboarding-time-label">Post program assessment</span>
            <span className="onboarding-time-value">1.5 hours</span>
            <span className="onboarding-time-label onboarding-time-total">Total commitment</span>
            <span className="onboarding-time-value onboarding-time-total">Up to 19 hours</span>
          </div>
        </div>

        {/* Risks */}
        <h4 className="onboarding-section-heading">What Are The Possible Risks And Discomforts?</h4>
        <p className="onboarding-para">
          There are no known risks for participating in this research study. It is possible that
          you may feel some exercise related discomfort. There may be risks associated with
          participating in an exercise program, but a kinesiologist is present to alleviate those
          risks. You may also feel uncomfortable answering some of the questions asked on the
          surveys and questionnaires. However, if you feel uncomfortable about anything being
          discussed or asked of you, you may choose not to participate in that activity, or
          withdraw from the study completely.
        </p>

        {/* Number of participants */}
        <h4 className="onboarding-section-heading">How Many People Will Be In The Study?</h4>
        <p className="onboarding-para">
          There will be 28 participants in this study.
        </p>

        {/* Benefits */}
        <h4 className="onboarding-section-heading">What Are The Possible Benefits?</h4>
        <p className="onboarding-para">
          There may be no direct benefits to you for participating in the study. However, you may
          see some health benefits from increased physical activity and attendance at the education
          sessions.
        </p>

        {/* Privacy */}
        <h4 className="onboarding-section-heading">What Information Will Be Kept Private?</h4>
        <p className="onboarding-para">
          Your personal information will not be shared with anyone outside of the research team
          without your consent, or as required by law. Any of the surveys or questionnaires that
          you answer will have your name removed and will be given an ID number. Your name will
          not be associated with any of the information you provide. A master log with your name
          and your ID will be securely stored on a password protected computer at the University
          of Prince Edward Island.
        </p>
        <p className="onboarding-para">
          There will be no identifying factors associated with your information, should this
          research study be published. Should a member of the research team be concerned about
          your health or well-being, they have the right to alert and consult with a primary
          healthcare provider. If a member of the research team suspects that you are experiencing
          emotional and/or physical abuse, they are obligated to report this information to the
          authorities.
        </p>

        {/* Early end */}
        <h4 className="onboarding-section-heading">Can Participation In The Study End Early?</h4>
        <p className="onboarding-para">
          Your participation in this research project is completely voluntary. You have the right
          to withdraw from the research study by February 28, 2023. Please reach out to either
          Anja Salijevic at asalijevic@upei.ca or Laurie Michael at lmichael@upei.ca if you wish
          to withdraw. If you would like to pass any of the questions, activities or physical
          assessments, you may do so and still remain in the study.
        </p>

        {/* Eligibility */}
        <h4 className="onboarding-section-heading">Who Can Participate?</h4>
        <div className="onboarding-info-card">
          <p className="onboarding-info-card-label">Inclusion Criteria</p>
          <ul className="onboarding-list">
            <li>Undergraduate student at UPEI</li>
            <li>Over 18 years of age</li>
            <li>Passing the screening of the PAR-Q test</li>
          </ul>
          <p className="onboarding-info-card-label" style={{ marginTop: '12px' }}>Exclusion Criteria</p>
          <ul className="onboarding-list">
            <li>Under 18 years of age</li>
            <li>Not an undergraduate student at UPEI</li>
            <li>Not passing the PAR-Q screening and not receiving approval from a health professional</li>
          </ul>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '10px', fontStyle: 'italic' }}>
            *PAR-Q is a test to determine whether a client should have a medical evaluation done
            before participating in a program that involves exercise.
          </p>
        </div>

        {/* Payment */}
        <h4 className="onboarding-section-heading">Will I Be Paid To Participate?</h4>
        <p className="onboarding-para">
          No, you will not be paid to participate in the study. This study is completely voluntary.
        </p>

        {/* Costs */}
        <h4 className="onboarding-section-heading">Will There Be Any Costs To Me?</h4>
        <p className="onboarding-para">
          No, there will be no costs to you for participating in this study.
        </p>

        {/* Results */}
        <h4 className="onboarding-section-heading">How Can I Learn About The Results?</h4>
        <p className="onboarding-para">
          If you are interested in receiving a copy of the study abstract once it is complete,
          please check the box at the end of the consent form under the Sharing Study Results
          section, and leave your email and/or mailing address.
        </p>

        {/* Contact */}
        <h4 className="onboarding-section-heading">If I Have Questions, Who Should I Call?</h4>
        <div className="onboarding-info-card">
          <p className="onboarding-info-card-text">
            <strong>Principal Investigator:</strong> Dr. William Montelpare —
            wmontelpare@upei.ca · 902-620-5186
          </p>
          <p className="onboarding-info-card-text" style={{ marginTop: '6px' }}>
            <strong>Health Educator:</strong> Anja Salijevic — asalijevic@upei.ca
          </p>
          <p className="onboarding-info-card-text" style={{ marginTop: '6px' }}>
            <strong>Dietitian:</strong> Laurie Michael — lmichael@upei.ca
          </p>
          <p className="onboarding-info-card-text" style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            This study has been reviewed and approved by the UPEI Research Ethics Board.
            Contact them at researchcompliance@upei.ca or 902-620-5104.
          </p>
        </div>
      </div>

      {/* Scroll hint — only shows when user hasn't scrolled to bottom yet */}
      {!hasScrolledToBottom && (
        <p
          className="text-center text-sm"
          style={{
            color: 'var(--color-primary-600)',
            marginTop: '0.75rem',
            marginBottom: '0',
            fontWeight: 500,
          }}
        >
          ↓ Scroll to read the full document before continuing
        </p>
      )}

      {/* Continue button */}
      <button
        className="btn-primary"
        style={{ marginTop: '1.25rem' }}
        disabled={!hasScrolledToBottom}
        onClick={() => navigate('/onboarding/consent')}
      >
        I Have Read This Document — Continue
      </button>
    </>
  );
}
