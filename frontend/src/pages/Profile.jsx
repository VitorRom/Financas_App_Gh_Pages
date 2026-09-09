import { useEffect, useState } from 'react';
import { authAPI, setAuthToken } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user, updateLocalUser, replayOnboarding } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
  }, [user?.name, user?.email]);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setSavingProfile(true);
    try {
      const updated = await authAPI.updateProfile({
        name: name.trim() || null,
        email: email.trim(),
      });
      updateLocalUser(updated);
      setProfileMsg('Dados salvos com sucesso.');
    } catch (err) {
      setProfileErr(err.message || 'Erro ao salvar');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');
    setSavingPassword(true);
    try {
      const { token } = await authAPI.changePassword({ currentPassword, newPassword });
      // Trocar a senha invalida os tokens anteriores, inclusive o desta aba.
      // O backend devolve um novo para a sessão atual continuar válida.
      if (token) setAuthToken(token);
      setPasswordMsg('Senha alterada. As outras sessões foram desconectadas.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordErr(err.message || 'Erro ao alterar senha');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Perfil</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Dados da conta e segurança.</p>
      </div>

      <div className="card max-w-xl">
        <h3 className="font-medium text-gray-900 dark:text-white mb-4">Dados pessoais</h3>
        {profileMsg && (
          <p className="mb-3 text-sm text-green-600 dark:text-green-400">{profileMsg}</p>
        )}
        {profileErr && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{profileErr}</p>
        )}
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="profile-name">
              Nome
            </label>
            <input
              id="profile-name"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="profile-email">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingProfile}>
            {savingProfile ? 'Salvando…' : 'Salvar dados'}
          </button>
        </form>
      </div>

      <div className="card max-w-xl">
        <h3 className="font-medium text-gray-900 dark:text-white mb-4">Alterar senha</h3>
        {passwordMsg && (
          <p className="mb-3 text-sm text-green-600 dark:text-green-400">{passwordMsg}</p>
        )}
        {passwordErr && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{passwordErr}</p>
        )}
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="current-password">
              Senha atual
            </label>
            <input
              id="current-password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="new-password">
              Nova senha
            </label>
            <input
              id="new-password"
              type="password"
              className="input"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={savingPassword}>
            {savingPassword ? 'Alterando…' : 'Alterar senha'}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Trocar a senha desconecta as outras sessões. Mínimo de 8 caracteres.
          </p>
        </form>
      </div>

      <div className="card max-w-xl">
        <h3 className="font-medium text-gray-900 dark:text-white mb-1">Apresentação</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Rever o passo a passo do que dá para fazer em cada aba.
        </p>
        <button type="button" className="btn btn-secondary" onClick={replayOnboarding}>
          Ver apresentação de novo
        </button>
      </div>
    </div>
  );
}
