
const app = require('./backend/server');
const path = require('path');
const express = require('express');

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '')));

// Serve index.html for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running locally on http://localhost:${PORT}`);
});
