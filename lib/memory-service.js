const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true
});

const MEMORY_DIR = process.env.MEMORY_DIR ||
  'C:\\Users\\ali\\.claude\\projects\\E--claude-claude----\\memory';

const MEMORY_INDEX = path.join(MEMORY_DIR, 'MEMORY.md');

// ── Helpers ──────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64) || 'untitled';
}

function uniqueFilename(baseSlug) {
  let slug = baseSlug;
  let counter = 2;
  while (fs.existsSync(path.join(MEMORY_DIR, `${slug}.md`))) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return `${slug}.md`;
}

function extractLinks(content) {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return [...new Set(links)];
}

function stripMarkdown(text) {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/>\s+/g, '')
    .replace(/---+/g, '')
    .trim();
}

// ── Core Operations ──────────────────────────────────────

function getAllMemories() {
  if (!fs.existsSync(MEMORY_DIR)) return [];

  const files = fs.readdirSync(MEMORY_DIR)
    .filter(f => f.endsWith('.md') && f !== 'MEMORY.md');

  const memories = [];
  const nameToId = new Map();

  // First pass: parse all memories and build name->id map
  for (const file of files) {
    const filePath = path.join(MEMORY_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(raw);
      const name = parsed.data.name || path.basename(file, '.md');
      const id = path.basename(file, '.md');

      nameToId.set(name, id);

      memories.push({
        id,
        name,
        description: parsed.data.description || '',
        type: parsed.data.metadata?.type || 'unknown',
        content: parsed.content,
        rawContent: raw,
        filePath: filePath,
        fileName: file,
        links: extractLinks(parsed.content),
        preview: stripMarkdown(parsed.content).substring(0, 150)
      });
    } catch (err) {
      // Handle malformed files gracefully
      const id = path.basename(file, '.md');
      memories.push({
        id,
        name: id,
        description: '⚠ Malformed memory file',
        type: 'unknown',
        content: '',
        rawContent: '',
        filePath: filePath,
        fileName: file,
        links: [],
        preview: '(unable to parse)'
      });
    }
  }

  // Second pass: resolve link names to IDs
  for (const mem of memories) {
    mem.resolvedLinks = mem.links.map(linkName => ({
      name: linkName,
      id: nameToId.get(linkName) || null,
      exists: nameToId.has(linkName)
    }));
  }

  // Sort by type then name
  memories.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });

  return memories;
}

function getMemoryById(id) {
  const filePath = path.join(MEMORY_DIR, `${id}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);

  const allMemories = getAllMemories();
  const nameToId = new Map(allMemories.map(m => [m.name, m.id]));
  const links = extractLinks(parsed.content);

  return {
    id,
    name: parsed.data.name || id,
    description: parsed.data.description || '',
    type: parsed.data.metadata?.type || 'unknown',
    content: parsed.content,
    rawContent: raw,
    htmlContent: marked.parse(parsed.content),
    filePath: filePath,
    fileName: `${id}.md`,
    links: links,
    resolvedLinks: links.map(linkName => ({
      name: linkName,
      id: nameToId.get(linkName) || null,
      exists: nameToId.has(linkName)
    }))
  };
}

function createMemory({ name, description, type, content }) {
  if (!name || !name.trim()) {
    throw new Error('Name is required');
  }

  const slug = slugify(name.trim());
  const fileName = uniqueFilename(slug);
  const filePath = path.join(MEMORY_DIR, fileName);
  const id = path.basename(fileName, '.md');

  const frontmatter = [
    '---',
    `name: "${name.trim()}"`,
    `description: "${(description || '').trim()}"`,
    'metadata:',
    `  type: ${type || 'project'}`,
    '---',
    '',
    (content || '').trim()
  ].join('\n');

  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  fs.writeFileSync(filePath, frontmatter, 'utf-8');
  regenerateIndex();

  return { id, name: name.trim(), fileName, filePath };
}

function updateMemory(id, { name, description, type, content }) {
  const filePath = path.join(MEMORY_DIR, `${id}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Memory not found: ${id}`);
  }

  // Read existing to preserve anything we don't explicitly set
  const existing = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(existing);

  const newName = name !== undefined ? name : parsed.data.name;
  const newDesc = description !== undefined ? description : (parsed.data.description || '');
  const newType = type !== undefined ? type : (parsed.data.metadata?.type || 'project');
  const newContent = content !== undefined ? content : parsed.content;

  const frontmatter = [
    '---',
    `name: "${newName}"`,
    `description: "${newDesc}"`,
    'metadata:',
    `  type: ${newType}`,
    '---',
    '',
    newContent.trim()
  ].join('\n');

  fs.writeFileSync(filePath, frontmatter, 'utf-8');
  regenerateIndex();

  return { id, name: newName, fileName: `${id}.md`, filePath };
}

function deleteMemory(id) {
  const filePath = path.join(MEMORY_DIR, `${id}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Memory not found: ${id}`);
  }

  // Read the memory before deleting for return info
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);

  fs.unlinkSync(filePath);
  regenerateIndex();

  return { id, name: parsed.data.name || id, deleted: true };
}

// ── Index Management ─────────────────────────────────────

function regenerateIndex() {
  const memories = getAllMemories();

  const lines = memories.map(m => {
    const displayTitle = m.name;
    return `- [${displayTitle}](${m.fileName}) — ${m.description || 'No description'}`;
  });

  const content = lines.join('\n') + (lines.length > 0 ? '\n' : '');
  fs.writeFileSync(MEMORY_INDEX, content, 'utf-8');
}

// ── Graph Data ───────────────────────────────────────────

function getGraphData() {
  const memories = getAllMemories();

  const nodes = memories.map(m => ({
    id: m.id,
    name: m.name,
    type: m.type
  }));

  const edges = [];
  for (const mem of memories) {
    for (const link of mem.resolvedLinks) {
      if (link.exists) {
        // Avoid duplicate edges (undirected graph)
        const existing = edges.find(e =>
          (e.source === mem.id && e.target === link.id) ||
          (e.source === link.id && e.target === mem.id)
        );
        if (!existing) {
          edges.push({ source: mem.id, target: link.id });
        }
      }
    }
  }

  return { nodes, edges };
}

// ── Type Summary ─────────────────────────────────────────

function getTypes() {
  const memories = getAllMemories();
  const typeCounts = {};
  for (const mem of memories) {
    typeCounts[mem.type] = (typeCounts[mem.type] || 0) + 1;
  }
  return typeCounts;
}

module.exports = {
  getAllMemories,
  getMemoryById,
  createMemory,
  updateMemory,
  deleteMemory,
  getGraphData,
  getTypes,
  MEMORY_DIR,
  regenerateIndex
};
