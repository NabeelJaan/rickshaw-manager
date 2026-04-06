import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, Trash2, Shield, User as UserIcon, AlertCircle, X, Eye, EyeOff } from 'lucide-react';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'super_admin';
  created_at: string;
}

interface UserManagementProps {
  onClose: () => void;
}

export default function UserManagement({ onClose }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // New user form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [adding, setAdding] = useState(false);
  
  const { token, user: currentUser } = useAuth();

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        setError('Failed to load users');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('User created successfully');
        setNewUsername('');
        setNewPassword('');
        setNewRole('admin');
        setShowAddForm(false);
        fetchUsers();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('User deleted successfully');
        fetchUsers();
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">User Management</h2>
              <p className="text-zinc-500 text-sm">Super Admin Only</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-3 rounded-xl text-sm flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-3 rounded-xl text-sm mb-4">
            {success}
          </div>
        )}

        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? 'Cancel' : 'Add New User'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddUser} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 mb-6 space-y-4">
            <h3 className="font-semibold text-white mb-4">Create New User</h3>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500"
                  placeholder="Enter username"
                />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2.5 pr-10 rounded-lg focus:outline-none focus:border-emerald-500"
                    placeholder="Enter password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Role</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={newRole === 'admin'}
                    onChange={(e) => setNewRole(e.target.value as 'admin')}
                    className="accent-emerald-500"
                  />
                  <span className="text-zinc-300 text-sm flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4" />
                    Admin
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="super_admin"
                    checked={newRole === 'super_admin'}
                    onChange={(e) => setNewRole(e.target.value as 'super_admin')}
                    className="accent-emerald-500"
                  />
                  <span className="text-zinc-300 text-sm flex items-center gap-1.5">
                    <Shield className="w-4 h-4" />
                    Super Admin
                  </span>
                </label>
              </div>
            </div>
            
            <div className="pt-2">
              <button
                type="submit"
                disabled={adding}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-all"
              >
                {adding ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Existing Users</h3>
          
          {loading ? (
            <div className="text-center py-8 text-zinc-500">Loading...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">No users found</div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      user.role === 'super_admin' ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                    }`}>
                      {user.role === 'super_admin' ? (
                        <Shield className="w-5 h-5 text-amber-500" />
                      ) : (
                        <UserIcon className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{user.username}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`${
                          user.role === 'super_admin' ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </span>
                        {user.id === currentUser?.id && (
                          <span className="text-zinc-500">(You)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {user.id !== currentUser?.id && currentUser?.role === 'super_admin' && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 hover:bg-rose-500/10 hover:text-rose-500 text-zinc-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
