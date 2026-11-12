import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendText?: string;
  className?: string;
  onClick?: () => void;
}

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  ({ label, value, subtext, icon, trend, trendText, className = '', onClick }, ref) => {
    return (
      <article
        ref={ref}
        className={`metric-card ${className}`.trim()}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        <div className="metric-card-header">
          <span className="metric-label">{label}</span>
          {icon && <span className="metric-icon">{icon}</span>}
        </div>
        <div className="metric-value">{value}</div>
        {subtext && <div className="metric-subtext">{subtext}</div>}
        {trendText && (
          <div className={`metric-trend metric-trend-${trend || 'neutral'}`}>
            {trend === 'up' && (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M6 11L1 6h10z" fill="currentColor" />
              </svg>
            )}
            {trend === 'down' && (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M6 1L1 6h10z" fill="currentColor" />
              </svg>
            )}
            {trend === 'neutral' && (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M1 6h10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
            <span>{trendText}</span>
          </div>
        )}
      </article>
    );
  },
);

MetricCard.displayName = 'MetricCard';

interface StatRingProps {
  value: number;
  label: string;
  sublabel?: string;
  color?: 'ice' | 'safe' | 'amber' | 'ember';
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const RING_COLORS = {
  ice: 'var(--ice-400)',
  safe: 'var(--safe-400)',
  amber: 'var(--amber-400)',
  ember: 'var(--ember-500)',
};

export function StatRing({
  value,
  label,
  sublabel,
  color = 'ice',
  size = 120,
  strokeWidth = 8,
  className = '',
}: StatRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const stroke = RING_COLORS[color];

  return (
    <div
      className={`stat-ring ${className}`.trim()}
      style={{ width: size, height: size, ['--ring-size' as string]: `${size}px` }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(156, 196, 216, 0.16)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="stat-ring-content">
        <div className="stat-ring-value" style={{ color: stroke }}>
          {value}
          <span className="stat-ring-percent">%</span>
        </div>
        {label && <div className="stat-ring-label">{label}</div>}
        {sublabel && <div className="stat-ring-sublabel">{sublabel}</div>}
      </div>
    </div>
  );
}

interface InteractiveCardProps {
  title: string;
  description: string;
  status: 'ready' | 'progress' | 'planned' | 'blocked';
  statusLabel: string;
  titleTo?: string;
  metrics?: Array<{ label: string; value: string }>;
  actions?: Array<{ label: string; onClick?: () => void; to?: string; variant?: 'primary' | 'secondary' }>;
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}

const STATUS_ACCENT: Record<InteractiveCardProps['status'], string> = {
  ready: 'var(--safe-400)',
  progress: 'var(--amber-400)',
  planned: 'var(--ice-400)',
  blocked: 'var(--ember-500)',
};

export function InteractiveCard({
  title,
  description,
  status,
  statusLabel,
  titleTo,
  metrics = [],
  actions = [],
  children,
  className = '',
  icon,
  trailing,
}: InteractiveCardProps) {
  const accent = STATUS_ACCENT[status];

  return (
    <article className={`interactive-card ${className}`.trim()} style={{ '--card-accent': accent } as CSSProperties}>
      <div className="interactive-card-top">
        <div className="interactive-card-title-row">
          {icon && <span className="interactive-card-icon">{icon}</span>}
          <div>
            <h3 className="interactive-card-title">
              {titleTo ? <Link to={titleTo}>{title}</Link> : title}
            </h3>
            <div className="interactive-card-status">
              <span className="interactive-card-status-dot" style={{ background: accent }} />
              <span className="interactive-card-status-label">{statusLabel}</span>
            </div>
          </div>
        </div>
        {trailing && <div className="interactive-card-trailing">{trailing}</div>}
      </div>

      {description && <p className="interactive-card-description">{description}</p>}

      {metrics.length > 0 && (
        <div className="interactive-card-metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className="interactive-card-metric">
              <span className="interactive-card-metric-label">{metric.label}</span>
              <span className="interactive-card-metric-value">{metric.value}</span>
            </div>
          ))}
        </div>
      )}

      {children && <div className="interactive-card-children">{children}</div>}

      {actions.length > 0 && (
        <div className="interactive-card-actions">
          {actions.map((action) => (
            action.to ? (
              <Link
                key={action.label}
                to={action.to}
                className={`btn ${action.variant === 'primary' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                className={`btn ${action.variant === 'primary' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            )
          ))}
        </div>
      )}
    </article>
  );
}
