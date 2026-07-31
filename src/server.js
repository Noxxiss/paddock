const app = require('./app');
const { initialize } = require('./db');

const PORT = process.env.PORT || 3000;

initialize();

app.listen(PORT, () => {
  console.log(`Paddock server listening on port ${PORT}`);
});
