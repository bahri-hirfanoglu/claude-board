import { useMemo } from 'react';
import {
  Activity,
  CheckCircle,
  Clock,
  Cpu,
  Coins,
  AlertCircle,
  BarChart3,
  Zap,
  TrendingUp,
  FlaskConical,
} from 'lucide-react';
import { formatTokens } from '../../lib/formatters';
import { TYPE_COLORS, COLUMNS, MODEL_DOT_COLORS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';

function StatCard({ icon: Icon, label, value, sublabel, color = 'text-surface-200' }) {
  return (
    <div className="bg-surface-800/50 rounded-lg px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] text-surface-500 mb-1">
        <Icon size={11} />
        {label}
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sublabel && <div className="text-[10px] text-surface-600 mt-0.5">{sublabel}</div>}
    </div>
  );
}

function MiniBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-surface-400 w-20 text-right">{label}</span>
      <div className="flex-1 h-5 bg-surface-800/50 rounded overflow-hidden relative">
        <div className={`h-full ${color} rounded transition-all duration-500`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-surface-200">
          {count}
        </span>
      </div>
      <span className="text-[10px] text-surface-600 w-10">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function SummaryView({ tasks }) {
  const { t } = useTranslation();
  const stats = useMemo(() => {
    const byStatus = {};
    const byType = {};
    const byPriority = { 0: 0, 1: 0, 2: 0, 3: 0 };
    const byModel = {};
    let totalTokens = 0,
      totalCost = 0,
      totalTurns = 0,
      running = 0,
      testing = 0;
    let inputTokens = 0,
      outputTokens = 0;

    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      const type = t.task_type || 'feature';
      byType[type] = (byType[type] || 0) + 1;
      const pri = t.priority || 0;
      byPriority[pri] = (byPriority[pri] || 0) + 1;
      const model = t.model_used || t.model || 'sonnet';
      byModel[model] = (byModel[model] || 0) + 1;
      inputTokens += t.input_tokens || 0;
      outputTokens += t.output_tokens || 0;
      totalTokens += (t.input_tokens || 0) + (t.output_tokens || 0);
      totalCost += t.total_cost || 0;
      totalTurns += t.num_turns || 0;
      if (t.is_running && t.status === 'testing') testing++;
      else if (t.is_running) running++;
    }

    const completed = byStatus['done'] || 0;
    const total = tasks.length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(0) : 0;

    // Avg duration for completed tasks
    const completedTasks = tasks.filter((t) => t.started_at && t.completed_at);
    let avgMinutes = 0;
    if (completedTasks.length > 0) {
      const totalMs = completedTasks.reduce((sum, t) => {
        if (t.work_duration_ms > 0) return sum + t.work_duration_ms;
        return sum + (new Date(t.completed_at) - new Date(t.started_at));
      }, 0);
      avgMinutes = Math.round(totalMs / completedTasks.length / 60000);
    }

    // Top cost tasks
    const topCost = [...tasks]
      .filter((t) => t.total_cost > 0)
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 5);

    // Cost per task average
    const tasksWithCost = tasks.filter((t) => t.total_cost > 0);
    const avgCost = tasksWithCost.length > 0 ? totalCost / tasksWithCost.length : 0;

    return {
      byStatus,
      byType,
      byPriority,
      byModel,
      totalTokens,
      inputTokens,
      outputTokens,
      totalCost,
      totalTurns,
      running,
      testing,
      completed,
      total,
      completionRate,
      avgMinutes,
      topCost,
      avgCost,
    };
  }, [tasks]);

  const formatMinutes = (m) => {
    if (m === 0) return '-';
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const statusColors = {
    backlog: 'bg-surface-500',
    in_progress: 'bg-amber-500',
    testing: 'bg-claude',
    done: 'bg-emerald-500',
  };

  const priorityLabels = ['None', 'Low', 'Medium', 'High'];
  const priorityColors = ['bg-surface-600', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];

  return (
    <div className="h-full overflow-auto p-4 space-y-6">
      {/* Top stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={BarChart3} label={t('summary.totalTasks')} value={stats.total} />
        <StatCard
          icon={CheckCircle}
          label={t('summary.completed')}
          value={`${stats.completionRate}%`}
          sublabel={`${stats.completed} of ${stats.total}`}
          color="text-emerald-400"
        />
        <StatCard
          icon={Activity}
          label={t('summary.running')}
          value={stats.running}
          color={stats.running > 0 ? 'text-amber-400' : 'text-surface-200'}
        />
        {stats.testing > 0 && (
          <StatCard icon={FlaskConical} label={t('status.testing')} value={stats.testing} color="text-purple-400" />
        )}
        {(stats.byStatus['failed'] || 0) > 0 && (
          <StatCard
            icon={AlertCircle}
            label={t('status.failed')}
            value={stats.byStatus['failed']}
            color="text-red-400"
          />
        )}
        <StatCard icon={Clock} label={t('summary.avgDuration')} value={formatMinutes(stats.avgMinutes)} />
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Cpu}
          label={t('summary.totalTokens')}
          value={formatTokens(stats.totalTokens)}
          sublabel={`In: ${formatTokens(stats.inputTokens)} / Out: ${formatTokens(stats.outputTokens)}`}
        />
        <StatCard
          icon={Coins}
          label={t('summary.totalCost')}
          value={stats.totalCost > 0 ? `$${stats.totalCost.toFixed(4)}` : '-'}
          sublabel={stats.avgCost > 0 ? `Avg: $${stats.avgCost.toFixed(4)}/task` : undefined}
        />
        <StatCard icon={Activity} label={t('summary.totalTurns')} value={stats.totalTurns || '-'} />
        <StatCard
          icon={TrendingUp}
          label="Throughput"
          value={stats.completed > 0 && stats.avgMinutes > 0 ? `${(60 / stats.avgMinutes).toFixed(1)}/hr` : '-'}
          color="text-blue-400"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div>
          <h3 className="text-xs font-semibold text-surface-400 mb-3 uppercase tracking-wider">
            {t('summary.statusDist')}
          </h3>
          <div className="h-3 rounded-full bg-surface-800 overflow-hidden flex mb-3">
            {COLUMNS.map((col) => {
              const count = stats.byStatus[col.id] || 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={col.id}
                  className={`${statusColors[col.id]} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                  title={`${t('status.' + col.id)}: ${count}`}
                />
              );
            })}
          </div>
          <div className="space-y-1.5">
            {COLUMNS.map((col) => (
              <MiniBar
                key={col.id}
                label={t('status.' + col.id)}
                count={stats.byStatus[col.id] || 0}
                total={stats.total}
                color={statusColors[col.id]}
              />
            ))}
          </div>
        </div>

        {/* Priority Distribution */}
        <div>
          <h3 className="text-xs font-semibold text-surface-400 mb-3 uppercase tracking-wider">
            Priority Distribution
          </h3>
          <div className="h-3 rounded-full bg-surface-800 overflow-hidden flex mb-3">
            {[0, 1, 2, 3].map((pri) => {
              const count = stats.byPriority[pri] || 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={pri}
                  className={`${priorityColors[pri]} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map((pri) => (
              <MiniBar
                key={pri}
                label={priorityLabels[pri]}
                count={stats.byPriority[pri] || 0}
                total={stats.total}
                color={priorityColors[pri]}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Type Distribution */}
        <div>
          <h3 className="text-xs font-semibold text-surface-400 mb-3 uppercase tracking-wider">
            {t('summary.typeDist')}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(stats.byType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 bg-surface-800/30 rounded-lg px-3 py-2">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[type] || ''}`}>
                    {type}
                  </span>
                  <span className="text-sm font-semibold text-surface-200 ml-auto">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Model Distribution */}
        <div>
          <h3 className="text-xs font-semibold text-surface-400 mb-3 uppercase tracking-wider">Model Usage</h3>
          <div className="space-y-2">
            {Object.entries(stats.byModel)
              .sort((a, b) => b[1] - a[1])
              .map(([model, count]) => (
                <div key={model} className="flex items-center gap-3 bg-surface-800/30 rounded-lg px-3 py-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: MODEL_DOT_COLORS[model] || '#94a3b8' }}
                  />
                  <span className="text-xs text-surface-300 capitalize flex-1">{model}</span>
                  <span className="text-sm font-semibold text-surface-200">{count}</span>
                  <span className="text-[10px] text-surface-500">
                    {stats.total > 0 ? ((count / stats.total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Top Cost Tasks */}
      {stats.topCost.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-surface-400 mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={11} /> Top Cost Tasks
          </h3>
          <div className="space-y-1">
            {stats.topCost.map((task) => (
              <div key={task.id} className="flex items-center gap-3 bg-surface-800/30 rounded-lg px-3 py-2">
                <span className="text-[10px] text-surface-500 font-mono w-8">{task.task_key || `#${task.id}`}</span>
                <span className="text-xs text-surface-300 flex-1 truncate">{task.title}</span>
                <span className="text-[10px] text-surface-500">
                  {formatTokens((task.input_tokens || 0) + (task.output_tokens || 0))}
                </span>
                <span className="text-xs font-semibold text-amber-400">${task.total_cost.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-surface-500">
          <AlertCircle size={24} className="mb-2" />
          <p className="text-sm">{t('summary.noTasks')}</p>
        </div>
      )}
    </div>
  );
}
