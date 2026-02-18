import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs,
  query, where, onSnapshot, updateDoc, deleteDoc, addDoc, writeBatch, orderBy, limit,
  serverTimestamp
} from 'firebase/firestore';
import {
  getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword
} from 'firebase/auth';
import {
  Folder, File, Shield, Users, HardDrive, Plus,
  Trash2, Globe, Lock, Copy, Download, ChevronRight,
  LogOut, Loader2, UploadCloud, Search, MoreVertical, Share2, Eye, XCircle, Mail,
  UserPlus, UserMinus, UserX, UserCheck, Database, FileUp, FolderPlus,
  FileText, FileImage, FileArchive
} from 'lucide-react';

// ========================================================
// Firebase Configuration - SEGURO com variáveis de ambiente
// ========================================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validar que todas as variáveis de ambiente estão configuradas
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ ERRO: Variáveis de ambiente do Firebase não configuradas!');
  console.error('Crie um arquivo .env.local baseado em .env.example');
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const appId = "meu-sistema-vps";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const logAction = async (action, details) => {
  try {
    const logDetails = {
      action,
      ...details,
      // Garante que 'performedBy' nunca é undefined
      performedBy: details.performedBy || 'Sistema',
      timestamp: serverTimestamp()
    };
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), logDetails);
  } catch (error) {
    console.error("Failed to log action:", error);
  }
};

const getIconForItem = (item) => {
  if (item.type === 'folder') {
    return <Folder size={24} fill="currentColor" fillOpacity={0.2} />;
  }
  const extension = item.name.split('.').pop().toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
      return <FileImage size={24} fill="currentColor" fillOpacity={0.2} />;
    case 'pdf':
      return <FileText size={24} fill="currentColor" fillOpacity={0.2} />;
    case 'zip':
    case 'rar':
    case '7z':
      return <FileArchive size={24} fill="currentColor" fillOpacity={0.2} />;
    default:
      return <File size={24} fill="currentColor" fillOpacity={0.2} />;
  }
};

function PreviewModal({ show, content, onClose }) {
  if (!show || !content) return null;

  const renderContent = () => {
    if (content.type === 'image') {
      return <img src={content.url} alt={content.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
    } else if (content.type === 'pdf') {
      return <iframe src={content.url} style={{ width: '100%', height: '100%', border: 'none' }} title={content.name} allow="fullscreen" frameBorder="0"></iframe>;
    } else {
      return <p>Pré-visualização não disponível para este tipo de arquivo.</p>;
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem',
        width: '80vw', height: '80vh',
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        padding: '1.5rem'
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '0.5rem', right: '0.5rem',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-default)',
          zIndex: 10
        }}>
          <XCircle size={24} />
        </button>
        <h3 style={{ marginBottom: '1rem', fontWeight: 'bold', flexShrink: 0 }}>{content.name}</h3>
        <div style={{ flexGrow: 1, overflow: 'hidden' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

const glassEffect = "glass-effect";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('login');
  const [sharedItemId, setSharedItemId] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    if (shareId) {
      setSharedItemId(shareId);
      setView('shared');
      setLoading(false); // Parar o carregamento, pois estamos indo diretamente para a visualização compartilhada
      return; // Sair do useEffect para não processar a autenticação
    }
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const d = userSnap.data();
          if (d.isBlocked) {
            alert('A sua conta foi bloqueada. Contacte o administrador.');
            signOut(auth);
            setView('login');
            return;
          }
          setUserData(d);
          setUser(u);
          setView(d.role === 'admin' ? 'admin' : 'user');
        } else {
          // Usuário autenticado mas não existe na base de dados do nosso sistema.
          alert('A sua conta não foi encontrada no sistema. Contacte um administrador.');
          signOut(auth);
          setView('login');
        }
      } else {
        setUser(null);
        setView('login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-light)' }} className="animate-fade-in">
      <div style={{ position: 'relative', marginBottom: '2rem' }}>
        <Loader2 className="animate-spin" style={{ color: 'var(--color-primary)', fontSize: '3rem', width: '48px', height: '48px', animation: 'rotateLoad 2s linear infinite' }} size={48} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '48px', height: '48px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--color-primary)', animation: 'rotateLoad 3s linear infinite reverse', opacity: 0.3 }}></div>
      </div>
      <span style={{ color: 'var(--color-text-light)', fontWeight: '500', animation: 'pulse 2s infinite', fontSize: '1rem' }}>A carregar sistema...</span>
    </div>
  );

  return (
    <>
      {view === 'login' && <LoginView />}
      {view === 'shared' && <SharedView itemId={sharedItemId} />}

      {view === 'admin' && (
        <Layout user={user} userData={userData} setView={setView}>
          <AdminDashboard user={user} userData={userData} setView={setView} />
        </Layout>
      )}

      {view === 'user' && (
        <Layout user={user} userData={userData} setView={setView}>
          <UserDashboard user={user} userData={userData} setView={setView} />
        </Layout>
      )}
    </>
  );
}

function Layout({ children, user, userData, setView }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <aside style={{ display: 'none', flexDirection: 'column', width: '18rem', padding: '1.5rem', backgroundColor: 'var(--app-white)', borderRight: '1px solid var(--app-border)', gap: '1.5rem' }} className="md-flex">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem', background: 'linear-gradient(to bottom right, var(--app-primary), var(--app-primary-dark))', color: 'var(--app-white)', borderRadius: '16px', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.2)' }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontWeight: '900', fontSize: '1.125rem' }}>SafeHost</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--app-text-medium)' }}>Drive pessoal</div>
          </div>
        </div>

        <nav style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', color: '#475569', fontWeight: '500', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--app-border-light)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            <Folder size={18} /> Meu Drive
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', color: '#475569', fontWeight: '500', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--app-border-light)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            <Users size={18} /> Compartilhados
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', color: '#475569', fontWeight: '500', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--app-border-light)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            <HardDrive size={18} /> Dispositivo
          </button>
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button onClick={() => setView('user')} className="btn btn-primary" style={{ width: '100%', padding: '0.5rem 1rem', borderRadius: '1rem' }}>Abrir Drive</button>
          <button onClick={() => signOut(auth)} className="btn btn-secondary" style={{ width: '100%', padding: '0.5rem 1rem', borderRadius: '1rem' }}>Sair</button>
        </div>
      </aside>

      <main style={{ flex: '1', padding: '1.5rem', overflow: 'auto' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  );
}

function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor, preencha o email e a password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged irá tratar do resto e redirecionar
    } catch (err) {
      setError('Email ou password inválidos.');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="login-scope" style={{ minHeight: '100vh' }}>
      <div className="login-card animate-scale-in">
        <div className="login-header">
          <div className="login-logo">
            <Shield size={32} /> {/* Ajustado para o tamanho do logo */}
          </div>
          <h1 className="login-title">SafeHost</h1>
          <p className="login-subtitle">Armazenamento seguro na nuvem.</p>
        </div>

        <form className="login-form" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          <div className="input-group">
            <Mail size={18} className="icon" />
            <input
              type="email"
              id="email"
              placeholder="Seu e-mail"
              className="login-input with-icon"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <Lock size={18} className="icon" />
            <input
              type="password"
              id="password"
              placeholder="Sua senha"
              className="login-input with-icon"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="login-options">
            <div className="remember-me">
              <input type="checkbox" id="remember" className="checkbox" />
              <label htmlFor="remember">Manter conectado</label>
            </div>
            <a href="#" className="forgot-password">Esqueci minha senha</a>
          </div>

          {error && <p style={{ color: 'var(--app-error)', textAlign: 'center', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
          </button>
        </form>

        <div className="login-footer">
          <p>Não tem conta? <a href="#" className="signup-link">Cadastre-se</a></p>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ user, userData, setView }) {
  const [usersList, setUsersList] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const menuRef = useRef(null);

  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      // Não mostrar o admin atual na lista para prevenir auto-ações
      setUsersList(snapshot.docs.map(d => d.data()).filter(u => u.uid !== user.uid));
    });

    const logsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      setActivityLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
    };

  }, [user.uid]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const updateLimit = async (uid, mb) => {
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', uid);
    await updateDoc(userRef, { storageLimit: parseInt(mb) * 1024 * 1024 });
    const targetUser = usersList.find(u => u.uid === uid);
    logAction('update_quota', {
      performedBy: userData.username,
      targetUsername: targetUser?.username || 'N/A',
      details: `Quota definida para ${mb}MB`
    });
  };

  const toggleBlockStatus = async (uid, currentStatus) => {
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', uid);
    await updateDoc(userRef, { isBlocked: !currentStatus });
    setOpenMenuId(null);
    const targetUser = usersList.find(u => u.uid === uid);
    logAction(currentStatus ? 'unblock_user' : 'block_user', {
      performedBy: userData.username,
      targetUsername: targetUser?.username || 'N/A',
      details: `Usuário ${currentStatus ? 'desbloqueado' : 'bloqueado'}`
    });
  };

  const createUser = async () => {
    const email = prompt("Email do novo usuário:");
    if (!email) return;
    const password = prompt(`Password para ${email} (mínimo 6 caracteres):`);
    if (!password || password.length < 6) return alert("A password é obrigatória e deve ter no mínimo 6 caracteres.");
    const username = prompt(`Nome de usuário para ${email}:`);
    if (!username) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_URL}/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, password, username })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Falha ao criar usuário.');

      logAction('create_user', {
        performedBy: userData.username,
        targetUsername: username,
        details: `Nova conta criada para ${email}`
      });
      alert(`Usuário ${username} criado com sucesso!`);
    } catch (err) {
      console.error("Erro ao criar usuário:", err);
      alert(`Erro: ${err.message}`);
    }
  };

  const deleteUser = async (userToDelete) => {
    if (!confirm(`Tem certeza de que deseja apagar PERMANENTEMENTE o usuário ${userToDelete.username} e todos os seus arquivos? Esta ação é irreversível.`)) return;
    setOpenMenuId(null);
    try {
      // 1. Apagar todos os items do usuário no Firestore (arquivos e pastas)
      const itemsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('userId', '==', userToDelete.uid));
      const itemsSnapshot = await getDocs(itemsQuery);
      const batch = writeBatch(db);
      itemsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // 2. Apagar a pasta de arquivos do usuário no disco do servidor
      const token = await user.getIdToken();
      await fetch(`${API_URL}/delete-user-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: userToDelete.uid })
      });

      // 3. Apagar o documento do usuário
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userToDelete.uid));

      logAction('delete_user', {
        performedBy: userData.username,
        targetUsername: userToDelete.username,
        details: `Conta e dados de ${userToDelete.username} apagados`
      });
      alert(`Usuário ${userToDelete.username} apagado com sucesso.`);

    } catch (err) {
      console.error("Erro ao apagar usuário:", err);
      alert("Ocorreu um erro ao apagar o usuário.");
    }
  };

  const formatLogTimestamp = (timestamp) => {
    if (!timestamp) return 'agora mesmo';
    const date = timestamp.toDate();
    const now = new Date();
    const diffSeconds = Math.round((now - date) / 1000);
    if (diffSeconds < 60) return `${diffSeconds}s atrás`;
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m atrás`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    return date.toLocaleDateString('pt-PT');
  };

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '1rem' }} className="md-p-8">
      <header style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '2.5rem' }} className="md-flex-row md-items-center">
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '900', letterSpacing: '-0.025em' }}>Painel de Controle</h1>
          <p style={{ color: '#64748b', fontWeight: '500' }}>Crie, gerencie e bloqueie usuários.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={createUser} className="btn btn-primary" style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}>
            <Plus size={18} /> Criar Usuário
          </button>
          <button onClick={() => setView('user')} className="btn btn-secondary" style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}>
            <HardDrive size={18} /> Ver Meus Arquivos
          </button>
          <button onClick={() => signOut(auth)} className="btn-danger" style={{ padding: '0.625rem' }}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }} className="no-scrollbar">
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }} className="admin-table">
            <thead style={{ backgroundColor: 'var(--app-border-light)', borderBottom: '1px solid var(--app-border)' }}>
              <tr>
                <th className="p-5 font-bold text-slate-400 text-xs uppercase tracking-widest">Usuário</th>
                <th className="p-5 font-bold text-slate-400 text-xs uppercase tracking-widest">Quota (MB)</th>
                <th className="p-5 font-bold text-slate-400 text-xs uppercase tracking-widest">Uso</th>
                <th className="p-5 font-bold text-slate-400 text-xs uppercase tracking-widest">Status</th>
                <th className="p-5 font-bold text-slate-400 text-xs uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map(u => (
                <tr key={u.uid} style={{ transition: 'background-color 0.2s ease-in-out', borderBottom: '1px solid var(--app-border-light)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--app-bg-light)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td style={{ padding: '1.25rem', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: '700', color: 'var(--app-text-dark)' }}>{u.username}</div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--app-text-medium)', fontFamily: 'monospace', marginTop: '0.125rem' }}>{u.uid}</div>
                  </td>
                  <td style={{ padding: '1.25rem', whiteSpace: 'nowrap' }}>
                    <input
                      type="number"
                      defaultValue={(u.storageLimit / 1024 / 1024).toFixed(0)}
                      onBlur={(e) => updateLimit(u.uid, e.target.value)}
                      className="input-field"
                      style={{ width: '6rem', padding: '0.5rem', borderRadius: '0.75rem', fontWeight: '700', fontSize: '0.875rem' }}
                    />
                  </td>
                  <td style={{ padding: '1.25rem', whiteSpace: 'nowrap' }}>
                    <div style={{ width: '8rem', backgroundColor: 'var(--app-border-light)', height: '0.5rem', borderRadius: '9999px', overflow: 'hidden', marginBottom: '0.25rem' }}>
                      <div style={{ backgroundColor: 'var(--app-primary)', height: '100%', borderRadius: '9999px', width: `${Math.min(100, (u.usedSpace / u.storageLimit) * 100)}%` }}></div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>{(u.usedSpace / 1024 / 1024).toFixed(2)} MB</span>
                  </td>
                  <td style={{ padding: '1.25rem', whiteSpace: 'nowrap' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      backgroundColor: u.isBlocked ? 'var(--app-error-light)' : 'var(--app-success-light)',
                      color: u.isBlocked ? 'var(--app-error)' : 'var(--app-success)'
                    }}>
                      {u.isBlocked ? 'Bloqueado' : 'Ativo'}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem', textAlign: 'right', position: 'relative' }}>
                    <button onClick={() => setOpenMenuId(openMenuId === u.uid ? null : u.uid)} style={{ padding: '0.5rem', backgroundColor: 'var(--app-white)', border: '1px solid var(--app-border-light)', borderRadius: '0.5rem', color: '#64748b' }}>
                      <MoreVertical size={20} />
                    </button>
                    {openMenuId === u.uid && (
                      <div className="dropdown-menu" ref={menuRef} style={{ right: '1.25rem', top: '4rem', width: '160px' }}>
                        <button onClick={() => toggleBlockStatus(u.uid, u.isBlocked)}>
                          {u.isBlocked ? <Globe size={14} /> : <Lock size={14} />}
                          <span>{u.isBlocked ? 'Desbloquear' : 'Bloquear'}</span>
                        </button>
                        <button onClick={() => deleteUser(u)} className="danger">
                          <Trash2 size={14} />
                          <span>Apagar</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-12">
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.025em', marginBottom: '1.5rem' }}>Atividade Recente</h2>
        <div className="content-card" style={{ padding: '1.5rem' }}>
          {activityLogs.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {activityLogs.map(log => (
                <li key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ backgroundColor: 'var(--app-border-light)', padding: '0.75rem', borderRadius: '0.75rem', display: 'inline-flex' }}>
                    {{
                      'create_user': <UserPlus size={20} className="text-slate-600" />,
                      'delete_user': <UserMinus size={20} className="text-slate-600" />,
                      'block_user': <UserX size={20} className="text-slate-600" />,
                      'unblock_user': <UserCheck size={20} className="text-slate-600" />,
                      'update_quota': <Database size={20} className="text-slate-600" />,
                      'upload_file': <FileUp size={20} className="text-slate-600" />,
                      'delete_item': <Trash2 size={20} className="text-slate-600" />,
                      'create_folder': <FolderPlus size={20} className="text-slate-600" />,
                      'make_item_public': <Globe size={20} className="text-slate-600" />,
                      'make_item_private': <Lock size={20} className="text-slate-600" />,
                    }[log.action] || <Shield size={20} className="text-slate-600" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '600', margin: 0, fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--app-primary)' }}>{log.performedBy}</span>
                      {{
                        'create_user': ' criou o usuário ',
                        'delete_user': ' apagou o usuário ',
                        'block_user': ' bloqueou o usuário ',
                        'unblock_user': ' desbloqueou o usuário ',
                        'update_quota': ' atualizou a quota de ',
                        'upload_file': ' fez upload do arquivo ',
                        'delete_item': ' apagou o item ',
                        'create_folder': ' criou a pasta ',
                        'make_item_public': ' tornou público o item ',
                        'make_item_private': ' tornou privado o item ',
                      }[log.action] || ' realizou uma ação em '}
                      <span style={{ color: 'var(--app-primary)' }}>{log.targetUsername || log.itemName}</span>
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--app-text-medium)', margin: '0.125rem 0 0 0' }}>{log.details}</p>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--app-text-medium)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    {formatLogTimestamp(log.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--app-text-medium)', fontWeight: '500' }}>
              Nenhuma atividade recente para mostrar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function UserDashboard({ user, userData, setView }) {
  const [currentFolder, setCurrentFolder] = useState('root');
  const [items, setItems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: 'root', name: 'Início' }]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const [downloadingItemId, setDownloadingItemId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'items'),
      where('userId', '==', user.uid),
      where('parentId', '==', currentFolder)
    );
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.type === 'folder' ? -1 : 1));
    });
  }, [currentFolder, user.uid]);

  // Busca global em todas as pastas quando há termo de pesquisa
  const [allItems, setAllItems] = useState([]);

  useEffect(() => {
    if (!searchTerm) return;

    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'items'),
      where('userId', '==', user.uid)
    );

    return onSnapshot(q, (snap) => {
      setAllItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.type === 'folder' ? -1 : 1));
    });
  }, [searchTerm, user.uid]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  useEffect(() => {
    if (showSearchInput && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchInput]);

  const filteredItems = searchTerm ? allItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) : items;

  const uploadFile = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (userData.usedSpace + totalSize > userData.storageLimit) {
      return alert("Limite de espaço atingido!");
    }

    setIsUploading(true);
    let uploadedSize = 0;
    let successCount = 0;

    try {
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('userId', user.uid);

          const token = await user.getIdToken();
          const res = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData,
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error("Erro no servidor");
          const data = await res.json();

          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'items'), {
            name: file.name,
            type: 'file',
            size: file.size,
            parentId: currentFolder,
            userId: user.uid,
            isPublic: false,
            vpsPath: data.filePath,
            createdAt: serverTimestamp()
          });

          uploadedSize += file.size;
          successCount++;

          logAction('upload_file', {
            performedBy: userData.username,
            itemName: file.name,
            details: `Arquivo de ${(file.size / 1024).toFixed(1)} KB enviado`
          });
        } catch (fileErr) {
          console.error(`Erro ao fazer upload de ${file.name}:`, fileErr);
        }
      }

      if (uploadedSize > 0) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
          usedSpace: userData.usedSpace + uploadedSize
        });
      }

      if (successCount < files.length) {
        alert(`${successCount} de ${files.length} arquivos enviados com sucesso.`);
      }

      // Resetar o input de arquivo após upload bem-sucedido
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      alert("Falha ao enviar arquivos para o disco local. Verifique se o backend está rodando.");
    }
    setIsUploading(false);
  };

  const createFolder = async () => {
    const n = prompt("Nome da nova pasta:");
    if (!n) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'items'), {
      name: n, type: 'folder', parentId: currentFolder, userId: user.uid, isPublic: false, createdAt: serverTimestamp()
    });
    logAction('create_folder', {
      performedBy: userData.username,
      itemName: n,
      details: `Pasta criada em '${breadcrumbs.at(-1).name}'`
    });
  };

  const deleteItem = async (item) => {
    if (!confirm("Confirmar eliminação permanente?")) return;
    try {
      if (item.type === 'file') {
        await fetchWithAuth(`${API_URL}/delete`, {
          method: 'DELETE',
          body: JSON.stringify({ filePath: item.vpsPath })
        });
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
          usedSpace: Math.max(0, userData.usedSpace - item.size)
        });
      }
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id));
      logAction('delete_item', {
        performedBy: userData.username,
        itemName: item.name,
        details: `Item do tipo '${item.type}' apagado`
      });
    } catch (err) { alert("Erro ao apagar."); }
  };

  const togglePublic = async (item) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id), { isPublic: !item.isPublic });
    logAction(item.isPublic ? 'make_item_private' : 'make_item_public', {
      performedBy: userData.username,
      itemName: item.name,
      details: `Compartilhamento ${item.isPublic ? 'desativado' : 'ativado'}`
    });
  };

  const navigateToItem = (item) => {
    if (item.type === 'folder') {
      // Se for uma pasta de uma busca global, navegue para ela
      if (searchTerm && item.parentId !== currentFolder) {
        setCurrentFolder(item.id);
        setBreadcrumbs([{ id: 'root', name: 'Início' }, { id: item.id, name: item.name }]);
      } else {
        // Senão, adicione ao breadcrumb normalmente
        setBreadcrumbs([...breadcrumbs, { id: item.id, name: item.name }]);
        setCurrentFolder(item.id);
      }
      setSearchTerm(''); // Limpar pesquisa ao navegar
      setShowSearchInput(false);
    }
  };

  // ✅ SEGURANÇA: Helper para requisições autenticadas
  const fetchWithAuth = async (url, options = {}) => {
    const token = await user.getIdToken();
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });
  };

  const downloadFile = async (item) => {
    if (downloadingItemId) return;
    setDownloadingItemId(item.id);
    try {
      const res = await fetchWithAuth(`${API_URL}/download`, {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id })
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Erro ao baixar. " + e.message);
    }
    setDownloadingItemId(null);
  };

  // O proprietário do arquivo pode visualizar sem restrições
  const token = await user.getIdToken();
  const previewUrl = `${API_URL}/preview/${item.id}?token=${token}`;
  const extension = item.name.split('.').pop().toLowerCase();
  let contentType = 'unsupported';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
    contentType = 'image';
  } else if (extension === 'pdf') {
    contentType = 'pdf';
  }

  setPreviewContent({ url: previewUrl, type: contentType, name: item.name });
  setShowPreviewModal(true);
  setOpenMenuId(null); // Fecha o menu de ações
};


const downloadFolder = async (folder) => {
  if (downloadingItemId) return;
  setDownloadingItemId(folder.id);
  try {
    const res = await fetchWithAuth(`${API_URL}/download-folder`, {
      method: 'POST',
      body: JSON.stringify({
        userId: user.uid,
        folderId: folder.id,
        folderName: folder.name
      })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha no download da pasta");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folder.name}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) { alert(`Erro ao descarregar pasta: ${e.message}`); }
  setDownloadingItemId(null);
};

const shareFolderContentsRecursively = async (folder) => {
  if (!confirm(`Tem certeza de que deseja tornar PÚBLICA a pasta "${folder.name}" e todo o seu conteúdo? Esta ação não pode ser desfeita em massa.`)) return;

  setOpenMenuId(null);
  // TODO: Adicionar um estado de loading visual para o utilizador

  const itemsToUpdate = [];

  // Função auxiliar para encontrar todos os descendentes
  const findDescendants = async (folderId) => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('parentId', '==', folderId), where('userId', '==', user.uid));
    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
      itemsToUpdate.push(docSnap.ref);
      if (docSnap.data().type === 'folder') {
        await findDescendants(docSnap.id);
      }
    }
  };

  try {
    // Adicionar a própria pasta à lista de atualização
    const rootFolderRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', folder.id);
    itemsToUpdate.push(rootFolderRef);

    await findDescendants(folder.id);

    if (itemsToUpdate.length > 499) {
      alert("Esta pasta é muito grande para compartilhar de uma só vez. Por favor, compartilhe as subpastas individualmente.");
      return;
    }

    const batch = writeBatch(db);
    itemsToUpdate.forEach(itemRef => {
      batch.update(itemRef, { isPublic: true });
    });
    await batch.commit();

    logAction('make_item_public', {
      performedBy: userData.username,
      itemName: folder.name,
      details: `Pasta e ${itemsToUpdate.length - 1} sub-itens tornados públicos`
    });
    alert(`A pasta "${folder.name}" e todo o seu conteúdo foram compartilhados com sucesso.`);
  } catch (err) {
    console.error("Erro ao compartilhar pasta recursivamente:", err);
    alert("Ocorreu um erro ao compartilhar a pasta.");
  }
};

return (
  <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '1rem' }} className="md-p-8">
    <header style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '2.5rem' }} className="md-flex-row md-items-center">
      <div style={{ width: '100%' }} className="md-w-auto">
        <h1 style={{ fontSize: '1.875rem', fontWeight: '900', letterSpacing: '-0.025em' }}>Meus Arquivos</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <div style={{ width: '8rem', backgroundColor: 'var(--app-border)', height: '0.375rem', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'var(--app-primary)', height: '100%', width: `${Math.min(100, (userData.usedSpace / userData.storageLimit) * 100)}%` }}></div>
          </div>
          <span style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {(userData.usedSpace / 1024 / 1024).toFixed(1)} / {(userData.storageLimit / 1024 / 1024).toFixed(0)} MB
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'center', flexWrap: 'wrap' }} className="md-w-auto">
        {showSearchInput && (
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Pesquisar arquivos ou pastas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onBlur={() => { if (!searchTerm) setShowSearchInput(false); }}
            className="login-input"
            style={{ padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--app-border)', flex: 1, minWidth: '200px', animation: 'slideInDown 0.3s ease-out' }}
          />
        )}
        {!showSearchInput && (
          <button onClick={() => setShowSearchInput(true)} className="btn btn-secondary" style={{ padding: '0.75rem' }} title="Pesquisar">
            <Search size={20} />
          </button>
        )}
        {userData.role === 'admin' && (
          <button onClick={() => setView('admin')} className="btn btn-secondary" style={{ padding: '0.75rem' }}>
            <Shield size={20} style={{ color: 'var(--app-primary)' }} />
          </button>
        )}
        <label className="btn btn-primary md-flex-none" style={{ flex: '1', padding: '0.75rem 1.5rem', borderRadius: '1rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(59,130,246,0.1)', cursor: 'pointer' }}>
          <UploadCloud size={18} /> Carregar <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={uploadFile} />
        </label>
        <button onClick={createFolder} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '1rem' }}>
          <Plus size={18} /> Pasta
        </button>
        <button onClick={() => signOut(auth)} className="btn-danger" style={{ padding: '0.75rem' }}>
          <LogOut size={20} />
        </button>
      </div>
    </header>

    {/* Breadcrumbs Melhorados */}
    <nav style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '2rem', fontSize: '0.875rem', overflowX: 'auto', paddingBottom: '0.5rem', paddingTop: '0.5rem' }} className="no-scrollbar">
      {breadcrumbs.map((c, i) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: '0' }}>
          {i > 0 && <ChevronRight size={14} style={{ color: '#cbd5e1' }} />}
          <button
            onClick={() => { setBreadcrumbs(breadcrumbs.slice(0, i + 1)); setCurrentFolder(c.id); }}
            className={i === breadcrumbs.length - 1 ? "bg-slate-900 text-white font-bold" : "text-slate-500 font-medium"}
            onMouseOver={(e) => { if (i !== breadcrumbs.length - 1) e.currentTarget.style.backgroundColor = 'var(--app-border-light)'; }}
            onMouseOut={(e) => { if (i !== breadcrumbs.length - 1) e.currentTarget.style.backgroundColor = 'transparent'; }}
            style={{
              ...(i === breadcrumbs.length - 1 ? { backgroundColor: 'var(--app-text-dark)', color: 'white', fontWeight: '700' } : { color: '#64748b', fontWeight: '500' }),
              padding: '0.375rem 0.75rem',
              borderRadius: '0.75rem',
              transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {c.name}
          </button>
        </div>
      ))}
    </nav>

    {isUploading && (
      <div style={{ padding: '1.25rem', backgroundColor: 'var(--app-bg-subtle)', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '1rem', marginBottom: '2rem', animation: 'pulse 2s infinite', display: 'flex', alignItems: 'center', gap: '1rem', fontWeight: '700', fontSize: '0.875rem', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)' }} className="animate-slide-in-down">
        <Loader2 className="animate-spin" style={{ animation: 'rotateLoad 2s linear infinite' }} /> Transferindo arquivo para o disco local...
      </div>
    )}

    {items.length === 0 && !isUploading ? ( /* flex flex-col items-center justify-center py-24 border-4 border-dashed border-slate-100 rounded-[3rem] */
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', border: '4px dashed var(--app-border)', borderRadius: '3rem' }}>
        <div style={{ backgroundColor: 'var(--app-border-light)', padding: '1.5rem', borderRadius: '9999px', marginBottom: '1.5rem', color: '#e2e8f0' }}><Search size={64} /></div>
        <p style={{ color: 'var(--app-text-medium)', fontWeight: '700' }}>Nenhum arquivo nesta pasta</p>
      </div>
    ) : filteredItems.length === 0 && searchTerm ? (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', border: '4px dashed var(--app-border)', borderRadius: '3rem' }}>
        <div style={{ backgroundColor: 'var(--app-border-light)', padding: '1.5rem', borderRadius: '9999px', marginBottom: '1.5rem', color: '#e2e8f0' }}><Search size={64} /></div>
        <p style={{ color: 'var(--app-text-medium)', fontWeight: '700' }}>Nenhum resultado para "{searchTerm}"</p>
      </div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }} className="sm-grid-cols-3 lg-grid-cols-4 xl-grid-cols-5">
        {filteredItems.map((item, index) => (
          <div
            key={item.id}
            className={`card ${glassEffect} animate-fade-in-up`}
            style={{ display: 'flex', flexDirection: 'column', height: '240px', animationDelay: `${index * 50}ms`, cursor: 'pointer' }}
            onClick={() => {
              if (item.type === 'folder') {
                navigateToItem(item);
              } else {
                handlePreview(item);
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', minHeight: '70px' }}>
              <div
                className={item.type === 'folder' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-700'}
                style={{ padding: '1rem', borderRadius: '1rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', zIndex: 1, flexShrink: 0 }}>
                {getIconForItem(item)}
              </div>

              <div className="card-actions" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}>
                  <MoreVertical size={16} />
                </button>
              </div>

              {openMenuId === item.id && (
                <div className="dropdown-menu" ref={menuRef}>
                  {item.type === 'file' && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); handlePreview(item); }}>
                        <Eye size={14} />
                        <span>Visualizar</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); downloadFile(item); }}>
                        {downloadingItemId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>{downloadingItemId === item.id ? 'Baixando...' : 'Baixar'}</span>
                      </button>
                    </>
                  )}
                  {item.type === 'folder' && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); downloadFolder(item); }}>
                        {downloadingItemId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>{downloadingItemId === item.id ? 'A baixar...' : 'Baixar Pasta (.zip)'}</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); shareFolderContentsRecursively(item); }}>
                        <Share2 size={14} />
                        <span>Compartilhar Tudo</span>
                      </button>
                    </>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); togglePublic(item); }}>
                    {item.isPublic ? <Globe size={14} /> : <Lock size={14} />}
                    <span>{item.isPublic ? 'Deixar Privado' : 'Compartilhar'}</span>
                  </button>
                  {item.isPublic && (
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?share=${item.id}`); alert("Link de partilha copiado!"); setOpenMenuId(null); }}>
                      <Copy size={14} />
                      <span>Copiar Link</span>
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); deleteItem(item); }} className="danger">
                    <Trash2 size={14} />
                    <span>Apagar</span>
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginTop: 'auto' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--app-text-dark)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.25rem', transition: 'color 0.2s ease-in-out' }} className="group-hover-text-blue-600" title={item.name}>
                {item.name}
              </h3>
              <p style={{ fontSize: '0.625rem', color: 'var(--app-text-medium)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.type === 'folder' ? 'Pasta' : `${(item.size / 1024).toFixed(1)} KB`}
              </p>
            </div>
          </div>
        ))}
      </div>
    )}
    <PreviewModal
      show={showPreviewModal}
      content={previewContent}
      onClose={() => {
        setShowPreviewModal(false);
        setPreviewContent(null);
      }}
    />
  </div>
);
}

function SharedView({ itemId }) {
  const [rootSharedItem, setRootSharedItem] = useState(null); // O item inicialmente compartilhado (arquivo ou pasta)
  const [currentFolderId, setCurrentFolderId] = useState(null); // O ID da pasta cujos conteúdos estão atualmente a ser exibidos
  const [displayedItems, setDisplayedItems] = useState([]); // Itens dentro de currentFolderId
  const [sharedBreadcrumbs, setSharedBreadcrumbs] = useState([]); // Breadcrumbs para navegação dentro da pasta compartilhada
  const [downloading, setDownloading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const [error, setError] = useState(false);

  // Função de download para o item raiz (se for um arquivo)
  const downloadRootFile = async () => {
    if (rootSharedItem.type !== 'file') return; // Não deve acontecer se a UI estiver correta
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: rootSharedItem.id })
      });
      if (!res.ok) throw new Error("Servidor offline");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = rootSharedItem.name;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { alert("Erro ao baixar do drive local. O servidor backend está rodando?"); }
    setDownloading(false);
  };

  // Efeito para carregar o item partilhado raiz e configurar a visualização da pasta, se aplicável
  useEffect(() => {
    const loadRootSharedItem = async () => {
      try {
        const sharedItemSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', itemId));
        if (sharedItemSnap.exists() && sharedItemSnap.data().isPublic) {
          const sharedData = { id: sharedItemSnap.id, ...sharedItemSnap.data() };
          setRootSharedItem(sharedData);
          if (sharedData.type === 'folder') {
            setCurrentFolderId(itemId);
            setSharedBreadcrumbs([{ id: itemId, name: sharedData.name }]);
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Error loading shared item:", err);
        setError(true);
      }
    };
    loadRootSharedItem();
  }, [itemId]);

  // Efeito para carregar itens quando currentFolderId muda (para navegação em pastas)
  useEffect(() => {
    if (!currentFolderId || rootSharedItem?.type === 'file') {
      setDisplayedItems([]); // Limpa os itens se for um arquivo ou nenhuma pasta estiver definida
      return;
    }

    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'items'),
      where('parentId', '==', currentFolderId),
      where('isPublic', '==', true) // Apenas mostrar itens públicos dentro de uma pasta compartilhada
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setDisplayedItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.type === 'folder' ? -1 : 1));
    });

    return () => unsubscribe();
  }, [currentFolderId, rootSharedItem]); // Depende de rootSharedItem para garantir que o tipo inicial é conhecido

  const navigateSharedFolder = (folderId, folderName) => {
    setCurrentFolderId(folderId);
    setSharedBreadcrumbs(prev => {
      const existingIndex = prev.findIndex(b => b.id === folderId);
      if (existingIndex !== -1) {
        return prev.slice(0, existingIndex + 1);
      } else {
        return [...prev, { id: folderId, name: folderName }];
      }
    });
  };

  const downloadSharedFolder = async (folder) => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/download-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: folder.id,
          folderName: folder.name
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Falha no download da pasta");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folder.name}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { alert(`Erro ao baixar pasta: ${e.message}`); }
    setDownloading(false);
  };

  // Nova função para download de arquivos dentro de uma pasta compartilhada
  const downloadSharedFile = async (fileItem) => {
    setDownloading(true); // Assumindo apenas um download de cada vez para simplicidade
    try {
      const res = await fetch(`${API_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: fileItem.id })
      });
      if (!res.ok) throw new Error("Servidor offline");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileItem.name;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { alert("Erro ao baixar do drive local. O servidor backend está rodando?"); }
    setDownloading(false);
  };

  const handleSharedPreview = async (item) => {
    // Na SharedView, o item já é público por definição.
    const previewUrl = `${API_URL}/preview/${item.id}`;
    const extension = item.name.split('.').pop().toLowerCase();
    let contentType = 'unsupported';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      contentType = 'image';
    } else if (extension === 'pdf') {
      contentType = 'pdf';
    }

    setPreviewContent({ url: previewUrl, type: contentType, name: item.name });
    setShowPreviewModal(true);
    // Não há menu de ações aqui, então não precisa fechar
  };

  if (error) return (
    <div className="h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-50 p-6 rounded-[2rem] text-red-500 mb-6 shadow-inner" style={{ backgroundColor: 'var(--app-error-light)', color: 'var(--app-error)' }}><Lock size={64} /></div>
      <h1 className="text-3xl font-black mb-2 tracking-tight">Acesso Restrito</h1>
      <p className="text-slate-500 max-w-xs font-medium" style={{ color: 'var(--app-text-medium)' }}>Este item é privado ou não existe mais no drive local.</p>
    </div>
  );

  if (!rootSharedItem) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  // Lógica de renderização baseada no tipo do item raiz partilhado
  if (rootSharedItem.type === 'file') {
    return (
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="content-card text-center" style={{ maxWidth: '500px', padding: '3rem', background: 'white', borderRadius: '2.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
          <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', width: '7rem', height: '7rem', borderRadius: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto', marginBottom: '2rem', boxShadow: '0 10px 30px rgba(102,126,234,0.3)' }}>
            <File size={48} fill="white" fillOpacity={0.3} />
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: '900', marginBottom: '0.75rem', letterSpacing: '-0.025em', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}>{rootSharedItem.name}</h2>

          <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: '500' }}>
            Compartilhado de forma segura via <span style={{ fontWeight: '700', color: '#667eea' }}>JustFiles</span>
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1.5rem', background: '#f1f5f9', borderRadius: '1.5rem', marginBottom: '2rem', fontSize: '0.875rem' }}>
            <div>
              <p style={{ color: '#94a3b8', fontWeight: '500', marginBottom: '0.25rem' }}>Tamanho</p>
              <p style={{ color: '#1e293b', fontWeight: '700', fontSize: '1.125rem' }}>{(rootSharedItem.size / 1024).toFixed(1)} KB</p>
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontWeight: '500', marginBottom: '0.25rem' }}>Tipo</p>
              <p style={{ color: '#1e293b', fontWeight: '700', fontSize: '1.125rem' }}>Arquivo</p>
            </div>
          </div>

          <button
            onClick={downloadRootFile}
            disabled={downloading}
            className="w-full py-4 text-white rounded-1.5rem font-black hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontSize: '1.125rem' }}
          >
            {downloading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                A preparar...
              </>
            ) : (
              <>
                <Download size={20} />
                Baixar Arquivo
              </>
            )}
          </button>

          <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500', lineHeight: '1.5' }}>
            ✓ Download seguro • ✓ Sem registro necessário • ✓ Sem limite de tempo
          </p>
        </div>
      </div>
    );
  } else { // rootSharedItem.type === 'folder'
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <header style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '3rem 1rem', textAlign: 'center' }}>
          <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '1rem', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}>
                <Folder size={40} />
              </div>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.025em', marginBottom: '0.5rem' }}>Pasta Compartilhada</h1>
            <p style={{ fontSize: '1.125rem', opacity: 0.9, marginBottom: '2rem' }}>{rootSharedItem.name}</p>
            <button
              onClick={() => downloadSharedFolder(rootSharedItem)}
              disabled={downloading}
              style={{ background: 'white', color: '#667eea', padding: '0.875rem 2rem', borderRadius: '1rem', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.75rem', fontSize: '1rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', transition: 'all 0.3s' }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)'; }}
            >
              {downloading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  A preparar...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Baixar Tudo (.zip)
                </>
              )}
            </button>
          </div>
        </header>

        <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '2rem 1rem' }}>
          {/* Breadcrumbs para a pasta compartilhada */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2.5rem', fontSize: '0.875rem', overflowX: 'auto', paddingBottom: '0.5rem' }} className="no-scrollbar">
            {sharedBreadcrumbs.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: '0' }}>
                {i > 0 && <ChevronRight size={14} style={{ color: '#cbd5e1' }} />}
                <button
                  onClick={() => navigateSharedFolder(c.id, c.name)}
                  style={{
                    ...(i === sharedBreadcrumbs.length - 1
                      ? { background: '#667eea', color: 'white', fontWeight: '700' }
                      : { color: '#64748b', fontWeight: '500' }),
                    padding: '0.5rem 1rem',
                    borderRadius: '0.75rem',
                    transition: 'all 0.2s ease-in-out',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                  onMouseOver={(e) => { if (i !== sharedBreadcrumbs.length - 1) { e.currentTarget.style.background = '#e2e8f0'; } }}
                  onMouseOut={(e) => { if (i !== sharedBreadcrumbs.length - 1) { e.currentTarget.style.background = 'transparent'; } }}
                >
                  {c.name}
                </button>
              </div>
            ))}
          </nav>

          {displayedItems.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 1rem', background: 'white', borderRadius: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ backgroundColor: '#f1f5f9', padding: '2rem', borderRadius: '50%', marginBottom: '1.5rem', color: '#cbd5e1' }}><Search size={48} /></div>
              <p style={{ color: '#64748b', fontWeight: '700', fontSize: '1rem' }}>Nenhum item nesta pasta compartilhada</p>
              <p style={{ color: '#94a3b8', marginTop: '0.5rem', fontSize: '0.875rem' }}>Esta pasta está vazia no momento</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {displayedItems.map((childItem, index) => (
                <div
                  key={childItem.id}
                  className={`animate-fade-in-up`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '240px',
                    animationDelay: `${index * 50}ms`,
                    background: 'white',
                    borderRadius: '1.5rem',
                    padding: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'all 0.3s ease',
                    cursor: childItem.type === 'folder' ? 'pointer' : 'default',
                    border: '1px solid #e2e8f0'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  onClick={() => childItem.type === 'folder' && navigateSharedFolder(childItem.id, childItem.name)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div
                      className={childItem.type === 'folder' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-700'}
                      style={{ padding: '0.75rem', borderRadius: '1rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {getIconForItem(childItem)}
                    </div>

                    {childItem.type === 'file' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSharedPreview(childItem); }}
                          style={{ background: '#f1f5f9', color: '#667eea', border: 'none', padding: '0.5rem', borderRadius: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                          title="Visualizar"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadSharedFile(childItem); }}
                          style={{ background: '#f1f5f9', color: '#667eea', border: 'none', padding: '0.5rem', borderRadius: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                          title="Baixar"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 'auto' }}>
                    <h3 style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.5rem', transition: 'color 0.2s ease-in-out' }} title={childItem.name}>
                      {childItem.name}
                    </h3>
                    <p style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {childItem.type === 'folder' ? '📁 Pasta' : `📄 ${(childItem.size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <PreviewModal
          show={showPreviewModal}
          content={previewContent}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewContent(null);
          }}
        />
      </div>
    );
  }
}