import { MaximizeIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils";

interface TagInfo {
  tag: string;
  color: string;
  count: number;
}

interface Props {
  tags: TagInfo[];
  visibleTags?: Set<string>;
  onToggleTag: (tag: string) => void;
  onShowAll: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  memoCount: number;
  linkCount: number;
}

const ConstellationControls = ({ tags, visibleTags, onToggleTag, onShowAll, onZoomIn, onZoomOut, onZoomFit, memoCount, linkCount }: Props) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
      {/* Stats badge */}
      <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-slate-400 flex items-center gap-3">
        <span>
          <span className="text-slate-200 font-mono">{memoCount}</span> stars
        </span>
        <span>
          <span className="text-slate-200 font-mono">{linkCount}</span> links
        </span>
      </div>

      {/* Zoom controls */}
      <div className="bg-black/50 backdrop-blur-sm rounded-lg flex flex-col">
        <button
          onClick={onZoomIn}
          className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
          title="Zoom in"
        >
          <ZoomInIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-2 text-slate-400 hover:text-slate-200 transition-colors border-t border-slate-700/50"
          title="Zoom out"
        >
          <ZoomOutIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomFit}
          className="p-2 text-slate-400 hover:text-slate-200 transition-colors border-t border-slate-700/50"
          title="Fit to view"
        >
          <MaximizeIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Tag legend / filter */}
      {tags.length > 0 && (
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 max-w-[200px]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left text-xs text-slate-400 hover:text-slate-200 transition-colors px-1 py-0.5"
          >
            {expanded ? "Hide" : "Tags"} ({tags.length})
          </button>
          {expanded && (
            <div className="mt-1 max-h-[300px] overflow-y-auto space-y-0.5">
              {visibleTags !== undefined && (
                <button
                  onClick={onShowAll}
                  className="w-full text-left text-xs text-slate-500 hover:text-slate-300 transition-colors px-1 py-0.5 italic"
                >
                  Show all
                </button>
              )}
              {tags.map(({ tag, color, count }) => {
                const isVisible = visibleTags === undefined || visibleTags.has(tag);
                const displayName = tag === "__untagged__" ? "Untagged" : tag;
                return (
                  <button
                    key={tag}
                    onClick={() => onToggleTag(tag)}
                    className={cn(
                      "w-full text-left flex items-center gap-1.5 px-1 py-0.5 rounded transition-all text-xs",
                      isVisible ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-400",
                    )}
                  >
                    <span
                      className={cn("w-2 h-2 rounded-full shrink-0 transition-opacity", !isVisible && "opacity-30")}
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{displayName}</span>
                    <span className="ml-auto font-mono text-slate-600 shrink-0">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConstellationControls;
