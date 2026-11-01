import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { categoryName } from '../utils/category';

interface Category { id: number; name: string; type: 'income' | 'expense'; is_default?: number | boolean }
interface Props {
  categories: Category[];
  value: string;
  type: 'income' | 'expense';
  onChange: (value: string) => void;
  onCreated: (category: Category) => void;
  onRemoved: (category: Category) => void;
}

export default function CategoryPicker({ categories, value, type, onChange, onCreated, onRemoved }: Props) {
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const add = async () => {
    let clean: string;
    try { clean = categoryName(name); } catch (e) { setError((e as Error).message); return; }
    if (!clean || saving) return;
    const existing = categories.find(c => c.type === type && c.name.toLowerCase() === clean);
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
  const remove = async (category: Category) => {
    if (saving || !confirm(`Remove category "${category.name.replace(/_/g, ' ')}"?`)) return;
    setSaving(true); setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/categories/${category.id}`, {
        method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not remove category');
      onRemoved(category);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove category'); }
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
    <button type="button" onClick={() => { setManaging(!managing); setError(''); }} className="mt-2 text-xs text-zinc-600 underline">{managing ? 'Done managing' : 'Manage categories'}</button>
    {managing && <div className="mt-2 space-y-2">
      <p className="text-xs text-zinc-500">Remove unused custom categories. Default categories and categories used in transactions are protected.</p>
      {categories.filter(cat => cat.type === type && !cat.is_default).map(cat => <div key={cat.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2">
        <span className="text-xs capitalize break-words">{cat.name.replace(/_/g, ' ')}</span>
        <button type="button" disabled={saving} aria-label={`Remove ${cat.name.replace(/_/g, ' ')}`} onClick={() => remove(cat)} className="text-rose-600 disabled:opacity-50 p-1"><Trash2 size={15} /></button>
      </div>)}
    </div>}
    {!categories.length && <p className="text-xs text-zinc-500 mt-2">No categories yet. Add a category to get started.</p>}
    {adding && <div className="mt-3 flex gap-2">
      <input aria-label="New category name" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Category name" className="min-w-0 flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
      <button type="button" disabled={saving || !name.trim()} onClick={add} className="rounded-lg bg-emerald-600 text-white px-3 text-xs disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button>
    </div>}
    {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
  </fieldset>;
}
