import { useState } from "react";
import { useListPosts, useCreatePost, useUploadPostImage, getListPostsQueryKey, useDeletePost } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Lock, Image as ImageIcon, Trash2, ShieldAlert, X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function FeedPage() {
  const queryClient = useQueryClient();
  const { data: postsData, isLoading } = useListPosts();
  const createPost = useCreatePost();
  const uploadPostImage = useUploadPostImage();
  const deletePost = useDeletePost();

  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const isSubmitting = createPost.isPending || uploadPostImage.isPending;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    // reset so same file can be re-selected
    e.target.value = "";
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    createPost.mutate(
      { data: { content } },
      {
        onSuccess: async (post) => {
          const postId = (post as any).id as number;
          if (imageFile) {
            uploadPostImage.mutate(
              { id: postId, data: { file: imageFile } },
              {
                onSettled: () => {
                  clearImage();
                  queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
                },
              }
            );
          } else {
            queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
          }
          setContent("");
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deletePost.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() }),
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] overflow-hidden">
      <div className="px-6 py-5 border-b border-[#1e1e26] bg-[#0a0a0f]/80 backdrop-blur-xl z-10 flex-shrink-0 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white tracking-tight">Public Feed</h1>
        <div className="flex items-center gap-2 text-xs font-medium text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/20">
          <ShieldAlert size={14} />
          Encrypted & Anonymous
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 md:p-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Create Post Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-[#111118] border border-[#1e1e26] rounded-2xl p-4 shadow-lg mb-8 relative overflow-hidden group focus-within:border-purple-500/50 transition-colors"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-cyan-500/5 opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative z-10">

              {/* Image preview */}
              {imagePreview && (
                <div className="relative mb-3 rounded-xl overflow-hidden border border-white/10 group/img">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full p-1 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Drop a thought into the void..."
                className="w-full bg-transparent text-white placeholder:text-zinc-600 resize-none outline-none min-h-[80px]"
                maxLength={280}
              />

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                {/* Label triggers file picker — works reliably inside iframes */}
                <label
                  htmlFor="feed-image-input"
                  className={`cursor-pointer p-2 rounded-full transition-colors ${imageFile ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-500 hover:text-cyan-400'}`}
                  title="Attach image"
                >
                  <ImageIcon size={18} />
                </label>
                <input
                  id="feed-image-input"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  onChange={handleImageSelect}
                />

                <div className="flex items-center gap-3">
                  <span className={`text-xs ${content.length > 250 ? 'text-red-400' : 'text-zinc-600'}`}>
                    {content.length}/280
                  </span>
                  <button
                    type="submit"
                    disabled={!content.trim() || isSubmitting}
                    className="bg-purple-600 hover:bg-purple-500 text-white rounded-full p-2.5 transition-all disabled:opacity-50 disabled:hover:bg-purple-600 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Feed List */}
          {isLoading ? (
            <div className="text-center py-12 text-zinc-500 animate-pulse">Loading feed...</div>
          ) : !postsData?.posts?.length ? (
            <div className="text-center py-12 text-zinc-500 bg-[#111118] rounded-2xl border border-dashed border-[#1e1e26]">
              No posts yet. Be the first to speak.
            </div>
          ) : (
            postsData.posts.map(post => {
              const isBlurred = post.isBlurred && !post.isOwn;

              return (
                <div key={post.id} className="bg-[#111118] border border-[#1e1e26] rounded-2xl p-5 shadow-lg relative group transition-all hover:border-white/10">
                  <div className="flex items-start gap-4">

                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 ${isBlurred ? 'blur-md' : ''}`}>
                        {post.authorAvatarUrl ? (
                          <img src={post.authorAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-zinc-400 font-bold text-sm">
                            {post.authorDisplayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isBlurred ? 'text-zinc-400 blur-sm select-none' : 'text-zinc-200'}`}>
                            {isBlurred ? 'Anonymous' : post.authorDisplayName}
                          </span>
                          <span className="text-xs text-zinc-600">
                            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {post.isOwn && (
                          <button onClick={() => handleDelete(post.id)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      {/* Post text */}
                      <div className={`relative ${isBlurred ? 'select-none' : ''}`}>
                        <p className={`text-zinc-300 break-words ${isBlurred ? 'blur-[6px] text-zinc-500' : ''}`}>
                          {post.content}
                        </p>
                        {isBlurred && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 text-sm font-medium text-cyan-300 shadow-xl shadow-black">
                              <Lock size={14} />
                              Match to reveal
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Post image */}
                      {post.imageUrl && (
                        <div className={`mt-3 rounded-xl overflow-hidden border border-white/5 ${isBlurred ? 'blur-lg' : ''}`}>
                          <img
                            src={post.imageUrl}
                            alt="Post"
                            className="w-full max-h-72 object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
