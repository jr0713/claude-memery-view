const express = require('express');
const router = express.Router();
const service = require('./memory-service');

// ── GET /api/memories ────────────────────────────────────

router.get('/memories', (req, res) => {
  try {
    let memories = service.getAllMemories();

    const typeFilter = req.query.type;
    if (typeFilter && typeFilter !== 'all') {
      memories = memories.filter(m => m.type === typeFilter);
    }

    const projectFilter = req.query.project;
    if (projectFilter && projectFilter !== 'all') {
      memories = memories.filter(m => m.projectDir === projectFilter);
    }

    const search = req.query.search?.toLowerCase();
    if (search) {
      memories = memories.filter(m =>
        m.name.toLowerCase().includes(search) ||
        m.description.toLowerCase().includes(search) ||
        m.content.toLowerCase().includes(search)
      );
    }

    const result = memories.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      type: m.type,
      fileName: m.fileName,
      filePath: m.filePath,
      projectDir: m.projectDir,
      projectName: m.projectName,
      projectPath: m.projectPath,
      preview: m.preview,
      links: m.links,
      resolvedLinks: m.resolvedLinks
    }));

    res.json({ memories: result, total: result.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/memories/:id ────────────────────────────────

router.get('/memories/:id', (req, res) => {
  try {
    const memory = service.getMemoryById(req.params.id);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    // Exclude internal fields
    const { rawContent, ...rest } = memory;
    res.json(rest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/memories ───────────────────────────────────

router.post('/memories', (req, res) => {
  try {
    const { name, description, type, content, projectDir } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '名称为必填项' });
    }
    const result = service.createMemory({ name, description, type, content, projectDir });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/memories/:id ────────────────────────────────

router.put('/memories/:id', (req, res) => {
  try {
    const result = service.updateMemory(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    if (err.message.startsWith('Memory not found')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/memories/:id ─────────────────────────────

router.delete('/memories/:id', (req, res) => {
  try {
    const result = service.deleteMemory(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.message.startsWith('Memory not found')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/graph ───────────────────────────────────────

router.get('/graph', (req, res) => {
  try {
    const data = service.getGraphData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/types ───────────────────────────────────────

router.get('/types', (req, res) => {
  try {
    const types = service.getTypes();
    res.json({ types });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects ────────────────────────────────────

router.get('/projects', (req, res) => {
  try {
    const projects = service.getProjects();
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/config ──────────────────────────────────────

router.get('/config', (req, res) => {
  res.json({
    projectsDir: service.PROJECTS_DIR,
    defaultProject: service.DEFAULT_PROJECT
  });
});

module.exports = router;
