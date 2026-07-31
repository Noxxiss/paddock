const express = require('express');
const path = require('path');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const farmsRouter = require('./routes/farms');
const paddocksRouter = require('./routes/paddocks');
const invitesRouter = require('./routes/invites');
const workersRouter = require('./routes/workers');
const tasksRouter = require('./routes/tasks');
const pushRouter = require('./routes/push');

const app = express();

app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(farmsRouter);
app.use(paddocksRouter);
app.use(invitesRouter);
app.use(workersRouter);
app.use(tasksRouter);
app.use(pushRouter);
app.use(express.static(path.join(__dirname, '..', 'dist', 'client')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'dist', 'client', 'index.html'));
});

module.exports = app;
