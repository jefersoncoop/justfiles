import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, getDocs, 
  query, where, onSnapshot, updateDoc, deleteDoc, addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  Folder, File, Shield, Users, HardDrive, Plus, 
  Trash2, Globe, Lock, Copy, Download, ChevronRight, 
  LogOut, Loader2, UploadCloud, Search
} from 'lucide-react';

// ========================================================
// 1. COLA O TEU JSON DO FIREBASE AQUI PARA TESTAR LOCALMENTE
// ========================================================
const firebaseConfig = {
  apiKey: "AIzaSyCp-JchdlKdapL9Nud1j0PpCUtwYGDFS4Q",
  authDomain: "justfiles-b2fe9.firebaseapp.com",
  projectId: "justfiles-b2fe9",
  storageBucket: "justfiles-b2fe9.firebasestorage.app",
  messagingSenderId: "921976405171",
  appId: "1:921976405171:web:833289bce4d368155e44c6"
};


const API_URL = "http://localhost:3001"; // URL do servidor backend local
const appId = "meu-sistema-vps";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const glassEffect = "bg-white/80 backdrop-blur-md border border-slate-200";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('login'); 
  const [sharedItemId, setSharedItemId] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const d = userSnap.data();
          setUserData(d);
          setUser(u);
          setView(d.role === 'admin' ? 'admin' : 'user');
        } else {
          const allUsers = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
          const isFirst = allUsers.empty;
          const newData = {
            uid: u.uid,
            username: u.isAnonymous ? 'Utilizador Local' : (u.email || 'Utilizador'),
            role: isFirst ? 'admin' : 'user',
            storageLimit: 100 * 1024 * 1024, // 100MB
            usedSpace: 0,
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, newData);
          setUserData(newData);
          setUser(u);
          setView(isFirst ? 'admin' : 'user');
        }
      } else {
        setUser(null);
        setView('login');
      }
      setLoading(false);
    });

    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    if (shareId) {
      setSharedItemId(shareId);
      setView('shared');
    }

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {view === 'login' && <LoginView />}
      {view === 'admin' && <AdminDashboard user={user} userData={userData} setView={setView} />}
      {view === 'user' && <UserDashboard user={user} userData={userData} setView={setView} />}
      {view === 'shared' && <SharedView itemId={sharedItemId} />}
    </div>
  );
}

function LoginView() {
  return (
    <div className="h-screen flex items-center justify-center p-4">
      <div className={`max-w-md w-full p-8 rounded-3xl shadow-xl ${glassEffect}`}>
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg"><Shield size={32} /></div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">SafeHost Local</h1>
        <p className="text-slate-500 text-center mb-8">Teste o armazenamento na sua máquina.</p>
        <button onClick={() => signInAnonymously(auth)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all">Entrar no Sistema</button>
      </div>
    </div>
  );
}

function AdminDashboard({ user, userData, setView }) {
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    return onSnapshot(q, (snapshot) => {
      setUsersList(snapshot.docs.map(d => d.data()));
    });
  }, []);

  const updateLimit = async (uid, mb) => {
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', uid);
    await updateDoc(userRef, { storageLimit: parseInt(mb) * 1024 * 1024 });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Painel Administrativo</h1>
        <div className="flex gap-2">
          <button onClick={() => setView('user')} className="px-4 py-2 bg-white border rounded-xl hover:bg-slate-50">Meus Ficheiros</button>
          <button onClick={() => signOut(auth)} className="p-2 text-red-500"><LogOut /></button>
        </div>
      </header>
      <div className={`rounded-2xl overflow-hidden ${glassEffect}`}>
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-4 font-semibold">Utilizador</th>
              <th className="p-4 font-semibold">Quota (MB)</th>
              <th className="p-4 font-semibold">Uso</th>
              <th className="p-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersList.map(u => (
              <tr key={u.uid}>
                <td className="p-4 font-medium">{u.username}</td>
                <td className="p-4">
                  <input type="number" defaultValue={(u.storageLimit / 1024 / 1024).toFixed(0)} 
                    onBlur={(e) => updateLimit(u.uid, e.target.value)}
                    className="w-20 p-1 border rounded" />
                </td>
                <td className="p-4 text-xs">{(u.usedSpace / 1024 / 1024).toFixed(2)} MB</td>
                <td className="p-4 text-right"><button className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserDashboard({ user, userData, setView }) {
  const [currentFolder, setCurrentFolder] = useState('root');
  const [items, setItems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: 'root', name: 'Início' }]);

  useEffect(() => {
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'items'),
      where('userId', '==', user.uid),
      where('parentId', '==', currentFolder)
    );
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.type === 'folder' ? -1 : 1));
    });
  }, [currentFolder, user.uid]);

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (userData.usedSpace + file.size > userData.storageLimit) return alert("Limite excedido!");

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.uid);

      const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      const data = await res.json();

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'items'), {
        name: file.name, type: 'file', size: file.size, parentId: currentFolder,
        userId: user.uid, isPublic: false, vpsPath: data.filePath, createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
        usedSpace: userData.usedSpace + file.size
      });
    } catch (err) { alert("Erro no upload local."); }
    setIsUploading(false);
  };

  const createFolder = async () => {
    const n = prompt("Nome da pasta:");
    if (!n) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'items'), {
      name: n, type: 'folder', parentId: currentFolder, userId: user.uid, isPublic: false
    });
  };

  const deleteItem = async (item) => {
    if (!confirm("Apagar ficheiro do disco local?")) return;
    if (item.type === 'file') {
      await fetch(`${API_URL}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: item.vpsPath })
      });
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
        usedSpace: Math.max(0, userData.usedSpace - item.size)
      });
    }
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id));
  };

  const togglePublic = async (item) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id), { isPublic: !item.isPublic });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Meus Ficheiros Locais</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">
            Espaço: {(userData.usedSpace / 1024 / 1024).toFixed(1)} / {(userData.storageLimit / 1024 / 1024).toFixed(0)} MB
          </p>
        </div>
        <div className="flex gap-2">
          {userData.role === 'admin' && <button onClick={() => setView('admin')} className="p-2 border rounded-xl"><Shield size={20} /></button>}
          <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2">
            <UploadCloud size={18} /> Carregar <input type="file" className="hidden" onChange={uploadFile} />
          </label>
          <button onClick={createFolder} className="px-4 py-2 border rounded-xl hover:bg-slate-50 flex items-center gap-2"><Plus size={18} /> Pasta</button>
          <button onClick={() => signOut(auth)} className="p-2 text-red-500"><LogOut /></button>
        </div>
      </header>

      <nav className="flex items-center gap-2 mb-6 text-sm">
        {breadcrumbs.map((c, i) => (
          <span key={c.id} className="flex items-center gap-2">
            {i > 0 && <ChevronRight size={14} />}
            <button onClick={() => { setBreadcrumbs(breadcrumbs.slice(0, i+1)); setCurrentFolder(c.id); }} className={i === breadcrumbs.length - 1 ? "font-bold" : "text-slate-500"}>{c.name}</button>
          </span>
        ))}
      </nav>

      {isUploading && <div className="p-4 bg-blue-50 text-blue-700 rounded-xl mb-6 animate-pulse">Enviando para o disco local...</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.id} className={`p-4 rounded-2xl group transition-all hover:shadow-lg ${glassEffect}`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${item.type === 'folder' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}
                onClick={() => item.type === 'folder' && (setBreadcrumbs([...breadcrumbs, {id: item.id, name: item.name}]), setCurrentFolder(item.id))}
                style={{ cursor: item.type === 'folder' ? 'pointer' : 'default' }}>
                {item.type === 'folder' ? <Folder /> : <File />}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => togglePublic(item)} className={`p-1 ${item.isPublic ? 'text-green-500' : 'text-slate-300'}`}>{item.isPublic ? <Globe size={16}/> : <Lock size={16}/>}</button>
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?share=${item.id}`); alert("Link copiado!"); }} className="p-1 text-slate-400"><Copy size={16}/></button>
                <button onClick={() => deleteItem(item)} className="p-1 text-red-400"><Trash2 size={16}/></button>
              </div>
            </div>
            <h3 className="font-semibold truncate text-sm">{item.name}</h3>
            <p className="text-[10px] text-slate-400 uppercase mt-1">{item.type === 'folder' ? 'Pasta' : `${(item.size / 1024).toFixed(1)} KB`}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SharedView({ itemId }) {
  const [item, setItem] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', itemId)).then(s => {
      if (s.exists() && s.data().isPublic) setItem(s.data());
    });
  }, [itemId]);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: item.vpsPath, originalName: item.name })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = item.name;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { alert("Erro no download."); }
    setDownloading(false);
  };

  if (!item) return <div className="h-screen flex flex-col items-center justify-center"><Lock size={48} className="text-slate-200 mb-4" /><p>Link inválido ou privado.</p></div>;

  return (
    <div className="h-screen flex items-center justify-center p-6 bg-slate-100">
      <div className={`max-w-md w-full p-10 rounded-[2.5rem] text-center shadow-2xl ${glassEffect}`}>
        <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-blue-200"><File size={40} /></div>
        <h2 className="text-2xl font-bold mb-2">{item.name}</h2>
        <p className="text-slate-400 mb-8 uppercase text-xs font-bold tracking-widest">Partilha Segura • {(item.size / 1024).toFixed(1)} KB</p>
        <button onClick={download} disabled={downloading} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
          {downloading ? <Loader2 className="animate-spin" /> : <Download />} {downloading ? 'A descarregar...' : 'Baixar Arquivo'}
        </button>
      </div>
    </div>
  );
}