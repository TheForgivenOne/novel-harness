import type { Bundle } from "../bundle/bundle.ts";
import { getTitle, getType, type Concept } from "../bundle/concept.ts";
import { sourceEntries } from "../bundle/entries.ts";
import { LINK_FIELDS, LINK_LIST_FIELDS, extractBundleLinks } from "../bundle/links.ts";
import { linkTargetId } from "../bundle/paths.ts";
import { escapeHtml } from "../text/html.ts";

export interface GraphNode {
  id: string;
  type: string;
  title: string;
  status?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function frontmatterEdges(
  concept: Concept,
): Array<{ kind: string; link: string }> {
  const frontmatter = concept.frontmatter;
  const edges: Array<{ kind: string; link: string }> = [];
  for (const field of LINK_FIELDS) {
    const value = frontmatter[field];
    if (typeof value === "string" && value.startsWith("/")) {
      edges.push({ kind: field, link: value });
    }
  }
  for (const field of LINK_LIST_FIELDS) {
    const value = frontmatter[field];
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (typeof entry === "string" && entry.startsWith("/")) {
        edges.push({ kind: field, link: entry });
      }
    }
  }

  for (const entry of sourceEntries(concept)) {
    const resource = entry.resource;
    if (resource.startsWith("/") && resource.endsWith(".md")) {
      edges.push({ kind: "sources", link: resource });
    }
  }

  return edges;
}

export function buildGraph(bundle: Bundle): GraphData {
  const ids = new Set(bundle.concepts.map((concept) => concept.id));
  const nodes: GraphNode[] = bundle.concepts.map((concept) => {
    const status = concept.frontmatter.status;
    return {
      id: concept.id,
      type: getType(concept) ?? "Unknown",
      title: getTitle(concept),
      ...(typeof status === "string" ? { status } : {}),
    };
  });

  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  const add = (from: string, link: string, kind: string): void => {
    const to = linkTargetId(link);
    if (!ids.has(to) || to === from) return;
    const key = `${from}\u0000${to}\u0000${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, kind });
  };

  for (const concept of bundle.concepts) {
    for (const edge of frontmatterEdges(concept)) {
      add(concept.id, edge.link, edge.kind);
    }
    for (const link of extractBundleLinks(concept.body, concept.path)) {
      add(concept.id, link, "links");
    }
  }

  edges.sort(
    (a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind),
  );
  nodes.sort((a, b) => a.id.localeCompare(b.id));

  return { nodes, edges };
}

export function graphToJson(graph: GraphData): string {
  return `${JSON.stringify(graph, null, 2)}\n`;
}

export function graphToHtml(graph: GraphData, name: string): string {
  const json = JSON.stringify(graph).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)} — novel graph</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #101014; color: #e8e8ea; font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  header { padding: 16px 20px; border-bottom: 1px solid #2a2a32; }
  h1 { margin: 0 0 6px; font-size: 16px; }
  #legend { display: flex; flex-wrap: wrap; gap: 6px 14px; color: #9a9aa4; font-size: 12px; }
  #legend span::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; background: currentColor; }
  main { display: grid; place-items: center; padding: 12px; }
  svg { width: min(92vw, 900px); height: auto; }
  line { stroke: #3a3a44; stroke-width: 0.6; }
  circle { cursor: default; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(name)}</h1>
  <div id="legend"></div>
</header>
<main>
<svg id="graph" viewBox="-480 -480 960 960" role="img" aria-label="Concept link graph">
<g id="edges"></g>
<g id="nodes"></g>
</svg>
</main>
<script type="application/json" id="graph-data">${json}</script>
<script>
(function () {
  var graph = JSON.parse(document.getElementById("graph-data").textContent);
  var edgeLayer = document.getElementById("edges");
  var nodeLayer = document.getElementById("nodes");
  var legend = document.getElementById("legend");
  var ns = "http://www.w3.org/2000/svg";
  var radius = 400;
  var positions = {};
  graph.nodes.forEach(function (node, index) {
    var angle = (index / Math.max(graph.nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    positions[node.id] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
  function colorFor(type) {
    var hash = 0;
    for (var i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) % 360;
    return "hsl(" + hash + " 62% 62%)";
  }
  graph.edges.forEach(function (edge) {
    var a = positions[edge.from];
    var b = positions[edge.to];
    if (!a || !b) return;
    var line = document.createElementNS(ns, "line");
    line.setAttribute("x1", a.x.toFixed(1));
    line.setAttribute("y1", a.y.toFixed(1));
    line.setAttribute("x2", b.x.toFixed(1));
    line.setAttribute("y2", b.y.toFixed(1));
    var title = document.createElementNS(ns, "title");
    title.textContent = edge.from + " —" + edge.kind + "→ " + edge.to;
    line.appendChild(title);
    edgeLayer.appendChild(line);
  });
  var types = [];
  graph.nodes.forEach(function (node) {
    var point = positions[node.id];
    var circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", point.x.toFixed(1));
    circle.setAttribute("cy", point.y.toFixed(1));
    circle.setAttribute("r", node.type === "Novel" ? 9 : 6);
    circle.setAttribute("fill", colorFor(node.type));
    var title = document.createElementNS(ns, "title");
    title.textContent = node.title + " (" + node.type + ")";
    circle.appendChild(title);
    nodeLayer.appendChild(circle);
    if (types.indexOf(node.type) === -1) types.push(node.type);
  });
  types.sort();
  types.forEach(function (type) {
    var span = document.createElement("span");
    span.textContent = type;
    span.style.color = colorFor(type);
    legend.appendChild(span);
  });
})();
</script>
</body>
</html>
`;
}
