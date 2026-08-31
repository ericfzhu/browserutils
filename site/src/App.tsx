import { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  Download,
  ExternalLink,
  Focus,
  LayoutDashboard,
  Menu,
  Shield,
  Timer,
  X,
} from 'lucide-react';

const previewTabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'blocked', label: 'Blocked sites', icon: Shield },
  { id: 'limits', label: 'Daily limits', icon: Timer },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
] as const;

type PreviewTab = (typeof previewTabs)[number]['id'];

const capabilityRows = [
  { number: '01', title: 'Observe', note: 'Usage tracking and daily activity structure.' },
  { number: '02', title: 'Interrupt', note: 'Blocked pages, schedules, and protected access.' },
  { number: '03', title: 'Limit', note: 'Daily allowances and deliberate overrides.' },
  { number: '04', title: 'Review', note: 'Metrics, focus sessions, and longer-term patterns.' },
];

function Mark() {
  return (
    <span className="flex size-9 items-center justify-center bg-ink text-white" aria-hidden="true">
      <Shield className="size-[18px]" strokeWidth={2.25} />
    </span>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-canvas/95 backdrop-blur-sm">
      <div className="site-grid flex h-16 items-center justify-between">
        <a href="#top" className="flex min-h-10 items-center gap-3 font-semibold">
          <Mark />
          <span>BrowserUtils</span>
        </a>

        <nav className="hidden items-center gap-8 text-sm md:flex" aria-label="Main navigation">
          <a className="min-h-10 py-2.5 text-quiet transition-colors duration-150 hover:text-ink" href="#product">Product</a>
          <a className="min-h-10 py-2.5 text-quiet transition-colors duration-150 hover:text-ink" href="#capabilities">Capabilities</a>
          <a className="min-h-10 py-2.5 text-quiet transition-colors duration-150 hover:text-ink" href="#install">Install</a>
          <a className="hairline-button" href="https://github.com/ericfzhu/browserutils">
            <Code2 className="size-4" /> Source
          </a>
        </nav>

        <button
          className="flex size-10 items-center justify-center border md:hidden"
          type="button"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen && (
        <nav className="site-grid flex flex-col border-t py-3 md:hidden" aria-label="Mobile navigation">
          {['Product', 'Capabilities', 'Install'].map((item) => (
            <a
              key={item}
              className="flex min-h-11 items-center justify-between border-b text-sm"
              href={`#${item.toLowerCase()}`}
              onClick={() => setMenuOpen(false)}
            >
              {item}<ChevronRight className="size-4" />
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="site-grid flex min-h-[calc(100svh-4rem)] flex-col justify-between py-10 md:py-14">
      <div className="flex items-start justify-between border-t border-ink pt-3">
        <span className="eyebrow">Chrome extension / v1.0.0</span>
        <span className="eyebrow hidden sm:block">Local-first tools for attention</span>
      </div>

      <div className="max-w-5xl py-16 md:py-24">
        <h1 className="text-[clamp(4rem,12vw,10.5rem)] font-semibold leading-[0.78] tracking-[-0.055em]">
          Browser<br />Utils<span className="text-signal">.</span>
        </h1>
        <div className="mt-10 grid gap-8 border-t pt-6 md:grid-cols-[1fr_1fr] md:items-end">
          <p className="max-w-xl text-xl leading-snug md:text-2xl">
            A working space for the primary product statement and a short description.
          </p>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <a className="solid-button" href="#install"><Download className="size-4" /> Download</a>
            <a className="hairline-button" href="#product">Explore structure <ArrowDown className="size-4" /></a>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between border-b border-ink pb-3">
        <span className="eyebrow">Block / Track / Focus</span>
        <span className="font-mono text-xs tabular-nums">Scroll 01—04</span>
      </div>
    </section>
  );
}

function OverviewPreview() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[
        ['Tracked today', '3h 42m', Clock3],
        ['Sites blocked', '14', Shield],
        ['Focus time', '1h 25m', Focus],
      ].map(([label, value, Icon]) => (
        <div key={String(label)} className="border bg-white p-4 shadow-[0_2px_0_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs text-quiet">
            <span>{String(label)}</span><Icon className="size-4" />
          </div>
          <p className="mt-5 text-3xl font-semibold tabular-nums">{String(value)}</p>
        </div>
      ))}
      <div className="border bg-white p-5 lg:col-span-2">
        <div className="flex items-center justify-between"><strong className="text-sm">Today</strong><span className="text-xs text-quiet">Activity</span></div>
        <div className="mt-8 space-y-4">
          {[['youtube.com', '42%'], ['github.com', '31%'], ['reddit.com', '18%']].map(([site, width]) => (
            <div key={site} className="grid grid-cols-[100px_1fr] items-center gap-4 text-xs">
              <span className="truncate">{site}</span>
              <div className="h-3 bg-[#ececea]"><div className="h-full bg-ink" style={{ width }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="border bg-white p-5">
        <div className="flex items-center justify-between"><strong className="text-sm">Current focus</strong><Focus className="size-4" /></div>
        <div className="flex min-h-36 flex-col justify-end">
          <p className="text-4xl font-semibold tabular-nums">24:16</p>
          <p className="mt-1 text-xs text-quiet">Session in progress</p>
        </div>
      </div>
    </div>
  );
}

function BlockedPreview() {
  return (
    <div className="border bg-white">
      <div className="flex items-center justify-between border-b px-5 py-4"><strong className="text-sm">Blocked sites</strong><button className="hairline-button">Add site</button></div>
      {['reddit.com', 'youtube.com', 'x.com'].map((site, index) => (
        <div key={site} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-4 border-b px-5 last:border-b-0">
          <div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center bg-[#ececea] text-xs font-semibold">{site[0].toUpperCase()}</span><span className="text-sm font-medium">{site}</span></div>
          <span className={`h-6 w-11 border border-ink p-0.5 ${index < 2 ? 'bg-ink' : 'bg-white'}`}><span className={`block size-[18px] bg-white transition-transform duration-150 ${index < 2 ? 'translate-x-[18px]' : ''}`} /></span>
        </div>
      ))}
    </div>
  );
}

function LimitsPreview() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[
        ['youtube.com', '1h 42m / 2h', 84],
        ['reddit.com', '38m / 45m', 82],
        ['instagram.com', '20m / 30m', 66],
        ['news', '15m / 1h', 25],
      ].map(([site, time, progress]) => (
        <div key={String(site)} className="border bg-white p-5">
          <div className="flex items-center justify-between"><strong className="text-sm">{String(site)}</strong><span className="font-mono text-xs tabular-nums text-quiet">{String(time)}</span></div>
          <div className="mt-8 h-2 bg-[#ececea]"><div className="h-full bg-ink" style={{ width: `${progress}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function MetricsPreview() {
  const bars = [38, 55, 43, 78, 64, 91, 57];
  return (
    <div className="border bg-white p-5">
      <div className="flex items-start justify-between"><div><strong className="text-sm">Last seven days</strong><p className="mt-1 text-xs text-quiet">Tracked browsing time</p></div><span className="font-mono text-xs">WEEK 34</span></div>
      <div className="mt-10 flex h-48 items-end gap-3 border-b border-l px-3 pt-4">
        {bars.map((height, index) => <div key={index} className="flex-1 bg-ink transition-[height,background-color] duration-200 hover:bg-signal" style={{ height: `${height}%` }} />)}
      </div>
      <div className="mt-3 grid grid-cols-7 px-3 text-center font-mono text-[10px] text-quiet">{['M','T','W','T','F','S','S'].map((day, i) => <span key={`${day}-${i}`}>{day}</span>)}</div>
    </div>
  );
}

function ProductPreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('overview');

  return (
    <section id="product" className="border-y border-ink bg-[#e9e9e6] py-20 md:py-28">
      <div className="site-grid">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="eyebrow">Product demonstration</p>
            <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-tight md:text-6xl">The extension should explain itself.</h2>
          </div>
          <p className="max-w-xl self-end text-lg text-quiet lg:justify-self-end">
            This area holds the eventual product narrative. For now, use the controls below to test the basic showcase structure.
          </p>
        </div>

        <div className="mt-14 overflow-hidden border border-ink bg-panel shadow-[6px_6px_0_#171717]">
          <div className="flex h-12 items-center gap-2 border-b border-ink bg-canvas px-4">
            <span className="size-2.5 rounded-full bg-ink/20" /><span className="size-2.5 rounded-full bg-ink/20" /><span className="size-2.5 rounded-full bg-ink/20" />
            <div className="mx-auto hidden w-[42%] border bg-white px-3 py-1.5 font-mono text-[10px] text-quiet sm:block">chrome-extension://browserutils/dashboard</div>
          </div>

          <div className="grid min-h-[560px] md:grid-cols-[220px_1fr]">
            <aside className="border-b border-ink bg-[#efefed] p-4 md:border-b-0 md:border-r">
              <div className="mb-7 flex items-center gap-3"><Mark /><div><strong className="block text-sm">BrowserUtils</strong><span className="text-[11px] text-quiet">Focus & productivity</span></div></div>
              <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
                {previewTabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex min-h-11 items-center gap-2 border-l-2 px-3 text-left text-xs font-medium transition-[background-color,color,border-color] duration-150 ${activeTab === id ? 'border-ink bg-ink text-white' : 'border-transparent text-quiet hover:border-ink hover:bg-white hover:text-ink'}`}
                  >
                    <Icon className="size-4 shrink-0" />{label}
                  </button>
                ))}
              </div>
            </aside>

            <div className="min-w-0 p-4 sm:p-6 md:p-8">
              <div className="mb-7 flex items-end justify-between border-b pb-4">
                <div><span className="eyebrow">Interactive preview</span><h3 className="mt-1 text-2xl font-semibold capitalize">{activeTab === 'blocked' ? 'Blocked sites' : activeTab}</h3></div>
                <span className="hidden font-mono text-[10px] text-quiet sm:block">SAMPLE DATA</span>
              </div>
              {activeTab === 'overview' && <OverviewPreview />}
              {activeTab === 'blocked' && <BlockedPreview />}
              {activeTab === 'limits' && <LimitsPreview />}
              {activeTab === 'metrics' && <MetricsPreview />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section id="capabilities" className="site-grid py-20 md:py-28">
      <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div><p className="eyebrow">Page sequence</p><h2 className="mt-5 text-4xl font-semibold md:text-5xl">Four product moments.</h2></div>
        <div className="border-t border-ink">
          {capabilityRows.map(({ number, title, note }) => (
            <div key={number} className="group grid min-h-32 grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-ink transition-colors duration-150 hover:bg-white md:grid-cols-[80px_1fr_1fr_auto]">
              <span className="pl-3 font-mono text-xs tabular-nums text-quiet md:pl-5">{number}</span>
              <h3 className="text-2xl font-semibold md:text-3xl">{title}</h3>
              <p className="hidden max-w-sm text-sm text-quiet md:block">{note}</p>
              <ArrowRight className="mr-3 size-5 transition-transform duration-150 group-hover:translate-x-1 md:mr-5" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Install() {
  return (
    <section id="install" className="border-t border-ink bg-ink text-white">
      <div className="site-grid grid min-h-[520px] gap-12 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">Release and installation</p>
          <h2 className="mt-5 max-w-xl text-5xl font-semibold leading-[0.95] md:text-7xl">A clear final action belongs here.</h2>
          <div className="mt-10 flex flex-wrap gap-3">
            <a className="inline-flex min-h-11 items-center gap-2 border border-white bg-white px-4 text-sm font-medium text-ink transition-colors duration-150 hover:bg-signal hover:text-white" href="https://github.com/ericfzhu/browserutils/releases/latest"><Download className="size-4" /> Latest release</a>
            <a className="inline-flex min-h-11 items-center gap-2 border border-white/50 px-4 text-sm font-medium transition-colors duration-150 hover:border-white hover:bg-white hover:text-ink" href="https://github.com/ericfzhu/browserutils"><Code2 className="size-4" /> View source</a>
          </div>
        </div>
        <div className="border border-white/35">
          {[
            ['01', 'Download the release'],
            ['02', 'Load the extension'],
            ['03', 'Keep data in your browser'],
          ].map(([number, label]) => (
            <div key={number} className="grid min-h-20 grid-cols-[52px_1fr_auto] items-center border-b border-white/35 px-4 last:border-b-0">
              <span className="font-mono text-xs text-white/55">{number}</span><span className="text-sm">{label}</span><Check className="size-4 text-white/55" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/20 bg-ink text-white">
      <div className="site-grid flex flex-col gap-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>BrowserUtils / 2026</span>
        <div className="flex flex-wrap gap-6 text-white/65">
          <a className="transition-colors duration-150 hover:text-white" href="https://ericfzhu.com/works">Back to Works</a>
          <a className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-white" href="https://github.com/ericfzhu/browserutils">GitHub <ExternalLink className="size-3" /></a>
          <a className="transition-colors duration-150 hover:text-white" href="#top">Top</a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Header />
      <main>
        <Hero />
        <ProductPreview />
        <Capabilities />
        <Install />
      </main>
      <Footer />
    </div>
  );
}
