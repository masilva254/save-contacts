// index.js – production entry point
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Import your Firebase functions module
import * as cloudFunctions from './functions/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------
// STATIC FRONTEND
// -------------------------------
// Serve public folder with index.html, app.js, styles.css
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------
// OPTIONAL SERVER-SIDE ENDPOINTS
// -------------------------------
// Example: trigger admin VCF generation via server-side
app.get('/api/generate-vcf', async (req, res) => {
  try {
    // Force=true simulates admin override
    const result = await cloudFunctions.generateVcf({ force: true }, { auth: { token: { admin: true } } });
    res.json(result);
  } catch (err) {
    console.error('VCF generation error:', err);
    res.status(500).json({ error: 'VCF generation failed' });
  }
});

// -------------------------------
// FALLBACK ROUTE FOR SPA
// -------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------------------
// START SERVER
// -------------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
