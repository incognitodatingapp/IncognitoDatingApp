import { useState, useRef, useEffect } from "react";
import { useGetMe, useUpdateMe, useUploadAvatar, useGetMyStats, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Save, Activity, MessageSquare, Unlock, LayoutGrid, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: stats } = useGetMyStats();
  
  const updateMe = useUpdateMe();
  const uploadAvatar = useUploadAvatar();
  
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName || "");
      setUsername(me.username || "");
      setBio(me.bio || "");
    }
  }, [me]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMe.mutate({ data: { displayName, username, bio } }, {
      onSuccess: () => {
        toast({ title: "Profile updated successfully", className: "bg-[#111118] text-white border-[#1e1e26]" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      }
    });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // We need to convert file to base64 or upload it directly. The api accepts { file: string } (Wait, API accepts form data according to openapi but the input type says string, usually this means we just pass the file object or binary, but let's check the schema. Wait, `AvatarUpload` says `file: string`. It is a string format binary or base64. Wait, customFetch typically uses FormData if it is a file upload. Let's look at the generated API:
    // `const formData = new FormData(); formData.append('file', avatarUpload.file);`
    // So `file` needs to be the actual File object despite TS typing it as string, or we cast it to any. Let's cast it).
    
    uploadAvatar.mutate({ data: { file: file as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Avatar updated", className: "bg-[#111118] text-white border-[#1e1e26]" });
      }
    });
  };

  if (meLoading) return <div className="flex-1 p-8 text-zinc-500 animate-pulse">Loading profile...</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0f] text-white p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 tracking-tight">Your Identity</h1>
        
        <div className="grid md:grid-cols-[1fr_300px] gap-8">
          
          <div className="space-y-8">
            <div className="bg-[#111118] border border-[#1e1e26] rounded-3xl p-8 shadow-xl">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
                <div 
                  className="relative group cursor-pointer shrink-0"
                  onClick={handleAvatarClick}
                >
                  <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-[#1e1e26] overflow-hidden">
                    {me?.avatarUrl ? (
                      <img src={me.avatarUrl} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-zinc-500 group-hover:opacity-50 transition-opacity">
                        {me?.displayName?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Camera className="text-white drop-shadow-md" size={24} />
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                
                <div>
                  <h2 className="text-xl font-bold">{me?.displayName}</h2>
                  <p className="text-zinc-500">@{me?.username || 'anonymous'}</p>
                  {me?.isVip && <div className="mt-2 inline-block px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase rounded-full tracking-wider">VIP Member</div>}
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e26] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Username</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-zinc-500">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-[#1e1e26] rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Bio</label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={4}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e26] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none"
                    placeholder="Tell them nothing, or tell them everything."
                  />
                </div>
                
                <div className="pt-4 flex justify-end">
                  <button 
                    type="submit"
                    disabled={updateMe.isPending}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.4)]"
                  >
                    {updateMe.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-zinc-200">
              <Activity className="text-cyan-400" size={20} />
              Your Impact
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111118] border border-[#1e1e26] rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center text-center group hover:border-purple-500/30 transition-colors">
                <MessageSquare className="text-purple-400 mb-3 group-hover:scale-110 transition-transform" size={28} />
                <span className="text-3xl font-black mb-1">{stats?.totalChats || 0}</span>
                <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Matches</span>
              </div>
              
              <div className="bg-[#111118] border border-[#1e1e26] rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center text-center group hover:border-cyan-500/30 transition-colors">
                <Unlock className="text-cyan-400 mb-3 group-hover:scale-110 transition-transform" size={28} />
                <span className="text-3xl font-black mb-1">{stats?.totalReveals || 0}</span>
                <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Reveals</span>
              </div>
              
              <div className="bg-[#111118] border border-[#1e1e26] rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center text-center group hover:border-white/20 transition-colors">
                <CheckCircle2 className="text-zinc-300 mb-3 group-hover:scale-110 transition-transform" size={28} />
                <span className="text-3xl font-black mb-1">{stats?.totalMessages || 0}</span>
                <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Messages</span>
              </div>
              
              <div className="bg-[#111118] border border-[#1e1e26] rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center text-center group hover:border-white/20 transition-colors">
                <LayoutGrid className="text-zinc-300 mb-3 group-hover:scale-110 transition-transform" size={28} />
                <span className="text-3xl font-black mb-1">{stats?.postsCount || 0}</span>
                <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Posts</span>
              </div>
            </div>
            
            <div className="mt-8 p-6 bg-gradient-to-br from-purple-900/20 to-[#111118] border border-purple-500/10 rounded-2xl text-sm text-zinc-400 leading-relaxed">
              <p>Your identity is safe here. Nothing is shared with a match unless both of you agree to a mutual reveal. Stay mysterious.</p>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
