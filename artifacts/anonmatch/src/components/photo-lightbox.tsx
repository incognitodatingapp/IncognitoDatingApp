import { useEffect } from "react";
import { X } from "lucide-react";

interface PhotoLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function PhotoLightbox({ src, alt = "Photo", onClose }: PhotoLightboxProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-zinc-800/90 border border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all z-10"
        onClick={onClose}
      >
        <X size={18} />
      </button>

      {/* Image */}
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl shadow-black animate-in zoom-in-95 duration-200 select-none"
        style={{ maxHeight: "calc(100dvh - 4rem)", maxWidth: "calc(100vw - 4rem)" }}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>
  );
}
