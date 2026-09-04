// src/app/superadmin/login/page.tsx
'use client';

import { useState } from 'react';
import { loginSuperadmin } from '../actions';
import { useRouter } from 'next/navigation';

export default function SuperadminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        const result = await loginSuperadmin(formData);

        if (result.success) {
            router.push('/superadmin');
        } else {
            setError(result.error || 'Une erreur est survenue');
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans">
            <div className="max-w-md w-full p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                        ODSM <span className="text-blue-500">Superadmin</span>
                    </h1>
                    <p className="text-slate-400">Section de maintenance sécurisée</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Identifiant</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                            placeholder="spadmin"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Mot de passe</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                            placeholder="••••••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transform active:scale-[0.98] transition-all"
                    >
                        {loading ? 'Connexion...' : 'Se connecter'}
                    </button>
                </form>

                <p className="mt-8 text-center text-slate-500 text-xs">
                    Accès strictement réservé à l'administrateur système.
                </p>

                {/* Footer Copyright */}
                <div className="mt-10 text-center space-y-1">
                    <p className="text-[10px] font-medium tracking-widest text-slate-600 uppercase">
                        © {new Date().getFullYear()} ODSM. Tous droits réservés.
                    </p>
                    <p className="text-[9px] text-slate-700 italic">
                        Conçu et développé par <span className="text-slate-500 font-semibold not-italic">Emmanuel Massey</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
