import { useGetMatchHistory } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Ghost, Unlock, Lock, MessageSquare } from "lucide-react";

export default function HistoryPage() {
  const { data: historyData, isLoading } = useGetMatchHistory();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] overflow-hidden">
      <div className="px-6 py-5 border-b border-[#1e1e26] bg-[#0a0a0f]/80 backdrop-blur-xl z-10 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white tracking-tight">Match History</h1>
        <p className="text-zinc-500 text-sm mt-1">Ghosts of conversations past.</p>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 md:p-6 pb-24">
        <div className="max-w-3xl mx-auto">
          
          {isLoading ? (
            <div className="text-center py-12 text-zinc-500 animate-pulse">Summoning history...</div>
          ) : !historyData?.matches?.length ? (
            <div className="text-center py-20 flex flex-col items-center">
              <div className="w-20 h-20 bg-[#111118] border border-[#1e1e26] rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <Ghost className="text-zinc-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No chats yet</h3>
              <p className="text-zinc-500">Go to the Match tab to find your first stranger.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {historyData.matches.map((match) => (
                <div key={match.id} className="bg-[#111118] border border-[#1e1e26] rounded-2xl p-5 flex items-center gap-5 shadow-lg group hover:border-white/10 transition-all">
                  
                  <div className="relative shrink-0">
                    <div className={`w-14 h-14 rounded-full bg-zinc-800 border-2 border-[#1e1e26] overflow-hidden ${!match.isRevealed ? 'blur-md' : ''}`}>
                      {match.partnerAvatarUrl ? (
                        <img src={match.partnerAvatarUrl} alt="Partner" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold bg-zinc-800">
                          {match.partnerDisplayName?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#111118] border border-[#1e1e26] flex items-center justify-center shadow-sm">
                      {match.isRevealed ? (
                        <Unlock size={10} className="text-cyan-400" />
                      ) : (
                        <Lock size={10} className="text-zinc-500" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`text-lg font-bold truncate ${match.isRevealed ? 'text-white' : 'text-zinc-400 select-none blur-[2px]'}`}>
                        {match.isRevealed ? match.partnerDisplayName : 'Anonymous User'}
                      </h3>
                      <span className="text-xs text-zinc-600 whitespace-nowrap ml-4">
                        {format(new Date(match.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare size={14} />
                        {match.myMessageCount + match.partnerMessageCount} total msgs
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                        {match.endedAt ? 'Ended' : 'Active'}
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
