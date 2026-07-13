import Link from 'next/link';
import type { Metadata } from 'next';
import { CopyCommand } from '@/components/copy-command';
import { JsonLd } from '@/components/json-ld';
import { UpgradeCta } from '@/components/upgrade-cta';
import { paymentsEnabled } from '@/lib/billing/types';
import { SITE, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  path: '/',
  absoluteTitle: true,
  keywords: [
    'AI coding spend tracker',
    'Claude Code cost dashboard',
    'Cursor team spend',
    'Codex usage cost',
    'AI developer budget alerts',
  ],
});

const FAQ_ITEMS = [
  {
    question: 'How is this different from the free usage trackers?',
    answer:
      'Free CLIs show one developer their own numbers. LMSpend adds the team layer: caps, alerts before the invoice, per-member and per-project roll-ups, Slack, and finance-ready exports. The individual report stays free.',
  },
  {
    question: 'Is this an LLM proxy or gateway?',
    answer:
      'No. We never touch your traffic. The CLI reads usage logs your tools already write to disk, after the fact.',
  },
  {
    question: 'How accurate are the numbers?',
    answer:
      'They are estimates from your actual token counts times published model pricing (including cache read/write rates), verified against official Anthropic, OpenAI, and Google pricing pages. Run lmspend --explain to see the exact math per model.',
  },
  {
    question: 'Which tools are supported?',
    answer:
      'Log parsing for Claude Code, Codex CLI, Cline, and Roo Code. Cursor via its official Team Admin API. Flat-rate subscriptions via config. Anything else via lmspend import.',
  },
  {
    question: 'Do my teammates each need to pay?',
    answer:
      'No. On the Team plan the owner pays; teammates join by invite link with their own free accounts and sync their aggregates. One buyer, up to five seats.',
  },
];

function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

function HeroTerminal() {
  return (
    <div className="terminal" aria-label="Example lmspend report output">
      <div className="terminal-bar">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="title">lmspend — team roll-up</span>
      </div>
      <div className="terminal-body">
        <pre>{`  `}<span className="prompt">$</span>{` lmspend team

  AI Coding Spend — June 2026            team total: `}<span className="amber">$3,418</span>{`
  budget $3,000                          `}<span className="bad">over by $418 — alerted Jun 22</span>{`

  by member                    by tool
  alex@      $1,204             claude-code   $2,140
  priya@       $986             cursor          $902
  sam@         $772             codex           $376
  jordan@      $456

  most expensive day: Jun 24 — $291  `}<span className="dim">(alex, long refactor)</span>{`

  `}<span className="dim">estimates at API list prices · export: lmspend export --csv</span>{`
  `}<span className="prompt">$</span> <span className="cursor">▌</span>
        </pre>
      </div>
    </div>
  );
}

export default function Home() {
  const paidLive = paymentsEnabled();

  return (
    <div className="landing">
      <JsonLd data={faqJsonLd()} />
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="nav">
        <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
        <nav className="nav-links" aria-label="Main">
          <a href="#teams">For teams</a>
          <a href="#how">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="nav-actions">
          <a
            href="https://github.com/NexaTechX/LMSPEND"
            className="nav-github"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LMSpend on GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.28-.01-1.02-.02-2-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.04.13 3 .4c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.82.58C20.56 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0z" />
            </svg>
          </a>
          <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          {paidLive ? (
            <Link href="/api/checkout?plan=team" className="btn btn-primary btn-sm">Start a team</Link>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm">Get started</Link>
          )}
        </div>
      </header>

      {!paidLive && (
        <div className="free-tier-banner" role="status" style={{ margin: '0 auto', maxWidth: 1120, width: 'calc(100% - 48px)' }}>
          <span className="badge badge-amber">Early access</span>
          <p>
            Complimentary Free access is available now — including sync and current-month reporting.
            Solo and Team plans will open when billing launches.
          </p>
        </div>
      )}

      <main id="main">
      <section className="hero">
        <div>
          <p className="eyebrow">AI coding cost management</p>
          <h1>Your team&apos;s AI coding spend, before the invoice.</h1>
          <p className="lede">
            Claude Code, Cursor, Codex, Gemini — every developer, every tool, one number. Set a
            budget, get pinged the moment a runaway agent burns $80, and hand finance a clean
            export. Local-first: no proxy, your code never leaves the machine.
          </p>
          <div className="hero-ctas">
            {paidLive ? (
              <Link href="/api/checkout?plan=team" className="btn btn-primary">Start a team — $49/mo</Link>
            ) : (
              <Link href="/login" className="btn btn-primary">Get started — free</Link>
            )}
            <CopyCommand command="npx lmspend" />
          </div>
          <p className="trust">
            {paidLive
              ? <>Free CLI for individuals. Paid dashboard for teams. Estimates audited against official
                 vendor pricing — run <code>lmspend --explain</code> to check the math.</>
              : <>Free CLI and complimentary dashboard sync for the current month during early access.
                 Estimates audited against official vendor pricing — run <code>lmspend --explain</code> to check the math.</>}
          </p>
        </div>
        <HeroTerminal />
      </section>

      <section id="problem">
        <p className="eyebrow">The problem</p>
        <h2 className="section-title">The person who owns the AI budget is the one flying blindest.</h2>
        <p className="section-lede">
          In 2026 a developer runs 2–3 coding agents at once, each billed separately. Nobody adds
          it up — until the invoice does.
        </p>
        <div className="cards-3">
          <div className="panel card">
            <h3>Surprise invoices</h3>
            <p>
              One long agentic session can burn $40–$80 in an afternoon. You find out at month-end,
              when it&apos;s too late to do anything about it.
            </p>
          </div>
          <div className="panel card">
            <h3>Every vendor shows a slice</h3>
            <p>
              Cursor shows Cursor. Anthropic shows Anthropic. Nobody shows the total across tools —
              and the total is what your card gets charged.
            </p>
          </div>
          <div className="panel card">
            <h3>Teams can&apos;t see per-seat</h3>
            <p>
              Five developers, three tools, usage-based overages. Who&apos;s driving the bill? Which
              project? The budget owner has the least visibility of anyone.
            </p>
          </div>
        </div>
      </section>

      <div className="privacy-band" id="teams">
        <section className="inner">
          <p className="eyebrow">For teams</p>
          <h2 style={{ fontSize: 30, marginBottom: 10 }}>The layer the free trackers don&apos;t have.</h2>
          <p className="section-lede" style={{ marginBottom: 32 }}>
            Plenty of tools show one developer their own numbers. LMSpend is built for the person
            who signs off on the spend.
          </p>
          <div className="cards-3">
            <div className="panel card">
              <h3>Budgets before the invoice</h3>
              <p>Set a monthly cap. Get an email and a Slack ping the moment the team crosses it — not four weeks later.</p>
            </div>
            <div className="panel card">
              <h3>Runaway-session alerts</h3>
              <p>Any day that runs 3× your average triggers an alert. Catch the $80 debug loop the day it happens.</p>
            </div>
            <div className="panel card">
              <h3>Per-member, per-tool roll-up</h3>
              <p>One dashboard: who spent what, on which tool, on which project. Invite by link — members join on their own free accounts.</p>
            </div>
            <div className="panel card">
              <h3>Finance-ready export</h3>
              <p>One CSV your finance person will actually accept — by tool, model, and day, project names hashed.</p>
            </div>
            <div className="panel card">
              <h3>Audited estimates</h3>
              <p>Costs computed from real token counts × official vendor pricing, including cache rates. Show the math with <code>--explain</code>.</p>
            </div>
            <div className="panel card">
              <h3>Local-first, no proxy</h3>
              <p>We read logs your tools already write. We never sit in the request path, so we never see your code or prompts.</p>
            </div>
          </div>
        </section>
      </div>

      <section id="how">
        <p className="eyebrow">How it works</p>
        <h2 className="section-title">Ten seconds to your real number.</h2>
        <div className="steps">
          <div className="panel step">
            <h3>1 · Run it</h3>
            <span className="cmd"><span className="dollar">$</span> npx lmspend</span>
            <p className="muted small">No config, no account. It reads the usage logs your tools already write locally.</p>
          </div>
          <div className="panel step">
            <h3>2 · See the whole picture</h3>
            <span className="cmd"><span className="dollar">$</span> lmspend report</span>
            <p className="muted small">Total spend by tool, model, project, and day, across every agent you run. Deltas vs. last month.</p>
          </div>
          <div className="panel step">
            <h3>3 · Put it on the team dashboard</h3>
            <span className="cmd"><span className="dollar">$</span> lmspend sync</span>
            <p className="muted small">Opt-in: send aggregates to your workspace for history, budgets, alerts, and the team roll-up.</p>
          </div>
        </div>
      </section>

      <div className="privacy-band" id="privacy">
        <section className="inner">
          <p className="eyebrow">Privacy</p>
          <h2>Local-first, or it doesn&apos;t ship.</h2>
          <ul>
            <li>The CLI is open source (MIT) and makes zero network calls by default.</li>
            <li>Syncing is opt-in and sends aggregates only — token counts, costs, hashed project names. Never code. Never prompts. Never file paths.</li>
            <li>We&apos;re not a gateway. Your traffic never routes through us — there&apos;s nothing for us to leak.</li>
          </ul>
        </section>
      </div>

      <section id="pricing">
        <p className="eyebrow">Pricing</p>
        <h2 className="section-title">The report is free. Teams pay for foresight.</h2>
        <p className="section-lede">
          {paidLive
            ? <>Prices in USD everywhere. Card payments handled by Kora.</>
            : <>Complimentary Free access is available now. Solo and Team plans open when billing launches.</>}
        </p>
        <div className="pricing-grid">
          <div className="panel price-card">
            <span className="plan-name">CLI</span>
            <div className="price">$0</div>
            <div className="per">free forever, open source</div>
            <ul>
              <li>Local reports across every tool</li>
              <li>Share cards</li>
              <li>JSON output &amp; --explain</li>
              <li className="no">History &amp; trends</li>
              <li className="no">Budgets &amp; alerts</li>
            </ul>
            <span className="cmd"><span className="dollar">$</span> npx lmspend</span>
          </div>
          <div className="panel price-card">
            <span className="plan-name">Solo</span>
            <div className="price">$19</div>
            <div className="per">per month</div>
            <ul>
              <li>Everything in CLI</li>
              <li>History &amp; trends</li>
              <li>Monthly email report</li>
              <li>Budget &amp; runaway alerts</li>
              <li className="no">Team roll-ups</li>
            </ul>
            <UpgradeCta href="/api/checkout?plan=solo" className="btn btn-ghost">Start with Solo</UpgradeCta>
          </div>
          <div className="panel price-card price-featured">
            <span className="plan-name">Team</span>
            <div className="price">$49</div>
            <div className="per">per month · 5 seats · $8 per extra seat</div>
            <ul>
              <li>Everything in Solo</li>
              <li>Team workspace &amp; per-member roll-up</li>
              <li>Slack budget alerts</li>
              <li>Per-project attribution</li>
              <li>CSV / expense export</li>
            </ul>
            <UpgradeCta href="/api/checkout?plan=team" className="btn btn-primary">Start a team</UpgradeCta>
          </div>
        </div>
      </section>

      <section id="faq" className="faq">
        <p className="eyebrow">FAQ</p>
        <h2 className="section-title">Fair questions.</h2>
        <details>
          <summary>How is this different from the free usage trackers?</summary>
          <p>
            Free CLIs show one developer their own numbers — and they&apos;re great at that. LMSpend
            adds the team layer built for whoever owns the budget: caps, alerts before the invoice,
            per-member and per-project roll-ups, Slack, and finance-ready exports. The individual
            report stays free.
          </p>
        </details>
        <details>
          <summary>Is this an LLM proxy or gateway?</summary>
          <p>No. We never touch your traffic. The CLI reads usage logs your tools already write to disk, after the fact.</p>
        </details>
        <details>
          <summary>How accurate are the numbers?</summary>
          <p>
            They&apos;re estimates from your actual token counts × published model pricing (including
            cache read/write rates), verified against the official Anthropic, OpenAI, and Google
            pricing pages. Run <code>lmspend --explain</code> to see the exact math per model.
          </p>
        </details>
        <details>
          <summary>Which tools are supported?</summary>
          <p>
            Log parsing for Claude Code, Codex CLI, Cline, and Roo Code. <a href="/cursor">Cursor</a>{' '}
            via its official Team Admin API (invoice-exact). Flat-rate subscriptions (Copilot,
            Windsurf) via one line of config. Anything else — Gemini CLI, Aider, gateways — via{' '}
            <code>lmspend import</code>.
          </p>
        </details>
        <details>
          <summary>Do my teammates each need to pay?</summary>
          <p>
            No. On the Team plan the owner pays; teammates join by invite link with their own free
            accounts and sync their aggregates. One buyer, up to five seats.
          </p>
        </details>
      </section>

      <section>
        <div className="panel" style={{ textAlign: 'center', padding: 48 }}>
          <h2 className="section-title">Find out what your team actually spent last month.</h2>
          <p className="muted" style={{ marginBottom: 24 }}>
            {paidLive
              ? <>Start free on your own machine, or spin up a team workspace in two minutes.</>
              : <>Start free on your own machine. Team billing will be available at launch.</>}
          </p>
          <div className="hero-ctas" style={{ justifyContent: 'center' }}>
            {paidLive ? (
              <Link href="/api/checkout?plan=team" className="btn btn-primary">Start a team</Link>
            ) : (
              <Link href="/login" className="btn btn-primary">Get started — free</Link>
            )}
            <CopyCommand command="npx lmspend" />
          </div>
        </div>
      </section>
      </main>

      <footer className="footer">
        <span className="wordmark">lmspend<span className="cursor">_</span></span>
        <span>Estimates at API list prices. Not affiliated with Anthropic, OpenAI, Google, or Cursor.</span>
        <span>
          <a href="https://github.com/NexaTechX/LMSPEND" target="_blank" rel="noopener noreferrer">GitHub</a>
          {' · '}
          <a href="#pricing">Pricing</a>
          {' · '}
          <a href="#faq">FAQ</a>
          {' · '}
          <Link href="/login">Sign in</Link>
        </span>
      </footer>
    </div>
  );
}
