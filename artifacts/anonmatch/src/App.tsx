import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect, Link } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

// Pages
import HomePage from './pages/home';
import FeedPage from './pages/feed';
import ChatPage from './pages/chat';
import ProfilePage from './pages/profile';
import HistoryPage from './pages/history';

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(258, 90%, 66%)", // #8B5CF6
    colorForeground: "hsl(0, 0%, 95%)",
    colorMutedForeground: "hsl(240, 5%, 65%)",
    colorDanger: "hsl(0, 84%, 60%)",
    colorBackground: "hsl(240, 17%, 8%)",
    colorInput: "hsl(240, 10%, 15%)",
    colorInputForeground: "hsl(0, 0%, 95%)",
    colorNeutral: "hsl(240, 10%, 15%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#111118] border border-[#1e1e26] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl shadow-purple-900/10",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold tracking-tight text-white",
    headerSubtitle: "text-zinc-400",
    socialButtonsBlockButtonText: "text-zinc-300 font-medium",
    formFieldLabel: "text-zinc-300",
    footerActionLink: "text-purple-400 hover:text-purple-300 transition-colors",
    footerActionText: "text-zinc-400",
    dividerText: "text-zinc-500",
    identityPreviewEditButton: "text-purple-400 hover:text-purple-300",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-red-400",
    logoBox: "flex justify-center mb-4",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "border-zinc-800 hover:bg-zinc-800/50 transition-colors",
    formButtonPrimary: "bg-purple-500 hover:bg-purple-400 text-white transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)]",
    formFieldInput: "bg-[#1e1e26] border-zinc-800 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50",
    footerAction: "bg-[#0a0a0f] border-t border-zinc-800",
    dividerLine: "bg-zinc-800",
    alert: "bg-red-500/10 border border-red-500/20",
    otpCodeFieldInput: "bg-[#1e1e26] border-zinc-800 text-white",
    formFieldRow: "mb-4",
    main: "p-6 sm:p-8",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0a0a0f] px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0a0a0f] px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/feed" />
      </Show>
      <Show when="signed-out">
        <HomePage />
      </Show>
    </>
  );
}

import { LayoutDashboard, MessageCircle, User, Clock } from 'lucide-react';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const navItems = [
    { href: '/feed', icon: LayoutDashboard, label: 'Feed' },
    { href: '/chat', icon: MessageCircle, label: 'Match' },
    { href: '/history', icon: Clock, label: 'History' },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[100dvh] bg-[#0a0a0f] text-white selection:bg-purple-500/30">
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
      
      <Show when="signed-in">
        <nav className="md:w-64 border-b md:border-b-0 md:border-r border-[#1e1e26] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 md:static z-40 flex-shrink-0">
          <div className="p-4 md:p-6 flex items-center justify-between md:justify-start md:mb-8">
            <Link href="/feed" className="flex items-center gap-3 group">
              <img src={`${basePath}/logo.svg`} alt="AnonMatch" className="w-8 h-8 group-hover:drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] transition-all" />
              <span className="font-bold tracking-wider text-lg bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 hidden md:inline-block">
                AnonMatch
              </span>
            </Link>
          </div>
          
          <div className="flex md:flex-col overflow-x-auto md:overflow-visible px-4 md:px-3 pb-4 md:pb-0 gap-2 hide-scrollbar">
            {navItems.map((item) => {
              const active = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium whitespace-nowrap ${
                    active 
                      ? 'bg-purple-500/10 text-purple-400 shadow-[inset_0_0_20px_rgba(139,92,246,0.05)]' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <Icon size={20} className={active ? 'drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]' : ''} />
                  <span className={active ? 'drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]' : ''}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        
        <main className="flex-1 flex flex-col relative w-full h-[calc(100dvh-73px)] md:h-[100dvh] overflow-hidden">
          {children}
        </main>
      </Show>
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/feed"><ProtectedLayout><FeedPage /></ProtectedLayout></Route>
          <Route path="/chat"><ProtectedLayout><ChatPage /></ProtectedLayout></Route>
          <Route path="/profile"><ProtectedLayout><ProfilePage /></ProtectedLayout></Route>
          <Route path="/history"><ProtectedLayout><HistoryPage /></ProtectedLayout></Route>
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
