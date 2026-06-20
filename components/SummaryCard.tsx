import React from 'react';

interface SummaryCardProps {
  title: string;
  amountHT: number;
  amountTVA: number;
  count: number;
  // On utilise des clés plus descriptives pour le style
  variant: 'blue-normal' | 'blue-auto' | 'pink-normal' | 'pink-auto' | 'green-normal' | 'green-auto' | 'slate';
  isActive: boolean;
  onClick: () => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, amountHT, amountTVA, count, variant, isActive, onClick }) => {
  
  // Définition des styles basés sur l'image utilisateur
  const styles = {
    'blue-normal': {
      base: 'bg-sky-300 border-sky-500 text-sky-950',
      active: 'ring-2 ring-sky-600 ring-offset-1 font-bold shadow-md transform scale-[1.02]',
      inactive: 'hover:bg-sky-400 opacity-90'
    },
    'blue-auto': {
      base: 'bg-sky-100 border-sky-300 text-sky-900',
      active: 'ring-2 ring-sky-400 ring-offset-1 font-bold shadow-md transform scale-[1.02]',
      inactive: 'hover:bg-sky-200 opacity-90'
    },
    'pink-normal': {
      base: 'bg-fuchsia-300 border-fuchsia-500 text-fuchsia-950',
      active: 'ring-2 ring-fuchsia-600 ring-offset-1 font-bold shadow-md transform scale-[1.02]',
      inactive: 'hover:bg-fuchsia-400 opacity-90'
    },
    'pink-auto': {
      base: 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-900',
      active: 'ring-2 ring-fuchsia-400 ring-offset-1 font-bold shadow-md transform scale-[1.02]',
      inactive: 'hover:bg-fuchsia-200 opacity-90'
    },
    'green-normal': {
      base: 'bg-emerald-300 border-emerald-500 text-emerald-950',
      active: 'ring-2 ring-emerald-600 ring-offset-1 font-bold shadow-md transform scale-[1.02]',
      inactive: 'hover:bg-emerald-400 opacity-90'
    },
    'green-auto': {
      base: 'bg-emerald-100 border-emerald-300 text-emerald-900',
      active: 'ring-2 ring-emerald-400 ring-offset-1 font-bold shadow-md transform scale-[1.02]',
      inactive: 'hover:bg-emerald-200 opacity-90'
    },
    'slate': {
      base: 'bg-slate-200 border-slate-400 text-slate-700',
      active: 'ring-2 ring-slate-500 ring-offset-1 font-bold shadow-md',
      inactive: 'hover:bg-slate-300'
    }
  };

  const currentStyle = styles[variant];
  const stateClass = isActive ? currentStyle.active : currentStyle.inactive;

  const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

  return (
    <div 
      onClick={onClick}
      className={`p-3 rounded-md shadow-sm border-l-4 cursor-pointer transition-all duration-200 mb-2 last:mb-0 ${currentStyle.base} ${stateClass}`}
    >
      <div className="flex justify-between items-start">
        <h3 className="text-xs uppercase tracking-wide opacity-80">{title}</h3>
      </div>
      <p className="text-xl font-bold mt-1">{currency.format(amountHT)} <span className="text-[10px] font-normal opacity-70">HT</span></p>
      <div className="mt-1 flex justify-between items-end border-t border-black/10 pt-1">
        <div>
           <p className="text-[10px] font-medium">TVA: {currency.format(amountTVA)}</p>
        </div>
        <span className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded font-mono shadow-sm">{count}</span>
      </div>
    </div>
  );
};