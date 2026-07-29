import { Link } from "wouter";
import { Eye, Shield, Zap, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-white overflow-hidden relative flex flex-col font-sans">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Navbar */}
      <header className="px-6 py-8 flex items-center justify-between z-10 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="AnonMatch" className="w-8 h-8 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <span className="font-bold tracking-widest text-xl bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
            Incognito
          </span>
        </div>
        <div className="flex gap-4">
          <Link href="/sign-in" className="text-zinc-300 hover:text-white px-4 py-2 text-sm font-medium transition-colors">
            Log In
          </Link>
          <Link href="/sign-up" className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-5 py-2 rounded-full text-sm font-medium transition-all hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            Join the Club
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center z-10 px-4 text-center mt-12 mb-24">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-8">
          <Sparkles size={14} />
          <span>The underground of connection</span>
        </div>
        
  <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-6 leading-none">
  INCOGNITO <br/>
  <span className="filter drop-shadow-[0_0_25px_rgba(139,92,246,0.4)]">
  <span className="bg-clip-text text-transparent bg-gradient-to-br from-purple-400 via-purple-600 to-cyan-500"
  style={{ filter: 'drop-shadow(0 0 25px rgba(139, 92, 246, 0.4))' }}>
  DATING
</span>
</h1>
        
        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mb-12 font-medium">
          No faces. No names. Just raw connection. Talk to strangers and watch the blur fade as trust builds, one message at a time.
        </p>
        
        <Link href="/sign-up" className="group relative inline-flex items-center justify-center px-8 py-4 bg-purple-600 text-white rounded-full font-bold text-lg overflow-hidden transition-transform active:scale-95 shadow-[0_0_40px_rgba(139,92,246,0.4)] hover:shadow-[0_0_60px_rgba(139,92,246,0.6)]">
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-purple-600 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <span className="relative flex items-center gap-2">
            Start Matching
            <Zap size={20} className="group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>
      </main>

      {/* Features */}
      <section className="bg-[#111118]/80 backdrop-blur-md border-t border-white/5 py-24 z-10">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <Eye className="text-purple-400" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-3">Progressive Reveal</h3>
            <p className="text-zinc-400">Start completely blurred. Every message you send makes your avatar slightly clearer to your match.</p>
          </div>
          
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <Shield className="text-cyan-400" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-3">Total Anonymity</h3>
            <p className="text-zinc-400">No profile links. No real names. Your identity is protected until you explicitly agree to "Reveal Both".</p>
          </div>
          
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <Zap className="text-purple-400" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-3">Instant Connections</h3>
            <p className="text-zinc-400">Drop into the public feed, find a vibe, and jump straight into a 1-on-1 private chat.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
