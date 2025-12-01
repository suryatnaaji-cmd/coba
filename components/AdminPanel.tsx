
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getStoredUsers, saveUsers } from '../utils';
import { Shield, Trash2, UserPlus, Users, Key, Save, RefreshCw, Edit, X, UserCog, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';

const AdminPanel: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    
    // Form State
    const [formUsername, setFormUsername] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formRole, setFormRole] = useState<'admin' | 'user'>('user');
    const [formDuration, setFormDuration] = useState<string>('30'); // Default 30 hari
    
    // State untuk mengetahui user mana yang sedang diedit (menyimpan username asli)
    const [editingTarget, setEditingTarget] = useState<string | null>(null);
    const isEditing = editingTarget !== null;
    
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = () => {
        setUsers(getStoredUsers());
    };

    const resetForm = () => {
        setFormUsername('');
        setFormPassword('');
        setFormRole('user');
        setFormDuration('30');
        setEditingTarget(null); // Reset target edit
        setMessage(null);
    };

    const handleEditUser = (user: User) => {
        // Simpan username asli ke editingTarget sebagai referensi kunci
        setEditingTarget(user.username);
        
        setFormUsername(user.username);
        setFormPassword(user.password);
        setFormRole(user.role);
        setFormDuration('30'); 
        setMessage(null);
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const calculateExpiry = (days: string): number | null => {
        if (days === 'permanent') return null;
        const dayCount = parseInt(days, 10);
        return Date.now() + (dayCount * 24 * 60 * 60 * 1000);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const cleanUsername = formUsername.trim();
        const cleanPassword = formPassword.trim();

        if (!cleanUsername || !cleanPassword) {
            setMessage({ type: 'error', text: 'Username dan Password wajib diisi.' });
            return;
        }

        const newExpiryDate = calculateExpiry(formDuration);
        
        // Ambil data terbaru untuk menghindari race condition
        const currentUsers = getStoredUsers();
        let updatedUsers = [...currentUsers];

        if (isEditing) {
            // Logic Update
            updatedUsers = currentUsers.map(u => 
                u.username === editingTarget 
                ? { ...u, password: cleanPassword, role: formRole, expiryDate: newExpiryDate } 
                : u
            );
            setMessage({ type: 'success', text: `Data user ${editingTarget} berhasil diperbarui!` });
        } else {
            // Logic Add New
            if (currentUsers.some(u => u.username === cleanUsername)) {
                setMessage({ type: 'error', text: 'Username sudah digunakan, pilih yang lain!' });
                return;
            }
            updatedUsers.push({ 
                username: cleanUsername, 
                password: cleanPassword, 
                role: formRole,
                expiryDate: newExpiryDate
            });
            setMessage({ type: 'success', text: `User ${cleanUsername} berhasil ditambahkan.` });
        }

        // Simpan ke LocalStorage dan Update State
        saveUsers(updatedUsers);
        setUsers(updatedUsers);
        
        setTimeout(() => {
            if (isEditing) resetForm();
            else {
                setFormUsername('');
                setFormPassword('');
                setFormRole('user');
                setFormDuration('30');
            }
        }, 1500);
    };

    const handleDeleteUser = (usernameToDelete: string) => {
        // Tambahkan type="button" di JSX untuk mencegah submit form
        if (window.confirm(`Yakin ingin MENGHAPUS user: ${usernameToDelete}?`)) {
            const currentUsers = getStoredUsers(); // Always fetch fresh data
            
            // Cek admin terakhir
            const admins = currentUsers.filter(u => u.role === 'admin' && u.username !== usernameToDelete);
            const userIsAdmin = currentUsers.find(u => u.username === usernameToDelete)?.role === 'admin';

            if (userIsAdmin && admins.length === 0) {
                alert("GAGAL: Tidak bisa menghapus Admin terakhir.");
                return;
            }

            const updatedUsers = currentUsers.filter(u => u.username !== usernameToDelete);
            saveUsers(updatedUsers);
            setUsers(updatedUsers);
            
            if (editingTarget === usernameToDelete) {
                resetForm();
            }

            setMessage({ type: 'success', text: `User ${usernameToDelete} berhasil dihapus.` });
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const getStatusInfo = (expiryDate?: number | null) => {
        if (!expiryDate) return { label: 'Permanen', color: 'text-blue-600 bg-blue-50', active: true };
        
        const now = Date.now();
        const diff = expiryDate - now;
        const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        if (diff > 0) {
            return { label: `Aktif (${daysLeft} hari)`, color: 'text-emerald-600 bg-emerald-50', active: true };
        } else {
            return { label: 'Expired (Nonaktif)', color: 'text-red-600 bg-red-50', active: false };
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8 animate-fade-in-up">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Shield className="w-6 h-6 text-emerald-400" />
                            Admin Panel: Manajemen User
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">Kelola akses, sandi, dan masa aktif pengguna</p>
                    </div>
                    <div className="bg-gray-800 px-4 py-2 rounded-lg flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="font-mono font-bold text-emerald-400">{users.length}</span> Users
                    </div>
                </div>

                <div className="p-6 grid gap-8 md:grid-cols-2">
                    
                    {/* Form Section */}
                    <div className={`p-6 rounded-xl border transition-colors duration-300 ${isEditing ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isEditing ? 'text-amber-700' : 'text-gray-800'}`}>
                            {isEditing ? <UserCog className="w-5 h-5" /> : <UserPlus className="w-5 h-5 text-purple-600" />}
                            {isEditing ? `Edit User: ${editingTarget}` : 'Tambah User Baru'}
                        </h3>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Username</label>
                                <input 
                                    type="text" 
                                    value={formUsername}
                                    onChange={(e) => setFormUsername(e.target.value)}
                                    className={`w-full p-2 border rounded-lg focus:ring-2 outline-none ${isEditing ? 'bg-gray-200 cursor-not-allowed' : 'bg-white focus:ring-emerald-500'}`}
                                    placeholder="Username unik"
                                    disabled={isEditing} 
                                />
                                {isEditing && <p className="text-[10px] text-gray-500 mt-1">*Username tidak dapat diubah saat edit</p>}
                            </div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Password</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={formPassword}
                                        onChange={(e) => setFormPassword(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                                        placeholder="Sandi user"
                                    />
                                    <Key className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Role</label>
                                    <select 
                                        value={formRole}
                                        onChange={(e) => setFormRole(e.target.value as 'admin' | 'user')}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Masa Aktif</label>
                                    <div className="relative">
                                        <select 
                                            value={formDuration}
                                            onChange={(e) => setFormDuration(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                                        >
                                            <option value="3">3 Hari</option>
                                            <option value="7">7 Hari</option>
                                            <option value="30">30 Hari</option>
                                            <option value="60">60 Hari</option>
                                            <option value="365">1 Tahun</option>
                                            <option value="permanent">Permanen</option>
                                        </select>
                                        <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
                                    </div>
                                    {isEditing && <p className="text-[10px] text-gray-500 mt-1">*Diperbarui dari hari ini</p>}
                                </div>
                            </div>

                            {message && (
                                <div className={`p-2 rounded text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {message.text}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button 
                                    type="submit" 
                                    className={`flex-1 py-2 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2
                                        ${isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-600 hover:bg-purple-700'}
                                    `}
                                >
                                    <Save className="w-4 h-4" /> {isEditing ? 'Simpan Perubahan' : 'Simpan User'}
                                </button>
                                {isEditing && (
                                    <button 
                                        type="button" 
                                        onClick={resetForm}
                                        className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition flex items-center justify-center"
                                        title="Batal Edit"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* User List */}
                    <div className="space-y-4">
                         <div className="flex justify-between items-center mb-2">
                             <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-emerald-600" /> Daftar User
                            </h3>
                            <button onClick={loadUsers} className="text-gray-500 hover:text-emerald-600"><RefreshCw className="w-4 h-4"/></button>
                         </div>
                        
                        <div className="max-h-[450px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {users.map((user, idx) => {
                                const status = getStatusInfo(user.expiryDate);
                                // Determine row styling based on status and edit mode
                                let rowClass = "bg-white border-gray-200 hover:border-emerald-300";
                                if (user.username === editingTarget) {
                                    rowClass = "bg-amber-50 border-amber-300 ring-1 ring-amber-300";
                                } else if (!status.active) {
                                    rowClass = "bg-gray-100 border-gray-200 opacity-70 grayscale-[0.5]"; // Dim expired users
                                }

                                return (
                                    <div 
                                        key={idx} 
                                        className={`p-3 rounded-lg border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${rowClass}`}
                                    >
                                        <div className="w-full sm:w-auto">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${!status.active ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                                    {user.username}
                                                </span>
                                                {user.role === 'admin' && (
                                                    <span className="text-[10px] bg-gray-900 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Admin</span>
                                                )}
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                            
                                            <div className="text-xs text-gray-500 font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <span className="flex items-center gap-1"><Key className="w-3 h-3" /> {user.password}</span>
                                                {user.expiryDate && (
                                                     <span className={`flex items-center gap-1 ${!status.active ? 'text-red-400' : 'text-gray-400'}`}>
                                                        <Clock className="w-3 h-3" /> Exp: {new Date(user.expiryDate).toLocaleDateString('id-ID')}
                                                     </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 self-end sm:self-center">
                                            <button 
                                                type="button"
                                                onClick={() => handleEditUser(user)}
                                                className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                title="Edit / Perpanjang"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => handleDeleteUser(user.username)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Hapus User"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
