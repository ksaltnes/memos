import dayjs from "dayjs";
import { Memo, MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import { ConstellationLink, ConstellationNode } from "./types";

// Nebula-inspired palette: purples, blues, teals, golds, pinks, greens.
const NEBULA_PALETTE = [
  "#a78bfa", // violet-400
  "#818cf8", // indigo-400
  "#60a5fa", // blue-400
  "#38bdf8", // sky-400
  "#22d3ee", // cyan-400
  "#2dd4bf", // teal-400
  "#4ade80", // green-400
  "#a3e635", // lime-400
  "#facc15", // yellow-400
  "#fb923c", // orange-400
  "#f87171", // red-400
  "#fb7185", // rose-400
  "#e879f9", // fuchsia-400
  "#c084fc", // purple-400
];

const DEFAULT_STAR_COLOR = "#e2e8f0"; // slate-200 (white/silver for untagged)

/**
 * Deterministic color from tag name using a simple hash.
 */
export const tagToColor = (tag: string): string => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit int
  }
  return NEBULA_PALETTE[Math.abs(hash) % NEBULA_PALETTE.length];
};

/**
 * Compute star size (3-12) based on content length, reactions, and pinned status.
 */
export const computeStarSize = (memo: Memo): number => {
  const contentLen = memo.snippet?.length || memo.content?.length || 0;
  const reactionsCount = memo.reactions?.length || 0;
  const base = 3;
  const fromContent = Math.min(Math.log(contentLen + 1) * 0.8, 4);
  const fromReactions = Math.min(reactionsCount * 0.5, 3);
  const fromPinned = memo.pinned ? 2 : 0;
  return Math.min(Math.max(base + fromContent + fromReactions + fromPinned, 3), 12);
};

/**
 * Compute star brightness (0.3-1.0) based on recency of update.
 * Updated today = 1.0, a week ago ~0.6, a month ago ~0.35.
 */
export const computeStarBrightness = (memo: Memo): number => {
  const now = dayjs();
  const updated = dayjs(memo.updateTime || memo.displayTime || memo.createTime);
  const daysAgo = now.diff(updated, "day");
  // Exponential decay: brightness = 0.3 + 0.7 * e^(-daysAgo / 14)
  const brightness = 0.3 + 0.7 * Math.exp(-daysAgo / 14);
  return Math.min(Math.max(brightness, 0.3), 1.0);
};

/**
 * Build the full constellation graph from a list of memos.
 */
export const buildConstellationGraph = (
  memos: Memo[],
  visibleTags?: Set<string>,
): { nodes: ConstellationNode[]; links: ConstellationLink[] } => {
  const nodeMap = new Map<string, ConstellationNode>();
  const links: ConstellationLink[] = [];

  // Filter memos by visible tags if provided.
  const filteredMemos =
    visibleTags !== undefined
      ? memos.filter((m) => {
          if (m.tags.length === 0) return visibleTags.has("__untagged__");
          return m.tags.some((t) => visibleTags.has(t));
        })
      : memos;

  // Build nodes.
  for (const memo of filteredMemos) {
    const primaryTag = memo.tags.length > 0 ? memo.tags[0] : undefined;
    const color = primaryTag ? tagToColor(primaryTag) : DEFAULT_STAR_COLOR;
    nodeMap.set(memo.name, {
      id: memo.name,
      memo,
      size: computeStarSize(memo),
      brightness: computeStarBrightness(memo),
      color,
      tags: memo.tags,
    });
  }

  // Build links from REFERENCE relations.
  for (const memo of filteredMemos) {
    if (!memo.relations) continue;
    for (const rel of memo.relations) {
      if (rel.type !== MemoRelation_Type.REFERENCE) continue;
      const sourceName = rel.memo?.name;
      const targetName = rel.relatedMemo?.name;
      if (!sourceName || !targetName) continue;
      // Only add link if both nodes exist in our filtered set.
      if (nodeMap.has(sourceName) && nodeMap.has(targetName)) {
        // Deduplicate bidirectional links.
        const key = [sourceName, targetName].sort().join("::");
        if (!links.some((l) => [l.source, l.target].sort().join("::") === key)) {
          links.push({ source: sourceName, target: targetName });
        }
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
};

/**
 * Get all unique tags with their colors and counts.
 */
export const getUniqueTags = (memos: Memo[]): Array<{ tag: string; color: string; count: number }> => {
  const tagCounts = new Map<string, number>();
  let untaggedCount = 0;

  for (const memo of memos) {
    if (memo.tags.length === 0) {
      untaggedCount++;
    }
    for (const tag of memo.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const result = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, color: tagToColor(tag), count }))
    .sort((a, b) => b.count - a.count);

  if (untaggedCount > 0) {
    result.push({ tag: "__untagged__", color: DEFAULT_STAR_COLOR, count: untaggedCount });
  }

  return result;
};

/**
 * Parse hex color to rgb components.
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 226, g: 232, b: 240 }; // fallback to slate-200
};
