const express = require('express');
const path = require('path');
const routes = require('./lib/routes');
const service = require('./lib/memory-service');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', routes);
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const memories = service.getAllMemories();
  const projects = service.getProjects();

  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║     🧠 Claude 记忆管理器 v1.1           ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  地址:    http://localhost:${PORT}          ║`);
  console.log(`  ║  项目:    ${projects.length} 个项目                    ║`);
  console.log(`  ║  记忆:    ${memories.length} 条                       ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');

  for (const proj of projects) {
    console.log(`  📁 ${proj.projectName}  →  ${proj.memoryCount} 条记忆`);
  }
  console.log('');
});
