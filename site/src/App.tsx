import { useEffect, useState } from 'react';
import {
  ArrowDown,
  BarChart3,
  ChevronRight,
  Clock3,
  Code2,
  Download,
  ExternalLink,
  Focus,
  LayoutDashboard,
  Menu,
  Pause,
  Play,
  RotateCcw,
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

const installationSteps = [
  {
    number: '01',
    title: 'get the release.',
    detail: <>Download <code className="font-mono text-white">browserutils-v1.0.0.zip</code> from GitHub.</>,
  },
  {
    number: '02',
    title: 'unpack it.',
    detail: <>Unzip the download and keep the folder somewhere permanent.</>,
  },
  {
    number: '03',
    title: 'open extensions.',
    detail: <>Enter <code className="font-mono text-white">chrome://extensions</code> and turn on Developer mode.</>,
  },
  {
    number: '04',
    title: 'load BrowserUtils.',
    detail: <>Click <strong className="font-medium text-white">Load unpacked</strong> and select the extracted folder.</>,
  },
];

const technicalDetails = [
  ['tracking', 'active tab time'],
  ['records', 'one key per day'],
  ['storage', 'Chrome local storage'],
  ['backup', 'complete encrypted export'],
  ['account', 'none'],
  ['subscription', 'none'],
];

const activitySegments = [
  { site: 'github.com', duration: '34m', width: '17%', color: '#2563eb' },
  { site: 'youtube.com', duration: '52m', width: '26%', color: '#e33d32' },
  { site: 'docs.google.com', duration: '41m', width: '21%', color: '#16a36a' },
  { site: 'reddit.com', duration: '19m', width: '10%', color: '#f08a24' },
  { site: 'figma.com', duration: '32m', width: '16%', color: '#8b5cf6' },
];

function Mark() {
  return (
    <img className="size-9 object-contain p-1" src="/favicon.svg" alt="" aria-hidden="true" />
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
          <a className="min-h-10 py-2.5 text-quiet transition-colors duration-150 hover:text-ink" href="#product">product</a>
          <a className="min-h-10 py-2.5 text-quiet transition-colors duration-150 hover:text-ink" href="#details">details</a>
          <a className="min-h-10 py-2.5 text-quiet transition-colors duration-150 hover:text-ink" href="#install">install</a>
          <a className="hairline-button" href="https://github.com/ericfzhu/browserutils">
            <Code2 className="size-4" /> source
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
          {['product', 'details', 'install'].map((item) => (
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
    <section id="top" className="site-grid flex min-h-[calc(100svh-4rem)] items-center py-16 md:py-24">
      <div className="w-full">
        <h1 className="text-[4rem] font-semibold leading-[0.78] sm:text-[6rem] md:text-[8rem] xl:text-[10.5rem] min-[1400px]:text-[12rem]">
          <span className="xl:hidden">Browser<br />Utils<span className="text-signal">.</span></span>
          <span className="hidden whitespace-nowrap xl:inline">BrowserUtils<span className="text-signal">.</span></span>
        </h1>
        <div className="mt-10 grid gap-8 border-t pt-6 md:grid-cols-[1fr_1fr] md:items-end">
          <p className="max-w-xl text-xl leading-snug md:text-2xl">
            <span className="block">the internet. useful until it isn’t.</span>
            <span className="block">BrowserUtils adds a few brakes.</span>
          </p>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <a className="solid-button" href="#install"><Download className="size-4" /> get BrowserUtils</a>
            <a className="hairline-button" href="#product">see it work <ArrowDown className="size-4" /></a>
          </div>
        </div>
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
            <p className="eyebrow">the control panel</p>
            <h2 className="mt-5 max-w-xl text-balance text-4xl font-semibold leading-tight md:text-6xl">everything, in one place.</h2>
          </div>
          <p className="max-w-xl self-end text-pretty text-lg text-quiet lg:justify-self-end">
            blocks, limits, browsing time and focus sessions live in the same dashboard. nothing leaves Chrome.
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

function FocusTheatre() {
  const initialSeconds = 24 * 60 + 16;
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds <= 1) {
          setRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [running]);

  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
  const seconds = (remainingSeconds % 60).toString().padStart(2, '0');

  return (
    <section className="border-b border-ink bg-signal text-white">
      <div className="site-grid grid min-h-[680px] gap-14 py-20 md:py-28 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
        <div>
          <p className="font-mono text-[11px] uppercase text-white/65">03 / focus</p>
          <h2 className="mt-5 max-w-lg text-balance text-5xl font-semibold leading-[0.95] md:text-7xl">focus. now in minutes.</h2>
          <p className="mt-7 max-w-md text-pretty text-lg text-white/70">
            choose what gets blocked, set the clock and get on with it.
          </p>
        </div>

        <div className="border-y border-white/45 py-8 sm:py-12 lg:border-l lg:border-y-0 lg:py-0 lg:pl-14">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="font-mono text-[11px] uppercase text-white/60">current focus</p>
              <p className="mt-3 text-sm text-white/75">all distracting sites</p>
            </div>
            <span className="border border-white/45 px-2 py-1 font-mono text-[10px] uppercase">{running ? 'running' : 'paused'}</span>
          </div>
          <p className="my-14 font-mono text-[clamp(5rem,15vw,10rem)] font-semibold leading-none tabular-nums">
            {minutes}:{seconds}
          </p>
          <div className="flex items-center justify-between border-t border-white/45 pt-5">
            <span className="text-sm text-white/65">25 minute session</span>
            <div className="flex gap-2">
              <button
                className="flex size-11 items-center justify-center border border-white/50 transition-[background-color,color] duration-150 hover:bg-white hover:text-signal"
                type="button"
                aria-label={running ? 'Pause focus timer' : 'Resume focus timer'}
                title={running ? 'Pause' : 'Resume'}
                onClick={() => setRunning((value) => !value)}
              >
                {running ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button
                className="flex size-11 items-center justify-center border border-white/50 transition-[background-color,color] duration-150 hover:bg-white hover:text-signal"
                type="button"
                aria-label="Reset focus timer"
                title="Reset"
                onClick={() => {
                  setRemainingSeconds(initialSeconds);
                  setRunning(true);
                }}
              >
                <RotateCcw className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductTheatre() {
  return (
    <div aria-label="BrowserUtils feature demonstrations">
      <section className="border-b border-ink bg-canvas">
        <div className="site-grid grid min-h-[640px] gap-14 py-20 md:py-28 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
          <div>
            <p className="eyebrow">01 / daily limits</p>
            <h2 className="mt-5 max-w-lg text-balance text-5xl font-semibold leading-[0.95] md:text-7xl">enough youtube.</h2>
            <p className="mt-7 max-w-md text-pretty text-lg text-quiet">
              set the number. BrowserUtils watches the clock. when the time is gone, the page is too.
            </p>
          </div>

          <div className="border-y border-ink py-8 sm:py-12 lg:border-l lg:border-y-0 lg:py-4 lg:pl-14">
            <div className="flex items-center justify-between border-b pb-5">
              <div className="flex items-center gap-3">
                <span className="size-3 bg-[#e33d32]" />
                <span className="text-sm font-semibold">youtube.com</span>
              </div>
              <span className="font-mono text-[10px] uppercase text-quiet">limit reached</span>
            </div>
            <p className="my-12 font-mono text-[clamp(5rem,14vw,9rem)] font-semibold leading-none tabular-nums">2h 00m</p>
            <div className="h-4 bg-[#dededa]"><div className="h-full w-full bg-[#e33d32]" /></div>
            <div className="mt-4 flex justify-between font-mono text-xs tabular-nums text-quiet">
              <span>used today</span><span>daily limit / 2h</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-ink bg-white">
        <div className="site-grid py-20 md:py-28">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow">02 / activity</p>
              <h2 className="mt-5 text-balance text-5xl font-semibold leading-[0.95] md:text-7xl">the day, measured.</h2>
            </div>
            <p className="max-w-lg self-end text-pretty text-lg text-quiet lg:justify-self-end">
              active tabs become a timeline. every main URL keeps its own color. the numbers stay in the browser.
            </p>
          </div>

          <div className="mt-16 border-y border-ink py-8">
            <div className="flex items-end justify-between gap-6">
              <div><span className="eyebrow">today</span><p className="mt-2 text-4xl font-semibold tabular-nums">3h 42m</p></div>
              <span className="font-mono text-xs text-quiet">09:00—17:00</span>
            </div>
            <div className="mt-10 flex h-16 w-full gap-1 bg-[#efefec] p-1">
              {activitySegments.map(({ site, width, color }) => (
                <div key={site} className="h-full min-w-2" style={{ width, backgroundColor: color }} title={site} />
              ))}
            </div>
            <div className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
              {activitySegments.map(({ site, duration, color }) => (
                <div key={site} className="flex items-center justify-between gap-4 border-b pb-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2"><span className="size-2 shrink-0" style={{ backgroundColor: color }} /><span className="truncate">{site}</span></span>
                  <span className="font-mono tabular-nums text-quiet">{duration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <FocusTheatre />
    </div>
  );
}

function TechnicalDetails() {
  return (
    <section id="details" className="border-b border-ink bg-canvas">
      <div className="site-grid py-20 md:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr]">
          <div>
            <p className="eyebrow">under the panel</p>
            <h2 className="mt-5 max-w-lg text-balance text-4xl font-semibold leading-tight md:text-6xl">what it does. where it keeps it.</h2>
          </div>
          <dl className="border-t border-ink">
            {technicalDetails.map(([term, detail]) => (
              <div key={term} className="grid grid-cols-[120px_1fr] gap-5 border-b border-ink py-5 sm:grid-cols-[180px_1fr]">
                <dt className="font-mono text-xs text-quiet">{term}</dt>
                <dd className="text-sm font-medium">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Install() {
  return (
    <section id="install" className="border-t border-ink bg-ink text-white">
      <div className="site-grid grid gap-14 py-20 md:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="font-mono text-[11px] uppercase text-white/55">install</p>
          <h2 className="mt-5 max-w-xl text-balance text-5xl font-semibold leading-[0.95] md:text-7xl">not in the store. still easy.</h2>
          <p className="mt-7 max-w-lg text-pretty text-base leading-relaxed text-white/65">
            download the release, unzip it and load the folder from Chrome’s extensions page. no account required.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a className="inline-flex min-h-11 items-center gap-2 border border-white bg-white px-4 text-sm font-medium text-ink transition-colors duration-150 hover:bg-signal hover:text-white" href="https://github.com/ericfzhu/browserutils/releases/latest"><Download className="size-4" /> latest release</a>
            <a className="inline-flex min-h-11 items-center gap-2 border border-white/50 px-4 text-sm font-medium transition-colors duration-150 hover:border-white hover:bg-white hover:text-ink" href="https://github.com/ericfzhu/browserutils"><Code2 className="size-4" /> view source</a>
          </div>
        </div>
        <div className="border-t border-white/50">
          {installationSteps.map(({ number, title, detail }) => (
            <div key={number} className="grid gap-3 border-b border-white/35 py-6 sm:grid-cols-[48px_180px_1fr] sm:gap-5">
              <span className="font-mono text-xs tabular-nums text-white/45">{number}</span>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="max-w-md text-pretty text-sm leading-relaxed text-white/60">{detail}</p>
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
          <a className="transition-colors duration-150 hover:text-white" href="https://ericfzhu.com/works">back to works</a>
          <a className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-white" href="https://github.com/ericfzhu/browserutils">github <ExternalLink className="size-3" /></a>
          <a className="transition-colors duration-150 hover:text-white" href="#top">top</a>
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
        <ProductTheatre />
        <TechnicalDetails />
        <Install />
      </main>
      <Footer />
    </div>
  );
}
