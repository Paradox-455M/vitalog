interface AuthSplitPanelProps {
  children: React.ReactNode
}

export function AuthSplitPanel({ children }: AuthSplitPanelProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — forest green, desktop only */}
      <div className="hidden lg:flex lg:w-[55%] bg-[#2D5016] relative overflow-hidden flex-col justify-between p-16">
        {/* Top label */}
        <p className="text-white/80 font-sans tracking-widest text-sm uppercase">
          The Mindful Curator
        </p>

        {/* Middle content */}
        <div>
          <h1 className="font-serif text-5xl xl:text-6xl text-white leading-tight mb-8">
            Finally understand what your health reports are telling you.
          </h1>
          <p className="text-white/90 text-xl italic mb-4">
            "Vitalog has changed how I look at my blood tests. I no longer feel anxious opening a PDF."
          </p>
          <p className="text-white/70 text-sm">— Ananya, Mumbai</p>
        </div>

        {/* Bottom logo row */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[#2D5016]">eco</span>
          </div>
          <span className="font-serif text-2xl font-bold text-white tracking-tight">Vitalog</span>
        </div>
      </div>

      {/* Right panel — cream */}
      <div className="w-full lg:w-[45%] bg-[#FAFAF7] flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-[400px] flex flex-col items-center">
          {children}
        </div>
      </div>
    </div>
  )
}
