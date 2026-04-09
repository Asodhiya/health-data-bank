import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../services/api";

function displayAnswerValue(answer) {
  if (answer.value_text) return answer.value_text;
  if (answer.value_number !== null && answer.value_number !== undefined) return String(answer.value_number);
  if (answer.value_date) return answer.value_date;
  if (answer.value_json !== null && answer.value_json !== undefined) return JSON.stringify(answer.value_json);
  return "—";
}

export default function ResearcherSubmissionDetailPage() {
  const { participantId, submissionId } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .researcherGetSubmissionDetail(participantId, submissionId)
      .then((res) => setDetail(res))
      .catch((err) => setError(err.message || "Failed to load submission detail."))
      .finally(() => setLoading(false));
  }, [participantId, submissionId]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Submission Detail</h1>
          <p className="text-sm text-slate-500 mt-1">
            Researcher read-only drill-down for survey-backed observations.
          </p>
        </div>
        <Link
          to="/researcher"
          className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        {loading ? (
          <p className="text-sm text-slate-400">Loading submission details...</p>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Form</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">{detail.form_name}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Submitted</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {detail.submitted_at || "Draft / unknown"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Answers</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">{detail.answers?.length || 0}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Field</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detail.answers || []).map((answer, index) => (
                    <tr key={`${answer.field_id || "field"}-${index}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">
                        {answer.field_label || answer.field_id || "Unnamed field"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{displayAnswerValue(answer)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
