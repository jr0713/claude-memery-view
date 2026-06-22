const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

marked.setOptions({ breaks: true, gfm: true });

// ── Configuration ────────────────────────────────────────

const PROJECTS_DIR = process.env.PROJECTS_DIR ||
  'C:\\Users\\ali\\.claude\\projects';

// Default project for creating new memories (current project)
const DEFAULT_PROJECT = process.env.DEFAULT_PROJECT ||
  'E--claude-claude----';

// ── Helpers ──────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64) || 'untitled';
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

// ── Project Path Resolution ──────────────────────────────

let _hashToPathCache = null;

function buildHashToPathMap() {
  if (_hashToPathCache) return _hashToPathCache;

  const map = {};
  const sessionsDir = path.join(path.dirname(PROJECTS_DIR), 'sessions');

  // Step 1: Map session IDs to project hashes (from jsonl files in project dirs)
  const sessionToHash = {};
  if (fs.existsSync(PROJECTS_DIR)) {
    const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(PROJECTS_DIR, entry.name);
      try {
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
        for (const f of files) {
          sessionToHash[f.replace('.jsonl', '')] = entry.name;
          break; // first sesion file is enough
        }
      } catch (e) { /* skip */ }
    }
  }

  // Step 2: Scan session files for cwd → hash
  if (fs.existsSync(sessionsDir)) {
    try {
      const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
      for (const f of sessionFiles) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
          if (data.sessionId && data.cwd && sessionToHash[data.sessionId]) {
            const hash = sessionToHash[data.sessionId];
            if (!map[hash]) {
              map[hash] = data.cwd;
            }
          }
        } catch (e) { /* skip malformed */ }
      }
    } catch (e) { /* skip */ }
  }

  _hashToPathCache = map;
  return map;
}

function getProjectPath(projectDir) {
  const map = buildHashToPathMap();
  if (map[projectDir]) return map[projectDir];
  // Fallback: clean up the hash for display
  return projectDir.replace(/^E--/, '').replace(/-+/g, ' ').trim() || projectDir;
}

function getProjectName(projectDir) {
  const realPath = getProjectPath(projectDir);
  // If it's a real filesystem path, show just the folder name
  if (realPath.includes('\\') || realPath.includes('/')) {
    return path.basename(realPath);
  }
  return realPath;
}

function findProjectMemoryDirs() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  const memoryDirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const memoryDir = path.join(PROJECTS_DIR, entry.name, 'memory');
    if (fs.existsSync(memoryDir)) {
      const projPath = getProjectPath(entry.name);
      memoryDirs.push({
        projectDir: entry.name,
        projectName: getProjectName(entry.name),
        projectPath: projPath,
        memoryDir: memoryDir
      });
    }
  }

  return memoryDirs;
}

// ── Core Operations ──────────────────────────────────────

function getAllMemories() {
  const projectDirs = findProjectMemoryDirs();
  const memories = [];
  const nameToId = new Map();

  // First pass: parse all memories from all projects
  for (const proj of projectDirs) {
    const files = fs.readdirSync(proj.memoryDir)
      .filter(f => f.endsWith('.md') && f !== 'MEMORY.md');

    for (const file of files) {
      const filePath = path.join(proj.memoryDir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(raw);
        const name = parsed.data.name || path.basename(file, '.md');
        const id = `${proj.projectDir}::${path.basename(file, '.md')}`;

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
          projectDir: proj.projectDir,
          projectName: proj.projectName,
          projectPath: proj.projectPath,
          links: extractLinks(parsed.content),
          preview: stripMarkdown(parsed.content).substring(0, 150)
        });
      } catch (err) {
        const id = `${proj.projectDir}::${path.basename(file, '.md')}`;
        memories.push({
          id,
          name: path.basename(file, '.md'),
          description: '⚠ 文件解析失败',
          type: 'unknown',
          content: '',
          rawContent: '',
          filePath: filePath,
          fileName: file,
          projectDir: proj.projectDir,
          projectName: proj.projectName,
          projectPath: proj.projectPath,
          links: [],
          preview: '(无法解析)'
        });
      }
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

  // Sort by project, then name
  memories.sort((a, b) => {
    if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });

  return memories;
}

function parseId(compoundId) {
  const idx = compoundId.indexOf('::');
  if (idx === -1) return { projectDir: DEFAULT_PROJECT, fileStem: compoundId };
  return {
    projectDir: compoundId.substring(0, idx),
    fileStem: compoundId.substring(idx + 2)
  };
}

function getMemoryById(compoundId) {
  const { projectDir, fileStem } = parseId(compoundId);
  const filePath = path.join(PROJECTS_DIR, projectDir, 'memory', `${fileStem}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);

  const allMemories = getAllMemories();
  const nameToId = new Map(allMemories.map(m => [m.name, m.id]));
  const links = extractLinks(parsed.content);

  const projName = getProjectName(projectDir);

  return {
    id: compoundId,
    name: parsed.data.name || fileStem,
    description: parsed.data.description || '',
    type: parsed.data.metadata?.type || 'unknown',
    content: parsed.content,
    htmlContent: marked.parse(parsed.content),
    filePath: filePath,
    fileName: `${fileStem}.md`,
    projectDir: projectDir,
    projectName: projName,
    links: links,
    resolvedLinks: links.map(linkName => ({
      name: linkName,
      id: nameToId.get(linkName) || null,
      exists: nameToId.has(linkName)
    }))
  };
}

function createMemory({ name, description, type, content, projectDir }) {
  if (!name || !name.trim()) {
    throw new Error('Name is required');
  }

  const targetProject = projectDir || DEFAULT_PROJECT;
  const memoryDir = path.join(PROJECTS_DIR, targetProject, 'memory');

  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }

  const slug = slugify(name.trim());

  // Unique filename within this project
  let fileName = `${slug}.md`;
  let counter = 2;
  while (fs.existsSync(path.join(memoryDir, fileName))) {
    fileName = `${slug}-${counter}.md`;
    counter++;
  }

  const filePath = path.join(memoryDir, fileName);
  const id = `${targetProject}::${path.basename(fileName, '.md')}`;

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

  fs.writeFileSync(filePath, frontmatter, 'utf-8');
  regenerateIndex(targetProject);

  return { id, name: name.trim(), fileName, filePath, projectDir: targetProject };
}

function updateMemory(compoundId, { name, description, type, content }) {
  const { projectDir, fileStem } = parseId(compoundId);
  const filePath = path.join(PROJECTS_DIR, projectDir, 'memory', `${fileStem}.md`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Memory not found: ${compoundId}`);
  }

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
  regenerateIndex(projectDir);

  return { id: compoundId, name: newName, fileName: `${fileStem}.md`, filePath, projectDir };
}

function deleteMemory(compoundId) {
  const { projectDir, fileStem } = parseId(compoundId);
  const filePath = path.join(PROJECTS_DIR, projectDir, 'memory', `${fileStem}.md`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Memory not found: ${compoundId}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);

  fs.unlinkSync(filePath);
  regenerateIndex(projectDir);

  return { id: compoundId, name: parsed.data.name || fileStem, deleted: true };
}

// ── Index Management ─────────────────────────────────────

function regenerateIndex(projectDir) {
  const memoryDir = path.join(PROJECTS_DIR, projectDir, 'memory');
  if (!fs.existsSync(memoryDir)) return;

  const files = fs.readdirSync(memoryDir)
    .filter(f => f.endsWith('.md') && f !== 'MEMORY.md');

  const items = [];
  for (const file of files) {
    const filePath = path.join(memoryDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(raw);
      const displayTitle = parsed.data.name || path.basename(file, '.md');
      items.push(`- [${displayTitle}](${file}) — ${parsed.data.description || 'No description'}`);
    } catch (err) {
      items.push(`- [${file}](${file})`);
    }
  }

  const indexPath = path.join(memoryDir, 'MEMORY.md');
  const content = items.join('\n') + (items.length > 0 ? '\n' : '');
  fs.writeFileSync(indexPath, content, 'utf-8');
}

// ── Graph Data ───────────────────────────────────────────

function getGraphData() {
  const memories = getAllMemories();

  const nodes = memories.map(m => ({
    id: m.id,
    name: m.name,
    type: m.type,
    projectName: m.projectName
  }));

  const edges = [];
  for (const mem of memories) {
    for (const link of mem.resolvedLinks) {
      if (link.exists) {
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

// ── Project List ─────────────────────────────────────────

function getProjects() {
  const projectDirs = findProjectMemoryDirs();
  return projectDirs.map(p => ({
    projectDir: p.projectDir,
    projectName: p.projectName,
    projectPath: p.projectPath,
    memoryDir: p.memoryDir,
    memoryCount: fs.readdirSync(p.memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md').length
  }));
}

module.exports = {
  getAllMemories,
  getMemoryById,
  createMemory,
  updateMemory,
  deleteMemory,
  getGraphData,
  getTypes,
  getProjects,
  regenerateIndex,
  PROJECTS_DIR,
  DEFAULT_PROJECT
};
