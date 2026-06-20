
import { InvoiceData, InvoiceCategoryType } from '../types';

// Declaration globale pour PDF.js chargé via script tag
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// Fonction utilitaire pour nettoyer les montants 
// Gère "EUR 1 234,56", "1.234,56", et surtout "-EUR 9.37"
const parseAmount = (str: string): number => {
  if (!str) return 0;

  // 1. Détection du signe négatif avant tout nettoyage
  const isNegative = str.includes('-');

  // 2. Nettoyage : On ne garde que les chiffres, la virgule et le point
  let clean = str.replace(/[^0-9,.]/g, ''); 
  
  // 3. Remplacement virgule par point pour le parsing
  clean = clean.replace(',', '.');

  const val = parseFloat(clean) || 0;

  return isNegative ? -Math.abs(val) : val;
};

// Fonction pour extraire une date (JJ/MM/AAAA ou AAAA-MM-JJ)
const extractDate = (text: string): string => {
  const dateRegex = /(\d{2}[/-]\d{2}[/-]\d{4})|(\d{4}[/-]\d{2}[/-]\d{2})/;
  const match = text.match(dateRegex);
  return match ? match[0] : 'Inconnue';
};

// Fonction principale pour déterminer la catégorie
const determineCategory = (text: string, filename: string): InvoiceCategoryType => {
  const t = text.toLowerCase();
  const f = filename.toLowerCase();

  // 0. Cas Spécifique : Facture technique Amazon (ais_selling_on_amazon_fees)
  if (t.includes('ais_selling_on_amazon_fees')) {
    return 'Frais de vente Amazon FR';
  }

  // 1. Chronopost
  if (t.includes('chronopost') || t.includes('transporteur') || f.includes('chronopost')) {
    return 'Frais Chronopost Amazon FR';
  }

  // 2. Avoir / Credit Note / Nota di credito
  if (t.includes('avoir') || t.includes('credit note') || t.includes('note de crédit') || t.includes('nota di credito') || t.includes('crédit d\'impôt')) {
    return 'Frais remboursés (Avoir)';
  }

  // 3. REP / Eco-contribution
  if (t.includes('responsabilité élargie') || t.includes('eco-contribution') || t.includes('rep ') || t.includes(' rep')) {
    return 'Eco-contributions et frais de service REP FR';
  }

  // 4. Publicité / Marketing
  if (t.includes('publicité') || t.includes('sponsored') || t.includes('ads invoice') || t.includes('marketing commissioni')) {
    return 'Publicité / Ads';
  }

  // 5. Frais Expédition (FBA) / Logistica
  if (t.includes('expédié par amazon') || t.includes('expédition par amazon') || t.includes('frais d\'expédition') || t.includes('fulfillment') || t.includes('fba') || t.includes('versand durch amazon') || t.includes('commissioni di logistica')) {
    
    // Belgique
    if (t.includes('be0') || t.includes('belgi') || t.includes('btw') || t.includes('amazon.com.be')) {
      return "Frais d'expédition par Amazon BE";
    }
    
    // Allemagne
    if (t.includes('versand durch amazon') || t.includes('deutschland') || t.includes('mwst') || t.includes('amazon.de')) {
      return "Frais d'expédition par Amazon DE";
    }

    // Par défaut FR (même si le texte est en italien, si c'est FR-AEU ou TVA FR)
    return "Frais d'expédition par Amazon FR";
  }

  // 6. Frais de vente (Selling Fees) / Commissioni di vendita
  if (t.includes('frais de vente') || t.includes('selling fees') || t.includes('verkopen via amazon') || t.includes('verkaufsgebühren') || t.includes('commissioni di vendita')) {
    
    // Belgique
    if (t.includes('be0') || t.includes('belgi') || t.includes('btw') || t.includes('amazon.com.be')) {
      return 'Frais de vente Amazon BE';
    }

    // Allemagne
    if (t.includes('verkaufsgebühren') || t.includes('deutschland') || t.includes('mwst') || t.includes('amazon.de')) {
      return 'Frais de vente Amazon DE';
    }

    return 'Frais de vente Amazon FR';
  }

  // Fallback Italien / Allemand générique
  if (t.includes('rechnung') || t.includes('fattura') || t.includes('mwst') || t.includes('totale')) {
      if (t.includes('logistica')) return "Frais d'expédition par Amazon FR";
      if (t.includes('vendita')) return "Frais de vente Amazon FR";
      return "Frais d'expédition par Amazon FR";
  }

  return 'Autre / Non classé';
};

// Extraction des montants HT et TVA
const extractAmounts = (text: string): { ht: number, tva: number } => {
  
  // Normalisation: remplacer les sauts de ligne et multiples espaces par un espace simple
  const cleanText = text.replace(/\s+/g, ' ');

  // --- STRATEGIE 0 : Facture Technique "ais_selling_on_amazon_fees" ---
  // Recherche la ligne spécifique : "ais_selling... EUR 1042.73 20.00% EUR 208.55"
  // Regex : Nom_Technique espace (HT) espace pourcentage espace (TVA)
  const technicalFeeRegex = /ais_selling_on_amazon_fees\w*\s+([-\sA-Z€]*[\d\s]+[.,]\d{2})\s+[\d.,]+%\s+([-\sA-Z€]*[\d\s]+[.,]\d{2})/i;
  const techMatch = cleanText.match(technicalFeeRegex);

  if (techMatch) {
    return {
      ht: parseAmount(techMatch[1]),
      tva: parseAmount(techMatch[2])
    };
  }

  // --- STRATEGIE 1 : Factures AMAZON (FR, BE, DE, IT, Credit Note) ---
  // Ajout de "TOTALE" pour le support de l'italien
  // Recherche ligne Totale : Total HT TVA TTC
  const amazonRegex = /(?:Total|Totaal|Gesamtsumme|Gesamtbetrag|Totale)\s+([-\sA-Z€]*[\d\s]+[.,]\d{2})\s+([-\sA-Z€]*[\d\s]+[.,]\d{2})\s+([-\sA-Z€]*[\d\s]+[.,]\d{2})/gi;
  
  const amazonMatches = [...cleanText.matchAll(amazonRegex)];
  
  if (amazonMatches.length > 0) {
    // On prend la dernière correspondance (le total général en bas)
    const lastMatch = amazonMatches[amazonMatches.length - 1];
    return {
      ht: parseAmount(lastMatch[1]),
      tva: parseAmount(lastMatch[2])
    };
  }

  // --- STRATEGIE 2 : Factures CHRONOPOST ---
  const chronoHtRegex = /Assiette d['’]imposition soumise\s*:\s*([-\sA-Z€]*[\d\s]+[.,]\d{2})/i;
  const chronoTvaRegex = /TVA\s*:\s*([-\sA-Z€]*[\d\s]+[.,]\d{2})/i;

  const chronoHtMatch = cleanText.match(chronoHtRegex);
  
  if (chronoHtMatch) {
    const ht = parseAmount(chronoHtMatch[1]);
    let tva = 0;
    const chronoTvaMatch = cleanText.match(chronoTvaRegex);
    if (chronoTvaMatch) {
      tva = parseAmount(chronoTvaMatch[1]);
    }
    return { ht, tva };
  }

  // --- STRATEGIE 3 : Fallback Générique ---
  const genericHtPatterns = [
    /total\s+ht\s*[:.]?\s*([-\sA-Z€]*[\d\s]+[.,]\d{2})/i,
    /montant\s+ht\s*[:.]?\s*([-\sA-Z€]*[\d\s]+[.,]\d{2})/i
  ];
  const genericTvaPatterns = [
    /total\s+tva\s*[:.]?\s*([-\sA-Z€]*[\d\s]+[.,]\d{2})/i,
    /montant\s+tva\s*[:.]?\s*([-\sA-Z€]*[\d\s]+[.,]\d{2})/i
  ];

  let ht = 0;
  let tva = 0;

  for (const p of genericHtPatterns) {
    const m = cleanText.match(p);
    if (m) { ht = parseAmount(m[1]); break; }
  }
  for (const p of genericTvaPatterns) {
    const m = cleanText.match(p);
    if (m) { tva = parseAmount(m[1]); break; }
  }

  return { ht, tva };
};


export const analyzeBatchInvoices = async (files: FileList): Promise<InvoiceData[]> => {
  const results: InvoiceData[] = [];
  const pdfjs = window.pdfjsLib;

  if (!pdfjs) {
    throw new Error("PDF.js n'est pas chargé.");
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id = `inv-${i}-${Date.now()}`;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let fullText = "";
      for (let j = 1; j <= pdf.numPages; j++) {
        const page = await pdf.getPage(j);
        const textContent = await page.getTextContent();
        // Modification: Ajouter un espace supplémentaire pour éviter la concaténation de mots
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + " ";
      }

      let category = determineCategory(fullText, file.name);
      let { ht, tva } = extractAmounts(fullText);
      const date = extractDate(fullText);

      // Sécurité Avoirs
      if (category === 'Frais remboursés (Avoir)' && ht > 0) {
        ht = -Math.abs(ht);
        tva = -Math.abs(tva);
      }

      results.push({
        id,
        filename: file.name,
        date,
        category,
        amountHT: ht,
        amountTVA: tva,
        error: (ht === 0 && tva === 0) ? "Montants non détectés" : undefined
      });

    } catch (error) {
      console.error(`Erreur analyse ${file.name}:`, error);
      results.push({
        id,
        filename: file.name,
        date: 'ERREUR',
        category: 'ERREUR',
        amountHT: 0,
        amountTVA: 0,
        error: "Fichier illisible"
      });
    }
  }

  return results;
};
