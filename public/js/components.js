// ── Components ────────────────────────────────────────────

const components = {
  // ── Toast Notifications ────────────────────────────────

  showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    if (duration > 0) {
      setTimeout(() => { if (toast.parentElement) toast.remove(); }, duration);
    }
  },

  // ── Render Cards (Grid View) ───────────────────────────

  renderCards(memories) {
    const grid = document.getElementById('memories-grid');
    grid.innerHTML = '';

    if (memories.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; height: 300px;">
          <div class="empty-icon">🔍</div>
          <h2>No Results</h2>
          <p>No memories match your current filters. Try a different search or type filter.</p>
        </div>`;
      return;
    }

    memories.forEach(mem => {
      const card = document.createElement('div');
      card.className = 'memory-card';
      card.dataset.id = mem.id;

      const typeClass = `badge-${mem.type}`;
      const linkChips = (mem.resolvedLinks || []).map(link => {
        const cls = link.exists ? 'link-chip' : 'link-chip dangling';
        const title = link.exists ? `Go to "${link.name}"` : `"${link.name}" not found (dangling)`;
        return `<span class="${cls}" data-link-id="${link.id || ''}" data-link-name="${escapeHtml(link.name)}" title="${escapeHtml(title)}">${escapeHtml(truncate(link.name, 25))}</span>`;
      }).join('');

      // Shorten path for display
      const displayPath = mem.filePath
        ? mem.filePath.replace(/\\/g, '/').split('/').slice(-3).join('/')
        : '';

      card.innerHTML = `
        <div class="card-header">
          <span class="card-title">${escapeHtml(mem.name)}</span>
          <span class="card-badge ${typeClass}">${escapeHtml(mem.type)}</span>
        </div>
        ${mem.description ? `<div class="card-description">${escapeHtml(mem.description)}</div>` : ''}
        ${mem.preview ? `<div class="card-preview">${escapeHtml(mem.preview)}</div>` : ''}
        <div class="card-footer">
          <div class="card-path" title="${escapeHtml(mem.filePath || '')}">
            <svg class="card-path-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style="color:var(--text-muted)">
              <path d="M2 1a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V4.5a1 1 0 00-.293-.707L8.207 1.293A1 1 0 007.5 1H2z"/>
            </svg>
            ${escapeHtml(displayPath)}
          </div>
          ${linkChips ? `<div class="card-links">${linkChips}</div>` : ''}
        </div>
      `;

      card.addEventListener('click', (e) => {
        // Don't open modal if clicking a link chip
        if (e.target.closest('.link-chip')) return;
        app.openEditor(mem.id);
      });

      grid.appendChild(card);
    });

    // Wire up link chip clicks
    grid.querySelectorAll('.link-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const linkId = chip.dataset.linkId;
        if (linkId) {
          app.highlightAndScroll(linkId);
        }
      });
    });
  },

  // ── Render List View ───────────────────────────────────

  renderList(memories) {
    const list = document.getElementById('memories-list');
    list.innerHTML = '';

    if (memories.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="height: 300px;">
          <div class="empty-icon">🔍</div>
          <h2>No Results</h2>
          <p>No memories match your current filters.</p>
        </div>`;
      return;
    }

    memories.forEach(mem => {
      const typeClass = `badge-${mem.type}`;
      const displayPath = mem.filePath
        ? mem.filePath.replace(/\\/g, '/').split('/').slice(-3).join('/')
        : '';

      const item = document.createElement('div');
      item.className = 'list-item';
      item.dataset.id = mem.id;
      item.innerHTML = `
        <span class="card-badge ${typeClass} list-item-badge">${escapeHtml(mem.type)}</span>
        <span class="list-item-name">${escapeHtml(mem.name)}</span>
        <span class="list-item-desc">${escapeHtml(mem.description || '')}</span>
        <span class="list-item-path" title="${escapeHtml(mem.filePath || '')}">${escapeHtml(displayPath)}</span>
      `;
      item.addEventListener('click', () => app.openEditor(mem.id));
      list.appendChild(item);
    });
  },

  // ── Render Type Filters ────────────────────────────────

  renderFilters(typeCounts, activeType) {
    const chips = document.querySelectorAll('.type-chip');
    chips.forEach(chip => {
      const type = chip.dataset.type;
      const count = type === 'all'
        ? Object.values(typeCounts).reduce((a, b) => a + b, 0)
        : (typeCounts[type] || 0);
      const countEl = document.getElementById(`count-${type}`);
      if (countEl) countEl.textContent = count;

      if (type === activeType) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  },

  // ── Render Stats ───────────────────────────────────────

  renderStats(memories) {
    document.getElementById('stat-total').textContent = memories.length;
    const totalLinks = memories.reduce((sum, m) => sum + (m.resolvedLinks || []).filter(l => l.exists).length, 0);
    document.getElementById('stat-links').textContent = totalLinks;
  },

  // ── Open Modal (Create / Edit) ─────────────────────────

  openModal(memory = null) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const nameInput = document.getElementById('input-name');
    const descInput = document.getElementById('input-description');
    const typeSelect = document.getElementById('input-type');
    const contentInput = document.getElementById('input-content');
    const fileInfo = document.getElementById('form-file-info');
    const deleteBtn = document.getElementById('btn-delete');
    const previewEl = document.getElementById('markdown-preview');

    // Reset
    nameInput.value = '';
    descInput.value = '';
    typeSelect.value = 'project';
    contentInput.value = '';
    previewEl.innerHTML = '';
    document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.editor-tab[data-tab="edit"]').classList.add('active');
    previewEl.classList.add('hidden');
    contentInput.classList.remove('hidden');

    if (memory) {
      // Edit mode
      title.textContent = 'Edit Memory';
      nameInput.value = memory.name || '';
      descInput.value = memory.description || '';
      typeSelect.value = memory.type || 'project';
      contentInput.value = memory.content || '';
      fileInfo.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style="vertical-align:middle"><path d="M2 1a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V4.5a1 1 0 00-.293-.707L8.207 1.293A1 1 0 007.5 1H2z"/></svg>
        ${escapeHtml(memory.filePath || '')}
      `;
      deleteBtn.classList.remove('hidden');
      overlay.dataset.mode = 'edit';
      overlay.dataset.id = memory.id;
    } else {
      // Create mode
      title.textContent = 'Create Memory';
      fileInfo.textContent = 'New file will be created in the memory directory';
      deleteBtn.classList.add('hidden');
      overlay.dataset.mode = 'create';
      delete overlay.dataset.id;
    }

    overlay.classList.remove('hidden');
    nameInput.focus();
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('confirm-overlay').classList.add('hidden');
  },

  // ── Markdown Preview ───────────────────────────────────

  updatePreview() {
    const content = document.getElementById('input-content').value;
    const preview = document.getElementById('markdown-preview');

    // Simple client-side markdown rendering for preview
    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Links: [[name]] format
    html = html.replace(/\[\[([^\]]+)\]\]/g, '<a href="#" class="internal-link">📎 $1</a>');

    // Regular links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    preview.innerHTML = '<p>' + html + '</p>';
  },

  // ── Confirm Delete ─────────────────────────────────────

  openConfirmDelete(name) {
    document.getElementById('confirm-name').textContent = name;
    document.getElementById('confirm-overlay').classList.remove('hidden');
  },

  closeConfirmDelete() {
    document.getElementById('confirm-overlay').classList.add('hidden');
  },

  // ── Graph View (Canvas) ────────────────────────────────

  _graphSimulation: null,
  _graphNodes: [],
  _graphData: null,

  async renderGraph() {
    const container = document.getElementById('graph-container');
    const canvas = document.getElementById('graph-canvas');
    const tooltip = document.getElementById('graph-tooltip');

    // Cancel previous simulation
    if (this._graphSimulation) {
      cancelAnimationFrame(this._graphSimulation);
      this._graphSimulation = null;
    }

    try {
      this._graphData = await api.fetchGraph();
    } catch (err) {
      components.showToast('Failed to load graph data', 'error');
      return;
    }

    const { nodes, edges } = this._graphData;

    if (nodes.length === 0) {
      const ctx = canvas.getContext('2d');
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No memories to graph', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Initialize node positions
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const nodeMap = {};
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const radius = Math.min(width, height) * 0.35;
      nodeMap[node.id] = {
        ...node,
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        radius: 18
      };
    });

    const graphNodes = Object.values(nodeMap);

    // Type colors
    const typeColors = {
      project: '#60a5fa',
      user: '#34d399',
      feedback: '#fbbf24',
      reference: '#c084fc',
      unknown: '#9ca3af'
    };

    // Force simulation
    const ctx = canvas.getContext('2d');
    let draggedNode = null;
    let hoveredNode = null;

    function simulate() {
      // Forces
      const centerX = width / 2;
      const centerY = height / 2;
      const repulsion = 8000;
      const attraction = 0.005;
      const damping = 0.85;

      for (const node of graphNodes) {
        if (node === draggedNode) continue;

        // Repulsion between all nodes
        for (const other of graphNodes) {
          if (other === node) continue;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = repulsion / (dist * dist);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }

        // Center gravity
        node.vx += (centerX - node.x) * 0.001;
        node.vy += (centerY - node.y) * 0.001;

        // Damping
        node.vx *= damping;
        node.vy *= damping;

        // Apply velocity
        node.x += node.vx;
        node.y += node.vy;

        // Bound to canvas
        node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
        node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
      }

      // Edge forces (spring)
      for (const edge of edges) {
        const source = nodeMap[edge.source];
        const target = nodeMap[edge.target];
        if (!source || !target) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (dist - 120) * attraction;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (source !== draggedNode) { source.vx += fx; source.vy += fy; }
        if (target !== draggedNode) { target.vx -= fx; target.vy -= fy; }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      // Draw edges
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      for (const edge of edges) {
        const source = nodeMap[edge.source];
        const target = nodeMap[edge.target];
        if (!source || !target) continue;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }

      // Draw nodes
      for (const node of graphNodes) {
        const color = typeColors[node.type] || typeColors.unknown;

        // Glow on hover
        if (node === hoveredNode || node === draggedNode) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = color + '30';
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#f1f5f9';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = node.name.length > 18 ? node.name.substring(0, 16) + '..' : node.name;
        ctx.fillText(label, node.x, node.y + node.radius + 14);
      }
    }

    function loop() {
      simulate();
      draw();
      components._graphSimulation = requestAnimationFrame(loop);
    }

    // Mouse interaction
    canvas.onmousedown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      draggedNode = graphNodes.find(n => {
        const dx = n.x - mx;
        const dy = n.y - my;
        return Math.sqrt(dx * dx + dy * dy) < n.radius + 4;
      }) || null;

      if (draggedNode) {
        draggedNode.vx = 0;
        draggedNode.vy = 0;
      }
    };

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (draggedNode) {
        draggedNode.x = mx;
        draggedNode.y = my;
      }

      hoveredNode = graphNodes.find(n => {
        const dx = n.x - mx;
        const dy = n.y - my;
        return Math.sqrt(dx * dx + dy * dy) < n.radius + 4;
      }) || null;

      if (hoveredNode) {
        tooltip.textContent = `${hoveredNode.name} [${hoveredNode.type}]`;
        tooltip.style.left = (mx + 16) + 'px';
        tooltip.style.top = (my - 10) + 'px';
        tooltip.classList.remove('hidden');
        canvas.style.cursor = 'pointer';
      } else {
        tooltip.classList.add('hidden');
        canvas.style.cursor = draggedNode ? 'grabbing' : 'grab';
      }
    };

    canvas.onmouseup = () => {
      draggedNode = null;
    };

    canvas.ondblclick = (e) => {
      if (hoveredNode) {
        app.openEditor(hoveredNode.id);
      }
    };

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      // Will be handled on next renderGraph call
    });
    resizeObserver.observe(container);

    // Store refs
    this._graphNodes = graphNodes;

    // Start simulation
    loop();
  },

  stopGraph() {
    if (this._graphSimulation) {
      cancelAnimationFrame(this._graphSimulation);
      this._graphSimulation = null;
    }
    const canvas = document.getElementById('graph-canvas');
    canvas.onmousedown = null;
    canvas.onmousemove = null;
    canvas.onmouseup = null;
    canvas.ondblclick = null;
  }
};
