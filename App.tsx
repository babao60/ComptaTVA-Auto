
import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseCSV, parseAmazonCSV } from './utils/csvParser';
import { analyzeBatchInvoices } from './utils/pdfParser'; // Import de la nouvelle fonction
import { Transaction, ExpenseCategory, TaxMode, AmazonSale, InvoiceData, InvoiceCategoryType, InvoiceSummary, CustomRule } from './types';
import { SummaryCard } from './components/SummaryCard';
import { FileUploader } from './components/FileUploader';
import { FileSpreadsheet, RotateCcw, Download, FileText, ShoppingCart, CreditCard, TrendingUp, ExternalLink, Files, AlertTriangle, ChevronDown, Settings, RefreshCw, HardDrive, Server } from 'lucide-react';

type ViewMode = 'EXPENSES' | 'SALES' | 'INVOICES' | 'MEMO';

// Declaration for the html2pdf library loaded via script tag
declare var html2pdf: any;

function App() {
  // Navigation State
  const [viewMode, setViewMode] = useState<ViewMode>('EXPENSES');

  // Expenses State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeFilter, setActiveFilter] = useState<{cat: ExpenseCategory, mode?: TaxMode} | null>(null);

  // Sales State
  const [sales, setSales] = useState<AmazonSale[]>([]);

  // Invoices (PDF) State
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);

  // Common State
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPdfMode, setIsPdfMode] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Custom Rules State
  const [rules, setRules] = useState<CustomRule[]>([]);

  // Load rules from API on startup
  useEffect(() => {
    fetch('/api/rules')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRules(data);
      })
      .catch(err => console.error("Error loading rules:", err));
  }, []);

  // Save rules to API whenever they change
  useEffect(() => {
    // Only save if rules is not empty, to prevent overwriting on first load
    // Actually, to correctly sync, we should only call save when rules are modified by user actions.
    // A better approach is to create a function saveRulesToApi that is called inside addRule and removeRule.
  }, [rules]);

  const saveRulesToApi = async (newRules: CustomRule[]) => {
    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRules)
      });
    } catch (err) {
      console.error("Error saving rules:", err);
    }
  };

  // Show Rules Modal State
  const [showRulesModal, setShowRulesModal] = useState(false);

  // AI Loading State
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- HANDLERS ---

  const handleFileUpload = async (files: FileList) => {
    setLoading(true);
    setFileName(`${files.length} fichier(s)`);
    try {
      if (viewMode === 'EXPENSES') {
        const data = await parseCSV(files[0], rules);
        setTransactions(data);
        setFileName(files[0].name);
      } else if (viewMode === 'SALES') {
        const data = await parseAmazonCSV(files[0]);
        setSales(data);
        setFileName(files[0].name);
      } else if (viewMode === 'INVOICES') {
        // PDF Batch Analysis
        const data = await analyzeBatchInvoices(files);
        setInvoices(data);
      }
    } catch (error) {
      console.error("Error processing files", error);
      alert("Erreur lors du traitement. Vérifiez les fichiers.");
    } finally {
      setLoading(false);
    }
  };

  const updateTransaction = (id: string, field: keyof Transaction, value: any) => {
    setTransactions(prev => prev.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const toggleFilter = (cat: ExpenseCategory, mode?: TaxMode) => {
    if (activeFilter && activeFilter.cat === cat && activeFilter.mode === mode) {
      setActiveFilter(null);
    } else {
      setActiveFilter({ cat, mode });
    }
  };

  const addRule = (keyword: string, category: ExpenseCategory, taxMode: TaxMode) => {
    const kw = keyword.toLowerCase();
    const existingIndex = rules.findIndex(r => r.keyword === kw);
    
    let newRules;
    if (existingIndex >= 0) {
      newRules = [...rules];
      newRules[existingIndex] = { ...newRules[existingIndex], category, taxMode };
    } else {
      newRules = [...rules, {
        id: Date.now().toString(),
        keyword: kw,
        category,
        taxMode
      }];
    }
    
    setRules(newRules);
    saveRulesToApi(newRules);
    alert(`Règle ${existingIndex >= 0 ? 'mise à jour' : 'ajoutée'} : "${keyword}" sera maintenant classé en ${category} (${taxMode})`);
  };

  const removeRule = (id: string) => {
    if (confirm('Supprimer cette règle ?')) {
      const newRules = rules.filter(r => r.id !== id);
      setRules(newRules);
      saveRulesToApi(newRules);
    }
  };

  const updateRule = (id: string, field: keyof CustomRule, value: any) => {
    const newRules = rules.map(r => r.id === id ? { ...r, [field]: value } : r);
    setRules(newRules);
    saveRulesToApi(newRules);
  };

  const memorizeAll = () => {
    // Find all transactions that have been categorized (not UNCATEGORIZED and not IGNORED for rules?)
    // Actually, IGNORED is a valid rule category. UNCATEGORIZED is the only invalid one.
    const validTransactions = transactions.filter(t => t.category !== ExpenseCategory.UNCATEGORIZED);
    
    // Build new rules from them, avoiding duplicates
    let addedCount = 0;
    const rulesToAdd: CustomRule[] = [];
    
    validTransactions.forEach(t => {
      const keyword = t.counterparty.toLowerCase();
      // Check if rule already exists
      if (!rules.some(r => r.keyword === keyword) && !rulesToAdd.some(r => r.keyword === keyword)) {
        rulesToAdd.push({
          id: Date.now().toString() + Math.random().toString().slice(2, 6),
          keyword,
          category: t.category,
          taxMode: t.taxMode
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      const newRules = [...rules, ...rulesToAdd];
      setRules(newRules);
      saveRulesToApi(newRules);
      alert(`${addedCount} nouvelle(s) règle(s) enregistrée(s) avec succès !`);
    } else {
      alert("Aucune nouvelle règle à mémoriser (elles existent déjà ou aucune transaction n'a été classée).");
    }
  };

  const categorizeWithAI = async () => {
    // Get uncategorized transactions
    const uncategorized = transactions.filter(t => t.category === ExpenseCategory.UNCATEGORIZED);
    if (uncategorized.length === 0) {
      alert("Aucune transaction à classer !");
      return;
    }

    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: uncategorized })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur de l'API");
      }

      const results = await response.json();
      
      // Update transactions state with AI results
      setTransactions(prev => prev.map(t => {
        const aiSuggestion = results.find((r: any) => r.id === t.id);
        if (aiSuggestion) {
          return { ...t, category: aiSuggestion.category, taxMode: aiSuggestion.taxMode };
        }
        return t;
      }));

      alert("L'IA a terminé son analyse. Veuillez vérifier les propositions puis cliquez sur 'Tout Mémoriser' si vous êtes d'accord.");
    } catch (error: any) {
      alert(`Erreur avec l'IA: ${error.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const downloadRules = async () => {
    try {
      const response = await fetch('/api/rules');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rules.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Erreur lors du téléchargement des règles.");
    }
  };

  // --- MEMOS & STATS ---

  // EXPENSES STATS
  const expenseStats = useMemo(() => {
    const initial = {
      uncategorized: { normal: { ht: 0, tva: 0, count: 0 }, auto: { ht: 0, tva: 0, count: 0 } },
      consommable: { normal: { ht: 0, tva: 0, count: 0 }, auto: { ht: 0, tva: 0, count: 0 } },
      service: { normal: { ht: 0, tva: 0, count: 0 }, auto: { ht: 0, tva: 0, count: 0 } },
      asset: { normal: { ht: 0, tva: 0, count: 0 }, auto: { ht: 0, tva: 0, count: 0 } },
      ignored: { ht: 0, tva: 0, count: 0 }
    };
    return transactions.reduce((acc, t) => {
      if (t.category === ExpenseCategory.IGNORED) {
        acc.ignored.ht += t.amountHT; acc.ignored.tva += t.amountTVA; acc.ignored.count += 1;
        return acc;
      }
      let catKey: 'consommable' | 'service' | 'asset' | 'uncategorized';
      if (t.category === ExpenseCategory.CONSUMABLE) catKey = 'consommable';
      else if (t.category === ExpenseCategory.SERVICE) catKey = 'service';
      else if (t.category === ExpenseCategory.ASSET) catKey = 'asset';
      else if (t.category === ExpenseCategory.UNCATEGORIZED) catKey = 'uncategorized';
      else return acc;

      const targetStat = acc[catKey];
      const modeKey = t.taxMode === TaxMode.NORMAL ? 'normal' : 'auto';
      targetStat[modeKey].ht += t.amountHT;
      targetStat[modeKey].tva += t.amountTVA;
      targetStat[modeKey].count += 1;
      return acc;
    }, initial);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (isPdfMode) return transactions;
    let data = transactions;
    if (activeFilter) {
      if (activeFilter.cat === ExpenseCategory.IGNORED) {
        data = data.filter(t => t.category === ExpenseCategory.IGNORED);
      } else {
        data = data.filter(t => t.category === activeFilter.cat && t.taxMode === activeFilter.mode);
      }
    } else {
      data = data.filter(t => t.category !== ExpenseCategory.IGNORED);
    }
    return data;
  }, [transactions, activeFilter, isPdfMode]);

  const getUnitCost = (sku: string) => {
    if (sku.startsWith('AVS.100.2')) return 5.83;
    if (sku.startsWith('AVS.100.4')) return 11.47;
    if (sku.startsWith('PE.TM7.1N')) return 1.62;
    if (sku.startsWith('LEG.42207.1N')) return 0.32;
    if (sku.startsWith('22-4R9V-SVKO')) return 0.74;
    if (sku.startsWith('SMF.PRO.1N') || sku.startsWith('SMF.PRO.1W')) return 0.19;
    if (sku.startsWith('SMF.PRO.2N') || sku.startsWith('SMF.PRO.2W')) return 0.63;
    return 0;
  };

  // SALES STATS
  const salesStats = useMemo(() => {
    return sales.reduce((acc, sale) => {
      if (sale.type === 'Commande' || sale.type === 'Remboursement') {
        acc.totalHT += sale.priceHT;
        acc.totalTVA += sale.priceTVA;
        acc.totalTTC += sale.priceTTC;
        const unitCost = getUnitCost(sale.sku || '');
        
        if (sale.type === 'Commande') {
          acc.count += 1;
          acc.totalFixedCosts += unitCost * (sale.quantity || 1);
        } else if (sale.type === 'Remboursement') {
          acc.refundCount += 1;
          acc.totalRefunds += Math.abs(sale.priceTTC);
          acc.totalFixedCosts -= unitCost * (sale.quantity || 1);
        }
        
        acc.fraisAmazon += (sale.fraisVente + sale.fraisFBA + sale.autresFrais);
        acc.fraisVente += sale.fraisVente;
        acc.fraisFBA += sale.fraisFBA;
        acc.autresFrais += sale.autresFrais;
      } else if (sale.type === 'Frais de service') {
        acc.fraisService += sale.total;
        acc.fraisAmazon += sale.total;
      } else if (sale.type === 'Frais de stock Expédié par Amazon') {
        acc.fraisStock += sale.total;
        acc.fraisAmazon += sale.total;
      } else if (sale.type === 'Ajustement' || sale.type === 'Solde négatif') {
        acc.fraisAjustement += sale.total;
        acc.fraisAmazon += sale.total;
      } else if (sale.type !== 'Transfert') {
        acc.autresFrais += sale.total;
        acc.fraisAmazon += sale.total;
      }

      if (sale.type !== 'Transfert') {
        acc.netPayout += sale.total;
      }

      return acc;
    }, { 
      totalHT: 0, totalTVA: 0, totalTTC: 0, count: 0, refundCount: 0, totalRefunds: 0, 
      fraisAmazon: 0, fraisVente: 0, fraisFBA: 0, autresFrais: 0, 
      fraisService: 0, fraisStock: 0, fraisAjustement: 0, 
      netPayout: 0, totalFixedCosts: 0 
    });
  }, [sales, getUnitCost]);

  // CA3 DECLARATION HELPER
  const ca3Summary = useMemo(() => {
    return sales.reduce((acc, sale) => {
      if (sale.type !== 'Commande' && sale.type !== 'Remboursement') return acc;
      
      const isRefund = sale.type === 'Remboursement';
      const amountHT = isRefund ? -Math.abs(sale.priceHT) : sale.priceHT;
      const country = sale.country || 'France';
      
      // Logic:
      // 1. If Country is France -> Case A1
      if (country === 'France') {
        // "pour les lignes Commande avec taxe > 0, MOINS le HT des lignes Remboursement correspondantes"
        if (sale.type === 'Commande' && sale.priceTVA > 0) {
          acc.A1 += amountHT;
        } else if (sale.type === 'Remboursement' && Math.abs(sale.priceTVA) > 0) {
          acc.A1 += amountHT;
        }
      } 
      // 2. Everything else (UE, Export, Facilitated) -> Case F2
      else {
        acc.F2 += amountHT;
      }
      return acc;
    }, { A1: 0, F2: 0 });
  }, [sales]);

  const netNetProfit = salesStats.netPayout - (salesStats.totalHT * 0.133) - salesStats.totalFixedCosts - salesStats.totalTVA;

  const getColorFromSku = (sku: string) => {
    if (sku.endsWith('2M') || sku.endsWith('4M') || sku.endsWith('M')) return 'Marbre';
    if (sku.endsWith('GA')) return 'Gris Anthracite';
    if (sku.endsWith('G')) return 'Gris';
    if (sku.endsWith('B')) return 'Beige';
    if (sku.endsWith('W')) return 'Blanc';
    if (sku.endsWith('N')) return 'Noir';
    return '';
  };

  const getSimplifiedName = (sku: string, originalName: string) => {
    const color = getColorFromSku(sku);
    const colorSuffix = color ? ` - ${color}` : '';

    if (sku.startsWith('AVS.100.2')) return `Lot 2x Grille d'aération${colorSuffix}`;
    if (sku.startsWith('AVS.100.4')) return `Lot 4x Grille d'aération${colorSuffix}`;
    if (sku.startsWith('SMF.PRO.1')) return `Coque Somfy - Individuel${colorSuffix}`;
    if (sku.startsWith('SMF.PRO.2')) return `Lot 2x Coque Somfy${colorSuffix}`;
    if (sku === 'PE.TM7.1N') return 'Coque Thermomix TM7';
    if (sku === 'LEG.42207.1N') return 'Support Mural Lego F1';
    if (sku === '22-4R9V-SVKO') return 'Kit Bouchons Citroën AMI / Opel';
    
    return originalName.split(',')[0].substring(0, 40) + (originalName.length > 40 ? '...' : '');
  };

  const getFamily = (sku: string, originalName: string) => {
    if (sku.startsWith('AVS.100.2')) return 'Famille Grilles 2x';
    if (sku.startsWith('AVS.100.4')) return 'Famille Grilles 4x';
    if (sku.startsWith('SMF.PRO.1')) return 'Famille Somfy Solo';
    if (sku.startsWith('SMF.PRO.2')) return 'Famille Somfy Duo';
    if (sku.startsWith('LEG.42207')) return 'Famille Lego F1';
    if (sku.startsWith('PE.TM7')) return 'Famille Thermomix TM7';
    if (sku.startsWith('22-4R9V-SVKO')) return 'Famille Citroën AMI';
    
    // User requested to show Lego, Thermomix, Citroën individually if not in a family
    // But they are already in families above. For others, we return the simplified name.
    return getSimplifiedName(sku, originalName);
  };

  const productProfitability = useMemo(() => {
    const groups: Record<string, any> = {};
    
    sales.forEach(sale => {
      if (sale.type !== 'Commande' && sale.type !== 'Remboursement') return;
      
      const sku = sale.sku || 'Inconnu';
      if (!groups[sku]) {
        groups[sku] = {
          name: getSimplifiedName(sku, sale.productName),
          family: getFamily(sku, sale.productName),
          sku: sku,
          orderLines: 0,
          refundLines: 0,
          netQuantity: 0,
          caHT: 0,
          tva: 0,
          fraisAmazon: 0,
          refundAmount: 0,
        };
      }
      
      if (sale.type === 'Commande') {
        groups[sku].orderLines += 1;
        groups[sku].netQuantity += sale.quantity || 1;
      } else if (sale.type === 'Remboursement') {
        groups[sku].refundLines += 1;
        groups[sku].netQuantity -= sale.quantity || 1;
        groups[sku].refundAmount += Math.abs(sale.priceTTC);
      }
      
      groups[sku].caHT += sale.priceHT;
      groups[sku].tva += sale.priceTVA;
      groups[sku].fraisAmazon += (sale.fraisVente + sale.fraisFBA);
    });
    
    return Object.values(groups).map(g => {
      const unitCost = getUnitCost(g.sku);
      const totalFixedCost = unitCost * Math.max(0, g.netQuantity);
      const urssaf = g.caHT * 0.133;
      const netProfit = g.caHT - g.tva - urssaf - totalFixedCost + g.fraisAmazon;
      const returnRate = g.orderLines > 0 ? (g.refundLines / g.orderLines) * 100 : 0;
      const netMargin = g.caHT > 0 ? (netProfit / g.caHT) * 100 : 0;
      
      return {
        ...g,
        unitCost,
        totalFixedCost,
        urssaf,
        netProfit,
        returnRate,
        netMargin
      };
    });
  }, [sales]);

  const familyProfitability = useMemo(() => {
    const groups: Record<string, any> = {};
    
    productProfitability.forEach(prod => {
      const family = prod.family;
      if (!groups[family]) {
        groups[family] = {
          name: family,
          netQuantity: 0,
          caHT: 0,
          netProfit: 0,
        };
      }
      groups[family].netQuantity += prod.netQuantity;
      groups[family].caHT += prod.caHT;
      groups[family].netProfit += prod.netProfit;
    });

    return Object.values(groups).map(g => {
      const netMargin = g.caHT > 0 ? (g.netProfit / g.caHT) * 100 : 0;
      return {
        ...g,
        netMargin
      };
    }).sort((a, b) => b.netProfit - a.netProfit);
  }, [productProfitability]);

  const sortedProductProfitability = useMemo(() => {
    let sortableItems = [...productProfitability];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    } else {
      // Default sort by netProfit descending
      sortableItems.sort((a, b) => b.netProfit - a.netProfit);
    }
    return sortableItems;
  }, [productProfitability, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // INVOICES STATS (GroupBy Category)
  const invoicesStats = useMemo(() => {
    const groups: Record<string, InvoiceSummary> = {};
    let grandTotalHT = 0;
    let grandTotalTVA = 0;

    invoices.forEach(inv => {
      if (!groups[inv.category]) {
        groups[inv.category] = { category: inv.category, totalHT: 0, totalTVA: 0, count: 0 };
      }
      if (inv.category !== 'ERREUR') {
        groups[inv.category].totalHT += inv.amountHT;
        groups[inv.category].totalTVA += inv.amountTVA;
        groups[inv.category].count += 1;
        grandTotalHT += inv.amountHT;
        grandTotalTVA += inv.amountTVA;
      }
    });

    return { groups, grandTotalHT, grandTotalTVA };
  }, [invoices]);

  // DATE INFO FOR PDF
  const dateInfo = useMemo(() => {
    let d = new Date();
    
    // Déterminer une date représentative selon les données chargées
    if (viewMode === 'EXPENSES' && transactions.length > 0) {
      const firstDateStr = transactions[0].date;
      const parts = firstDateStr.split('/');
      if (parts.length === 3) {
        d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, 1);
      }
    } else if (viewMode === 'SALES' && sales.length > 0) {
      const firstDateStr = sales[0].date;
      const parts = firstDateStr.split('/');
      if (parts.length === 3) {
        d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, 1);
      }
    } else if (viewMode === 'INVOICES' && invoices.length > 0) {
      // Chercher une date valide parmi les factures analysées
      const validInvoice = invoices.find(inv => inv.date !== 'Inconnue' && inv.date !== 'ERREUR');
      if (validInvoice) {
        const dateStr = validInvoice.date;
        // Format JJ/MM/AAAA
        const match = dateStr.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
        if (match) {
          d = new Date(parseInt(match[3]), parseInt(match[2]) - 1, 1);
        } else {
          // Format ISO YYYY-MM-DD
          const matchIso = dateStr.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
          if (matchIso) {
            d = new Date(parseInt(matchIso[1]), parseInt(matchIso[2]) - 1, 1);
          }
        }
      }
    }

    const month = d.toLocaleString('fr-FR', { month: 'long' });
    const year = d.getFullYear();
    const title = `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
    
    let prefix = 'Export';
    if (viewMode === 'EXPENSES') prefix = 'Dépenses';
    if (viewMode === 'SALES') prefix = 'Recettes';
    if (viewMode === 'INVOICES') prefix = 'Factures';

    return {
      filename: `Justificatif_${prefix}_${title.replace(' ', '_')}.pdf`,
      displayTitle: title.toUpperCase()
    };
  }, [viewMode, transactions, sales, invoices]);

  // --- PDF GENERATOR ---
  const handleDownloadPDF = () => {
    setIsPdfMode(true);
    const oldTitle = document.title;
    // On change le titre du document juste avant l'impression car c'est ce que le navigateur 
    // utilise comme nom de fichier par défaut pour "Enregistrer au format PDF"
    document.title = dateInfo.filename.replace('.pdf', '');
    
    setTimeout(() => {
      window.print();
      document.title = oldTitle;
      setIsPdfMode(false);
    }, 250);
  };

  const resetData = () => {
    if(confirm('Tout effacer ?')) {
      if (viewMode === 'EXPENSES') setTransactions([]);
      else if (viewMode === 'SALES') setSales([]);
      else setInvoices([]);
      setFileName(null);
    }
  };

  const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

  // Helpers
  const getRowColor = (t: Transaction, isIgnored: boolean) => {
    if (isIgnored) return 'bg-slate-100 text-slate-400';
    if (t.category === ExpenseCategory.UNCATEGORIZED) return 'bg-slate-200 hover:bg-slate-300';
    if (t.category === ExpenseCategory.CONSUMABLE) return t.taxMode === TaxMode.NORMAL ? 'bg-sky-300 hover:bg-sky-400' : 'bg-sky-100 hover:bg-sky-200';
    if (t.category === ExpenseCategory.SERVICE) return t.taxMode === TaxMode.NORMAL ? 'bg-fuchsia-300 hover:bg-fuchsia-400' : 'bg-fuchsia-100 hover:bg-fuchsia-200';
    if (t.category === ExpenseCategory.ASSET) return t.taxMode === TaxMode.NORMAL ? 'bg-emerald-300 hover:bg-emerald-400' : 'bg-emerald-100 hover:bg-emerald-200';
    return 'bg-white';
  };

  const footerTotals = filteredTransactions.reduce((acc, t) => {
    acc.ht += t.amountHT; acc.tva += t.amountTVA; acc.total += t.totalAmount; return acc;
  }, { ht: 0, tva: 0, total: 0 });

  const hasData = viewMode === 'EXPENSES' ? transactions.length > 0 
                : viewMode === 'SALES' ? sales.length > 0
                : viewMode === 'INVOICES' ? invoices.length > 0
                : true;

  const getPercentageOfCA = (amount: number) => {
    if (!salesStats.totalTTC) return '0.0%';
    return ((Math.abs(amount) / salesStats.totalTTC) * 100).toFixed(1) + '%';
  };

  const simplifyAdjustmentDescription = (desc: string) => {
    const d = desc.toLowerCase();
    if (d.includes('damaged:warehouse') || d.includes('endommagé')) return 'Stock endommagé en entrepôt';
    if (d.includes('lost:warehouse') || d.includes('perdu')) return 'Stock perdu en entrepôt';
    if (d.includes('customer return') || d.includes('retour client')) return 'Remboursement retour client';
    if (d.includes('reversal_reimbursement')) return 'Annulation de remboursement';
    if (d.includes('compensated_clawback')) return 'Récupération compensée';
    if (d.includes('general adjustment')) return 'Ajustement général';
    if (d.includes('fba inventory reimbursement')) return 'Remboursement de stock FBA';
    return desc || 'Ajustement divers';
  };

  const adjustmentsList = useMemo(() => {
    return sales.filter(s => s.type === 'Ajustement' || s.type === 'Solde négatif');
  }, [sales]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      
      {/* HEADER / NAVIGATION */}
      {/* PRINT STYLES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          #printable-content { 
            border: none !important; 
            box-shadow: none !important; 
            padding: 0 !important;
            width: 100% !important;
          }
          .bg-slate-800 { background-color: #1e293b !important; color: white !important; -webkit-print-color-adjust: exact; }
          .bg-sky-500 { background-color: #0ea5e9 !important; -webkit-print-color-adjust: exact; }
          .bg-emerald-500 { background-color: #10b981 !important; -webkit-print-color-adjust: exact; }
          .bg-purple-500 { background-color: #a855f7 !important; -webkit-print-color-adjust: exact; }
          .bg-amber-500 { background-color: #f59e0b !important; -webkit-print-color-adjust: exact; }
        }
      `}} />

      <div className={`bg-white border-b shadow-sm sticky top-0 z-40 no-print`} data-html2canvas-ignore="true">
        <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="bg-sky-600 p-2 rounded-lg text-white">
               {viewMode === 'EXPENSES' && <CreditCard size={24}/>}
               {viewMode === 'SALES' && <ShoppingCart size={24} />}
               {viewMode === 'INVOICES' && <Files size={24} />}
             </div>
             <div>
               <h1 className="text-xl font-bold text-slate-800">ComptaTVA Auto</h1>
               {hasData && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[200px] inline-block">{fileName}</span>}
             </div>
          </div>
          
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('EXPENSES')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'EXPENSES' ? 'bg-white text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)] border-sky-500/50' : 'text-slate-500 hover:text-slate-700'}`}>Dépenses (CSV)</button>
            <button onClick={() => setViewMode('SALES')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'SALES' ? 'bg-white text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)] border-yellow-500/50' : 'text-slate-500 hover:text-slate-700'}`}>Ventes (Amazon)</button>
            <button onClick={() => setViewMode('INVOICES')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'INVOICES' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Factures Amazon (PDF)</button>
            <button onClick={() => setViewMode('MEMO')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'MEMO' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <Settings size={16} /> Mémos & Sauvegarde
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowRulesModal(true)} className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md">
               Règles ({rules.length})
            </button>
            {hasData && (
              <>
              <button onClick={handleDownloadPDF} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white border rounded shadow-sm ${viewMode === 'EXPENSES' ? 'bg-sky-600 border-sky-600 hover:bg-sky-700' : viewMode === 'SALES' ? 'bg-yellow-500 border-yellow-500 hover:bg-yellow-600' : 'bg-purple-600 border-purple-600 hover:bg-purple-700'}`}>
                <Download className="w-4 h-4" /> Imprimer / PDF
              </button>
              <button onClick={resetData} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded hover:bg-red-100"><RotateCcw className="w-4 h-4" /></button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* NO DATA STATE */}
      {!hasData && (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center">
            <div className={`mb-6 p-6 rounded-full bg-opacity-10 ${viewMode === 'EXPENSES' ? 'bg-sky-500 text-sky-600' : viewMode === 'SALES' ? 'bg-yellow-500 text-yellow-600' : 'bg-purple-500 text-purple-600'}`}>
              {viewMode === 'EXPENSES' && <FileSpreadsheet size={64} />}
              {viewMode === 'SALES' && <ShoppingCart size={64} />}
              {viewMode === 'INVOICES' && <Files size={64} />}
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              {viewMode === 'EXPENSES' && 'Analysez vos dépenses bancaires'}
              {viewMode === 'SALES' && 'Calculez votre CA Amazon'}
              {viewMode === 'INVOICES' && 'Analysez vos Factures Amazon'}
              {viewMode === 'MEMO' && 'Paramètres, Sauvegarde & Mémos'}
            </h2>
            <p className="text-slate-500 max-w-md mb-8">
              {viewMode === 'EXPENSES' && "Importez votre CSV bancaire pour catégoriser vos achats."}
              {viewMode === 'SALES' && "Importez votre rapport de transactions Amazon (.csv)."}
              {viewMode === 'INVOICES' && "Sélectionnez plusieurs factures PDF (Amazon, Chronopost, REP...) pour extraire les montants HT/TVA automatiquement."}
              {viewMode === 'MEMO' && "Toutes les commandes pour gérer, mettre à jour et sauvegarder votre outil."}
            </p>
            
            {viewMode === 'SALES' && (
              <a href="https://sellercentral.amazon.fr/payments/reports-repository?ref_=xx_rrepo_ttab_trans" target="_blank" rel="noreferrer" className="mb-8 flex items-center gap-2 text-sm text-yellow-600 hover:text-yellow-700 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-100"><ExternalLink className="w-4 h-4" />Générer le rapport Amazon</a>
            )}

            {loading ? (
              <div className="animate-pulse text-sky-600 font-medium">Analyse en cours...</div>
            ) : (
              <FileUploader 
                onFileUpload={handleFileUpload} 
                accept={viewMode === 'INVOICES' ? '.pdf' : viewMode === 'SALES' ? '.csv,.txt,.tsv' : '.csv'}
                multiple={viewMode === 'INVOICES'}
              />
            )}
        </div>
      )}

      {/* DATA DASHBOARD */}
      {hasData && (
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div id="printable-content" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            
            <div className="mb-8 border-b pb-6 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  {viewMode === 'EXPENSES' && 'Synthèse Dépenses & TVA'}
                  {viewMode === 'SALES' && 'Justificatif de Recettes'}
                  {viewMode === 'INVOICES' && 'Synthèse Factures Fournisseurs'}
                  {viewMode === 'MEMO' && 'Documentation Technique'}
                  <span className={`${viewMode === 'EXPENSES' ? 'text-sky-600' : viewMode === 'SALES' ? 'text-yellow-600' : 'text-purple-600'} ml-2`}>{dateInfo.displayTitle}</span>
                </h1>
                <p className="text-sm text-gray-500 mt-1">Généré le {new Date().toLocaleDateString()}</p>
              </div>
              {viewMode === 'INVOICES' && (
                 <div className="text-right">
                   <div className="text-xs uppercase text-slate-500 font-bold tracking-wider">Total Frais Détectés</div>
                   <div className="text-2xl font-bold text-purple-600">{currency.format(invoicesStats.grandTotalHT)} HT</div>
                   <div className="text-sm text-slate-500">TVA: {currency.format(invoicesStats.grandTotalTVA)}</div>
                 </div>
              )}
            </div>

            {/* EXPENSES DASHBOARD (CSV) */}
            {viewMode === 'EXPENSES' && (
              <>
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1 px-1">À classer</h2>
                    <SummaryCard variant="slate" title="Non reconnu" amountHT={expenseStats.uncategorized.normal.ht + expenseStats.uncategorized.auto.ht} amountTVA={expenseStats.uncategorized.normal.tva + expenseStats.uncategorized.auto.tva} count={expenseStats.uncategorized.normal.count + expenseStats.uncategorized.auto.count} isActive={activeFilter?.cat === ExpenseCategory.UNCATEGORIZED} onClick={() => toggleFilter(ExpenseCategory.UNCATEGORIZED)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">Consommable</h2>
                    <SummaryCard variant="blue-normal" title="TVA Payée" amountHT={expenseStats.consommable.normal.ht} amountTVA={expenseStats.consommable.normal.tva} count={expenseStats.consommable.normal.count} isActive={activeFilter?.cat === ExpenseCategory.CONSUMABLE && activeFilter?.mode === TaxMode.NORMAL} onClick={() => toggleFilter(ExpenseCategory.CONSUMABLE, TaxMode.NORMAL)} />
                    <SummaryCard variant="blue-auto" title="Autoliquidation" amountHT={expenseStats.consommable.auto.ht} amountTVA={expenseStats.consommable.auto.tva} count={expenseStats.consommable.auto.count} isActive={activeFilter?.cat === ExpenseCategory.CONSUMABLE && activeFilter?.mode === TaxMode.AUTOLIQUIDATION} onClick={() => toggleFilter(ExpenseCategory.CONSUMABLE, TaxMode.AUTOLIQUIDATION)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">Service</h2>
                    <SummaryCard variant="pink-normal" title="TVA Payée" amountHT={expenseStats.service.normal.ht} amountTVA={expenseStats.service.normal.tva} count={expenseStats.service.normal.count} isActive={activeFilter?.cat === ExpenseCategory.SERVICE && activeFilter?.mode === TaxMode.NORMAL} onClick={() => toggleFilter(ExpenseCategory.SERVICE, TaxMode.NORMAL)} />
                    <SummaryCard variant="pink-auto" title="Autoliquidation" amountHT={expenseStats.service.auto.ht} amountTVA={expenseStats.service.auto.tva} count={expenseStats.service.auto.count} isActive={activeFilter?.cat === ExpenseCategory.SERVICE && activeFilter?.mode === TaxMode.AUTOLIQUIDATION} onClick={() => toggleFilter(ExpenseCategory.SERVICE, TaxMode.AUTOLIQUIDATION)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">Immobilisation</h2>
                    <SummaryCard variant="green-normal" title="TVA Payée" amountHT={expenseStats.asset.normal.ht} amountTVA={expenseStats.asset.normal.tva} count={expenseStats.asset.normal.count} isActive={activeFilter?.cat === ExpenseCategory.ASSET && activeFilter?.mode === TaxMode.NORMAL} onClick={() => toggleFilter(ExpenseCategory.ASSET, TaxMode.NORMAL)} />
                    <SummaryCard variant="green-auto" title="Autoliquidation" amountHT={expenseStats.asset.auto.ht} amountTVA={expenseStats.asset.auto.tva} count={expenseStats.asset.auto.count} isActive={activeFilter?.cat === ExpenseCategory.ASSET && activeFilter?.mode === TaxMode.AUTOLIQUIDATION} onClick={() => toggleFilter(ExpenseCategory.ASSET, TaxMode.AUTOLIQUIDATION)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">Ignorés</h2>
                    <SummaryCard variant="slate" title="Total Ignoré" amountHT={expenseStats.ignored.ht} amountTVA={expenseStats.ignored.tva} count={expenseStats.ignored.count} isActive={activeFilter?.cat === ExpenseCategory.IGNORED} onClick={() => toggleFilter(ExpenseCategory.IGNORED)} />
                  </div>
                </div>

                {hasData && (
                  <div className="flex justify-between items-center mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                     <div className="flex gap-2">
                        <button 
                           onClick={categorizeWithAI} 
                           disabled={isAiLoading || (expenseStats.uncategorized.normal.count + expenseStats.uncategorized.auto.count === 0)}
                           className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-all
                              ${isAiLoading ? 'bg-slate-400 cursor-wait' : 
                              (expenseStats.uncategorized.normal.count + expenseStats.uncategorized.auto.count > 0) ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 hover:-translate-y-0.5' : 'bg-slate-300 opacity-50 cursor-not-allowed'}`}
                        >
                           {isAiLoading ? 'Analyse en cours...' : '✨ Catégoriser avec l\'IA'}
                        </button>
                     </div>
                     <button onClick={memorizeAll} className="px-4 py-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-sm">
                        💾 Tout Mémoriser
                     </button>
                  </div>
                )}

                <div className="border-t pt-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800 text-slate-900 uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-3 w-24">Date</th>
                        <th className="px-3 py-3 w-48">Justificatif</th>
                        <th className="px-3 py-3">Contrepartie</th>
                        <th className="px-3 py-3 text-right">HT</th>
                        <th className="px-3 py-3 text-right">TVA</th>
                        <th className="px-3 py-3 text-right">Total</th>
                        <th className="px-3 py-3">Catégorie</th>
                        <th className="px-3 py-3">Régime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((t) => (
                          <tr key={t.id} className={`${getRowColor(t, t.category === ExpenseCategory.IGNORED)} border-b border-slate-200`}>
                            <td className="px-3 py-2 font-mono whitespace-nowrap opacity-80">{t.date}</td>
                            <td className="px-3 py-2">{t.invoiceTitle || <span className="opacity-30">-</span>}</td>
                            <td className="px-3 py-2 font-bold truncate max-w-[180px]">{t.counterparty}</td>
                            <td className="px-3 py-2 text-right">{currency.format(t.amountHT)}</td>
                            <td className="px-3 py-2 text-right">{currency.format(t.amountTVA)}</td>
                            <td className="px-3 py-2 text-right opacity-70">{currency.format(t.totalAmount)}</td>
                            <td className="px-3 py-2">
                              {isPdfMode ? t.category : (
                                <div className="flex flex-col gap-1">
                                  <select value={t.category} onChange={(e) => updateTransaction(t.id, 'category', e.target.value)} className={`bg-white/50 border rounded px-1 py-1 text-[10px] w-full ${t.category === ExpenseCategory.UNCATEGORIZED ? 'border-orange-400 text-orange-700 font-bold' : ''}`}>
                                    <option value={ExpenseCategory.UNCATEGORIZED}>À classer</option>
                                    <option value={ExpenseCategory.CONSUMABLE}>Conso.</option>
                                    <option value={ExpenseCategory.SERVICE}>Service</option>
                                    <option value={ExpenseCategory.ASSET}>Immo.</option>
                                    <option value={ExpenseCategory.IGNORED}>Ignoré</option>
                                  </select>
                                  {t.category !== ExpenseCategory.UNCATEGORIZED && (
                                    <button onClick={() => addRule(t.counterparty, t.category, t.taxMode)} className="text-[9px] text-sky-600 hover:text-sky-800 text-left underline">Mémoriser</button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                               {isPdfMode ? (t.taxMode === TaxMode.AUTOLIQUIDATION ? 'Autoliq.' : 'Normal') : (
                                <select value={t.taxMode} onChange={(e) => updateTransaction(t.id, 'taxMode', e.target.value)} className="bg-white/50 border rounded px-1 py-1 text-[10px] w-full">
                                  <option value={TaxMode.NORMAL}>Normal</option>
                                  <option value={TaxMode.AUTOLIQUIDATION}>Autoliq.</option>
                                </select>
                              )}
                            </td>
                          </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-800 text-white font-bold uppercase">
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-right">Total</td>
                        <td className="px-3 py-3 text-right text-emerald-300">{currency.format(footerTotals.ht)}</td>
                        <td className="px-3 py-3 text-right text-emerald-300">{currency.format(footerTotals.tva)}</td>
                        <td className="px-3 py-3 text-right text-emerald-300">{currency.format(footerTotals.total)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}

            {/* SALES DASHBOARD (AMAZON) */}
            {viewMode === 'SALES' && (
              <div className="border-t pt-4">
                 <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 mt-6">
                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400"></div>
                       <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-widest mb-1">CA HT Global</p>
                       <p className="text-xl font-extrabold text-yellow-600 my-1">{currency.format(salesStats.totalHT)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">TVA Collectée</p>
                       <p className="text-xl font-bold text-slate-700 my-1">{currency.format(salesStats.totalTVA)}</p>
                       <p className="text-[10px] text-slate-500 font-medium">{getPercentageOfCA(salesStats.totalTVA)} du CA TTC</p>
                       <p className="text-[8px] text-slate-700 mt-1 italic">(Normal: 16.6% du TTC = 20% du HT)</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm flex flex-col items-center justify-center text-center">
                       <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Remboursements</p>
                       <p className="text-xl font-bold text-red-600 my-1">-{currency.format(salesStats.totalRefunds)}</p>
                       <p className="text-[10px] text-red-400 font-medium">{getPercentageOfCA(salesStats.totalRefunds)} du CA TTC</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Frais Amazon</p>
                       <p className="text-xl font-bold text-slate-700 my-1">{currency.format(salesStats.fraisAmazon)}</p>
                       <p className="text-[10px] text-slate-500 font-medium">{getPercentageOfCA(salesStats.fraisAmazon)} du CA TTC</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-1 bg-green-400"></div>
                       <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1">Net à verser</p>
                       <p className="text-xl font-extrabold text-green-600 my-1">{currency.format(salesStats.netPayout)}</p>
                    </div>
                    <div className="bg-emerald-100 p-4 rounded-xl border border-emerald-300 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden md:col-span-5">
                       <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                       <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-1">Bénéfice Net Réel Estimé (Net-Net)</p>
                       <p className="text-2xl font-extrabold text-emerald-700 my-1">{currency.format(netNetProfit)}</p>
                       <p className="text-[10px] text-emerald-600 font-medium mt-1">* Hors TVA récupérable sur vos achats</p>
                    </div>
                 </div>
                 
                 <div className="mb-8 bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-6 text-white">
                    <div className="flex items-center gap-2 mb-4">
                       <AlertTriangle className="text-yellow-400" size={20} />
                       <h3 className="text-sm font-bold uppercase tracking-wide">Aide à la déclaration TVA (Formulaire CA3)</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-6 italic">Utilisez ces montants HT pour remplir vos cases de déclaration. Cela évite de payer 20% sur vos ventes export/UE.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                          <div className="flex justify-between items-start mb-2">
                             <span className="bg-sky-500 text-[10px] font-bold px-1.5 py-0.5 rounded">Case A1</span>
                             <span className="text-[10px] text-slate-500 uppercase font-bold">Ventes France</span>
                          </div>
                          <p className="text-xl font-mono font-bold text-sky-300">{currency.format(ca3Summary.A1)}</p>
                          <p className="text-[10px] text-slate-500 mt-1">Soumis à 20% de TVA</p>
                       </div>

                       <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                          <div className="flex justify-between items-start mb-2">
                             <span className="bg-emerald-500 text-[10px] font-bold px-1.5 py-0.5 rounded">Case F2</span>
                             <span className="text-[10px] text-slate-500 uppercase font-bold">Ventes UE / Export</span>
                          </div>
                          <p className="text-xl font-mono font-bold text-emerald-300">{currency.format(ca3Summary.F2)}</p>
                          <p className="text-[10px] text-slate-500 mt-1">TVA à 0% (Intracommunautaire / Export)</p>
                       </div>
                    </div>
                 </div>

                 <div className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                       <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Détail des Frais Amazon</h3>
                       <div className="bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 text-right">
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Coût Total Amazon</p>
                          <p className="text-lg font-bold text-slate-800 leading-none">
                             {currency.format(salesStats.fraisAmazon)} <span className="text-sm text-slate-500 font-normal">({getPercentageOfCA(salesStats.fraisAmazon)} du CA TTC)</span>
                          </p>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-500 font-medium">Frais de vente (Commissions)</p>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-700">{currency.format(salesStats.fraisVente)}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{getPercentageOfCA(salesStats.fraisVente)} du CA TTC</p>
                          </div>
                       </div>
                       <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-500 font-medium">Frais d'expédition (FBA)</p>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-700">{currency.format(salesStats.fraisFBA)}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{getPercentageOfCA(salesStats.fraisFBA)} du CA TTC</p>
                          </div>
                       </div>
                       <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-500 font-medium">Autres frais de transaction</p>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-700">{currency.format(salesStats.autresFrais)}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{getPercentageOfCA(salesStats.autresFrais)} du CA TTC</p>
                          </div>
                       </div>
                       <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-500 font-medium">Frais de service (Publicité, etc.)</p>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-700">{currency.format(salesStats.fraisService)}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{getPercentageOfCA(salesStats.fraisService)} du CA TTC</p>
                          </div>
                       </div>
                       <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-500 font-medium">Frais de stockage FBA</p>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-700">{currency.format(salesStats.fraisStock)}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{getPercentageOfCA(salesStats.fraisStock)} du CA TTC</p>
                          </div>
                       </div>
                       <div 
                          className={`flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-200 transition-colors ${showAdjustments ? 'md:col-span-2 lg:col-span-3' : ''}`}
                          onClick={() => setShowAdjustments(!showAdjustments)}
                       >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500 font-medium">Ajustements & Soldes</p>
                              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showAdjustments ? 'rotate-180' : ''}`} />
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-700">{currency.format(salesStats.fraisAjustement)}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{getPercentageOfCA(salesStats.fraisAjustement)} du CA TTC</p>
                            </div>
                          </div>
                          
                          {showAdjustments && adjustmentsList.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200 w-full">
                              <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {adjustmentsList.map((adj, i) => (
                                  <li key={i} className="flex justify-between items-start text-[10px]">
                                    <div className="flex flex-col">
                                      <span className="text-slate-700 font-medium">{adj.date} {adj.orderId !== 'N/A' ? `- ${adj.orderId}` : ''}</span>
                                      <span className="text-slate-500">{simplifyAdjustmentDescription(adj.productName)}</span>
                                    </div>
                                    <span className={`font-bold whitespace-nowrap ml-2 ${adj.total > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {adj.total > 0 ? '+' : ''}{currency.format(adj.total)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                       <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wide">Répartition du CA par Famille</h3>
                       <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                             <Pie
                               data={familyProfitability.filter(f => f.caHT > 0)}
                               cx="50%"
                               cy="50%"
                               innerRadius={60}
                               outerRadius={80}
                               paddingAngle={5}
                               dataKey="caHT"
                               nameKey="name"
                             >
                               {familyProfitability.filter(f => f.caHT > 0).map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={['#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#f43f5e', '#64748b'][index % 6]} />
                               ))}
                             </Pie>
                             <Tooltip formatter={(value: number) => currency.format(value)} />
                             <Legend />
                           </PieChart>
                         </ResponsiveContainer>
                       </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                       <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wide">Synthèse par Famille de Produits</h3>
                       <div className="overflow-x-auto">
                         <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-3 w-auto">Famille</th>
                                <th className="px-3 py-3 w-24 text-center">Qté Nette</th>
                                <th className="px-3 py-3 text-right w-32">CA HT</th>
                                <th className="px-3 py-3 text-right w-32">Bénéfice Net</th>
                                <th className="px-3 py-3 text-right w-24">Marge</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {familyProfitability.map((fam, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-bold text-slate-800">{fam.name}</td>
                                  <td className="px-3 py-2 text-center font-medium text-slate-700">{fam.netQuantity}</td>
                                  <td className="px-3 py-2 text-right text-slate-700">{currency.format(fam.caHT)}</td>
                                  <td className={`px-3 py-2 text-right font-bold ${fam.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                     {currency.format(fam.netProfit)}
                                  </td>
                                  <td className={`px-3 py-2 text-right font-medium ${fam.netMargin >= 20 ? 'text-emerald-600' : fam.netMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                                     {fam.netMargin.toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                         </table>
                       </div>
                    </div>
                 </div>

                 <div className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                       <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Rentabilité par Produit</h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                         <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                           <tr>
                             <th className="px-3 py-3 w-auto cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                               Produit {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                             </th>
                             <th className="px-3 py-3 w-24 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('sku')}>
                               SKU {sortConfig?.key === 'sku' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                             </th>
                             <th className="px-3 py-3 w-16 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('netQuantity')}>
                               Qté Nette {sortConfig?.key === 'netQuantity' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                             </th>
                             <th className="px-3 py-3 w-24 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('returnRate')}>
                               Retours {sortConfig?.key === 'returnRate' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                             </th>
                             <th className="px-3 py-3 text-right w-24 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('refundAmount')}>
                               Remboursements {sortConfig?.key === 'refundAmount' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                             </th>
                             <th className="px-3 py-3 text-right w-24 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('netProfit')}>
                               Bénéfice Net {sortConfig?.key === 'netProfit' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                             </th>
                             <th className="px-3 py-3 text-right w-20 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('netMargin')}>
                               Marge {sortConfig?.key === 'netMargin' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                             </th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                           {sortedProductProfitability.map((prod, idx) => (
                             <tr key={idx} className="hover:bg-slate-50">
                               <td className="px-3 py-2"><div className="truncate font-medium text-slate-800 max-w-[250px]" title={prod.name}>{prod.name}</div></td>
                               <td className="px-3 py-2 font-mono text-slate-500 truncate">{prod.sku}</td>
                               <td className="px-3 py-2 text-center font-bold text-slate-700">{prod.netQuantity}</td>
                               <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${prod.returnRate > 10 ? 'bg-red-100 text-red-700' : prod.returnRate > 5 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                    {prod.refundLines} ({prod.returnRate.toFixed(1)}%)
                                  </span>
                               </td>
                               <td className="px-3 py-2 text-right text-red-600 font-medium">
                                  {prod.refundAmount > 0 ? `-${currency.format(prod.refundAmount)}` : '-'}
                               </td>
                               <td className={`px-3 py-2 text-right font-bold ${prod.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {currency.format(prod.netProfit)}
                               </td>
                               <td className={`px-3 py-2 text-right font-medium ${prod.netMargin >= 20 ? 'text-emerald-600' : prod.netMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {prod.netMargin.toFixed(1)}%
                               </td>
                             </tr>
                           ))}
                         </tbody>
                      </table>
                    </div>
                 </div>

                 <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide">Détails des transactions</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                         <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                           <tr>
                             <th className="px-3 py-3 w-24">Date</th>
                             <th className="px-3 py-3 w-32">N° Commande</th>
                             <th className="px-3 py-3 w-32">Type</th>
                             <th className="px-3 py-3 w-auto">Description</th>
                             <th className="px-3 py-3 w-16 text-center">Qté</th>
                             <th className="px-3 py-3 text-right w-24">Total TTC</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                           {sales.map((sale, idx) => (
                             <tr key={idx} className="hover:bg-slate-50">
                               <td className="px-3 py-2 text-slate-500">{sale.date}</td>
                               <td className="px-3 py-2 font-mono text-slate-500 truncate">{sale.orderId}</td>
                               <td className="px-3 py-2">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                                     sale.type === 'Commande' ? 'bg-green-100 text-green-700' :
                                     sale.type === 'Remboursement' ? 'bg-red-100 text-red-700' :
                                     'bg-slate-100 text-slate-700'
                                  }`}>
                                     {sale.type}
                                  </span>
                               </td>
                               <td className="px-3 py-2"><div className="truncate font-medium text-slate-800 max-w-[300px]" title={sale.productName}>{sale.productName || '-'}</div></td>
                               <td className="px-3 py-2 text-center font-bold text-slate-700">{sale.quantity > 0 ? sale.quantity : '-'}</td>
                               <td className="px-3 py-2 text-right font-medium text-slate-700">
                                  {currency.format(sale.type === 'Commande' || sale.type === 'Remboursement' ? sale.priceTTC : sale.total)}
                               </td>
                             </tr>
                           ))}
                         </tbody>
                      </table>
                    </div>
                 </div>

                 {isPdfMode && adjustmentsList.length > 0 && (
                   <div className="mt-8 break-inside-avoid">
                     <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide border-b border-slate-200 pb-2">Détail des indemnisations Amazon</h3>
                     <table className="w-full text-left border-collapse">
                       <thead>
                         <tr className="border-b border-slate-200">
                           <th className="py-2 text-xs font-bold text-slate-700">Date</th>
                           <th className="py-2 text-xs font-bold text-slate-700">Commande</th>
                           <th className="py-2 text-xs font-bold text-slate-700">Description</th>
                           <th className="py-2 text-right text-xs font-bold text-slate-700">Montant</th>
                         </tr>
                       </thead>
                       <tbody>
                         {adjustmentsList.map((adj, i) => (
                           <tr key={i} className="border-b border-slate-100">
                             <td className="py-2 text-xs text-slate-700">{adj.date}</td>
                             <td className="py-2 text-xs text-slate-700">{adj.orderId !== 'N/A' ? adj.orderId : '-'}</td>
                             <td className="py-2 text-xs text-slate-700">{simplifyAdjustmentDescription(adj.productName)}</td>
                             <td className={`py-2 text-right text-xs font-bold ${adj.total > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                               {adj.total > 0 ? '+' : ''}{currency.format(adj.total)}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}
              </div>
            )}

            {/* INVOICES DASHBOARD (PDF) */}
            {viewMode === 'INVOICES' && (
              <div className="pt-4">
                 
                 {/* Grouped Summary */}
                 <div className="mb-8 grid grid-cols-3 gap-4">
                    {Object.values(invoicesStats.groups).map((group: InvoiceSummary, idx) => (
                      <div key={idx} className="bg-purple-50 border border-purple-100 p-4 rounded-lg">
                         <h3 className="font-bold text-purple-900 text-sm mb-2 h-10 flex items-center">{group.category}</h3>
                         <div className="flex justify-between items-end">
                            <div>
                               <p className="text-xl font-bold text-purple-800">{currency.format(group.totalHT)} <span className="text-xs font-normal text-purple-600">HT</span></p>
                               <p className="text-xs text-purple-500">TVA: {currency.format(group.totalTVA)}</p>
                            </div>
                            <span className="bg-white text-purple-600 px-2 py-1 rounded text-xs font-bold shadow-sm">{group.count} docs</span>
                         </div>
                      </div>
                    ))}
                 </div>

                 <h2 className="font-semibold text-slate-800 text-sm mb-3 uppercase tracking-wide flex items-center gap-2">
                    <Files size={16} />
                    Détail des fichiers analysés
                 </h2>

                 <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-purple-600 text-white uppercase border-b border-purple-700">
                      <tr>
                        <th className="px-3 py-3 w-28">Date (Détectée)</th>
                        <th className="px-3 py-3">Fichier</th>
                        <th className="px-3 py-3">Catégorie</th>
                        <th className="px-3 py-3 text-right">Montant HT</th>
                        <th className="px-3 py-3 text-right">Montant TVA</th>
                        <th className="px-3 py-3 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-purple-50 even:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-slate-700">{inv.date}</td>
                          <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px] truncate" title={inv.filename}>{inv.filename}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded-full text-[10px] border ${
                                inv.category === 'ERREUR' ? 'bg-red-100 text-red-700 border-red-200' : 
                                inv.category.includes('Avoir') ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                'bg-purple-100 text-purple-700 border-purple-200'
                            }`}>
                              {inv.category}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-700">{currency.format(inv.amountHT)}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{currency.format(inv.amountTVA)}</td>
                          <td className="px-3 py-2 text-center">
                            {inv.error ? (
                               <span className="text-red-500 flex justify-center" title={inv.error}><AlertTriangle size={14}/></span>
                            ) : (
                               <span className="text-green-500 font-bold">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
              </div>
            )}

            {/* MEMOS DASHBOARD */}
            {viewMode === 'MEMO' && (
              <div className="pt-4">
                
                {/* DEPLOYMENT SECTION */}
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <RefreshCw size={24} className="text-indigo-500" /> Cycle de Déploiement
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
                  {/* PC to GIT */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span> 
                      Du PC vers Git (Sauvegarde Code)
                    </h4>
                    <p className="text-sm text-slate-500 mb-4">Ouvrez une Invite de Commande ou PowerShell sur votre PC. Il faut d'abord se placer dans le bon dossier avant de sauvegarder :</p>
                    <div className="bg-slate-900 text-slate-300 p-4 rounded-lg font-mono text-xs mb-4 overflow-x-auto whitespace-pre">
{`# 1. Aller sur le disque D: et se placer dans le dossier
d:
cd "D:\\OneDrive\\Documents\\1. Projets & Création\\3DMatch\\01 - Administration\\Docker_compta\\ComptaTVA-Auto"

# 2. Sauvegarder et envoyer vers Git
git add .
git commit -m "Mise à jour"
git push origin master`}
                    </div>
                    <a href="https://github.com/babao60/ComptaTVA-Auto" target="_blank" rel="noreferrer" className="text-sm text-slate-600 hover:text-indigo-600 flex items-center gap-2 font-medium">
                      <ExternalLink size={16} /> Voir le projet sur GitHub
                    </a>
                  </div>

                  {/* GIT to NAS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span> 
                      De Git vers NAS (Mise en ligne)
                    </h4>
                    <p className="text-sm text-slate-500 mb-4">Connectez-vous en SSH sur votre NAS pour récupérer le code et redémarrer l'application :</p>
                    <div className="bg-slate-900 text-slate-300 p-4 rounded-lg font-mono text-xs mb-4 overflow-x-auto whitespace-pre">
{`cd /volume1/@appdata/ContainerManager/all_shares/docker/ComptaTVA-Auto
git pull origin master
sudo docker compose build
sudo docker compose up -d`}
                    </div>
                    <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded">Astuce : Si le port est bloqué, modifiez le fichier <code className="bg-slate-200 px-1 rounded">docker-compose.yml</code>.</p>
                  </div>
                </div>

                {/* DATA BACKUP SECTION */}
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <HardDrive size={24} className="text-emerald-500" /> Sauvegarde des Données (Règles IA)
                </h3>
                
                <p className="text-slate-600 mb-6 max-w-3xl">Votre code source est en sécurité sur Git, mais <strong>vos règles personnalisées sont stockées uniquement sur votre NAS</strong>. Il est fortement recommandé de télécharger régulièrement une copie de votre base de données de règles.</p>
                
                <button onClick={downloadRules} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-lg shadow-sm flex items-center gap-2 mb-8 transition-colors">
                  <Download size={20} /> Télécharger rules.json
                </button>

                <div className="bg-slate-800 text-slate-200 p-6 rounded-xl border border-slate-700 shadow-md">
                  <h4 className="font-bold text-lg text-white mb-4">Comment restaurer l'application en cas de problème ?</h4>
                  <ol className="list-decimal pl-5 space-y-3 text-sm text-slate-300 mb-6">
                    <li>Installez le dossier de l'application (depuis Git) sur votre nouveau NAS.</li>
                    <li>Créez un fichier <code className="bg-slate-900 px-1 rounded text-pink-400">.env</code> avec votre clé `GEMINI_API_KEY`.</li>
                    <li>Placez le fichier <code className="bg-slate-900 px-1 rounded text-emerald-400">rules.json</code> que vous avez téléchargé dans le sous-dossier <code className="bg-slate-900 px-1 rounded text-emerald-400">data/</code> de l'application.</li>
                    <li>Lancez l'application via Container Manager ou SSH : <code className="bg-slate-900 px-1 py-0.5 rounded text-white">sudo docker compose up -d</code>.</li>
                  </ol>
                  <p className="text-xs text-slate-400 italic">Pour automatiser ces sauvegardes, utilisez l'application <strong>Synology Hyper Backup</strong> pour sauvegarder le dossier <code className="bg-slate-900 px-1 rounded">data/</code> de l'application sur un disque dur externe ou dans le Cloud.</p>
                </div>

              </div>
            )}
        </div>
      </div>
      )}
      {/* RULES MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Règles de catégorisation ({rules.length})</h2>
              <button onClick={() => setShowRulesModal(false)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {rules.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Aucune règle personnalisée.<br/>Modifiez une catégorie dans le tableau et cliquez sur "Mémoriser" pour en ajouter.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                    <tr>
                      <th className="px-4 py-2">Mot-clé (Contient)</th>
                      <th className="px-4 py-2">Catégorie cible</th>
                      <th className="px-4 py-2">TVA</th>
                      <th className="px-4 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map(r => (
                      <tr key={r.id} className={`border-b border-slate-200 ${getRowColor(r as any, r.category === ExpenseCategory.IGNORED)}`}>
                        <td className="px-4 py-2 font-bold text-slate-700">{r.keyword}</td>
                        <td className="px-4 py-2">
                          <select value={r.category} onChange={(e) => updateRule(r.id, 'category', e.target.value)} className={`bg-white/50 border rounded px-2 py-1 text-xs w-full ${r.category === ExpenseCategory.UNCATEGORIZED ? 'border-orange-400 text-orange-700 font-bold' : 'border-slate-300'}`}>
                            <option value={ExpenseCategory.UNCATEGORIZED}>À classer</option>
                            <option value={ExpenseCategory.CONSUMABLE}>Conso.</option>
                            <option value={ExpenseCategory.SERVICE}>Service</option>
                            <option value={ExpenseCategory.ASSET}>Immo.</option>
                            <option value={ExpenseCategory.IGNORED}>Ignoré</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <select value={r.taxMode} onChange={(e) => updateRule(r.id, 'taxMode', e.target.value)} className="bg-white/50 border border-slate-300 rounded px-2 py-1 text-xs w-full">
                            <option value={TaxMode.NORMAL}>Normal</option>
                            <option value={TaxMode.AUTOLIQUIDATION}>Autoliq.</option>
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => removeRule(r.id)} className="text-red-500 hover:text-red-700 text-xs font-bold">Supprimer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50">
               <p className="text-xs text-slate-500">Les règles sont appliquées automatiquement lors de l'import d'un nouveau fichier CSV. Elles sont sauvegardées dans votre dossier OneDrive et partagées avec vos autres appareils.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
