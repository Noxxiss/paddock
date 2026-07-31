const express = require('express');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const farmsRouter = require('./routes/farms');

const app = express();

app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(farmsRouter);

module.exports = app;
