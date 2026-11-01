import { useState } from 'react';
import { Plus } from 'lucide-react';

interface Category { id: number; name: string; type: 'income' | 'expense' }
interface Props {
  categories: Category[];
  value: string;
  type: 'income' | 'expense';
  onChange: (value: string) => void;
  onCreated: (category: Category) => void;
}

export default function CategoryPicker({ categories, value, type, onChange, onCreated }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const add = async () => {
    const clean = name.trim().toLowerCase().replace(/\s+/g, '_');
    if (!clean || saving) return;
    const existing = categories.find(c => c.name.toLowerCase() === clean);
    if (existing) { onChange(existing.name); setAdding(false); setName(''); return; }
    setSaving(true); setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: clean, type })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not add category');
      onCreated(data); onChange(data.name); setName(''); setAdding(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add category'); }
    finally { setSaving(false); }
  };
  return <fieldset>
    <div className="flex items-center justify-between mb-1.5">
      <legend className="text-[13px] font-medium text-zinc-700">Category</legend>
      <button type="button" onClick={() => setAdding(!adding)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><Plus size={14} /> Add category</button>
    </div>
    <div className="grid grid-cols-3 gap-[10px]" role="group" aria-label="Category">
      {categories.map(cat => <button key={cat.id} type="button" aria-pressed={value === cat.name} onClick={() => onChange(cat.name)}
        className={`min-w-0 rounded-lg border px-2 py-2 text-[10px] leading-4 break-words capitalize focus-visible:outline-2 focus-visible:outline-emerald-500 ${value === cat.name ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-emerald-400'}`}>
        {cat.name.replace(/_/g, ' ')}
      </button>)}
    </div>
    {!categories.length && <p className="text-xs text-zinc-500 mt-2">No categories yet. Add a category to get started.</p>}
    {adding && <div className="mt-3 flex gap-2">
      <input aria-label="New category name" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Category name" className="min-w-0 flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
      <button type="button" disabled={saving || !name.trim()} onClick={add} className="rounded-lg bg-emerald-600 text-white px-3 text-xs disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button>
    </div>}
    {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
  </fieldset>;
}
