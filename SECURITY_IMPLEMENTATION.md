# 🔒 GUIA DE IMPLEMENTAÇÃO - CORREÇÕES DE SEGURANÇA

## ✅ COMPLETADAS AUTOMATICAMENTE

### 1. ✅ Credenciais Firebase Protegidas
- [x] Arquivo `.env.example` criado
- [x] Arquivo `.env.local` configurado (frontend)
- [x] Arquivo `.gitignore` criado
- [x] Firebase config movida para variáveis de ambiente

### 2. ✅ Backend - Segurança Implementada
- [x] CORS configurado com whitelist
- [x] Rate limiting implementado
- [x] Sanitização de filenames
- [x] Validação de path (previne directory traversal)
- [x] Autenticação com Firebase tokens
- [x] Validação de tipos de arquivo
- [x] Limite de tamanho de arquivo (100MB)
- [x] Extensões proibidas bloqueadas (.exe, .bat, .sh, etc)

### 3. ✅ Dependências Atualizadas
- [x] `express-rate-limit` adicionado
- [x] `dotenv` adicionado
- [x] `firebase-admin` já presente

---

## 🔴 PRÓXIMAS ETAPAS (MANUAL)

### Passo 1: Instalar Dependências

```bash
# Backend
cd /Users/jefersonrodrigues/Dev/justfiles
npm install

# Frontend
cd frontend
npm install
```

### Passo 2: Atualizar Frontend para usar Tokens

**Adicionar esta função LOGO APÓS o `const uploadFile = ...`**

Localizar linha ~670 (função uploadFile) e adicionar NO INÍCIO:

```javascript
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
```

**Depois, substituir estas funções:**

```javascript
// ✅ uploadFile - adicionar validações
const uploadFile = async (e) => {
  const files = Array.from(e.target.files);
  if (!files || files.length === 0) return;

  // SEGURANÇA: Validações
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar'];
  const FORBIDDEN_EXTENSIONS = ['exe', 'bat', 'sh', 'cmd', 'scr', 'msi', 'app', 'dmg'];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      alert(`${file.name} excede 100MB`);
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      alert(`Extensão ${ext} não permitida`);
      return;
    }

    if (!ALLOWED_EXTENSIONS.includes(ext) && ext !== '') {
      alert(`Tipo de arquivo não permitido: .${ext}`);
      return;
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (userData.usedSpace + totalSize > userData.storageLimit) {
    return alert("Limite de espaço atingido!");
  }

  setIsUploading(true);
  const results = { success: [], failed: [] };

  try {
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.uid);

        // ✅ Token no upload
        const token = await user.getIdToken();
        const res = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
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

        results.success.push(file.name);

        logAction('upload_file', {
          performedBy: userData.username,
          itemName: file.name,
          details: `Arquivo de ${(file.size / 1024).toFixed(1)} KB enviado`
        });
      } catch (fileErr) {
        console.error(`Erro ao fazer upload de ${file.name}:`, fileErr);
        results.failed.push(file.name);
      }
    }

    // Atualizar usado apenas com arquivos bem-sucedidos
    const successSize = results.success.reduce((sum, name) => {
      const file = files.find(f => f.name === name);
      return sum + (file?.size || 0);
    }, 0);

    if (successSize > 0) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
        usedSpace: userData.usedSpace + successSize
      });
    }

    if (results.failed.length > 0) {
      alert(`⚠️ ${results.success.length}/${files.length} arquivos enviados. Falhas: ${results.failed.join(', ')}`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  } catch (err) {
    alert("Falha ao enviar arquivos. Backend rodando?");
  }
  setIsUploading(false);
};
```

### Passo 3: Atualizar deleteItem

```javascript
const deleteItem = async (item) => {
  if (!confirm(`Confirmar eliminação permanente?`)) return;
  try {
    if (item.type === 'file') {
      const res = await fetchWithAuth(`${API_URL}/delete`, {
        method: 'DELETE',
        body: JSON.stringify({ filePath: item.vpsPath })
      });
      
      if (!res.ok) throw new Error("Erro ao deletar");
      
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
  } catch (err) {
    console.error("Erro ao deletar:", err);
    alert("Erro ao apagar.");
  }
};
```

### Passo 4: Atualizar downloadFile

```javascript
const downloadFile = async (item) => {
  if (downloadingItemId) return;
  setDownloadingItemId(item.id);
  try {
    const res = await fetchWithAuth(`${API_URL}/download`, {
      method: 'POST',
      body: JSON.stringify({ filePath: item.vpsPath, originalName: item.name })
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
    alert("Erro ao baixar. Backend rodando?");
  } finally {
    setDownloadingItemId(null);
  }
};
```

### Passo 5: Atualizar downloadFolder

```javascript
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
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    alert(`Erro ao baixar pasta: ${e.message}`);
  } finally {
    setDownloadingItemId(null);
  }
};
```

### Passo 6: Atualizar rota /download-folder do Backend

Localizar no `server.js` e adicionar autenticação:

```javascript
app.post('/download-folder', authenticateToken, async (req, res) => {
  try {
    const { folderId, folderName } = req.body;
    const userId = req.userId; // Vem do token, não do corpo

    if (!folderId || !folderName) {
      return res.status(400).json({ error: "Dados insuficientes para baixar a pasta." });
    }

    const appId = "meu-sistema-vps";
    const itemsRef = dbAdmin.collection('artifacts').doc(appId).collection('public').doc('data').collection('items');

    // Buscar pasta raiz para verificar permissões
    const rootFolderSnap = await itemsRef.doc(folderId).get();
    if (!rootFolderSnap.exists) {
      return res.status(404).json({ error: "Pasta raiz não encontrada." });
    }

    const rootFolderData = rootFolderSnap.data();
    const isPublicDownload = rootFolderData.isPublic;

    // Se não é pública, verificar se é dono
    if (!isPublicDownload && rootFolderData.userId !== userId) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    // Resto do código...
  } catch (err) {
    console.error('Erro:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
```

### Passo 7: Criar arquivo .env (Backend)

```bash
cp .env.example .env
```

Editar `.env`:
```
PORT=3001
NODE_ENV=development
FIREBASE_CREDENTIALS_PATH=./justfiles-b2fe9-firebase-adminsdk-fbsvc-b8899bae0a.json
FRONTEND_URL=http://localhost:5173
PRODUCTION_URL=https://seu-dominio.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 🧪 TESTAR

```bash
# Terminal 1 - Backend
cd /Users/jefersonrodrigues/Dev/justfiles
npm install
node server.js

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

Abrir http://localhost:5173

---

## 📊 Problemas Ainda a Resolver

Ainda faltam corrigir (em próxima fase):

- [ ] **Memory leaks em listeners** - Adicionar cleanup nas funções useEffect
- [ ] **Race condition downloads** - Usar Set<> para múltiplos downloads
- [ ] **Sem debounce na pesquisa** - Adicionar função debounce
- [ ] **Código duplicado** - Refatorar funções comuns
- [ ] **Sem testes unitários** - Criar test suite

---

## ⚠️ AVISOS IMPORTANTES

1. **NUNCA commitar `.env.local`** - Já está em `.gitignore`
2. **Revoke Firebase keys imediatamente** se já foram expostas
3. **Gerar novas credenciais** em Firebase Console
4. **Configurar HTTPS em produção** com certificado SSL
5. **Mudar senhas de admin** após deploy

---

## 🎯 RESUMO DO QUE FOI FEITO

```
✅ Proteção de Credenciais
├─ Firebase config em .env
├─ .gitignore configurado
└─ .env.example criado

✅ Backend - Segurança
├─ CORS seguro (whitelist)
├─ Rate limiting (100 req/15min)
├─ Autenticação com tokens
├─ Validação de files
├─ Sanitização de filenames
├─ Path traversal protection
└─ Extensões proibidas bloqueadas

🔄 Frontend - Em Progresso
├─ Helper fetchWithAuth criado
└─ Integração de tokens nas requisições

⏳ A Fazer (Próxima Fase)
├─ Refatoração de código
├─ Testes unitários
└─ Otimização de performance
```

---

Criado em: 22 de janeiro de 2026
Documentação: Guia de Implementação - Correções de Segurança
