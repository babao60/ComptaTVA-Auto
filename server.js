import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the React build
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Data storage path
const dataDir = path.join(__dirname, 'data');
const rulesFile = path.join(dataDir, 'rules.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// API: Get rules
app.get('/api/rules', async (req, res) => {
  try {
    await ensureDataDir();
    try {
      const data = await fs.readFile(rulesFile, 'utf8');
      res.json(JSON.parse(data));
    } catch (err) {
      // If file doesn't exist, return empty array
      if (err.code === 'ENOENT') {
        res.json([]);
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Error reading rules:', error);
    res.status(500).json({ error: 'Failed to read rules' });
  }
});

// API: Save rules
app.post('/api/rules', async (req, res) => {
  try {
    await ensureDataDir();
    const rules = req.body;
    await fs.writeFile(rulesFile, JSON.stringify(rules, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving rules:', error);
    res.status(500).json({ error: 'Failed to save rules' });
  }
});

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// API: Categorize with AI
app.post('/api/ai/categorize', async (req, res) => {
  if (!genAI) {
    return res.status(500).json({ error: "L'API Key Gemini (GEMINI_API_KEY) n'est pas configurée sur le serveur." });
  }
  
  const transactions = req.body.transactions; // [{ id, counterparty, description, amountHT, amountTVA }]
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.json([]);
  }

  const prompt = `Tu es un expert comptable français. Tu dois catégoriser une liste de transactions bancaires pour préparer une déclaration de TVA.
  
Règles de catégorisation :
Catégories possibles (category) :
- CONSUMABLE : Achats de matériel, petites fournitures, matières premières, logiciels en boîte, petit matériel (ex: Amazon, boulanger, outillage, filament 3D, emballage).
- SERVICE : Prestations de services, abonnements mensuels, frais bancaires, assurances, livraison, honoraires (ex: Shopify, Google, Adobe, La Poste, Shine, expert comptable).
- ASSET : Immobilisations, matériel coûteux destiné à durer plusieurs années (ex: ordinateur, grosse machine).
- IGNORED : Dépenses à ignorer pour la TVA : virements personnels (ex: M. Heude Jerome), impôts, URSSAF, ou erreurs.

Régimes de TVA possibles (taxMode) :
- NORMAL : TVA payée en France. C'est le cas par défaut si le 'amountTVA' est > 0, ou si c'est un achat en France.
- AUTOLIQUIDATION : Achat de services à l'étranger (ex: Shopify, Google, Meta, Sendcloud) où la TVA facturée est de 0€ car elle doit être autoliquidée en France. Attention, pour du matériel physique (Amazon) avec 0 TVA, c'est généralement NORMAL (intracomm ou import) mais par défaut on garde NORMAL pour le matériel sauf mention contraire. Privilégie AUTOLIQUIDATION pour les SERVICES digitaux/étrangers avec 0 TVA.

Transactions à analyser :
${JSON.stringify(transactions.map(t => ({ id: t.id, counterparty: t.counterparty, description: t.description, amountHT: t.amountHT, amountTVA: t.amountTVA })), null, 2)}

Réponds UNIQUEMENT avec un tableau JSON valide contenant exactement ce format pour chaque transaction :
[
  { "id": "id_de_la_transaction", "category": "UNE_DES_4_CATEGORIES", "taxMode": "NORMAL_OU_AUTOLIQUIDATION" }
]
Aucun texte supplémentaire, juste le JSON.`;

  try {
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent(prompt);
    const resultText = result.response.text();
    const parsed = JSON.parse(resultText);
    res.json(parsed);
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Erreur lors de la communication avec l\'IA.' });
  }
});

// Fallback to index.html for SPA routing (if any)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
