import { useState, useEffect } from 'react';
import { History as HistoryIcon, Trash2, Edit, RefreshCw, Filter, Receipt, Users, Car } from 'lucide-react';
import { formatDateTime } from '../utils/date';

interface ActivityRow {
  id: number;
  entity_type: string;
  entity_id: string | null;
  action: 'update' | 'delete';
  description: string;
  old_data: string | null;
  new_data: string | null;
  username: string | null;
  created_at: string;
}

const entityIcon = (type: string) =>
  type === 'transaction' ? Receipt : type === 'driver' ? Users : type === 'rickshaw' ? Car : Receipt;

// Fields worth showing in the before/after diff, per entity type
const DIFF_FIELDS: Record<string, string[]> = {
  transaction: ['date', 'type', 'category', 'amount', 'notes', 'rickshaw_id', 'driver_id'],
  driver: ['name', 'phone', 'join_date', 'status'],
  rickshaw: ['number', 'purchase_date', 'investment_cost', 'status'],
};

export default function History() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchHistory = () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const params = new URLSearchParams();
    if (entityFilter !== 'all') params.set('entity_type', entityFilter);
    if (actionFilter !== 'all') params.set('action', actionFilter);
    fetch(`/api/history?${params.toString()}`, { headers })
      .then(r => r.json())
      .then(data => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchHistory(); }, [entityFilter, actionFilter]);

  const parse = (s: string | null) => {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  };

  const renderDiff = (row: ActivityRow) => {
    const oldD = parse(row.old_data);
    const newD = parse(row.new_data);
    const fields = DIFF_FIELDS[row.entity_type] || Object.keys(oldD || newD || {});
    return (
      <div className="mt-2 rounded-lg border border-zinc-200 overflow-hidden">
        <div className="grid grid-cols-3 bg-zinc-50 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          <div className="px-2.5 py-1.5">Field</div>
          <div className="px-2.5 py-1.5">Before</div>
          <div className="px-2.5 py-1.5">After</div>
        </div>
        {fields.map(f => {
          const before = oldD?.[f];
          const after = row.action === 'delete' ? undefined : newD?.[f];
          const changed = row.action === 'update' && String(before ?? '') !== String(after ?? '');
          if (before == null && after == null) return null;
          return (
            <div key={f} className={`grid grid-cols-3 text-[11px] border-t border-zinc-100 ${changed ? 'bg-amber-50/50' : ''}`}>
              <div className="px-2.5 py-1.5 font-medium text-zinc-600 capitalize">{f.replace('_', ' ')}</div>
              <div className={`px-2.5 py-1.5 font-number ${changed ? 'text-rose-600' : 'text-zinc-500'}`}>{String(before ?? '—')}</div>
              <div className={`px-2.5 py-1.5 font-number ${changed ? 'text-emerald-600 font-semibold' : 'text-zinc-500'}`}>
                {row.action === 'delete' ? '—' : String(after ?? '—')}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4 md:p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-lg md:text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-emerald-400" /> History
          </h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
                className="bg-white/10 text-white text-[11px] md:text-xs px-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none">
                <option className="text-zinc-900" value="all">All Types</option>
                <option className="text-zinc-900" value="transaction">Transactions</option>
                <option className="text-zinc-900" value="driver">Drivers</option>
                <option className="text-zinc-900" value="rickshaw">Rickshaws</option>
              </select>
            </div>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
              className="bg-white/10 text-white text-[11px] md:text-xs px-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none">
              <option className="text-zinc-900" value="all">All Actions</option>
              <option className="text-zinc-900" value="update">Updated</option>
              <option className="text-zinc-900" value="delete">Deleted</option>
            </select>
            <button onClick={fetchHistory}
              className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-lg border border-white/10 transition-colors" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-zinc-500 text-sm">Loading history...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <HistoryIcon className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm">No changes recorded yet.</p>
            <p className="text-[11px] text-zinc-400 mt-1">Edits and deletions will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {rows.map(row => {
              const Icon = entityIcon(row.entity_type);
              const isDelete = row.action === 'delete';
              const isOpen = expanded === row.id;
              return (
                <div key={row.id} className="px-3 md:px-4 py-2.5 md:py-3">
                  <button className="w-full flex items-start gap-2.5 text-left"
                    onClick={() => setExpanded(isOpen ? null : row.id)}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDelete ? 'bg-rose-50' : 'bg-amber-50'}`}>
                      {isDelete ? <Trash2 className="w-4 h-4 text-rose-600" /> : <Edit className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isDelete ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {row.action}
                        </span>
                        <span className="text-[9px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded flex items-center gap-1 capitalize">
                          <Icon className="w-2.5 h-2.5" /> {row.entity_type}
                        </span>
                      </div>
                      <p className="text-[12px] md:text-sm font-medium text-zinc-900 mt-1">{row.description}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {formatDateTime(row.created_at)}
                        {row.username ? ` · by ${row.username}` : ''}
                      </p>
                    </div>
                  </button>
                  {isOpen && renderDiff(row)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
