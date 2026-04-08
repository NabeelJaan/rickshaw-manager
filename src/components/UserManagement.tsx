import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Plus, Trash2, Shield, User as UserIcon,
  AlertCircle, Eye, EyeOff, X, Check, KeyRound, RefreshCw
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'super_admin';
  created_at: string;
}

interface UserManagementProps {
  onClose?: () => void;
  inline?: boolean; // if true, renders without the modal wrapper
}

export default function UserManagement({ onClose, inline = false }: UserManagementProps) {
  const { token, user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [adding, setAdding] = useState(false);

  // Change password form
  const [changingPasswordFor, setChangingPasswordFor] = useState<User | null>(null);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
      else setError('Failed to load users');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg); setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setAdding(true); setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers,
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(`User "${newUsername}" created successfully`);
        setNewUsername(''); setNewPassword(''); setNewRole('admin'); setShowAddForm(false);
        fetchUsers();
      } else { setError(data.error || 'Failed to create user'); }
    } catch { setError('Network error'); }
    finally { setAdding(false); }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    setError('');
    try {
      const res = await fetch(`/api/auth/users/${user.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) { showSuccess(`User "${user.username}" deleted`); fetchUsers(); }
      else setError(data.error || 'Failed to delete user');
    } catch { setError('Network error'); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setError('Passwords do not match'); return; }
    if (newPw.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSavingPassword(true); setError('');
    try {
      // Super admin resets another user's password directly by re-creating
      // We use the register endpoint trick: delete + re-create with same role
      // Instead, we call a dedicated reset endpoint if available, or show instructions
      const res = await fetch(`/api/auth/users/${changingPasswordFor!.id}/reset-password`, {
        method: 'POST', headers,
        body: JSON.stringify({ newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(`Password updated for "${changingPasswordFor!.username}"`);
        setChangingPasswordFor(null); setNewPw(''); setConfirmPw('');
      } else { setError(data.error || 'Failed to update password'); }
    } catch { setError('Network error'); }
    finally { setSavingPassword(false); }
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">User Management</h2>
            <p className="text-zinc-500 text-sm">Add and manage admin accounts</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Add User Button */}
      <button
        onClick={() => { setShowAddForm(!showAddForm); setError(''); }}
        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl transition-all text-sm font-medium shadow-sm"
      >
        <Plus className="w-4 h-4" />
        {showAddForm ? 'Cancel' : 'Add New User'}
      </button>

      {/* Add User Form */}
      {showAddForm && (
        <form onSubmit={handleAddUser} className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-white text-sm uppercase tracking-wider">New User Details</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text" required
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 text-sm"
                  placeholder="e.g. manager1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type={showNewPassword ? 'text' : 'password'} required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white pl-9 pr-10 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 text-sm"
                  placeholder="Min 6 characters"
                  minLength={6}
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300">
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Role</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewRole('admin')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  newRole === 'admin'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <UserIcon className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Admin</p>
                  <p className="text-xs opacity-70">View & manage data</p>
                </div>
                {newRole === 'admin' && <Check className="w-4 h-4 ml-auto shrink-0" />}
              </button>
              <button
                type="button"
                onClick={() => setNewRole('super_admin')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  newRole === 'super_admin'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <Shield className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Super Admin</p>
                  <p className="text-xs opacity-70">Full access + users</p>
                </div>
                {newRole === 'super_admin' && <Check className="w-4 h-4 ml-auto shrink-0" />}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={adding}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
          >
            {adding ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4" /> Create User</>}
          </button>
        </form>
      )}

      {/* Change Password Modal */}
      {changingPasswordFor && (
        <form onSubmit={handleChangePassword} className="bg-zinc-800/50 border border-amber-500/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">
              Reset password for <span className="text-amber-400">@{changingPasswordFor.username}</span>
            </h3>
            <button type="button" onClick={() => { setChangingPasswordFor(null); setError(''); }}
              className="text-zinc-500 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} required
                  value={newPw} onChange={e => setNewPw(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 pr-10 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="New password" minLength={6}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Confirm Password</label>
              <input
                type="password" required
                value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 text-sm"
                placeholder="Confirm password"
              />
            </div>
          </div>

          <button type="submit" disabled={savingPassword}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2">
            {savingPassword ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><KeyRound className="w-4 h-4" /> Update Password</>}
          </button>
        </form>
      )}

      {/* Users List */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          {loading ? 'Loading...' : `${users.length} User${users.length !== 1 ? 's' : ''}`}
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-zinc-600">No users found</div>
        ) : (
          <div className="space-y-2">
            {users.map(user => (
              <div key={user.id}
                className="flex items-center justify-between bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 hover:border-zinc-600/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    user.role === 'super_admin' ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                  }`}>
                    {user.role === 'super_admin'
                      ? <Shield className="w-5 h-5 text-amber-500" />
                      : <UserIcon className="w-5 h-5 text-emerald-500" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white text-sm">@{user.username}</p>
                      {user.id === currentUser?.id && (
                        <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-md font-medium">You</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium ${
                        user.role === 'super_admin' ? 'text-amber-500' : 'text-emerald-500'
                      }`}>
                        {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </span>
                      {user.created_at && (
                        <span className="text-zinc-600 text-xs">
                          · Joined {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions — only for other users, only super_admin can act */}
                {user.id !== currentUser?.id && currentUser?.role === 'super_admin' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setChangingPasswordFor(user); setNewPw(''); setConfirmPw(''); setError(''); }}
                      className="p-2 rounded-lg text-zinc-500 hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
                      title="Reset password"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className="p-2 rounded-lg text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (inline) return <div>{content}</div>;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {content}
      </div>
    </div>
  );
}