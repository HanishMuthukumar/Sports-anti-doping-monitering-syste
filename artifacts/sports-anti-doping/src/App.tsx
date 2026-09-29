import { type ButtonHTMLAttributes, type FormEvent, type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Beaker,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileBarChart,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TestTube2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey,
  getGetReportSummaryQueryKey,
  getListNotificationsQueryKey,
  getListResultsQueryKey,
  getListSamplesQueryKey,
  getListTestsQueryKey,
  getListViolationsQueryKey,
  useCreateResult,
  useCreateTest,
  useGetCurrentUser,
  useGetDashboardSummary,
  useGetReportSummary,
  useGetTest,
  useHealthCheck,
  useListNotifications,
  useListResults,
  useListSamples,
  useListTests,
  useListViolations,
  useLogin,
  useMarkAllNotificationsRead,
  useTransitionSample,
  useUpdateTest,
  useUpdateViolation,
  setAuthTokenGetter,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Route, Router as WouterRouter, Link, Switch, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient();

setAuthTokenGetter(() =>
  typeof window === 'undefined' ? null : window.localStorage.getItem('clearline_access_token'),
);

type Role = 'admin' | 'athlete' | 'officer' | 'laboratory' | 'authority';
type IconType = typeof LayoutDashboard;

const roleNames: Record<Role, string> = {
  admin: 'Administrator',
  athlete: 'Athlete',
  officer: 'Doping control officer',
  laboratory: 'Laboratory staff',
  authority: 'Sports authority',
};

const roleRoutes: Record<Role, string> = {
  admin: '/admin/dashboard',
  athlete: '/athlete/dashboard',
  officer: '/officer/dashboard',
  laboratory: '/laboratory/dashboard',
  authority: '/authority/dashboard',
};

function roleKey(value?: string): Role {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('athlete')) return 'athlete';
  if (normalized.includes('officer')) return 'officer';
  if (normalized.includes('laboratory')) return 'laboratory';
  if (normalized.includes('authority')) return 'authority';
  return 'admin';
}

const navByRole: Record<Role, { label: string; href: string; icon: IconType }[]> = {
  admin: [
    { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Users', href: '/admin/users', icon: UsersRound },
    { label: 'Athletes', href: '/admin/athletes', icon: UserRound },
    { label: 'Officers', href: '/admin/officers', icon: ShieldCheck },
    { label: 'Laboratories', href: '/admin/laboratories', icon: FlaskConical },
    { label: 'Tests', href: '/admin/tests', icon: ClipboardCheck },
    { label: 'Samples', href: '/admin/samples', icon: TestTube2 },
    { label: 'Results', href: '/admin/results', icon: Beaker },
    { label: 'Violations', href: '/admin/violations', icon: AlertCircle },
    { label: 'Reports', href: '/admin/reports', icon: FileBarChart },
  ],
  athlete: [
    { label: 'Overview', href: '/athlete/dashboard', icon: LayoutDashboard },
    { label: 'My profile', href: '/athlete/profile', icon: UserRound },
    { label: 'My tests', href: '/athlete/tests', icon: ClipboardCheck },
    { label: 'Results', href: '/athlete/results', icon: Beaker },
    { label: 'Violations', href: '/athlete/violations', icon: AlertCircle },
    { label: 'Notifications', href: '/athlete/notifications', icon: Bell },
  ],
  officer: [
    { label: 'Overview', href: '/officer/dashboard', icon: LayoutDashboard },
    { label: 'Assigned tests', href: '/officer/tests', icon: ClipboardCheck },
    { label: 'Samples', href: '/officer/samples', icon: TestTube2 },
  ],
  laboratory: [
    { label: 'Overview', href: '/laboratory/dashboard', icon: LayoutDashboard },
    { label: 'Sample intake', href: '/laboratory/samples', icon: TestTube2 },
    { label: 'Results', href: '/laboratory/results', icon: Beaker },
  ],
  authority: [
    { label: 'Overview', href: '/authority/dashboard', icon: LayoutDashboard },
    { label: 'Violations', href: '/authority/violations', icon: AlertCircle },
    { label: 'Reports', href: '/authority/reports', icon: FileBarChart },
  ],
};

function roleFromPath(path: string): Role {
  const match = path.match(/^\/(admin|athlete|officer|laboratory|authority)/);
  return (match?.[1] as Role) || 'admin';
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function toneFor(value = '') {
  const normalized = value.toLowerCase();
  if (normalized.includes('positive') || normalized.includes('critical') || normalized.includes('open') || normalized.includes('urgent')) return 'danger';
  if (normalized.includes('pending') || normalized.includes('review') || normalized.includes('transit') || normalized.includes('warning')) return 'warning';
  if (normalized.includes('negative') || normalized.includes('complete') || normalized.includes('clear') || normalized.includes('closed') || normalized.includes('verified')) return 'success';
  return 'neutral';
}

function StatusPill({ value }: { value?: string }) {
  const tone = toneFor(value);
  return <span data-testid={`status-${value || 'unknown'}`} className={`status-pill status-${tone}`}><span className="status-dot" />{value || 'Not set'}</span>;
}

function Avatar({ name, accent = false }: { name: string; accent?: boolean }) {
  return <span data-testid={`avatar-${name.replace(/\s/g, '-').toLowerCase()}`} className={`avatar ${accent ? 'avatar-accent' : ''}`}>{initials(name)}</span>;
}

function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger' }) {
  return <button {...props} className={`action-button action-${variant} ${className}`}>{children}</button>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

function LoadingPanel({ label = 'Loading operational data' }: { label?: string }) {
  return <div data-testid="loading-panel" className="loading-panel"><Skeleton className="h-3 w-32" /><Skeleton className="h-8 w-52" /><p>{label}</p></div>;
}

function ErrorPanel({ onRetry, label = 'We could not load this view.' }: { onRetry?: () => void; label?: string }) {
  return <div data-testid="error-panel" className="empty-panel error-panel"><AlertCircle size={20} /><div><strong>{label}</strong><p>Check the connection, then try again.</p></div>{onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}</div>;
}

function EmptyPanel({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div data-testid="empty-panel" className="empty-panel"><div className="empty-mark"><ClipboardCheck size={20} /></div><div><strong>{title}</strong><p>{detail}</p></div>{action}</div>;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">Operational action</span><h2>{title}</h2></div><button data-testid="button-close-modal" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>;
}

function TableFrame({ children, empty }: { children: ReactNode; empty?: boolean }) {
  return <div className={`table-frame ${empty ? 'table-empty' : ''}`}>{children}</div>;
}

function PageIntro({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="page-intro rise-in"><div><div className="eyebrow">{eyebrow || 'Monitoring workspace'}</div><h1 data-testid="page-title">{title}</h1>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function MetricCards({ metrics }: { metrics?: { label: string; value: string; trend: string; tone: string }[] }) {
  if (!metrics?.length) return <div className="metrics-grid">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="metric-card h-32" />)}</div>;
  return <div className="metrics-grid">{metrics.map((metric, index) => <div data-testid={`metric-card-${index}`} className="metric-card rise-in" key={metric.label}><div className="metric-top"><span>{metric.label}</span><Activity size={15} /></div><strong>{metric.value}</strong><span className={`metric-trend trend-${metric.tone}`}>{metric.trend}</span></div>)}</div>;
}

function Dashboard({ role }: { role: Role }) {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const tests = useListTests(undefined, { query: { queryKey: getListTestsQueryKey() } });
  const notifications = useListNotifications({ query: { queryKey: getListNotificationsQueryKey() } });
  const title = role === 'admin' ? 'Control room' : `Good morning`;
  const detail = role === 'admin' ? 'A live view of testing integrity across your programme.' : `Your role-aware view of the anti-doping programme.`;
  const activity = summary.data?.activity || [];
  const statusBreakdown = summary.data?.statusBreakdown || [];
  return <><PageIntro eyebrow={`${roleNames[role]} / Today`} title={title} detail={detail} action={<div className="live-badge"><span />Live operational feed</div>} />
    <div className="dashboard-content">
      {summary.isLoading ? <LoadingPanel label="Assembling your operational summary" /> : summary.isError ? <ErrorPanel onRetry={() => summary.refetch()} /> : <MetricCards metrics={summary.data?.metrics} />}
      <div className="dashboard-grid">
        <section className="panel span-2 rise-in stagger-1"><div className="panel-head"><div><span className="eyebrow">Recent activity</span><h2>What needs attention</h2></div><Link data-testid="link-view-tests" className="text-link" href={`/${role}/tests`}>View register <ArrowRight size={14} /></Link></div>{activity.length ? <div className="activity-list">{activity.slice(0, 5).map((item) => <div className="activity-row" data-testid={`activity-${item.id}`} key={item.id}><span className={`activity-marker marker-${item.tone}`}><Activity size={14} /></span><div><strong>{item.title}</strong><p>{item.detail}</p></div><time>{item.time}</time></div>)}</div> : <EmptyPanel title="No recent activity" detail="The feed will appear as programme activity comes in." />}</section>
        <section className="panel rise-in stagger-2"><div className="panel-head"><div><span className="eyebrow">Programme health</span><h2>Status mix</h2></div><SlidersHorizontal size={17} /></div>{statusBreakdown.length ? <div className="breakdown-list">{statusBreakdown.map((item) => <div key={item.label}><div className="breakdown-label"><span>{item.label}</span><b>{item.value}</b></div><div className="bar"><span style={{ width: `${Math.min(item.value, 100)}%`, background: item.color }} /></div></div>)}</div> : <EmptyPanel title="No status mix yet" detail="Status reporting will populate after the first test." />}</section>
      </div>
      <div className="dashboard-grid bottom-grid">
        <section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">Upcoming</span><h2>Scheduled testing</h2></div><Link data-testid="link-schedule-test" className="text-link" href={`/${role === 'officer' ? 'officer' : 'admin'}/tests`}>Open register <ArrowRight size={14} /></Link></div>{tests.isLoading ? <div className="table-skeleton">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div> : tests.isError ? <ErrorPanel onRetry={() => tests.refetch()} /> : tests.data?.length ? <div className="mini-table"><div className="mini-row mini-head"><span>Test</span><span>Athlete</span><span>Date</span><span>Status</span></div>{tests.data.slice(0, 4).map((test) => <div className="mini-row" key={test.id}><span className="mono">{test.testNumber}</span><span><strong>{test.athlete}</strong><small>{test.sport}</small></span><span>{formatDate(test.scheduledDate)}</span><StatusPill value={test.status} /></div>)}</div> : <EmptyPanel title="No tests scheduled" detail="There are no scheduled tests in your current scope." />}</section>
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">Notifications</span><h2>Signal</h2></div><Bell size={17} /></div>{notifications.isLoading ? <Skeleton className="h-40 w-full" /> : notifications.data?.length ? <div className="signal-list">{notifications.data.slice(0, 3).map((notification) => <div key={notification.id} className={`signal-row ${notification.isRead ? '' : 'signal-unread'}`}><span className="signal-icon"><Bell size={14} /></span><div><strong>{notification.title}</strong><p>{notification.message}</p><small>{formatTime(notification.createdAt)}</small></div></div>)}</div> : <EmptyPanel title="All clear" detail="No new notifications." />}</section>
      </div>
    </div></>;
}

function RegisterHeader({ title, detail, action, search, setSearch }: { title: string; detail: string; action?: ReactNode; search?: string; setSearch?: (value: string) => void }) {
  return <><PageIntro eyebrow="Register" title={title} detail={detail} action={action} />{setSearch ? <div className="register-tools"><div className="search-box"><Search size={16} /><input data-testid={`input-search-${title.toLowerCase().replace(/\s/g, '-')}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or reference" /></div><Button variant="quiet"><SlidersHorizontal size={15} /> Filters</Button></div> : null}</>;
}

function TestsPage({ role }: { role: Role }) {
  const [search, setSearch] = useState('');
  const tests = useListTests(search ? { search } : undefined, { query: { queryKey: getListTestsQueryKey(search ? { search } : undefined) } });
  const filtered = (tests.data || []).filter((test) => `${test.testNumber} ${test.athlete} ${test.sport}`.toLowerCase().includes(search.toLowerCase()));
  const canCreate = role === 'officer';
  return <><RegisterHeader title={role === 'officer' ? 'Assigned tests' : 'Test register'} detail={role === 'officer' ? 'Keep each collection moving from appointment to secure sample.' : 'Every authorized collection, from scheduling to result.'} search={search} setSearch={setSearch} action={canCreate ? <Link data-testid="link-create-test" href="/officer/tests/create" className="action-button action-primary"><Plus size={16} /> Schedule test</Link> : undefined} /><div className="page-body">{tests.isLoading ? <LoadingPanel label="Loading authorized tests" /> : tests.isError ? <ErrorPanel onRetry={() => tests.refetch()} /> : filtered.length ? <TableFrame><table><thead><tr><th>Reference</th><th>Athlete</th><th>Sport</th><th>Scheduled</th><th>Type</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{filtered.map((test) => <tr data-testid={`row-test-${test.id}`} key={test.id}><td className="mono">{test.testNumber}</td><td><div className="person-cell"><Avatar name={test.athlete} /><span><strong>{test.athlete}</strong><small>{test.location}</small></span></div></td><td>{test.sport}</td><td>{formatDate(test.scheduledDate)}</td><td>{test.testType}</td><td><StatusPill value={test.status} /></td><td><Link data-testid={`link-test-${test.id}`} href={role === 'officer' ? `/officer/tests/${test.id}` : `/admin/tests`} className="row-action">Open <ArrowRight size={14} /></Link></td></tr>)}</tbody></table></TableFrame> : <EmptyPanel title="No tests match your search" detail="Try a different athlete, sport, or reference." action={search ? <Button variant="secondary" onClick={() => setSearch('')}>Clear search</Button> : undefined} />}</div></>;
}

function SamplesPage({ role }: { role: Role }) {
  const [selected, setSelected] = useState<string | null>(null);
  const samples = useListSamples({ query: { queryKey: getListSamplesQueryKey() } });
  const transition = useTransitionSample();
  const { toast } = useToast();
  const updateSample = (id: string, status: string) => transition.mutate({ id, data: { status } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSamplesQueryKey() }); toast({ title: 'Chain of custody updated', description: 'The sample status is now recorded.' }); }, onError: () => toast({ title: 'Update failed', description: 'The sample could not be transitioned.', variant: 'destructive' }) });
  const list = samples.data || [];
  return <><PageIntro eyebrow={`${roleNames[role]} / Chain of custody`} title={role === 'laboratory' ? 'Sample intake' : 'Samples'} detail="Protect the record at every hand-off. Status changes are auditable." /><div className="page-body">{samples.isLoading ? <LoadingPanel label="Loading sample chain of custody" /> : samples.isError ? <ErrorPanel onRetry={() => samples.refetch()} /> : list.length ? <TableFrame><table><thead><tr><th>Sample</th><th>Test / athlete</th><th>Type</th><th>Collected</th><th>Custody</th><th>Status</th><th /></tr></thead><tbody>{list.map((sample) => <tr key={sample.id}><td className="mono">{sample.sampleNumber}</td><td><strong>{sample.athlete}</strong><small className="block">{sample.testNumber}</small></td><td>{sample.type}</td><td>{formatDate(sample.collectedAt)}</td><td>{sample.custody}</td><td><StatusPill value={sample.status} /></td><td><Button data-testid={`button-transition-sample-${sample.id}`} variant="quiet" onClick={() => setSelected(sample.id)}>Update <ChevronDown size={14} /></Button></td></tr>)}</tbody></table></TableFrame> : <EmptyPanel title="No samples in scope" detail="Samples will appear here once a test has been collected." />}</div>{selected && <Modal title="Update sample custody" onClose={() => setSelected(null)}><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); updateSample(selected, String(form.get('status'))); setSelected(null); }}><Field label="Next status"><select name="status" defaultValue="RECEIVED"><option value="RECEIVED">Received</option><option value="UNDER_ANALYSIS">In analysis</option><option value="ANALYZED">Analyzed</option></select></Field><Field label="Record note"><textarea name="notes" placeholder="Optional hand-off note" /></Field><div className="modal-actions"><Button variant="quiet" type="button" onClick={() => setSelected(null)}>Cancel</Button><Button type="submit" disabled={transition.isPending}>{transition.isPending ? 'Saving…' : 'Record transition'}</Button></div></form></Modal>}</>;
}

function ResultsPage({ role }: { role: Role }) {
  const [search, setSearch] = useState('');
  const results = useListResults({ query: { queryKey: getListResultsQueryKey() } });
  const filtered = (results.data || []).filter((result) => `${result.sampleNumber} ${result.athlete} ${result.lab}`.toLowerCase().includes(search.toLowerCase()));
  const action = role === 'laboratory' ? <Link data-testid="link-create-result" href="/laboratory/results/create" className="action-button action-primary"><Plus size={16} /> Record result</Link> : undefined;
  return <><RegisterHeader title="Results" detail="Laboratory outcomes with a clear review trail." search={search} setSearch={setSearch} action={action} /><div className="page-body">{results.isLoading ? <LoadingPanel label="Loading laboratory results" /> : results.isError ? <ErrorPanel onRetry={() => results.refetch()} /> : filtered.length ? <TableFrame><table><thead><tr><th>Sample</th><th>Athlete</th><th>Laboratory</th><th>Method</th><th>Analysed</th><th>Finding</th></tr></thead><tbody>{filtered.map((result) => <tr key={result.id}><td className="mono">{result.sampleNumber}</td><td><strong>{result.athlete}</strong></td><td>{result.lab}</td><td>{result.method}</td><td>{formatDate(result.analyzedAt)}</td><td><StatusPill value={result.status} /></td></tr>)}</tbody></table></TableFrame> : <EmptyPanel title="No results available" detail="Results appear when a laboratory submits a completed analysis." />}</div></>;
}

function ViolationsPage({ role }: { role: Role }) {
  const violations = useListViolations({ query: { queryKey: getListViolationsQueryKey() } });
  const [selected, setSelected] = useState<string | null>(null);
  const update = useUpdateViolation();
  const { toast } = useToast();
  const list = violations.data || [];
  return <><PageIntro eyebrow={`${roleNames[role]} / Casework`} title="Violations" detail="Manage potential anti-doping rule violations with a consistent decision trail." /><div className="page-body">{violations.isLoading ? <LoadingPanel label="Loading casework" /> : violations.isError ? <ErrorPanel onRetry={() => violations.refetch()} /> : list.length ? <TableFrame><table><thead><tr><th>Case</th><th>Athlete</th><th>Substance / basis</th><th>Opened</th><th>Priority</th><th>Status</th><th /></tr></thead><tbody>{list.map((item) => <tr key={item.id}><td className="mono">{item.violationNumber}</td><td><div className="person-cell"><Avatar name={item.athlete} /><strong>{item.athlete}</strong></div></td><td>{item.substance}</td><td>{formatDate(item.openedAt)}</td><td><StatusPill value={item.priority} /></td><td><StatusPill value={item.status} /></td><td>{role === 'authority' ? <Link data-testid={`link-violation-${item.id}`} className="row-action" href={`/authority/violations/${item.id}`}>Review <ArrowRight size={14} /></Link> : <Button variant="quiet" onClick={() => setSelected(item.id)}>Update</Button>}</td></tr>)}</tbody></table></TableFrame> : <EmptyPanel title="No violations on record" detail="Potential cases will appear here when a review is opened." />}</div>{selected && <Modal title="Update case status" onClose={() => setSelected(null)}><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); update.mutate({ id: selected, data: { status: String(form.get('status')), action: String(form.get('action')) } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListViolationsQueryKey() }); setSelected(null); toast({ title: 'Case updated', description: 'The violation record was updated.' }); }, onError: () => toast({ title: 'Could not update case', variant: 'destructive' }) }); }}><Field label="Status"><select name="status" defaultValue="UNDER_REVIEW"><option value="OPEN">Open</option><option value="UNDER_REVIEW">Under review</option><option value="ACTION_TAKEN">Action taken</option><option value="CLOSED">Closed</option></select></Field><Field label="Next action"><input name="action" placeholder="e.g. Notify athlete" /></Field><div className="modal-actions"><Button type="button" variant="quiet" onClick={() => setSelected(null)}>Cancel</Button><Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save case'}</Button></div></form></Modal>}</>;
}

function ReportsPage() {
  const reports = useGetReportSummary({ query: { queryKey: getGetReportSummaryQueryKey() } });
  const data = reports.data;
  return <><PageIntro eyebrow="Intelligence" title="Reports" detail="A measured view of programme activity, result mix, and laboratory performance." action={<Button variant="secondary"><FileText size={15} /> Export report</Button>} /><div className="page-body">{reports.isLoading ? <LoadingPanel label="Preparing report summary" /> : reports.isError ? <ErrorPanel onRetry={() => reports.refetch()} /> : data ? <div className="report-grid"><section className="panel report-chart"><div className="panel-head"><div><span className="eyebrow">Monthly testing</span><h2>Throughput and outcomes</h2></div><span className="mono small">LAST 6 MONTHS</span></div><div className="bars">{data.monthly.map((month) => <div className="bar-col" key={month.month}><div className="bar-stack"><span className="bar-positive" style={{ height: `${Math.max(5, month.positive * 2)}%` }} /><span className="bar-negative" style={{ height: `${Math.max(5, month.negative / Math.max(month.tests, 1) * 100)}%` }} /></div><small>{month.month}</small><b>{month.tests}</b></div>)}</div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">Result mix</span><h2>Programme signal</h2></div></div><div className="breakdown-list report-breakdown">{data.resultMix.map((item) => <div key={item.label}><div className="breakdown-label"><span><i style={{ background: item.color }} />{item.label}</span><b>{item.value}%</b></div><div className="bar"><span style={{ width: `${item.value}%`, background: item.color }} /></div></div>)}</div></section><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">Laboratory performance</span><h2>Turnaround by partner</h2></div></div><TableFrame><table><thead><tr><th>Laboratory</th><th>Samples processed</th><th>Median turnaround</th></tr></thead><tbody>{data.labPerformance.map((lab) => <tr key={lab.name}><td><div className="person-cell"><span className="lab-mark"><FlaskConical size={15} /></span><strong>{lab.name}</strong></div></td><td>{lab.samples}</td><td><span className="mono">{lab.turnaround}</span></td></tr>)}</tbody></table></TableFrame></section></div> : <EmptyPanel title="Report data is not ready" detail="Reports will appear when programme activity has been recorded." />}</div></>;
}

function UsersPage({ kind }: { kind: 'users' | 'athletes' | 'officers' | 'laboratories' }) {
  const rows = kind === 'athletes' ? [{ name: 'Amara Okafor', detail: 'Athletics · Kenya', status: 'Verified' }, { name: 'Jonas Meyer', detail: 'Cycling · Germany', status: 'Verified' }, { name: 'Lena Petrova', detail: 'Swimming · Bulgaria', status: 'Review' }] : kind === 'officers' ? [{ name: 'Mikael Brandt', detail: 'Northern Europe · DCO-018', status: 'Active' }, { name: 'Sofia Williams', detail: 'Central region · DCO-041', status: 'Active' }] : kind === 'laboratories' ? [{ name: 'Nordic Analytical Centre', detail: 'Helsinki · Accredited', status: 'Active' }, { name: 'Meridian Sport Lab', detail: 'London · Accredited', status: 'Active' }] : [{ name: 'Elena Marquez', detail: 'Administrator · elena@clean-sport.org', status: 'Active' }, { name: 'Ravi Shah', detail: 'Authority · ravi@clean-sport.org', status: 'Active' }, { name: 'Sofia Williams', detail: 'DCO · sofia@clean-sport.org', status: 'Active' }];
  const labels = { users: 'Users', athletes: 'Athletes', officers: 'Officers', laboratories: 'Laboratories' };
  return <><PageIntro eyebrow="Administration" title={labels[kind]} detail={`Maintain the ${kind} directory and keep access information current.`} action={<Button><Plus size={16} /> Add {kind === 'users' ? 'user' : kind.slice(0, -1)}</Button>} /><div className="page-body"><div className="directory-grid">{rows.map((row, index) => <div className="directory-card rise-in" key={row.name}><Avatar name={row.name} accent={kind === 'athletes'} /><div className="directory-copy"><strong>{row.name}</strong><p>{row.detail}</p><StatusPill value={row.status} /></div><button data-testid={`button-directory-menu-${index}`} className="icon-button"><MoreHorizontal size={18} /></button></div>)}</div></div></>;
}

function TestCreate() {
  const create = useCreateTest();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); create.mutate({ data: { athlete: String(form.get('athlete')), scheduledDate: String(form.get('scheduledDate')), location: String(form.get('location')), testType: String(form.get('testType')) } }, { onSuccess: (test) => { queryClient.invalidateQueries({ queryKey: getListTestsQueryKey() }); toast({ title: 'Test scheduled', description: `${test.testNumber} is ready for collection.` }); setLocation(`/officer/tests/${test.id}`); }, onError: () => toast({ title: 'Could not schedule test', description: 'Review the fields and try again.', variant: 'destructive' }) }); };
  return <><PageIntro eyebrow="Assigned tests / New" title="Schedule a test" detail="Create an authorized collection appointment with the minimum necessary detail." /><div className="page-body form-layout"><form className="panel form-card" onSubmit={submit}><div className="form-section"><span className="eyebrow">Collection details</span><h2>Set the appointment</h2><p className="form-note">The athlete and appointment details are visible to the assigned operational team.</p></div><Field label="Athlete"><input required name="athlete" placeholder="Full legal name" /></Field><div className="form-two"><Field label="Scheduled date and time"><input required name="scheduledDate" type="datetime-local" /></Field><Field label="Test type"><select name="testType" defaultValue="In-competition"><option>In-competition</option><option>Out-of-competition</option><option>Targeted</option><option>Follow-up</option></select></Field></div><Field label="Collection location"><input required name="location" placeholder="Venue, training centre, or address" /></Field><div className="form-footer"><span className="secure-note"><ShieldCheck size={15} /> Saved to the secure register</span><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Scheduling…' : 'Schedule test'} <ArrowRight size={15} /></Button></div></form><aside className="side-note"><Sparkles size={18} /><h3>Before you submit</h3><p>Confirm the athlete identity and use a location specific enough for the collection record.</p><div className="note-line"><CheckCircle2 size={15} /> No sample is created yet</div><div className="note-line"><CheckCircle2 size={15} /> Assignment can be updated later</div></aside></div></>;
}

function TestDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const test = useGetTest(id, { query: { queryKey: [`/api/tests/${id}`], enabled: Boolean(id) } });
  const update = useUpdateTest();
  const { toast } = useToast();
  const item = test.data;
  const save = (status: string) => update.mutate({ id, data: { status } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTestsQueryKey() }); toast({ title: 'Test updated', description: `Status changed to ${status}.` }); }, onError: () => toast({ title: 'Could not update test', variant: 'destructive' }) });
  return <><PageIntro eyebrow="Test register / Detail" title={item?.testNumber || 'Test detail'} detail={item ? `${item.athlete} · ${item.sport}` : 'Review collection instructions and current status.'} action={<Link data-testid="link-back-tests" href="/officer/tests" className="action-button action-secondary"><ArrowLeft size={15} /> Back to tests</Link>} /><div className="page-body">{test.isLoading ? <LoadingPanel /> : test.isError ? <ErrorPanel onRetry={() => test.refetch()} /> : item ? <div className="detail-grid"><section className="panel detail-main"><div className="detail-banner"><div><span className="eyebrow">Collection status</span><h2>{item.status}</h2></div><StatusPill value={item.status} /></div><div className="detail-facts"><div><small>Athlete</small><strong>{item.athlete}</strong></div><div><small>Location</small><strong>{item.location}</strong></div><div><small>Appointment</small><strong>{formatDate(item.scheduledDate)}</strong></div><div><small>Test type</small><strong>{item.testType}</strong></div><div><small>Officer</small><strong>{item.officer}</strong></div><div><small>Result</small><strong>{item.result || 'Pending analysis'}</strong></div></div><div className="detail-actions"><span className="eyebrow">Move test forward</span><div><Button variant="secondary" onClick={() => save('SAMPLE_COLLECTED')} disabled={update.isPending}><Check size={15} /> Mark collected</Button><Button onClick={() => save('COMPLETED')} disabled={update.isPending}>Complete test</Button></div></div></section><aside className="panel timeline"><div className="panel-head"><div><span className="eyebrow">Audit trail</span><h2>Record history</h2></div><Clock3 size={17} /></div><div className="timeline-list"><div><span className="timeline-dot done" /><p><strong>Test authorized</strong><small>Scheduled into the programme</small></p></div><div><span className="timeline-dot done" /><p><strong>Officer assigned</strong><small>{item.officer}</small></p></div><div><span className="timeline-dot" /><p><strong>Collection pending</strong><small>Awaiting next recorded action</small></p></div></div></aside></div> : <EmptyPanel title="Test not found" detail="This record may have moved out of your scope." />}</div></>;
}

function ResultCreate() {
  const create = useCreateResult();
  const samples = useListSamples({ query: { queryKey: getListSamplesQueryKey() } });
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); create.mutate({ data: { sampleId: String(form.get('sampleId')), status: String(form.get('status')), method: String(form.get('method')), findings: String(form.get('findings')) } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() }); toast({ title: 'Result recorded', description: 'The laboratory result is now in the review queue.' }); setLocation('/laboratory/results'); }, onError: () => toast({ title: 'Could not record result', variant: 'destructive' }) }); };
  return <><PageIntro eyebrow="Laboratory / Results / New" title="Record a result" detail="Submit a complete analytical record for review." /><div className="page-body form-layout"><form className="panel form-card" onSubmit={submit}><div className="form-section"><span className="eyebrow">Analytical record</span><h2>Identify the sample</h2></div><Field label="Sample"><select required name="sampleId" defaultValue=""><option value="" disabled>Select a sample</option>{(samples.data || []).map((sample) => <option key={sample.id} value={sample.id}>{sample.sampleNumber} · {sample.athlete}</option>)}</select></Field><div className="form-two"><Field label="Result status"><select name="status" defaultValue="NEGATIVE"><option value="NEGATIVE">Negative</option><option value="POSITIVE">Positive</option><option value="INCONCLUSIVE">Inconclusive</option><option value="INVALID">Invalid</option></select></Field><Field label="Method"><input required name="method" defaultValue="LC-MS/MS" /></Field></div><Field label="Findings"><textarea required name="findings" rows={5} placeholder="Document the analytical finding and relevant context" /></Field><div className="form-footer"><span className="secure-note"><FlaskConical size={15} /> Laboratory record</span><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Submitting…' : 'Submit result'} <ArrowRight size={15} /></Button></div></form><aside className="side-note"><Beaker size={18} /><h3>Quality checkpoint</h3><p>Use the sample number on the container, then record the exact analytical method and finding.</p></aside></div></>;
}

function NotificationsPage() {
  const notifications = useListNotifications({ query: { queryKey: getListNotificationsQueryKey() } });
  const markAll = useMarkAllNotificationsRead();
  const { toast } = useToast();
  return <><PageIntro eyebrow="Athlete / Updates" title="Notifications" detail="Important programme notices, collection reminders, and case updates." action={<Button variant="secondary" onClick={() => markAll.mutate(undefined, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }); toast({ title: 'Notifications cleared', description: 'All notifications are marked as read.' }); } })} disabled={markAll.isPending}><Check size={15} /> Mark all read</Button>} /><div className="page-body"><section className="panel notifications-panel">{notifications.isLoading ? <LoadingPanel /> : notifications.isError ? <ErrorPanel onRetry={() => notifications.refetch()} /> : notifications.data?.length ? notifications.data.map((notification) => <div className={`notification-row ${notification.isRead ? '' : 'notification-unread'}`} key={notification.id}><span className={`notification-symbol symbol-${notification.type}`}><Bell size={16} /></span><div><div className="notification-title"><strong>{notification.title}</strong>{!notification.isRead && <span className="unread-label">Unread</span>}</div><p>{notification.message}</p><small>{formatTime(notification.createdAt)}</small></div></div>) : <EmptyPanel title="Nothing new" detail="You are up to date with programme notifications." />}</section></div></>;
}

function ProfilePage() {
  const user = useGetCurrentUser();
  return <><PageIntro eyebrow="Athlete / Account" title="My profile" detail="Your identity and programme contact details." /><div className="page-body profile-layout"><section className="panel profile-card"><div className="profile-hero"><Avatar name={user.data?.name || 'Athlete'} accent /><div><span className="eyebrow">Verified account</span><h2>{user.data?.name || 'Athlete account'}</h2><p>{user.data?.email || 'Loading profile details'}</p></div></div><div className="detail-facts"><div><small>Role</small><strong>{user.data?.role || 'Athlete'}</strong></div><div><small>Account reference</small><strong>{user.data?.id || '—'}</strong></div></div><div className="profile-notice"><ShieldCheck size={16} /><span>Your profile is managed by your anti-doping organization. Contact them if these details need to change.</span></div></section></div></>;
}

function Login() {
  const login = useLogin();
  const health = useHealthCheck();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('admin@safeguard.test');
  const [password, setPassword] = useState('demo');
  const [error, setError] = useState('');
  const accounts: { role: Role; email: string; name: string }[] = [
    { role: 'admin', email: 'admin@safeguard.test', name: 'Maya Chen' },
    { role: 'athlete', email: 'athlete@safeguard.test', name: 'Aarav Mehta' },
    { role: 'officer', email: 'officer@safeguard.test', name: 'Jon Bell' },
    { role: 'laboratory', email: 'lab@safeguard.test', name: 'Dr. Elena Rossi' },
    { role: 'authority', email: 'authority@safeguard.test', name: 'Nia Okafor' },
  ];
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(''); login.mutate({ data: { email, password } }, { onSuccess: (session) => { window.localStorage.setItem('clearline_access_token', session.accessToken); const role = roleKey(session.user.role); setLocation(roleRoutes[role]); }, onError: () => setError('Sign-in was not accepted. Use one of the development accounts below.') }); };
  return <div className="login-shell app-noise"><div className="login-visual"><div className="brand-lockup"><span className="brand-mark"><ShieldCheck size={20} /></span><span>Clearline <b>Monitor</b></span></div><div className="login-statement"><span className="eyebrow">Anti-doping operations</span><h1>Protect the record.<br /><em>Protect the sport.</em></h1><p>One calm workspace for every decision, hand-off, and result that keeps competition fair.</p></div><div className="login-footer"><span>SECURE COMPLIANCE WORKSPACE</span><span className="mono">v0.1 / DEVELOPMENT</span></div></div><div className="login-panel"><div className="login-form-wrap"><div className="mobile-brand"><span className="brand-mark"><ShieldCheck size={18} /></span>Clearline <b>Monitor</b></div><div className="eyebrow">Welcome back</div><h2>Sign in to your workspace</h2><p className="login-lede">Access depends on your operational role. Choose a seeded account to begin.</p><form onSubmit={submit} className="login-form"><Field label="Work email"><input data-testid="input-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field label="Password"><input data-testid="input-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>{error && <div className="form-error"><AlertCircle size={15} />{error}</div>}<Button data-testid="button-login" type="submit" className="login-submit" disabled={login.isPending}>{login.isPending ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></Button></form><div className="dev-accounts"><div className="dev-heading"><span>Development-only role switch</span><span className={`api-status ${health.isSuccess ? 'online' : ''}`}><span />{health.isSuccess ? 'API online' : 'Checking API'}</span></div>{accounts.map((account) => <button data-testid={`button-account-${account.role}`} className={`account-chip ${email === account.email ? 'selected' : ''}`} key={account.role} onClick={() => { setEmail(account.email); setPassword('demo'); }}><Avatar name={account.name} /><span><strong>{roleNames[account.role]}</strong><small>{account.email}</small></span><ArrowRight size={14} /></button>)}</div><p className="login-disclaimer">Development accounts are provided for local evaluation only. Production access is managed by your organization.</p></div></div></div>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const role = roleFromPath(location);
  const user = useGetCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = navByRole[role];
  const displayName = user.data?.name || roleNames[role];
  const unreadQuery = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), enabled: role === 'athlete' } });
  const unread = unreadQuery.data?.filter((item) => !item.isRead).length || 0;
  const signOut = () => { queryClient.clear(); window.localStorage.removeItem('clearline_access_token'); setLocation('/login'); };
  return <div className="app-shell app-noise"><aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><span className="brand-mark"><ShieldCheck size={18} /></span><span>Clearline <b>Monitor</b></span><button data-testid="button-close-menu" className="icon-button mobile-only" onClick={() => setMobileOpen(false)}><X size={18} /></button></div><div className="role-switch"><span>Signed in as</span><strong>{roleNames[role]}</strong><ChevronDown size={14} /></div><nav className="side-nav">{nav.map((item) => { const Icon = item.icon; const active = location === item.href; return <Link data-testid={`link-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`} onClick={() => setMobileOpen(false)} className={`side-link ${active ? 'side-active' : ''}`} href={item.href} key={item.href}><Icon size={17} /><span>{item.label}</span>{item.label === 'Notifications' && unread > 0 && <b className="nav-count">{unread}</b>}</Link>; })}</nav><div className="sidebar-bottom"><div className="support-box"><div><span className="support-dot" /><span>System operational</span></div><small>Last checked just now</small></div><button data-testid="button-signout" className="user-mini" onClick={signOut}><Avatar name={displayName} /><span><strong>{displayName}</strong><small>Sign out</small></span><ArrowRight size={14} /></button></div></aside><div className="main-shell"><header className="topbar"><button data-testid="button-open-menu" className="icon-button mobile-only" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Clearline Monitor</span><b>/</b><strong>{roleNames[role]}</strong></div><div className="topbar-actions"><div className="topbar-search"><Search size={15} /><span>Search register</span><kbd>⌘ K</kbd></div><Link data-testid="link-header-notifications" href={role === 'athlete' ? '/athlete/notifications' : `/${role}/dashboard`} className="notification-button"><Bell size={18} />{unread > 0 && <i />}</Link><div className="topbar-user"><Avatar name={displayName} /><span>{displayName}</span></div></div></header><main className="content-area">{children}</main></div></div>;
}

function AdminDashboard() { return <Dashboard role="admin" />; }
function AthleteDashboard() { return <Dashboard role="athlete" />; }
function OfficerDashboard() { return <Dashboard role="officer" />; }
function LaboratoryDashboard() { return <Dashboard role="laboratory" />; }
function AuthorityDashboard() { return <Dashboard role="authority" />; }

function AppRouter() {
  const [location] = useLocation();
  const role = roleFromPath(location);
  if (location === '/login' || location === '/') return <Switch><Route path="/login" component={Login} /><Route path="/" component={Login} /></Switch>;
  return <Shell><Switch>
    <Route path="/admin/dashboard" component={AdminDashboard} />
    <Route path="/admin/users"><UsersPage kind="users" /></Route>
    <Route path="/admin/athletes"><UsersPage kind="athletes" /></Route>
    <Route path="/admin/officers"><UsersPage kind="officers" /></Route>
    <Route path="/admin/laboratories"><UsersPage kind="laboratories" /></Route>
    <Route path="/admin/tests"><TestsPage role="admin" /></Route>
    <Route path="/admin/samples"><SamplesPage role="admin" /></Route>
    <Route path="/admin/results"><ResultsPage role="admin" /></Route>
    <Route path="/admin/violations"><ViolationsPage role="admin" /></Route>
    <Route path="/admin/reports"><ReportsPage /></Route>
    <Route path="/athlete/dashboard" component={AthleteDashboard} />
    <Route path="/athlete/profile" component={ProfilePage} />
    <Route path="/athlete/tests"><TestsPage role="athlete" /></Route>
    <Route path="/athlete/results"><ResultsPage role="athlete" /></Route>
    <Route path="/athlete/violations"><ViolationsPage role="athlete" /></Route>
    <Route path="/athlete/notifications" component={NotificationsPage} />
    <Route path="/officer/dashboard" component={OfficerDashboard} />
    <Route path="/officer/tests/create" component={TestCreate} />
    <Route path="/officer/tests/:id" component={TestDetail} />
    <Route path="/officer/tests"><TestsPage role="officer" /></Route>
    <Route path="/officer/samples"><SamplesPage role="officer" /></Route>
    <Route path="/laboratory/dashboard" component={LaboratoryDashboard} />
    <Route path="/laboratory/samples"><SamplesPage role="laboratory" /></Route>
    <Route path="/laboratory/samples/:id"><SamplesPage role="laboratory" /></Route>
    <Route path="/laboratory/results/create" component={ResultCreate} />
    <Route path="/laboratory/results"><ResultsPage role="laboratory" /></Route>
    <Route path="/authority/dashboard" component={AuthorityDashboard} />
    <Route path="/authority/violations/:id"><ViolationsPage role="authority" /></Route>
    <Route path="/authority/violations"><ViolationsPage role="authority" /></Route>
    <Route path="/authority/reports" component={ReportsPage} />
    <Route><div className="not-found"><AlertCircle size={28} /><h1>Page not found</h1><p>The route does not exist in this workspace.</p><Link className="action-button action-primary" href={`/${role}/dashboard`}>Return to overview</Link></div></Route>
  </Switch></Shell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><AppRouter /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;