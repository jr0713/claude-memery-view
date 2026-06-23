// ── App ──────────────────────────────────────────────────

const app = {
  state: {
    memories: [],
    activeType: 'all',
    activeProject: 'all',
    activeSort: 'time',
    searchTerm: '',
    viewMode: 'grid',
    selectedMemoryId: null,
    config: null,
    projects: []
  },

  // ── Init ───────────────────────────────────────────────

  async init() {
    this.bindEvents();
    await this.loadConfig();
    await this.loadProjects();
    await this.refresh();
    document.getElementById('loading-state').classList.add('hidden');
  },

  async loadConfig() {
    try {
      this.state.config = await api.fetchConfig();
      const pathEl = document.getElementById('memory-path');
      if (this.state.config && this.state.config.projectsDir) {
        pathEl.textContent = this.state.config.projectsDir;
        pathEl.title = this.state.config.projectsDir;
      }
    } catch (err) {
      components.showToast('配置加载失败', 'error');
    }
  },

  async loadProjects() {
    try {
      const data = await api.fetchProjects();
      this.state.projects = data.projects || [];
    } catch (err) {
      this.state.projects = [];
    }
  },

  async refresh() {
    try {
      const params = { type: this.state.activeType };
      if (this.state.searchTerm) params.search = this.state.searchTerm;
      if (this.state.activeProject && this.state.activeProject !== 'all') {
        params.project = this.state.activeProject;
      }
      if (this.state.activeSort) {
        params.sort = this.state.activeSort;
      }

      const data = await api.fetchMemories(params);
      this.state.memories = data.memories;

      // Fetch all memories for accurate type/project counts
      const allData = await api.fetchMemories({});
      const typeCounts = {};
      allData.memories.forEach(m => {
        typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
      });

      // Update project memory counts
      const projCounts = {};
      allData.memories.forEach(m => {
        projCounts[m.projectDir] = (projCounts[m.projectDir] || 0) + 1;
      });
      // Update the projects list with fresh counts
      this.state.projects.forEach(p => {
        p.memoryCount = projCounts[p.projectDir] || 0;
      });

      this.render(typeCounts);
    } catch (err) {
      components.showToast('加载记忆失败: ' + err.message, 'error');
    }
  },

  render(typeCounts) {
    this._lastTypeCounts = typeCounts;
    const { memories, activeType, activeProject, viewMode, projects } = this.state;

    // Filters
    components.renderFilters(typeCounts, activeType);
    components.renderProjectFilters(projects, activeProject);

    // Stats
    const totalMemories = Object.values(typeCounts).reduce((a, b) => a + b, 0);
    components.renderStats(memories, projects.length);

    // Views
    const emptyState = document.getElementById('empty-state');
    const grid = document.getElementById('memories-grid');
    const list = document.getElementById('memories-list');
    const graphContainer = document.getElementById('graph-container');

    // Hide all views
    grid.classList.add('hidden');
    list.classList.add('hidden');
    graphContainer.classList.add('hidden');
    components.stopGraph();

    if (totalMemories === 0 && !this.state.searchTerm) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');

      if (memories.length === 0 && this.state.searchTerm) {
        grid.classList.remove('hidden');
        components.renderCards([]);
        return;
      }

      switch (viewMode) {
        case 'grid':
          grid.classList.remove('hidden');
          components.renderCards(memories);
          break;
        case 'list':
          list.classList.remove('hidden');
          components.renderList(memories);
          break;
        case 'graph':
          graphContainer.classList.remove('hidden');
          components.renderGraph();
          break;
      }
    }
  },

  // ── Editor ─────────────────────────────────────────────

  async openEditor(id) {
    try {
      const memory = await api.getMemory(id);
      components.openModal(memory);
    } catch (err) {
      components.showToast('加载记忆失败: ' + err.message, 'error');
    }
  },

  async saveMemory() {
    const name = document.getElementById('input-name').value.trim();
    const description = document.getElementById('input-description').value.trim();
    const type = document.getElementById('input-type').value;
    const content = document.getElementById('input-content').value;

    if (!name) {
      components.showToast('名称为必填项', 'error');
      return;
    }

    const overlay = document.getElementById('modal-overlay');
    const mode = overlay.dataset.mode;

    try {
      if (mode === 'create') {
        const projectDir = this.state.activeProject !== 'all' ? this.state.activeProject : null;
        await api.createMemory({ name, description, type, content, projectDir });
        components.showToast('记忆创建成功！', 'success');
      } else {
        const id = overlay.dataset.id;
        await api.updateMemory(id, { name, description, type, content });
        components.showToast('记忆更新成功！', 'success');
      }
      components.closeModal();
      await this.loadProjects();
      await this.refresh();
    } catch (err) {
      components.showToast('保存失败: ' + err.message, 'error');
    }
  },

  async deleteMemory() {
    const overlay = document.getElementById('modal-overlay');
    const id = overlay.dataset.id;
    const name = document.getElementById('input-name').value;

    try {
      await api.deleteMemory(id);
      components.showToast(`"${name}" 已删除`, 'success');
      components.closeModal();
      components.closeConfirmDelete();
      await this.loadProjects();
      await this.refresh();
    } catch (err) {
      components.showToast('删除失败: ' + err.message, 'error');
    }
  },

  // ── Navigation ─────────────────────────────────────────

  highlightAndScroll(id) {
    if (this.state.viewMode === 'graph') {
      this.state.viewMode = 'grid';
      document.querySelectorAll('.view-toggle').forEach(t => t.classList.remove('active'));
      document.querySelector('.view-toggle[data-view="grid"]').classList.add('active');
    }

    this.render(this._lastTypeCounts || {});

    setTimeout(() => {
      const card = document.querySelector(`.memory-card[data-id="${CSS.escape(id)}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight');
        setTimeout(() => card.classList.remove('highlight'), 1500);
      }
    }, 100);
  },

  // ── Event Binding ──────────────────────────────────────

  bindEvents() {
    // New memory button
    document.getElementById('btn-new-memory').addEventListener('click', () => {
      components.openModal(null);
    });

    document.getElementById('btn-empty-create').addEventListener('click', () => {
      components.openModal(null);
    });

    // Search with debounce
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', debounce((e) => {
      this.state.searchTerm = e.target.value.trim();
      this.refresh();
    }, 300));

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        this.state.searchTerm = '';
        this.refresh();
      }
    });

    // Type filters
    document.getElementById('type-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.type-chip');
      if (!chip) return;
      this.state.activeType = chip.dataset.type;
      this.refresh();
    });

    // Project filters
    document.getElementById('project-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.type-chip');
      if (!chip) return;
      this.state.activeProject = chip.dataset.project;
      this.refresh();
    });

    // Sort select
    document.getElementById('sort-select').addEventListener('change', (e) => {
      this.state.activeSort = e.target.value;
      this.refresh();
    });

    // View toggles
    document.querySelectorAll('.view-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        document.querySelectorAll('.view-toggle').forEach(t => t.classList.remove('active'));
        toggle.classList.add('active');
        this.state.viewMode = toggle.dataset.view;
        this.render(this._lastTypeCounts || {});
      });
    });

    // Modal close
    document.getElementById('btn-modal-close').addEventListener('click', () => components.closeModal());
    document.getElementById('btn-cancel').addEventListener('click', () => components.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) components.closeModal();
    });

    // Save
    document.getElementById('btn-save').addEventListener('click', () => this.saveMemory());

    // Delete flow
    document.getElementById('btn-delete').addEventListener('click', () => {
      const name = document.getElementById('input-name').value;
      components.openConfirmDelete(name);
    });
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => components.closeConfirmDelete());
    document.getElementById('btn-confirm-delete').addEventListener('click', () => this.deleteMemory());
    document.getElementById('confirm-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) components.closeConfirmDelete();
    });

    // Editor tabs
    document.querySelectorAll('.editor-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const mode = tab.dataset.tab;
        const textarea = document.getElementById('input-content');
        const preview = document.getElementById('markdown-preview');
        if (mode === 'preview') {
          components.updatePreview();
          textarea.classList.add('hidden');
          preview.classList.remove('hidden');
        } else {
          textarea.classList.remove('hidden');
          preview.classList.add('hidden');
        }
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        components.openModal(null);
      }
      if (e.key === 'Escape') {
        const overlay = document.getElementById('modal-overlay');
        const confirmOverlay = document.getElementById('confirm-overlay');
        if (!confirmOverlay.classList.contains('hidden')) {
          components.closeConfirmDelete();
        } else if (!overlay.classList.contains('hidden')) {
          components.closeModal();
        }
      }
      if (e.ctrlKey && e.key === 's') {
        const overlay = document.getElementById('modal-overlay');
        if (!overlay.classList.contains('hidden')) {
          e.preventDefault();
          this.saveMemory();
        }
      }
    });
  }
};

// ── Boot ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => app.init());
