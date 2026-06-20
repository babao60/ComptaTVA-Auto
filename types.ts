
export enum ExpenseCategory {
  CONSUMABLE = 'Consommable',
  SERVICE = 'Service',
  ASSET = 'Immobilisation', // Materiel
  IGNORED = 'Ignoré', // For La Poste etc
  UNCATEGORIZED = 'À classer'
}

export interface CustomRule {
  id: string;
  keyword: string;
  category: ExpenseCategory;
  taxMode: TaxMode;
}

export enum TaxMode {
  NORMAL = 'Normal', // TVA Paid
  AUTOLIQUIDATION = 'Autoliquidation' // Reverse Charge / No TVA paid
}

export interface RawCsvRow {
  'Transaction ID': string;
  'Date de la valeur': string;
  'Solde mouvement': string;
  'Libellé': string;
  'Nom de la contrepartie': string;
  'Montant HT': string;
  'Montant de TVA total': string;
  'Commentaire'?: string;
  'Titre du justificatif'?: string; // Colonne Shine souvent en V
  'Nom du fichier'?: string; // Alternative
  [key: string]: string | undefined;
}

export interface Transaction {
  id: string;
  date: string;
  counterparty: string;
  description: string;
  invoiceTitle?: string; // Nouveau champ pour le justificatif
  amountHT: number;
  amountTVA: number;
  totalAmount: number; // Signed amount from 'Solde mouvement'
  category: ExpenseCategory;
  taxMode: TaxMode;
  comment?: string;
}

export interface SummaryData {
  category: ExpenseCategory;
  taxMode: TaxMode;
  totalHT: number;
  totalTVA: number;
  count: number;
}

// Nouvelle interface pour les ventes Amazon avec détails
export interface AmazonSale {
  orderId: string;
  date: string;
  type: string; // 'Commande', 'Remboursement', 'Frais de service', etc.
  productName: string;
  sku: string;
  quantity: number;
  
  // Détails pour audit
  itemPrice: number;
  shippingPrice: number;
  itemTax: number;
  shippingTax: number;

  priceTTC: number; // CA Brut (URSSAF)
  priceHT: number; // CA HT
  priceTVA: number; // TVA collectée
  
  fraisVente: number;
  fraisFBA: number;
  autresFrais: number;
  total: number; // Montant net de la ligne

  country: string;
  zip?: string;
  marketplace?: string;
}

// --- Types pour l'analyse PDF ---

export type InvoiceCategoryType = 
  | 'Frais Chronopost Amazon FR'
  | 'Eco-contributions et frais de service REP FR'
  | 'Frais remboursés (Avoir)'
  | 'Frais d\'expédition par Amazon FR'
  | 'Frais d\'expédition par Amazon BE'
  | 'Frais d\'expédition par Amazon DE'
  | 'Frais de vente Amazon FR'
  | 'Frais de vente Amazon BE'
  | 'Frais de vente Amazon DE'
  | 'Publicité / Ads'
  | 'Autre / Non classé'
  | 'ERREUR';

export interface InvoiceData {
  id: string;
  filename: string;
  date: string;
  category: InvoiceCategoryType;
  amountHT: number;
  amountTVA: number;
  error?: string; // Si le parsing échoue
}

export interface InvoiceSummary {
  category: InvoiceCategoryType;
  totalHT: number;
  totalTVA: number;
  count: number;
}
