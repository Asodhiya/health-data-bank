import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export default function BackgroundInfoPage() {
  const navigate = useNavigate();

  /*
    Track whether the user has scrolled to the bottom of the content.
    The Continue button stays disabled until they do, ensuring they've
    at least seen the full document before proceeding.
  */
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleContinue = async () => {
    if (!hasScrolledToBottom || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await api.markBackgroundRead();
      navigate('/onboarding/consent');
    } catch (err) {
      setError(err.message || 'Could not continue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Page heading */}
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">
          Background Information Sheet
        </h2>
        <p className="text-sm text-slate-400">
          Appendix A — Please read carefully before proceeding
        </p>
      </div>

      {/* Scrollable content area */}
      <div
        className="max-h-96 overflow-y-auto border border-slate-100 rounded-xl p-5 bg-slate-50/50 mb-4"
        ref={scrollRef}
      >
        {/* Study title */}
        <h3 className="text-lg font-bold text-slate-800 mb-1">Connections for Healthy Living</h3>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Title of Study</p>

        {/* Principal Investigator card */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Principal Investigator</p>
          <p className="text-sm text-slate-700">
            Dr. William Montelpare<br />
            Professor, Dept. of Applied Human Sciences<br />
            University of Prince Edward Island<br />
            Charlottetown, PE<br />
            Tel: 902-620-5186 · wmontelpare@upei.ca
          </p>
        </div>

        {/* Introduction */}
        <p className="text-sm text-slate-600 mb-3">
          You have been invited to participate in a research study. You are eligible to participate
          in the study because you are an undergraduate student at the University of Prince Edward
          Island, that must be available for the next 10 weeks, beginning from when you join the
          study. The Connections program is a ten week wellness program for students enrolled at
          the University of Prince Edward Island.
        </p>
        <p className="text-sm text-slate-600 mb-3">
          Before you decide whether or not you would like to participate in the research study,
          please read this background information sheet so that you can learn about the study and
          what is involved in your participation. Once you review this background information
          sheet, research staff will be happy to answer any questions that you may have. If you do
          decide you would like to participate in the study, you will be asked to sign a letter of
          informed consent. Please take as much time as you need to decide whether or not you
          would like to participate in the study.
        </p>
        <p className="text-sm text-slate-600 mb-3">
          Your participation in this research study is completely voluntary. You have the right to
          withdraw from the research study by February 28, 2023. If you choose to withdraw from
          the study, you will not receive any type of penalty. You have the right to refuse to any
          of the questions asked of you.
        </p>

        {/* Why is this research being done? */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">Why Is This Research Being Done?</h4>
        <p className="text-sm text-slate-600 mb-3">
          Our intention is to develop a health education and promotion program for undergraduate
          students enrolled at UPEI. This model of healthcare programming will provide education
          on topics that contribute to the health and wellbeing of the student population, along
          with an exercise program. The educational curriculum is based on a process-oriented
          approach known as a participatory planning process (Reger, Williams &amp; Kolar, 2002).
          This process helps participants identify their problems, set goals, mobilize resources,
          and develop strategies for achieving their goals.
        </p>

        {/* What is the purpose? */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">What Is The Purpose Of This Research?</h4>
        <p className="text-sm text-slate-600 mb-3">
          The purpose of this specific research study is to determine the effectiveness of an
          8-week educational and exercise program in a cohort of university undergraduate students.
        </p>

        {/* Why have I been asked? */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">Why Have I Been Asked To Participate?</h4>
        <p className="text-sm text-slate-600 mb-3">
          You have been invited to participate in this research project because you fit the
          eligibility criteria for the study. This means that you are currently a University of
          Prince Edward Island undergraduate student, lasting the duration of the study.
        </p>
        <p className="text-sm text-slate-600 mb-3">
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
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">What Will My Responsibilities Be?</h4>
        <p className="text-sm text-slate-600 mb-3">
          If you choose to participate in this research project you will first be asked to sign
          the letter of informed consent. Once the consent has been signed the next form you will
          need to fill out is the PAR-Q form which assesses your physical readiness. You will
          also be asked to complete an initial intake day, scheduled for 1.5 hours. At this time,
          you will complete a series of non-invasive physical tests including: balance testing,
          one mile walk, half kneeling ankle flexion, back scratch test, resting heart rate,
          height/weight measurement and endurance of extensors.
        </p>
        <p className="text-sm text-slate-600 mb-3">
          In addition to the physical tests, you will be asked to complete a number of surveys
          about perceived stress, loneliness, willingness to change, physical activity readiness,
          and a confidence questionnaire. All testing and sessions will take place at the Health
          Centred Research Clinic, located in the lower level of the Steel Building on the UPEI
          campus.
        </p>
        <p className="text-sm text-slate-600 mb-3">
          Once you have completed your initial intake day, you may attend your first session.
          Both groups will receive all of the education and exercise sessions. Education sessions
          will cover various topics related to health, well-being and skills development. Exercise
          sessions will include guided group exercise and a tailored exercise routine to complete
          at home. All sessions will be 45 minutes in length and held once a week for 8 weeks.
        </p>

        {/* Time commitment */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">Time Commitment</h4>
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4">
          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
            <span className="text-slate-600">Initial intake day</span>
            <span className="text-slate-800 font-medium text-right">1.5 hours</span>
            <span className="text-slate-600">8 Education sessions</span>
            <span className="text-slate-800 font-medium text-right">8 hours</span>
            <span className="text-slate-600">8 Exercise sessions</span>
            <span className="text-slate-800 font-medium text-right">8 hours</span>
            <span className="text-slate-600">Post program assessment</span>
            <span className="text-slate-800 font-medium text-right">1.5 hours</span>
            <span className="text-slate-800 font-bold border-t border-blue-200 pt-1.5 mt-1">Total commitment</span>
            <span className="text-slate-800 font-bold border-t border-blue-200 pt-1.5 mt-1 text-right">Up to 19 hours</span>
          </div>
        </div>

        {/* Risks */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">What Are The Possible Risks And Discomforts?</h4>
        <p className="text-sm text-slate-600 mb-3">
          There are no known risks for participating in this research study. It is possible that
          you may feel some exercise related discomfort. There may be risks associated with
          participating in an exercise program, but a kinesiologist is present to alleviate those
          risks. You may also feel uncomfortable answering some of the questions asked on the
          surveys and questionnaires. However, if you feel uncomfortable about anything being
          discussed or asked of you, you may choose not to participate in that activity, or
          withdraw from the study completely.
        </p>

        {/* Number of participants */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">How Many People Will Be In The Study?</h4>
        <p className="text-sm text-slate-600 mb-3">
          There will be 28 participants in this study.
        </p>

        {/* Benefits */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">What Are The Possible Benefits?</h4>
        <p className="text-sm text-slate-600 mb-3">
          There may be no direct benefits to you for participating in the study. However, you may
          see some health benefits from increased physical activity and attendance at the education
          sessions.
        </p>

        {/* Privacy */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">What Information Will Be Kept Private?</h4>
        <p className="text-sm text-slate-600 mb-3">
          Your personal information will not be shared with anyone outside of the research team
          without your consent, or as required by law. Any of the surveys or questionnaires that
          you answer will have your name removed and will be given an ID number. Your name will
          not be associated with any of the information you provide. A master log with your name
          and your ID will be securely stored on a password protected computer at the University
          of Prince Edward Island.
        </p>
        <p className="text-sm text-slate-600 mb-3">
          There will be no identifying factors associated with your information, should this
          research study be published. Should a member of the research team be concerned about
          your health or well-being, they have the right to alert and consult with a primary
          healthcare provider. If a member of the research team suspects that you are experiencing
          emotional and/or physical abuse, they are obligated to report this information to the
          authorities.
        </p>

        {/* Early end */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">Can Participation In The Study End Early?</h4>
        <p className="text-sm text-slate-600 mb-3">
          Your participation in this research project is completely voluntary. You have the right
          to withdraw from the research study by February 28, 2023. Please reach out to either
          Anja Salijevic at asalijevic@upei.ca or Laurie Michael at lmichael@upei.ca if you wish
          to withdraw. If you would like to pass any of the questions, activities or physical
          assessments, you may do so and still remain in the study.
        </p>

        {/* Eligibility */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">Who Can Participate?</h4>
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Inclusion Criteria</p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
            <li>Undergraduate student at UPEI</li>
            <li>Over 18 years of age</li>
            <li>Passing the screening of the PAR-Q test</li>
          </ul>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 mt-3">Exclusion Criteria</p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
            <li>Under 18 years of age</li>
            <li>Not an undergraduate student at UPEI</li>
            <li>Not passing the PAR-Q screening and not receiving approval from a health professional</li>
          </ul>
          <p className="text-xs text-slate-400 mt-2.5 italic">
            *PAR-Q is a test to determine whether a client should have a medical evaluation done
            before participating in a program that involves exercise.
          </p>
        </div>

        {/* Payment */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">Will I Be Paid To Participate?</h4>
        <p className="text-sm text-slate-600 mb-3">
          No, you will not be paid to participate in the study. This study is completely voluntary.
        </p>

        {/* Costs */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">Will There Be Any Costs To Me?</h4>
        <p className="text-sm text-slate-600 mb-3">
          No, there will be no costs to you for participating in this study.
        </p>

        {/* Results */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">How Can I Learn About The Results?</h4>
        <p className="text-sm text-slate-600 mb-3">
          If you are interested in receiving a copy of the study abstract once it is complete,
          please check the box at the end of the consent form under the Sharing Study Results
          section, and leave your email and/or mailing address.
        </p>

        {/* Contact */}
        <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">If I Have Questions, Who Should I Call?</h4>
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-2">
          <p className="text-sm text-slate-700">
            <strong>Principal Investigator:</strong> Dr. William Montelpare —
            wmontelpare@upei.ca · 902-620-5186
          </p>
          <p className="text-sm text-slate-700 mt-1.5">
            <strong>Health Educator:</strong> Anja Salijevic — asalijevic@upei.ca
          </p>
          <p className="text-sm text-slate-700 mt-1.5">
            <strong>Dietitian:</strong> Laurie Michael — lmichael@upei.ca
          </p>
          <p className="text-xs text-slate-400 mt-2.5">
            This study has been reviewed and approved by the UPEI Research Ethics Board.
            Contact them at researchcompliance@upei.ca or 902-620-5104.
          </p>
        </div>
      </div>

      {/* Scroll hint — only shows when user hasn't scrolled to bottom yet */}
      {!hasScrolledToBottom && (
        <p className="text-xs text-amber-600 font-medium text-center mt-3">
          ↓ Scroll to read the full document before continuing
        </p>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-2.5 rounded-lg mt-3">
          {error}
        </div>
      )}

      {/* Continue button */}
      <button
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors mt-4 ${
          hasScrolledToBottom && !isSubmitting
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
        disabled={!hasScrolledToBottom || isSubmitting}
        onClick={handleContinue}
      >
        {isSubmitting ? 'Saving...' : 'I Have Read This Document - Continue'}
      </button>
    </>
  );
}
