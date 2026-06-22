// ── App ──────────────────────────────────────────────────

const app = {
  state: {
    memories: [],
    activeType: 'all',
    searchTerm: '',
    viewMode: 'grid',
    selectedMemoryId: null,
    config: null
  },

  // ── Init ───────────────────────────────────────────────

  async init() {
    this.bindEvents();
    await this.loadConfig();
    await this.refresh();
    document.getElementById('loading-state').classList.add('hidden');
  },

  async loadConfig() {
    try {
      this.state.config = await api.fetchConfig();
      const pathEl = document.getElementById('memory-path');
      if (this.state.config && this.state.config.memoryDir) {
        pathEl.textContent = this.state.config.memoryDir;
        pathEl.title = this.state.config.memoryDir;
      }
    } catch (err) {
      components.showToast('配置加载失败', 'error');
    }
  },

  async refresh() {
    try {
      const params = { type: this.state.activeType };
      if (this.state.searchTerm) params.search = this.state.searchTerm;

      const data = await api.fetchMemories(params);
      this.state.memories = data.memories;

      // Update type counts (fetch all memories without type filter for accurate counts)
      const allData = await api.fetchMemories({});
      const typeCounts = {};
      allData.memories.forEach(m => {
        typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
      });

      this.render(typeCounts);
    } catch (err) {
      components.showToast('加载记忆失败: ' + err.message, 'error');
    }
  },

  render(typeCounts) {
    this._lastTypeCounts = typeCounts;
    const { memories, activeType, viewMode } = this.state;

    // Filters
    components.renderFilters(typeCounts, activeType);

    // Stats
    components.renderStats(memories);

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

    const totalMemories = Object.values(typeCounts).reduce((a, b) => a + b, 0);

    if (totalMemories === 0 && !this.state.searchTerm) {
      // Show empty state only when no memories exist AND no search active
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');

      if (memories.length === 0 && this.state.searchTerm) {
        // Show "no results" in the grid
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
        await api.createMemory({ name, description, type, content });
        components.showToast('记忆创建成功！', 'success');
      } else {
        const id = overlay.dataset.id;
        await api.updateMemory(id, { name, description, type, content });
        components.showToast('记忆更新成功！', 'success');
      }
      components.closeModal();
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
      await this.refresh();
    } catch (err) {
      components.showToast('删除失败: ' + err.message, 'error');
    }
  },

  // ── Navigation ─────────────────────────────────────────

  highlightAndScroll(id) {
    // Switch to grid view if in graph view
    if (this.state.viewMode === 'graph') {
      this.state.viewMode = 'grid';
      document.querySelectorAll('.view-toggle').forEach(t => t.classList.remove('active'));
      document.querySelector('.view-toggle[data-view="grid"]').classList.add('active');
    }

    // Refresh to ensure grid is shown
    this.render(this._lastTypeCounts || {});

    // Find and highlight the card
    setTimeout(() => {
      const card = document.querySelector(`.memory-card[data-id="${id}"]`);
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

    // Clear search on Escape
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
      // Ctrl+N: New memory
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        components.openModal(null);
      }
      // Escape: Close modal
      if (e.key === 'Escape') {
        const overlay = document.getElementById('modal-overlay');
        const confirmOverlay = document.getElementById('confirm-overlay');
        if (!confirmOverlay.classList.contains('hidden')) {
          components.closeConfirmDelete();
        } else if (!overlay.classList.contains('hidden')) {
          components.closeModal();
        }
      }
      // Ctrl+S: Save in modal
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
