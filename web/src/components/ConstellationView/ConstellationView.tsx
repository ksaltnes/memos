import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";
import useNavigateTo from "@/hooks/useNavigateTo";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { cn } from "@/utils";
import ConstellationControls from "./ConstellationControls";
import { ConstellationLink, ConstellationNode } from "./types";
import { buildConstellationGraph, getUniqueTags, hexToRgb, tagToColor } from "./utils";

dayjs.extend(relativeTime);

interface Props {
  memos: Memo[];
  fullScreen?: boolean;
  className?: string;
}

const ConstellationView = ({ memos, fullScreen, className }: Props) => {
  const navigateTo = useNavigateTo();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<NodeObject<ConstellationNode>, LinkObject<ConstellationNode, ConstellationLink>> | undefined>(
    undefined,
  );
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [visibleTags, setVisibleTags] = useState<Set<string> | undefined>(undefined);

  // Resize observer for responsive sizing.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setGraphSize({ width, height });
      }
    });
    observer.observe(containerRef.current);
    setGraphSize(containerRef.current.getBoundingClientRect());
    return () => observer.disconnect();
  }, []);

  // Zoom to fit after initial render.
  useEffect(() => {
    if (graphRef.current && memos.length > 0) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 60);
      }, 500);
    }
  }, [memos.length]);

  const uniqueTags = useMemo(() => getUniqueTags(memos), [memos]);
  const graphData = useMemo(() => buildConstellationGraph(memos, visibleTags), [memos, visibleTags]);

  const handleNodeHover = useCallback((node: NodeObject<ConstellationNode> | null, previousNode: NodeObject<ConstellationNode> | null) => {
    void previousNode;
    if (node) {
      setHoveredNode(node as unknown as ConstellationNode);
    } else {
      setHoveredNode(null);
    }
  }, []);

  const handlePointerMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleNodeClick = useCallback(
    (node: NodeObject<ConstellationNode>) => {
      const n = node as unknown as ConstellationNode;
      navigateTo(`/${n.memo.name}`);
    },
    [navigateTo],
  );

  const handleToggleTag = useCallback(
    (tag: string) => {
      setVisibleTags((prev) => {
        if (prev === undefined) {
          // First toggle: show all except clicked.
          const allTags = new Set(uniqueTags.map((t) => t.tag));
          allTags.delete(tag);
          return allTags;
        }
        const next = new Set(prev);
        if (next.has(tag)) {
          next.delete(tag);
        } else {
          next.add(tag);
        }
        // If all tags are visible again, reset to undefined (show all).
        if (next.size === uniqueTags.length) {
          return undefined;
        }
        return next;
      });
    },
    [uniqueTags],
  );

  const handleShowAllTags = useCallback(() => {
    setVisibleTags(undefined);
  }, []);

  // Custom node rendering: glowing star.
  const nodeCanvasObject = useCallback(
    (node: NodeObject<ConstellationNode>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as unknown as ConstellationNode;
      const x = node.x || 0;
      const y = node.y || 0;
      const size = n.size / globalScale;
      const rgb = hexToRgb(n.color);

      // Outer glow.
      const glowRadius = size * 3;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${n.brightness * 0.4})`);
      gradient.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${n.brightness * 0.15})`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Core star.
      const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      coreGradient.addColorStop(0, `rgba(255, 255, 255, ${n.brightness})`);
      coreGradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${n.brightness})`);
      coreGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${n.brightness * 0.5})`);
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fill();

      // Pinned indicator: bright outer ring.
      if (n.memo.pinned) {
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${n.brightness * 0.8})`;
        ctx.lineWidth = 0.5 / globalScale;
        ctx.beginPath();
        ctx.arc(x, y, size * 1.8, 0, 2 * Math.PI);
        ctx.stroke();

        // Cross sparkle for pinned.
        const sparkleLen = size * 2.5;
        ctx.strokeStyle = `rgba(255, 255, 255, ${n.brightness * 0.3})`;
        ctx.lineWidth = 0.3 / globalScale;
        ctx.beginPath();
        ctx.moveTo(x - sparkleLen, y);
        ctx.lineTo(x + sparkleLen, y);
        ctx.moveTo(x, y - sparkleLen);
        ctx.lineTo(x, y + sparkleLen);
        ctx.stroke();
      }
    },
    [],
  );

  // Custom link rendering: dim constellation lines.
  const linkCanvasObject = useCallback(
    (link: LinkObject<ConstellationNode, ConstellationLink>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const source = link.source as unknown as ConstellationNode & { x: number; y: number };
      const target = link.target as unknown as ConstellationNode & { x: number; y: number };
      if (!source?.x || !target?.x) return;

      const rgb = hexToRgb(source.color || "#e2e8f0");
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
      ctx.lineWidth = 0.5 / globalScale;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    },
    [],
  );

  // Configure forces for tag clustering.
  const configureForces = useCallback(
    (graph: ForceGraphMethods<NodeObject<ConstellationNode>, LinkObject<ConstellationNode, ConstellationLink>> | undefined) => {
      if (!graph) return;
      const fg = graph as any;
      // Spread nodes further apart.
      fg.d3Force("charge")?.strength(-120);
      fg.d3Force("link")?.distance(80);

      // Tag-based clustering using a custom radial force.
      const tagCenters = new Map<string, { x: number; y: number }>();
      const allTags = uniqueTags.map((t) => t.tag);
      const radius = Math.max(200, memos.length * 8);
      allTags.forEach((tag, i) => {
        const angle = (2 * Math.PI * i) / allTags.length;
        tagCenters.set(tag, {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      });

      // Custom force: gently pull nodes toward their tag cluster center.
      const clusterForce = (alpha: number) => {
        const nodes = graphData.nodes as Array<ConstellationNode & { x: number; y: number; vx: number; vy: number }>;
        for (const node of nodes) {
          const primaryTag = node.tags[0];
          const center = primaryTag ? tagCenters.get(primaryTag) : undefined;
          if (center && node.x !== undefined) {
            node.vx += (center.x - node.x) * alpha * 0.03;
            node.vy += (center.y - node.y) * alpha * 0.03;
          }
        }
      };

      fg.d3Force("cluster", clusterForce);
    },
    [uniqueTags, memos.length, graphData.nodes],
  );

  useEffect(() => {
    configureForces(graphRef.current);
  }, [configureForces]);

  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      const currentZoom = (graphRef.current as any).zoom();
      (graphRef.current as any).zoom(currentZoom * 1.5, 300);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      const currentZoom = (graphRef.current as any).zoom();
      (graphRef.current as any).zoom(currentZoom / 1.5, 300);
    }
  }, []);

  const handleZoomFit = useCallback(() => {
    graphRef.current?.zoomToFit(400, 60);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "constellation-bg relative overflow-hidden rounded-xl",
        fullScreen ? "w-full h-full" : "w-full min-h-[500px] h-[60vh]",
        className,
      )}
      onMouseMove={handlePointerMove}
    >
      {/* Twinkling stars background */}
      <div className="constellation-stars" />
      <div className="constellation-stars constellation-stars-2" />

      {graphSize.width > 0 && (
        <ForceGraph2D
          ref={graphRef}
          width={graphSize.width}
          height={graphSize.height}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as unknown as ConstellationNode;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x || 0, node.y || 0, n.size * 1.5, 0, 2 * Math.PI);
            ctx.fill();
          }}
          linkCanvasObject={linkCanvasObject}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          backgroundColor="rgba(0,0,0,0)"
          enableZoomInteraction
          enablePanInteraction
          cooldownTime={2000}
          warmupTicks={50}
        />
      )}

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="fixed z-50 pointer-events-none max-w-xs"
          style={{
            left: tooltipPos.x + 16,
            top: tooltipPos.y - 8,
          }}
        >
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2 shadow-xl">
            <p className="text-slate-200 text-sm leading-snug line-clamp-3">
              {hoveredNode.memo.snippet?.slice(0, 120) || hoveredNode.memo.content?.slice(0, 120) || "Empty memo"}
              {(hoveredNode.memo.snippet?.length || hoveredNode.memo.content?.length || 0) > 120 ? "..." : ""}
            </p>
            {hoveredNode.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {hoveredNode.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${tagToColor(tag)}22`, color: tagToColor(tag) }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tagToColor(tag) }} />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-slate-500 text-xs mt-1">
              {dayjs(hoveredNode.memo.updateTime || hoveredNode.memo.displayTime).fromNow()}
              {hoveredNode.memo.pinned && " \u00b7 Pinned"}
            </p>
          </div>
        </div>
      )}

      {/* Controls panel */}
      <ConstellationControls
        tags={uniqueTags}
        visibleTags={visibleTags}
        onToggleTag={handleToggleTag}
        onShowAll={handleShowAllTags}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        memoCount={graphData.nodes.length}
        linkCount={graphData.links.length}
      />
    </div>
  );
};

export default ConstellationView;
