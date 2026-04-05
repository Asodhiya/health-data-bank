import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../../services/api';

export default function BackgroundInfoPage() {
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef(null);

  // Fetch background info template from backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getBackgroundInfo();
        if (!cancelled) setTemplate(data);
      } catch (err) {
        if (!cancelled) setFetchError(err.message || 'Failed to load background information.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Scroll-to-bottom detection — re-attach after content loads
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || loading) return;

    const handleScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
      if (atBottom) setHasScrolledToBottom(true);
    };

    el.addEventListener('scroll', handleScroll);
    // Check immediately in case content is short enough to not need scrolling
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [loading]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-3 rounded-lg">
        {fetchError}
      </div>
    );
  }

  return (
    <>
      {/* Page heading */}
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">
          {template.title}
        </h2>
        {template.subtitle && (
          <p className="text-sm text-slate-400">{template.subtitle}</p>
        )}
      </div>

      {/* Scrollable content area */}
      <div
        className="max-h-96 overflow-y-auto border border-slate-100 rounded-xl p-5 bg-slate-50/50 mb-4"
        ref={scrollRef}
      >
        {template.sections?.map((section, i) => (
          <div
            key={i}
            className={
              section.style === 'card'
                ? 'bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4'
                : 'mb-4'
            }
          >
            {section.heading && (
              <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">
                {section.heading}
              </h4>
            )}
            <div className="prose prose-sm prose-slate max-w-none [&_table]:w-full [&_th]:text-left [&_td]:py-1 [&_th]:py-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {section.body}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      {/* Scroll hint */}
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
