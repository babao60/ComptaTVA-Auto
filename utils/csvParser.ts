import Papa from 'papaparse';
import { ExpenseCategory, RawCsvRow, TaxMode, Transaction, AmazonSale, CustomRule } from '../types';

const parseAmount = (val: string): number => {
  if (!val) return 0;
  // Replace space (thousands separator) and comma (decimal) to standard float
  const clean = val.replace(/\s/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};

// Initial Logic to guess category based on user rules
const categorizeTransaction = (row: RawCsvRow, rules: CustomRule[]): { category: ExpenseCategory } => {
  const name = (row['Nom de la contrepartie'] || '').toLowerCase();
  const desc = (row['Libellé'] || '').toLowerCase();
  const comment = (row['Commentaire'] || '').toLowerCase();

  // Check Custom Rules first
  for (const rule of rules) {
    const keyword = rule.keyword.toLowerCase();
    if (name.includes(keyword) || desc.includes(keyword)) {
      // Rule matched!
      return { category: rule.category };
    }
  }

  // Rule 1: Ignore list 
  // - La Poste (Exonerated)
  // - Personal transfers (M. HEUDE Jerome, Mme LEROY)
  // - Taxes (SERVICE DES IMPOTS, DGFIP)
  // - Phone/Internet (FREE MOBILE)
  // - URSSAF (Social charges)
  const ignoreKeywords = [
    'la poste',
    'heude jerome',
    'leroy',
    'service des impots',
    'free mobile',
    'direction générale des finances public',
    'dgfip',
    'urssaf'
  ];

  if (ignoreKeywords.some(k => name.includes(k) || desc.includes(k))) {
    return { category: ExpenseCategory.IGNORED };
  }

  // Check Category from comments first
  if (comment.includes('immo') || comment.includes('immobilisation')) {
    return { category: ExpenseCategory.ASSET };
  }

  // Rule 3: Services (Shopify, Google, Adobe, Shine, Bank fees, Mondial Relay, SendCloud)
  const serviceKeywords = [
    'shopify', 'google', 'adobe', 'shine', 'bank', 'frais', 'commission', 'abonnement',
    'mondial relay', 'sndcld', 'send cloud'
  ];
  
  if (serviceKeywords.some(k => name.includes(k) || desc.includes(k))) {
    return { category: ExpenseCategory.SERVICE };
  }

  // Rule 4: Consumables (Default for everything else like Amazon, Atome3D, 3djack, material suppliers)
  // Logic: If it's not ignored, not a service, and not explicitly marked as asset, it's a consumable.
  return { category: ExpenseCategory.UNCATEGORIZED };
};

export const parseCSV = (file: File, rules: CustomRule[] = []): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';', // French banks usually use semicolon
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row, index) => {
          // Solde mouvement (Column J)
          const solde = parseAmount(row['Solde mouvement']);
          
          // Filter out positive amounts (Income)
          if (solde >= 0) return;

          let amountHT = parseAmount(row['Montant HT']);
          let amountTVA = parseAmount(row['Montant de TVA total']);
          
          if (amountHT === 0 && amountTVA === 0 && solde < 0) {
            amountHT = Math.abs(solde);
          }
          
          // Determine category
          const { category } = categorizeTransaction(row, rules);
          
          // STRICT RULE: if tva is > 0 it is NORMAL, if tva is 0 it is AUTOLIQUIDATION
          const taxMode = amountTVA > 0 ? TaxMode.NORMAL : TaxMode.AUTOLIQUIDATION;

          // Extract Invoice Title (usually Col V/W in Shine exports)
          // Added 'Pièces' as requested by user
          const invoiceTitle = row['Pièces'] || row['Titre du justificatif'] || row['Nom du fichier'] || '';

          transactions.push({
            id: row['Transaction ID'] || `row-${index}`,
            date: row['Date de la valeur'] || row['Date d\'opération'] || '',
            counterparty: row['Nom de la contrepartie'] || 'Inconnu',
            description: row['Libellé'] || '',
            invoiceTitle: invoiceTitle,
            amountHT: Math.abs(amountHT), // Ensure positive for dashboard
            amountTVA: Math.abs(amountTVA),
            totalAmount: Math.abs(solde), // Store absolute total cost
            category,
            taxMode,
            comment: row['Commentaire']
          });
        });

        resolve(transactions);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};

// --- AMAZON PARSER ---

interface AmazonRawRow {
  'amazon-order-id': string;
  'purchase-date': string;
  'order-status': string;
  'product-name': string;
  'sku': string;
  'ship-country': string;
  'item-price': string;
  'shipping-price': string;
  'gift-wrap-price': string;
  'item-promotion-discount': string;
  'ship-promotion-discount': string;
  [key: string]: string | undefined;
}

const parseAmazonFloat = (val: string | undefined): number => {
  if (!val) return 0;
  // Robust parsing: Handle spaces (thousands) and commas (decimals)
  // If Excel saved it as "1 299,00", parseFloat would stop at space or return 1.
  const clean = val.replace(/\s/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};

export const parseAmazonCSV = (file: File): Promise<AmazonSale[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return reject(new Error("Fichier vide"));

      // Find the header line
      const lines = text.split('\n');
      const headerIndex = lines.findIndex(line => line.startsWith('"date/heure"') || line.startsWith('date/heure'));
      
      if (headerIndex === -1) {
        return reject(new Error("En-têtes introuvables dans le fichier Amazon."));
      }

      const csvContent = lines.slice(headerIndex).join('\n');

      Papa.parse<any>(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ',', // Amazon transaction reports are comma-separated
        complete: (results) => {
          const sales: AmazonSale[] = [];
          
          results.data.forEach((row) => {
            const type = row['type'];
            if (!type) return; // Skip empty rows

            const itemPrice = parseAmazonFloat(row['ventes de produits']);
            const shippingPrice = parseAmazonFloat(row['crédits d\'expédition']);
            const promotionalRebates = parseAmazonFloat(row['Rabais promotionnels']);
            
            const itemTax = parseAmazonFloat(row['Taxes sur la vente des produits']);
            const shippingTax = parseAmazonFloat(row['taxe sur les crédits d’expédition']);
            const promotionalRebatesTax = parseAmazonFloat(row['Taxes sur les remises promotionnelles']);

            let priceHT = itemPrice + shippingPrice + promotionalRebates;
            const priceTVA = itemTax + shippingTax + promotionalRebatesTax;
            let rawPriceTTC = priceHT + priceTVA;

            const marketplace = (row['Marketplace'] || '').toLowerCase();
            const postalCode = (row['code postal de la commande'] || '').trim();
            const isBelgianZip = postalCode.length === 4;
            
            // Special Logic: if VAT is 0 but it's on amazon.fr, it's likely a TTC price that wasn't de-taxed
            // User requested 21.90 -> 18.25 (which is 21.90 / 1.2)
            // BUT: "Ne divise pas par 1,2 dans ce cas précis" for Belgium (4-digit zip)
            if (priceTVA === 0 && isBelgianZip) {
              priceHT = itemPrice; // 100% de la colonne ventes de produits
              rawPriceTTC = priceHT; // Since TVA is 0
            } else if (priceTVA === 0 && marketplace === 'amazon.fr' && priceHT > 0 && type === 'Commande' && !isBelgianZip) {
              // rawPriceTTC remains the original priceHT (which was TTC)
              priceHT = priceHT / 1.2;
            }

            const quantity = parseInt(row['quantité'], 10) || 0;
            const fraisVente = parseAmazonFloat(row['frais de vente']);
            const fraisFBA = parseAmazonFloat(row['Frais Expédié par Amazon']);
            const autresFrais = parseAmazonFloat(row['autres frais de transaction']) + parseAmazonFloat(row['autre']);
            const total = parseAmazonFloat(row['total']);

            let dateStr = row['date/heure'];
            try {
               // Handle French dates like "28 févr. 2026 23:00:44 UTC"
               let cleanDate = dateStr;
               const frMonths: Record<string, string> = {
                 'janv.': 'Jan', 'janvier': 'Jan', 'févr.': 'Feb', 'février': 'Feb', 'mars': 'Mar', 'avr.': 'Apr', 'avril': 'Apr', 'mai': 'May', 'juin': 'Jun',
                 'juil.': 'Jul', 'juillet': 'Jul', 'août': 'Aug', 'sept.': 'Sep', 'septembre': 'Sep', 'oct.': 'Oct', 'octobre': 'Oct', 'nov.': 'Nov', 'novembre': 'Nov', 'déc.': 'Dec', 'décembre': 'Dec'
               };
               for (const [fr, en] of Object.entries(frMonths)) {
                 if (cleanDate.includes(fr)) {
                   cleanDate = cleanDate.replace(fr, en);
                   break;
                 }
               }
               const d = new Date(cleanDate);
               if (!isNaN(d.getTime())) {
                  dateStr = d.toLocaleDateString('fr-FR');
               }
            } catch(e) {}

            let country = 'France';
            
            if (marketplace.includes('.be')) country = 'Belgique';
            else if (marketplace.includes('.ch')) country = 'Suisse';
            else if (marketplace.includes('.de')) country = 'Allemagne';
            else if (marketplace.includes('.it')) country = 'Italie';
            else if (marketplace.includes('.es')) country = 'Espagne';
            else if (postalCode.length === 4) country = 'Belgique / Suisse';
            else if (postalCode.length === 5) country = 'France';
            else if (marketplace) country = marketplace;

            sales.push({
              orderId: row['numéro de la commande'] || 'N/A',
              date: dateStr,
              type: type,
              productName: row['description'] || '',
              sku: row['sku'] || '',
              quantity,
              itemPrice,
              shippingPrice: 0,
              itemTax,
              shippingTax: 0,
              priceHT,
              priceTVA,
              priceTTC: rawPriceTTC,
              fraisVente,
              fraisFBA,
              autresFrais,
              total,
              country,
              zip: postalCode,
              marketplace: (row['Marketplace'] || '')
            });
          });

          resolve(sales);
        },
        error: (error) => {
          reject(error);
        }
      });
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsText(file);
  });
};