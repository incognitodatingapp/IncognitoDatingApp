import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@clerk/react";
import { 
  useStartSearch, 
  useCancelSearch, 
  useGetCurrentMatch, 
  useEndChat, 
  useListMessages, 
  useSendMessage, 
  useRequestReveal, 
  getGetCurrentMatchQueryKey, 
  getListMessagesQueryKey,
  MatchStateStatus
} from "@workspace/api-client-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Search, X, UserX, Unlock, Loader2, Info, Eye } from "lucide-react";
import { format } from "date-fns";

export default function ChatPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  
  // Data hooks
  const { data: matchData, isLoading: matchLoading } = useGetCurrentMatch({
    query: {
      queryKey: getGetCurrentMatchQueryKey(),
      refetchInterval: (query) => {
         const state = query.state.data;
         // Poll if searching or if no match, to handle edge cases where WS drops
         if (!state) return 3000;
         return false;
      }
    }
  });

  const matchId = matchData?.status === MatchStateStatus.active ? matchData.id : null;

  const { data: messagesData } = useListMessages(
    { limit: 100 },
    { 
      query: { 
        enabled: !!matchId, 
        queryKey: getListMessagesQueryKey({ limit: 100 })
      } 
    }
  );

  const startSearch = useStartSearch();
  const cancelSearch = useCancelSearch();
  const endChat = useEndChat();
  const sendMessage = useSendMessage();
  const requestReveal = useRequestReveal();

  const [inputContent, setInputContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Local message state for optimistic updates + ws appends
  const [localMessages, setLocalMessages] = useState<any[]>([]);

  useEffect(() => {
    if (messagesData?.messages) {
      setLocalMessages([...messagesData.messages].reverse());
    }
  }, [messagesData]);

  // WebSocket listener
  useEffect(() => {
    const unsubscribe = addListener((msg) => {
      if (msg.type === 'match_found' || msg.type === 'chat_ended' || msg.type === 'reveal_update') {
        queryClient.invalidateQueries({ queryKey: getGetCurrentMatchQueryKey() });
      }
      if (msg.type === 'new_message') {
        setLocalMessages(prev => [...prev, msg.message]);
        queryClient.invalidateQueries({ queryKey: getGetCurrentMatchQueryKey() }); // to update msg counts
      }
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  // Actions
  const handleStartSearch = () => {
    startSearch.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCurrentMatchQueryKey() })
    });
  };

  const handleCancelSearch = () => {
    cancelSearch.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCurrentMatchQueryKey() })
    });
  };

  const handleEndChat = () => {
    if (!confirm("Are you sure you want to end this chat?")) return;
    endChat.mutate(undefined, {
      onSuccess: () => {
        setLocalMessages([]);
        queryClient.invalidateQueries({ queryKey: getGetCurrentMatchQueryKey() });
      }
    });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || !matchId) return;
    
    const content = inputContent;
    setInputContent("");
    
    // Optimistic append
    const tempId = Math.random();
    setLocalMessages(prev => [...prev, { id: tempId, content, isMine: true, createdAt: new Date().toISOString() }]);
    
    sendMessage.mutate({ data: { content } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCurrentMatchQueryKey() });
      },
      onError: () => {
        setLocalMessages(prev => prev.filter(m => m.id !== tempId));
        setInputContent(content); // restore
      }
    });
  };

  const handleReveal = () => {
    requestReveal.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCurrentMatchQueryKey() })
    });
  };

  // UI calculations
  const calculateBlur = (msgCount: number, isRevealed: boolean) => {
    if (isRevealed) return 0;
    if (msgCount >= 50) return 0;
    if (msgCount >= 20) return 5;
    if (msgCount >= 10) return 9;
    if (msgCount >= 5) return 14;
    return 20;
  };

  // View States
  if (matchLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  // STATE 2: SEARCHING
  // If the user's overall state says searching but there is no active match.
  // We don't have a direct "isSearching" flag on matchData if it returns null, 
  // but if we rely on a global user search state we might need useGetMe. 
  // Wait, if matchData is missing, startSearch triggers. The API returns SearchResult.
  // We can track local state for searching to show the spinner immediately.
  const isSearching = startSearch.isPending || (matchData && !matchData.id && false); // API might return a specific status if searching? 
  // The prompt says "Poll useGetCurrentMatch every 3s as a fallback." So we should also rely on useGetMe.isSearching.
  // Actually, let's just use local state to track if we clicked search, or rely on the query if we can.
  // The requirements mention "State 1: No active chat, not searching" and "State 2: Searching".
  
  // Let's use a local state to bridge the gap, or just check if startSearch has fired.

  // Let's import useGetMe to accurately read isSearching.
  return <ChatContent matchData={matchData} onStart={handleStartSearch} onCancel={handleCancelSearch} onEnd={handleEndChat} onSend={handleSend} onReveal={handleReveal} inputContent={inputContent} setInputContent={setInputContent} localMessages={localMessages} messagesEndRef={messagesEndRef} calculateBlur={calculateBlur} />;
}

import { useGetMe } from "@workspace/api-client-react";

// Blur level at each milestone
const MILESTONE_BLUR: Record<number, number> = { 5: 14, 10: 9, 20: 5, 50: 0 };
const MILESTONES = [5, 10, 20, 50];

type AugmentedItem =
  | { kind: "message"; data: any }
  | { kind: "milestone"; milestone: number; blurPx: number; partnerAvatarUrl?: string; partnerDisplayName?: string }
  | { kind: "reveal"; partnerAvatarUrl?: string; partnerDisplayName?: string };

function MilestoneCard({ item }: { item: Extract<AugmentedItem, { kind: "milestone" }> }) {
  const label =
    item.milestone >= 50
      ? "Half a century of words 🔥"
      : item.milestone >= 20
      ? "Trust is building fast..."
      : item.milestone >= 10
      ? "Getting clearer..."
      : "The fog is lifting...";

  return (
    <div className="flex flex-col items-center gap-3 py-6 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Glowing ring around avatar */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl scale-150" />
        <div
          className="relative w-20 h-20 rounded-full border-2 border-purple-500/60 overflow-hidden transition-all duration-[1200ms] ease-in-out shadow-[0_0_30px_rgba(139,92,246,0.4)]"
          style={{ filter: `blur(${item.blurPx}px)` }}
        >
          {item.partnerAvatarUrl ? (
            <img src={item.partnerAvatarUrl} alt="Partner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-2xl font-bold text-zinc-400">?</div>
          )}
        </div>
        {/* milestone badge */}
        <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-[#0a0a0f] shadow-lg">
          {item.milestone}
        </div>
      </div>
      <div className="text-center">
        <p className="text-cyan-400 text-sm font-semibold tracking-wide">{label}</p>
        <p className="text-zinc-500 text-xs mt-0.5">{item.milestone} messages unlocked a new level</p>
      </div>
      <div className="h-px w-24 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
    </div>
  );
}

function RevealCard({ item }: { item: Extract<AugmentedItem, { kind: "reveal" }> }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 px-4 animate-in fade-in zoom-in-95 duration-700">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-2xl scale-150 animate-pulse" />
        <div className="relative w-24 h-24 rounded-full border-2 border-cyan-400 overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.6)]">
          {item.partnerAvatarUrl ? (
            <img src={item.partnerAvatarUrl} alt="Partner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-3xl font-bold text-zinc-300">
              {item.partnerDisplayName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        <div className="absolute -bottom-1 -right-1 bg-cyan-500 text-white rounded-full w-7 h-7 flex items-center justify-center border-2 border-[#0a0a0f] shadow-lg">
          <Eye size={14} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-cyan-300 text-base font-bold tracking-wide">
          {item.partnerDisplayName ? `${item.partnerDisplayName} revealed` : "Both revealed!"}
        </p>
        <p className="text-zinc-500 text-xs mt-1">The masks are off. You can see each other now.</p>
      </div>
      <div className="h-px w-32 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
    </div>
  );
}

function ChatContent({ matchData, onStart, onCancel, onEnd, onSend, onReveal, inputContent, setInputContent, localMessages, messagesEndRef, calculateBlur }: any) {
  const { data: me } = useGetMe();
  const isSearching = me?.isSearching;
  const isMatched = matchData && matchData.status === MatchStateStatus.active;

  // Build augmented timeline with milestone avatar cards injected after the Nth sent message
  const augmentedMessages = useMemo<AugmentedItem[]>(() => {
    if (!isMatched) return [];
    const result: AugmentedItem[] = [];
    let myCount = 0;
    const shownMilestones = new Set<number>();

    for (const msg of localMessages) {
      result.push({ kind: "message", data: msg });
      if (msg.isMine) {
        myCount++;
        if (MILESTONES.includes(myCount) && !shownMilestones.has(myCount)) {
          shownMilestones.add(myCount);
          result.push({
            kind: "milestone",
            milestone: myCount,
            blurPx: MILESTONE_BLUR[myCount],
            partnerAvatarUrl: matchData.partnerAvatarUrl,
            partnerDisplayName: matchData.partnerDisplayName,
          });
        }
      }
    }

    // Append a reveal card at the end if mutually revealed
    if (matchData.isRevealed) {
      result.push({
        kind: "reveal",
        partnerAvatarUrl: matchData.partnerAvatarUrl,
        partnerDisplayName: matchData.partnerDisplayName,
      });
    }

    return result;
  }, [localMessages, isMatched, matchData]);

  if (isSearching && !isMatched) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0f] p-6 text-center">
        <div className="relative mb-8">
          <div className="w-32 h-32 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          <div className="w-24 h-24 rounded-full border-2 border-cyan-500/30 border-l-cyan-500 animate-[spin_2s_linear_reverse] absolute top-4 left-4" />
          <Search className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Looking for someone...</h2>
        <p className="text-zinc-400 mb-8 max-w-sm">Reaching out into the void to find a match. This usually takes just a moment.</p>
        <button onClick={onCancel} className="flex items-center gap-2 text-zinc-400 hover:text-white bg-[#111118] px-6 py-3 rounded-full border border-[#1e1e26] transition-all hover:bg-[#1e1e26]">
          <X size={18} />
          Cancel Search
        </button>
      </div>
    );
  }

  if (!isMatched) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0f] p-6 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="w-20 h-20 bg-[#111118] border border-[#1e1e26] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] mb-8 relative z-10">
          <UserX className="text-purple-400" size={36} />
        </div>
        
        <h2 className="text-3xl font-extrabold text-white mb-4 z-10 tracking-tight">Enter the Void</h2>
        <p className="text-zinc-400 max-w-md mb-10 z-10 text-lg">
          Get matched with a random stranger. Your faces and names are hidden. Trust is built word by word.
        </p>
        
        <button onClick={onStart} className="group relative inline-flex items-center justify-center px-8 py-4 bg-purple-600 text-white rounded-full font-bold text-lg overflow-hidden transition-transform active:scale-95 shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_50px_rgba(139,92,246,0.5)] z-10">
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-purple-600 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <span className="relative flex items-center gap-2">
            Find Someone
            <Search size={20} className="group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </div>
    );
  }

  // STATE 3: ACTIVE CHAT
  const partnerBlur = calculateBlur(matchData.partnerMessageCount, matchData.isRevealed);
  const myBlur = calculateBlur(matchData.myMessageCount, matchData.isRevealed);
  
  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Header */}
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-[#1e1e26] bg-[#111118]/90 backdrop-blur-xl z-20 flex items-center justify-between shrink-0 shadow-lg">
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <div 
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden transition-all duration-[800ms] ease-in-out will-change-filter"
              style={{ filter: `blur(${partnerBlur}px)` }}
            >
              {matchData.partnerAvatarUrl ? (
                <img src={matchData.partnerAvatarUrl} alt="Partner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold bg-zinc-800">?</div>
              )}
            </div>
            {/* Status dot */}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-cyan-400 rounded-full border-2 border-[#111118] shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
          </div>
          <div>
            <h2 className="font-bold text-white tracking-wide">
              {matchData.isRevealed ? matchData.partnerDisplayName : "Anonymous"}
            </h2>
            <div className="text-xs text-zinc-500 flex items-center gap-1">
              <span>{matchData.partnerMessageCount} msgs sent</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {!matchData.isRevealed && (
            <button 
              onClick={onReveal}
              disabled={matchData.myRevealRequested}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all border ${
                matchData.myRevealRequested 
                  ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' 
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white'
              }`}
            >
              {matchData.myRevealRequested ? (
                matchData.partnerRevealRequested ? <Loader2 className="animate-spin" size={14} /> : <ClockIcon size={14} />
              ) : <Unlock size={14} />}
              <span className="hidden sm:inline">
                {matchData.myRevealRequested ? 'Waiting for partner...' : 'Reveal Both'}
              </span>
              <span className="sm:hidden">Reveal</span>
            </button>
          )}
          
          <button onClick={onEnd} className="text-zinc-500 hover:text-red-400 p-2 rounded-full transition-colors bg-zinc-900 border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/30">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 hide-scrollbar relative">
        <div className="text-center text-xs text-zinc-600 mb-8 border border-white/5 bg-white/5 py-2 px-4 rounded-full mx-auto w-fit flex items-center gap-2">
          <Info size={14} />
          You are now chatting with a stranger. Say hi.
        </div>

        {augmentedMessages.map((item, i) => {
          if (item.kind === "milestone") {
            return <MilestoneCard key={`milestone-${item.milestone}`} item={item} />;
          }
          if (item.kind === "reveal") {
            return <RevealCard key="reveal-card" item={item} />;
          }
          const msg = item.data;
          return (
            <div key={msg.id} className={`flex flex-col ${msg.isMine ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                msg.isMine 
                  ? 'bg-purple-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(139,92,246,0.15)]' 
                  : 'bg-[#1e1e26] text-zinc-200 rounded-bl-sm border border-white/5'
              }`}>
                <p className="break-words leading-relaxed">{msg.content}</p>
              </div>
              <span className="text-[10px] text-zinc-600 mt-1 px-1">
                {format(new Date(msg.createdAt), 'HH:mm')}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-4 bg-[#111118] border-t border-[#1e1e26] shrink-0">
        <form onSubmit={onSend} className="max-w-4xl mx-auto flex items-end gap-2 bg-[#0a0a0f] border border-[#1e1e26] rounded-2xl p-2 focus-within:border-purple-500/50 transition-colors">
          
          <div className="flex flex-col justify-end pb-1 px-2 shrink-0">
            <div 
              className="w-8 h-8 rounded-full bg-purple-900 border border-purple-700 overflow-hidden transition-all duration-[800ms]"
              style={{ filter: `blur(${myBlur}px)` }}
            >
              {me?.avatarUrl ? (
                <img src={me.avatarUrl} alt="Me" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-purple-300 font-bold bg-purple-900/50">M</div>
              )}
            </div>
          </div>

          <textarea
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend(e);
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-white placeholder:text-zinc-600 resize-none outline-none py-2 max-h-[120px]"
            rows={1}
            style={{ minHeight: '40px' }}
          />

          <button 
            type="submit" 
            disabled={!inputContent.trim()}
            className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white rounded-xl w-10 h-10 flex items-center justify-center transition-all disabled:opacity-50 shadow-lg mb-0.5"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

// A simple clock icon since it wasn't imported
function ClockIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
