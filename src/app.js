const express = require('express');
const path = require('path');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const farmsRouter = require('./routes/farms');
const paddocksRouter = require('./routes/paddocks');
const invitesRouter = require('./routes/invites');
const workersRouter = require('./routes/workers');

const app = express();

app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(farmsRouter);
app.use(paddocksRouter);
app.use(invitesRouter);
app.use(workersRouter);
app.use(express.static(path.join(__dirname, '..', 'dist', 'client')));

module.exports = app;
