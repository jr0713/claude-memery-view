const express = require('express');
const path = require('path');
const routes = require('./lib/routes');
const service = require('./lib/memory-service');

const app = express();
const PORT = process.env.PORT || 3456;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', routes);

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║     🧠 Claude Memory Manager v1.0       ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  Local:   http://localhost:${PORT}          ║`);
  console.log(`  ║  Memory:  ${service.MEMORY_DIR}  ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');

  // Verify memory directory exists
  const fs = require('fs');
  if (!fs.existsSync(service.MEMORY_DIR)) {
    console.log('  ⚠  Memory directory does not exist yet.');
    console.log(`  → It will be created when you save your first memory.`);
    console.log('');
  } else {
    const memories = service.getAllMemories();
    console.log(`  ✓ Memory directory found (${memories.length} memories loaded)`);
    console.log('');
  }
});
