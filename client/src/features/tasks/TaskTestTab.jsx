import {
  CircleCheck, CircleX, CircleAlert, CircleMinus,
} from 'lucide-react';
import { parseTestReport, getCheckStatusColors, getCheckCardBorder } from './taskDetailHelpers';
import { useTranslation } from '../../i18n/I18nProvider';

function StatusIcon({ s }) {
  if (s === 'pass') return <CircleCheck size={14} className="text-emerald-400" />;
  if (s === 'fail') return <CircleX size={14} className="text-red-400" />;
  if (s === 'warn') return <CircleAlert size={14} className="text-amber-400" />;
  return <CircleMinus size={14} className="text-surface-500" />;
}

export function TaskTestTab({ d }) {
  const { t } = useTranslation();

  try {
    const report = parseTestReport(d.test_report);
    if (!report) return <div className="text-center text-surface-600 text-xs py-8">{t('detail.noTestReport')}</div>;
    const verdict = report.verdict;
    const checks = report.checks || [];

    return (
      <div className="space-y-4">
        {/* Verdict banner */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
          verdict === 'approve' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          {verdict === 'approve' ? <CircleCheck size={20} className="text-emerald-400" /> : <CircleX size={20} className="text-red-400" />}
          <div>
            <div className={`text-sm font-semibold ${verdict === 'approve' ? 'text-emerald-400' : 'text-red-400'}`}>
              {verdict === 'approve' ? t('detail.allChecksPassed') : t('detail.verificationFailed')}
            </div>
            {report.summary && <p className="text-xs text-surface-400 mt-0.5">{report.summary}</p>}
          </div>
        </div>

        {/* Check cards */}
        <div className="space-y-2">
          {checks.map((check, i) => (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${getCheckCardBorder(check.status)}`}>
              <StatusIcon s={check.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-surface-200">{check.name}</span>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${getCheckStatusColors(check.status)}`}>{check.status}</span>
                </div>
                {check.detail && <p className="text-[11px] text-surface-400 mt-1 leading-relaxed">{check.detail}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Feedback */}
        {report.feedback && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3">
            <p className="text-[10px] font-semibold text-red-400 mb-1">{t('detail.feedback')}</p>
            <p className="text-xs text-red-300/80 whitespace-pre-wrap leading-relaxed">{report.feedback}</p>
          </div>
        )}
      </div>
    );
  } catch {
    return <div className="text-center text-surface-600 text-xs py-8">{t('detail.testParseError')}</div>;
  }
}
