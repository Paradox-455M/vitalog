import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="bg-surface text-on-background antialiased selection:bg-primary/20 selection:text-primary font-body">
      {/* Top Navigation Bar */}
      <nav
        className="fixed top-0 w-full h-16 z-50 border-b border-outline-variant/15"
        style={{ background: 'rgba(251, 249, 242, 0.7)', backdropFilter: 'blur(20px)' }}
      >
        <div className="flex justify-between items-center px-8 h-full w-full max-w-screen-2xl mx-auto">
          {/* Logo */}
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="w-10 h-10 bg-secondary-container/30 flex items-center justify-center rounded-xl overflow-hidden group-hover:scale-95 transition-all">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                eco
              </span>
            </div>
            <span className="text-2xl font-bold font-serif text-primary">Vitalog</span>
          </div>

          {/* Centre Nav */}
          <div className="hidden md:flex items-center space-x-10">
            <a href="#how-it-works" className="font-body text-[14px] text-on-surface-variant hover:text-primary transition-colors">
              How it works
            </a>
            <a href="#features" className="font-body text-[14px] text-on-surface-variant hover:text-primary transition-colors">
              Features
            </a>
            <a href="#pricing" className="font-body text-[14px] text-on-surface-variant hover:text-primary transition-colors">
              Pricing
            </a>
          </div>

          {/* CTA */}
          <Link
            to="/signup"
            className="bg-primary text-on-primary px-6 py-2 rounded-lg font-body font-medium text-sm hover:opacity-90 transition-all scale-95 hover:scale-100"
          >
            Get started free
          </Link>
        </div>
      </nav>

      <main className="relative">
        {/* ── Hero Section ── */}
        <section className="pt-[140px] pb-24 px-8 max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            {/* Left content */}
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center space-x-2 bg-stat-card px-4 py-2 rounded-full border border-primary/10">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-primary font-bold font-body text-xs uppercase tracking-wider">
                  Your personal health companion
                </span>
              </div>

              {/* H1 */}
              <h1 className="font-display text-6xl xl:text-7xl leading-[1.1] text-on-background">
                Your health,<br />
                <span className="italic text-primary">finally</span><br />
                understood.
              </h1>

              {/* Sub */}
              <p className="text-lg font-body font-light text-on-surface-variant leading-relaxed max-w-lg">
                Upload any medical report. Vitalog's AI explains it in plain language, tracks your
                values over time, and surfaces what actually matters about your health.
              </p>

              {/* CTAs */}
              <div className="flex items-center space-x-6 pt-4">
                <Link
                  to="/signup"
                  className="bg-forest text-on-primary px-8 py-4 rounded-full font-body font-semibold text-base hover:shadow-lg transition-all flex items-center group"
                >
                  Start for free
                  <span className="material-symbols-outlined ml-2 transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </Link>
                <a
                  href="#how-it-works"
                  className="flex items-center font-body font-medium text-primary hover:underline transition-all"
                >
                  See how it works{' '}
                  <span className="material-symbols-outlined ml-1 text-sm">play_circle</span>
                </a>
              </div>

              {/* Social proof */}
              <div className="flex items-center space-x-4 pt-4">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-secondary-container flex items-center justify-center text-xs font-bold text-primary">
                    AK
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-secondary-container flex items-center justify-center text-xs font-bold text-primary">
                    RS
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-primary-fixed flex items-center justify-center text-xs font-bold text-primary">
                    PM
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-primary">
                    +2k
                  </div>
                </div>
                <p className="font-body text-sm text-on-surface-variant/80">
                  2,400+ reports understood this month
                </p>
              </div>
            </div>

            {/* Right: Mock Report Card */}
            <div className="relative">
              {/* Floating top-right chip */}
              <div className="absolute -top-12 -right-8 bg-white rounded-2xl p-4 shadow-[0px_12px_32px_rgba(27,28,24,0.06)] z-20 w-48 border border-outline-variant/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Haemoglobin</span>
                  <span className="text-[10px] font-bold text-secondary">↑ Improved</span>
                </div>
                <div className="text-lg font-serif font-bold text-primary">13.8 g/dL</div>
                <div className="mt-2 flex space-x-1 h-2">
                  <div className="flex-1 bg-primary rounded-full" />
                  <div className="flex-1 bg-primary/30 rounded-full" />
                </div>
              </div>

              {/* Main card */}
              <div className="bg-white rounded-3xl p-8 shadow-[0px_12px_32px_rgba(27,28,24,0.06)] relative z-10 w-full max-w-lg mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-serif font-bold text-xl text-on-background">Blood Work Analysis</h3>
                  <span className="text-xs font-body text-outline uppercase tracking-widest">Oct 24, 2024</span>
                </div>

                <div className="space-y-6">
                  {/* Haemoglobin */}
                  <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                    <span className="font-body font-medium text-on-surface">Haemoglobin</span>
                    <div className="flex items-center space-x-3">
                      <span className="px-3 py-1 bg-secondary-container/20 text-secondary text-xs rounded-full font-bold uppercase">
                        Normal
                      </span>
                      <span className="font-serif font-bold text-primary">13.8 g/dL</span>
                    </div>
                  </div>

                  {/* WBC */}
                  <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                    <span className="font-body font-medium text-on-surface">WBC Count</span>
                    <div className="flex items-center space-x-3">
                      <span className="px-3 py-1 bg-secondary-container/20 text-secondary text-xs rounded-full font-bold uppercase">
                        Normal
                      </span>
                      <span className="font-serif font-bold text-primary">6.4 K/μL</span>
                    </div>
                  </div>

                  {/* Ferritin — flagged amber */}
                  <div className="flex items-center justify-between p-4 bg-surface rounded-2xl border-2 border-amber/20">
                    <span className="font-body font-medium text-on-surface">Ferritin</span>
                    <div className="flex items-center space-x-3">
                      <span className="px-3 py-1 bg-amber/10 text-amber text-xs rounded-full font-bold uppercase">
                        Attention
                      </span>
                      <span className="font-serif font-bold text-amber">22 ng/mL</span>
                    </div>
                  </div>
                </div>

                {/* AI Insight */}
                <div className="mt-8 p-6 bg-stat-card rounded-2xl border border-primary/10">
                  <div className="flex items-start space-x-3">
                    <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                    <p className="font-body text-sm leading-relaxed text-on-primary-fixed-variant">
                      Your <span className="font-bold">ferritin</span> is 40% lower than 6 months ago.
                      This often links to dietary iron intake or absorption patterns.
                    </p>
                  </div>
                </div>

                {/* Mini trend chart */}
                <div className="mt-8 pt-6 border-t border-outline-variant/10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-serif font-semibold">Ferritin History</span>
                    <span className="px-2 py-1 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-md uppercase">
                      Trending down
                    </span>
                  </div>
                  <div className="h-24 w-full bg-surface-container-low rounded-xl overflow-hidden flex items-end px-4 space-x-2">
                    <div className="w-full bg-primary/20 h-full rounded-t-sm" />
                    <div className="w-full bg-primary/30 h-[80%] rounded-t-sm" />
                    <div className="w-full bg-primary/40 h-[65%] rounded-t-sm" />
                    <div className="w-full bg-primary/50 h-[50%] rounded-t-sm" />
                    <div className="w-full bg-amber h-[35%] rounded-t-sm" />
                  </div>
                </div>
              </div>

              {/* Floating bottom-left chip */}
              <div className="absolute -bottom-6 -left-12 bg-forest text-on-primary rounded-2xl p-5 shadow-[0px_12px_32px_rgba(27,28,24,0.06)] z-20 w-48">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <span className="material-symbols-outlined text-white text-lg">folder_shared</span>
                  </div>
                  <div>
                    <div className="text-xs font-body opacity-70 leading-none mb-1">Total Assets</div>
                    <div className="text-sm font-serif font-bold leading-none">24 reports</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 text-[10px] font-body opacity-80 uppercase tracking-widest">
                  3 family profiles
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="py-24 px-8 bg-surface-container-low/50">
          <div className="max-w-screen-2xl mx-auto">
            <div className="grid md:grid-cols-3 bg-white border border-outline-variant/20 rounded-3xl overflow-hidden shadow-[0px_12px_32px_rgba(27,28,24,0.06)]">
              {/* Step 1 */}
              <div className="p-12 md:border-r border-outline-variant/20 space-y-6">
                <span className="font-display text-6xl text-outline-variant">01</span>
                <h3 className="font-display text-2xl font-bold text-on-background">Upload Report</h3>
                <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                  Snap a photo or upload a PDF of your latest lab results. We support everything from
                  basic blood panels to complex genetics.
                </p>
              </div>
              {/* Step 2 */}
              <div className="p-12 md:border-r border-outline-variant/20 space-y-6">
                <span className="font-display text-6xl text-outline-variant">02</span>
                <h3 className="font-display text-2xl font-bold text-on-background">AI Transformation</h3>
                <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                  Vitalog translates medical jargon into a clear health story. We identify trends and
                  flag markers that need your attention.
                </p>
              </div>
              {/* Step 3 */}
              <div className="p-12 space-y-6">
                <span className="font-display text-6xl text-outline-variant">03</span>
                <h3 className="font-display text-2xl font-bold text-on-background">Actionable Insight</h3>
                <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                  Get personalized advice based on your history. Know exactly what to ask your doctor
                  in your next consultation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features Section ── */}
        <section id="features" className="py-24 px-8 max-w-screen-2xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <h2 className="font-display text-4xl text-on-background">
                Health intelligence for <br />
                <span className="italic text-primary">everybody.</span>
              </h2>
              <p className="font-body text-on-surface-variant max-w-md">
                Powerful tools to manage your longevity journey with confidence.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Large card */}
            <div className="md:col-span-2 bg-surface-container-low rounded-3xl p-10 flex flex-col md:flex-row items-center gap-12 overflow-hidden">
              <div className="flex-1 space-y-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-[0px_12px_32px_rgba(27,28,24,0.06)]">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    psychology
                  </span>
                </div>
                <h3 className="font-display text-3xl font-bold">AI that actually explains</h3>
                <p className="font-body text-on-surface-variant leading-relaxed">
                  No more Googling "low hemoglobin causes." Vitalog gives you the nuance of your
                  results in the context of your personal health history and age bracket.
                </p>
                <button className="text-primary font-bold font-body flex items-center group">
                  Learn about our AI{' '}
                  <span className="material-symbols-outlined ml-2 transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </button>
              </div>

              <div className="flex-1 w-full space-y-4">
                <div className="bg-white border border-primary/20 p-6 rounded-2xl shadow-[0px_12px_32px_rgba(27,28,24,0.06)]">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="material-symbols-outlined text-primary">info</span>
                    <span className="font-serif font-bold text-sm">Optimal Range Insight</span>
                  </div>
                  <p className="text-xs font-body text-on-surface-variant">
                    Your Vitamin D is within range but below the 'optimal' longevity threshold of 50 ng/mL.
                  </p>
                </div>
                <div className="bg-white border border-tertiary/20 p-6 rounded-2xl shadow-[0px_12px_32px_rgba(27,28,24,0.06)] ml-8">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="material-symbols-outlined text-tertiary">warning</span>
                    <span className="font-serif font-bold text-sm text-tertiary">Critical Marker Warning</span>
                  </div>
                  <p className="text-xs font-body text-on-surface-variant">
                    Glucose (Fasting) has increased by 15% year-over-year. Discuss pre-diabetic monitoring
                    with your physician.
                  </p>
                </div>
              </div>
            </div>

            {/* Family profiles card */}
            <div className="bg-white border border-outline-variant/15 rounded-3xl p-10 space-y-6 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-secondary-container/20 rounded-2xl flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-secondary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  family_restroom
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold">Family Profiles</h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                Manage health records for your parents, children, and partner from a single dashboard.
                Secure sharing for doctors and caregivers.
              </p>
            </div>

            {/* Trend tracking card */}
            <div className="bg-white border border-outline-variant/15 rounded-3xl p-10 space-y-6 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-primary-fixed/20 rounded-2xl flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  history_edu
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold">Trend Tracking</h3>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed">
                Vitalog visualizes how your biomarkers change over decades, not just months. Identify
                subtle shifts before they become health issues.
              </p>
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="py-24 px-8 bg-surface-container-low/30">
          <div className="max-w-screen-2xl mx-auto space-y-12">
            <h2 className="font-display text-center text-4xl text-on-background italic">
              "The peace of mind I've been looking for."
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1 */}
              <div className="bg-white p-8 rounded-2xl shadow-[0px_12px_32px_rgba(27,28,24,0.06)] space-y-6">
                <p className="font-display italic text-lg text-on-surface-variant">
                  "Finally, I can understand my thyroid reports without feeling overwhelmed. The AI
                  explanation is spot-on and very human."
                </p>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-sm font-bold text-primary">
                    AM
                  </div>
                  <div>
                    <div className="font-serif font-bold text-on-background">Ananya Mehta</div>
                    <div className="text-xs font-body text-outline uppercase">Yoga Instructor · Mumbai</div>
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-white p-8 rounded-2xl shadow-[0px_12px_32px_rgba(27,28,24,0.06)] space-y-6">
                <p className="font-display italic text-lg text-on-surface-variant">
                  "Vitalog caught a downward trend in my ferritin that my regular doctor hadn't mentioned.
                  It changed how I approach my nutrition."
                </p>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-sm font-bold text-primary">
                    RG
                  </div>
                  <div>
                    <div className="font-serif font-bold text-on-background">Rahul Gupta</div>
                    <div className="text-xs font-body text-outline uppercase">Tech Lead · Bengaluru</div>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-white p-8 rounded-2xl shadow-[0px_12px_32px_rgba(27,28,24,0.06)] space-y-6">
                <p className="font-display italic text-lg text-on-surface-variant">
                  "As a caregiver for my elderly parents, Vitalog is a lifesaver. All their records in
                  one place and clear AI summaries."
                </p>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-amber-light flex items-center justify-center text-sm font-bold text-amber-text">
                    PM
                  </div>
                  <div>
                    <div className="font-serif font-bold text-on-background">Priya Mehta</div>
                    <div className="text-xs font-body text-outline uppercase">Doctor · Delhi</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="py-24 px-8 max-w-screen-2xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="font-display text-4xl font-bold">Simple, transparent pricing.</h2>
            <p className="font-body text-on-surface-variant">Invest in your longevity, starting today.</p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {/* Free card */}
            <div className="w-full max-w-sm bg-white border border-outline-variant/30 rounded-3xl p-10 space-y-8">
              <div className="space-y-2">
                <h3 className="font-display text-2xl font-bold">Standard</h3>
                <p className="text-on-surface-variant text-sm font-body">For personal report tracking.</p>
              </div>
              <div className="font-serif text-5xl font-bold">Free</div>
              <ul className="space-y-4 pt-4">
                <li className="flex items-center space-x-3 text-sm font-body text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                  <span>3 lifetime report uploads</span>
                </li>
                <li className="flex items-center space-x-3 text-sm font-body text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                  <span>Basic AI explanations</span>
                </li>
                <li className="flex items-center space-x-3 text-sm font-body text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                  <span>Biomarker extraction</span>
                </li>
              </ul>
              <Link
                to="/signup"
                className="block w-full py-4 rounded-xl border border-primary text-primary font-bold font-body hover:bg-primary/5 transition-all text-center"
              >
                Start for free
              </Link>
            </div>

            {/* Pro card */}
            <div className="w-full max-w-sm bg-forest text-on-primary rounded-3xl p-10 space-y-8 shadow-[0px_12px_32px_rgba(27,28,24,0.06)] transform scale-105">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <h3 className="font-display text-2xl font-bold">Vitalog Pro</h3>
                  <p className="text-white/70 text-sm font-body">The complete health stack.</p>
                </div>
                <span className="bg-primary-fixed text-on-primary-fixed text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                  Most Popular
                </span>
              </div>
              <div className="font-serif text-5xl font-bold">
                ₹299 <span className="text-lg font-body opacity-70">/mo</span>
              </div>
              <ul className="space-y-4 pt-4">
                <li className="flex items-center space-x-3 text-sm font-body text-white/90">
                  <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
                  <span>Unlimited report uploads</span>
                </li>
                <li className="flex items-center space-x-3 text-sm font-body text-white/90">
                  <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
                  <span>Health timeline &amp; trend charts</span>
                </li>
                <li className="flex items-center space-x-3 text-sm font-body text-white/90">
                  <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
                  <span>5 family member profiles</span>
                </li>
                <li className="flex items-center space-x-3 text-sm font-body text-white/90">
                  <span className="material-symbols-outlined text-primary-fixed text-lg">check_circle</span>
                  <span>PDF export &amp; priority support</span>
                </li>
              </ul>
              <Link
                to="/signup"
                className="block w-full py-4 rounded-xl bg-surface text-forest font-bold font-body hover:opacity-90 transition-all text-center"
              >
                Start Pro
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer CTA ── */}
        <section className="mt-24 py-24 bg-forest text-on-primary text-center px-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-64 h-64 bg-primary-fixed blur-[100px]" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-container blur-[150px]" />
          </div>
          <div className="max-w-screen-md mx-auto space-y-10 relative z-10">
            <h2 className="font-display text-5xl md:text-6xl leading-tight">
              Your health has a story.<br />Start reading it.
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <Link
                to="/signup"
                className="bg-white text-primary px-10 py-5 rounded-full font-body font-bold text-lg hover:shadow-2xl transition-all"
              >
                Create your free account
              </Link>
              <a
                href="#how-it-works"
                className="bg-transparent border border-white/30 text-white px-10 py-5 rounded-full font-body font-bold text-lg hover:bg-white/5 transition-all"
              >
                View demo
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-surface py-16 px-8 border-t border-outline-variant/15">
        <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-secondary-container/30 flex items-center justify-center rounded-lg">
              <span
                className="material-symbols-outlined text-primary text-base"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                eco
              </span>
            </div>
            <span className="text-xl font-bold font-serif text-primary">Vitalog</span>
          </div>

          {/* Nav links */}
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
            <a href="#" className="text-xs font-body uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-xs font-body uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-xs font-body uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">
              Cookie Policy
            </a>
            <a href="#" className="text-xs font-body uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">
              Contact Us
            </a>
          </div>

          {/* Copyright */}
          <p className="text-xs font-body uppercase tracking-widest text-on-surface-variant/60">
            © 2024 Vitalog Health Intelligence.
          </p>
        </div>
      </footer>
    </div>
  )
}
