const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const admin = require('firebase-admin');
const archiver = require('archiver');
const mime = require('mime-types');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const session = require('express-session');
const diskusage = require('diskusage');
const logger = require('./logger');
const securityUtils = require('./security-utils');
require('dotenv').config();

// ========================================================
// SEGURANÇA: Inicialização Firebase Admin via ambiente
// ========================================================
const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH || './justfiles-b2fe9-firebase-adminsdk-fbsvc-b8899bae0a.json';

if (!fs.existsSync(credentialsPath)) {
  console.error('❌ ERRO: Arquivo de credenciais Firebase não encontrado!');
  console.error(`Caminho esperado: ${credentialsPath}`);
  process.exit(1);
}

const serviceAccount = require(credentialsPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const dbAdmin = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3001;

// ========================================================
// SEGURANÇA: CORS configurado com whitelist
// ========================================================
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.PRODUCTION_URL || 'https://seu-dominio.com'
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// ========================================================
// SEGURANÇA: Helmet.js - Headers de segurança HTTP
// ========================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// ========================================================
// SEGURANÇA: Sessão com token CSRF
// ========================================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'seu-secret-key-mude-em-producao',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

app.use(express.json({ limit: '10mb' }));

// ========================================================
// SEGURANÇA: Middleware de logging
// ========================================================
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  next();
});

// ========================================================
// SEGURANÇA: Rate Limiting (Global)
// ========================================================
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Limite de requisições atingido. Tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit atingido', {
      type: 'SECURITY',
      ip: req.ip,
      user: req.userId || 'anônimo'
    });
    res.status(429).json({ error: 'Limite de requisições atingido' });
  }
});

// ========================================================
// SEGURANÇA: Rate Limiting por Usuário
// ========================================================
const userLimiter = rateLimit({
  keyGenerator: (req) => req.userId || req.ip,
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Limite de requisições por usuário atingido',
  skip: (req) => !req.userId, // Só aplica se autenticado
  handler: (req, res) => {
    logger.warn('User rate limit atingido', {
      type: 'SECURITY',
      userId: req.userId,
      ip: req.ip
    });
    res.status(429).json({ error: 'Limite de requisições atingido' });
  }
});

// ========================================================
// SEGURANÇA: Rate Limiting para Upload
// ========================================================
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: 'Limite de uploads atingido. Tente novamente em 1 hora',
  skip: (req) => req.userId === 'admin',
  handler: (req, res) => {
    logger.warn('Upload rate limit atingido', {
      type: 'SECURITY',
      userId: req.userId,
      ip: req.ip
    });
    res.status(429).json({ error: 'Limite de uploads atingido' });
  }
});


app.use(limiter);

// ========================================================
// SEGURANÇA: Middleware de autenticação com Firebase token
// ========================================================
// ========================================================
// SEGURANÇA: Middleware de autenticação (Opcional por padrão)
// ========================================================
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) {
      req.userId = null;
      return next();
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.userId = decodedToken.uid;
      req.userEmail = decodedToken.email;
      next();
    } catch (error) {
      // Se o token for inválido, não barramos aqui, apenas limpamos o userId
      // Rotas protegidas usarão o requireAuth para barrar.
      req.userId = null;
      next();
    }
  } catch (error) {
    logger.error('Erro na autenticação', {
      type: 'SECURITY',
      error: error.message
    });
    res.status(500).json({ error: 'Erro no servidor' });
  }
};

// Middleware para rotas que EXIGEM autenticação
const requireAuth = (req, res, next) => {
  if (!req.userId) {
    logger.warn('Acesso negado: Autenticação necessária', {
      type: 'SECURITY',
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({ error: 'Autenticação necessária' });
  }
  next();
};

// ========================================================
// SEGURANÇA: Sanitização de nomes de arquivo
// ========================================================
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Remove caracteres perigosos
    .replace(/^\.+/, '') // Remove pontos iniciais (evita .bashrc)
    .substring(0, 255); // Limita tamanho
};

// ========================================================
// SEGURANÇA: Validação de path (previne directory traversal)
// ========================================================
const validatePath = (filePath, userId, logContext = {}) => {
  const uploadDir = path.join(__dirname, 'armazenamento_local');
  const realPath = path.resolve(filePath);
  const allowedDir = path.resolve(uploadDir);

  if (!realPath.startsWith(allowedDir)) {
    logger.warn('Path traversal bloqueado', {
      type: 'SECURITY',
      path: filePath,
      userId,
      ...logContext
    });
    throw new Error('Acesso negado');
  }

  return realPath;
};

// ========================================================
// ARMAZENAMENTO: Configuração Multer com segurança
// ========================================================
const uploadDir = path.join(__dirname, 'armazenamento_local');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Limitações de arquivo
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar'];
const FORBIDDEN_EXTENSIONS = ['exe', 'bat', 'sh', 'cmd', 'scr', 'msi', 'app', 'dmg'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userPath = path.join(uploadDir, req.userId || 'common');
    if (!fs.existsSync(userPath)) {
      fs.mkdirSync(userPath, { recursive: true });
    }
    cb(null, userPath);
  },
  filename: (req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + sanitized);
  }
});

// Filtro de arquivo (validação)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);

  // Validar extensão proibida
  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Extensão ${ext} não permitida`), false);
  }

  // Validar extensão permitida (MIME type pode ser falsificado)
  if (!ALLOWED_EXTENSIONS.includes(ext) && ext !== '') {
    return cb(new Error(`Tipo de arquivo não permitido: .${ext}`), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10 // Máximo 10 arquivos por request
  }
});

// ========================================================
// ROTA: Upload com segurança (autenticação + validação)
// ========================================================
app.post('/upload', authenticateToken, requireAuth, userLimiter, uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      logger.warn('Upload sem arquivo', {
        userId: req.userId,
        ip: req.ip
      });
      return res.status(400).json({ error: 'Arquivo não fornecido' });
    }

    // ✅ SEGURANÇA: Validar espaço em disco
    try {
      const diskSpace = await diskusage.check('/');
      const minFreeSpace = 100 * 1024 * 1024; // 100MB mínimo

      if (diskSpace.free < minFreeSpace) {
        fs.unlink(req.file.path, () => { });
        logger.error('Espaço em disco insuficiente', {
          type: 'SECURITY',
          free: diskSpace.free,
          required: minFreeSpace
        });
        return res.status(507).json({ error: 'Servidor sem espaço' });
      }
    } catch (diskErr) {
      logger.error('Erro ao verificar espaço em disco', { error: diskErr.message });
    }

    // ✅ SEGURANÇA: Validar que userId no token corresponde ao corpo
    if (req.body.userId !== req.userId) {
      fs.unlink(req.file.path, () => { });
      logger.warn('Tentativa de upload com userId inconsistente', {
        type: 'SECURITY',
        userId: req.userId,
        ip: req.ip
      });
      return res.status(403).json({ error: 'Acesso negado' });
    }

    logger.info(`Upload bem-sucedido: ${req.file.filename}`, {
      userId: req.userId,
      size: req.file.size,
      filename: req.file.filename
    });
    res.json({ filePath: req.file.path });
  } catch (err) {
    logger.error('Erro no upload', {
      userId: req.userId,
      error: err.message
    });
    res.status(500).json({ error: 'Erro no upload' });
  }
});

// ========================================================
// ROTA: Download com segurança (Suporta itens públicos e privados)
// ========================================================
app.post('/download', authenticateToken, userLimiter, async (req, res) => {
  try {
    const { itemId, filePath, originalName } = req.body;

    if (!itemId && !filePath) {
      return res.status(400).json({ error: 'Identificação do arquivo necessária' });
    }

    let targetPath = filePath;
    let targetName = originalName;
    let isPublic = false;
    let ownerId = null;

    // Buscar metadados no Firestore se o itemId for fornecido
    if (itemId) {
      const itemSnap = await dbAdmin.collection('artifacts').doc('meu-sistema-vps').collection('public').doc('data').collection('items').doc(itemId).get();
      if (!itemSnap.exists) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }
      const itemData = itemSnap.data();
      targetPath = itemData.vpsPath;
      targetName = itemData.name;
      isPublic = itemData.isPublic;
      ownerId = itemData.userId;
    }

    // Se NÃO for público, validar propriedade pelo token verificado
    if (!isPublic) {
      if (!req.userId || req.userId !== ownerId) {
        logger.warn('Tentativa de baixar arquivo privado sem permissão', {
          type: 'SECURITY',
          userId: req.userId,
          targetItemId: itemId,
          targetOwnerId: ownerId,
          ip: req.ip
        });
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    // ✅ SEGURANÇA: Validar path final
    try {
      validatePath(targetPath, req.userId || 'common', { action: 'download' });
    } catch (err) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: "Arquivo físico não encontrado" });
    }

    const fileExtension = path.extname(targetName).toLowerCase();
    const contentType = mime.lookup(fileExtension) || 'application/octet-stream';

    const encodedName = encodeURIComponent(targetName).replace(/'/g, '%27');

    res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Type', contentType);

    logger.info('Download iniciado', { itemId, isPublic, userId: req.userId });
    fs.createReadStream(targetPath).pipe(res);
  } catch (err) {
    logger.error('Erro no download', { error: err.message });
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ========================================================
// ROTA: Deletar arquivo com segurança
// ========================================================
app.delete('/delete', authenticateToken, requireAuth, userLimiter, (req, res) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      logger.warn('Delete sem filePath', {
        userId: req.userId,
        ip: req.ip
      });
      return res.status(400).json({ error: 'Arquivo inválido' });
    }

    // ✅ SEGURANÇA: Validar path
    try {
      validatePath(filePath, req.userId, { action: 'delete' });
    } catch (err) {
      logger.warn('Delete path traversal bloqueado', {
        type: 'SECURITY',
        userId: req.userId,
        path: filePath,
        ip: req.ip
      });
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Arquivo deletado: ${filePath}`, {
        userId: req.userId
      });
      return res.json({ status: "Arquivo removido" });
    }

    logger.warn('Tentativa de deletar arquivo inexistente', {
      userId: req.userId,
      path: filePath
    });
    res.status(404).json({ error: 'Arquivo não encontrado' });
  } catch (err) {
    logger.error('Erro ao deletar', {
      userId: req.userId,
      error: err.message
    });
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// --- Nova Rota: Pré-visualização de Ficheiros ---
app.get('/preview/:itemId', authenticateToken, async (req, res) => {
  const { itemId } = req.params;

  if (!itemId) {
    return res.status(400).send("ID do item não fornecido.");
  }

  const appId = "meu-sistema-vps";
  const itemsRef = dbAdmin.collection('artifacts').doc(appId).collection('public').doc('data').collection('items');

  try {
    const itemSnap = await itemsRef.doc(itemId).get();

    if (!itemSnap.exists) {
      return res.status(404).send("Item não encontrado.");
    }

    const itemData = itemSnap.data();

    // Security Check: Allow preview if item is public OR if user is the verified owner
    if (!itemData.isPublic) {
      if (!req.userId || itemData.userId !== req.userId) {
        return res.status(403).send("Acesso negado.");
      }
    }

    if (itemData.type !== 'file' || !itemData.vpsPath || !fs.existsSync(itemData.vpsPath)) {
      return res.status(404).send("Ficheiro não encontrado.");
    }

    const contentType = mime.lookup(itemData.name) || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    fs.createReadStream(itemData.vpsPath).pipe(res);
  } catch (error) {
    console.error("Erro na rota de pré-visualização:", error);
    res.status(500).send("Erro interno.");
  }
});

// --- Nova Rota: Baixar Pasta como ZIP ---
app.post('/download-folder', authenticateToken, async (req, res) => {
  const { folderId, folderName } = req.body;
  if (!folderId || !folderName) {
    return res.status(400).json({ error: "Dados insuficientes." });
  }

  const appId = "meu-sistema-vps";
  const itemsRef = dbAdmin.collection('artifacts').doc(appId).collection('public').doc('data').collection('items');

  try {
    const rootFolderSnap = await itemsRef.doc(folderId).get();
    if (!rootFolderSnap.exists) {
      return res.status(404).json({ error: "Pasta não encontrada." });
    }
    const rootFolderData = rootFolderSnap.data();
    const isPublicDownload = rootFolderData.isPublic;

    // Se a pasta não for pública, garantir que temos um usuário autenticado e que ele é o dono
    if (!isPublicDownload) {
      if (!req.userId || rootFolderData.userId !== req.userId) {
        return res.status(403).json({ error: "Acesso negado." });
      }
    }

    // Função para buscar todos os ficheiros recursivamente
    const getAllFiles = async (currentFolderId, currentPath, isRootPublic) => {
      let filesToZip = [];
      let query = itemsRef.where('parentId', '==', currentFolderId);

      if (isRootPublic) {
        query = query.where('isPublic', '==', true);
      } else {
        query = query.where('userId', '==', req.userId);
      }

      const snapshot = await query.get();
      if (snapshot.empty) return [];

      for (const doc of snapshot.docs) {
        const item = doc.data();
        if (item.type === 'file') {
          if (fs.existsSync(item.vpsPath)) {
            filesToZip.push({
              filePath: item.vpsPath,
              zipPath: path.join(currentPath, item.name)
            });
          }
        } else if (item.type === 'folder') {
          const subFiles = await getAllFiles(doc.id, path.join(currentPath, item.name), isRootPublic);
          filesToZip = filesToZip.concat(subFiles);
        }
      }
      return filesToZip;
    };

    const files = await getAllFiles(folderId, '', isPublicDownload);

    if (files.length === 0) {
      return res.status(404).json({ error: "A pasta está vazia ou não contém ficheiros públicos." });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.attachment(`${folderName}.zip`);
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    for (const file of files) {
      archive.file(file.filePath, { name: file.zipPath });
    }

    await archive.finalize();
  } catch (error) {
    console.error("Erro ao criar zip da pasta:", error);
    res.status(500).json({ error: "Erro ao processar a pasta." });
  }
});

// --- Nova Rota: Criar Utilizador ---
app.post('/create-user', authenticateToken, requireAuth, userLimiter, async (req, res) => {
  const { email, password, username } = req.body;

  // ✅ SEGURANÇA: Validação rigorosa
  if (!email || !password || !username) {
    logger.warn('Create-user com parâmetros inválidos', {
      type: 'SECURITY',
      userId: req.userId,
      ip: req.ip
    });
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  // ✅ SEGURANÇA: Validar email
  if (!securityUtils.validateEmail(email)) {
    logger.warn('Create-user com email inválido', {
      type: 'SECURITY',
      email,
      userId: req.userId,
      ip: req.ip
    });
    return res.status(400).json({ error: 'Email inválido' });
  }

  // ✅ SEGURANÇA: Validar força de senha
  const passwordStrength = securityUtils.getPasswordStrength(password);
  if (passwordStrength < 60) {
    return res.status(400).json({
      error: 'Senha fraca. Use maiúscula, minúscula, números e 8+ caracteres',
      strength: passwordStrength
    });
  }

  // ✅ SEGURANÇA: Sanitizar entrada
  const sanitizedUsername = securityUtils.sanitizeInput(username);

  try {
    // 1. Criar utilizador no Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: sanitizedUsername,
    });

    // 2. Criar documento do utilizador no Firestore
    const appId = "meu-sistema-vps";
    const userRef = dbAdmin.collection('artifacts').doc(appId).collection('public').doc('data').collection('users').doc(userRecord.uid);

    const newUserDoc = {
      uid: userRecord.uid,
      username: sanitizedUsername,
      email: email,
      role: 'user',
      storageLimit: 100 * 1024 * 1024,
      usedSpace: 0,
      createdAt: new Date().toISOString(),
      isBlocked: false,
      lastLogin: null
    };

    await userRef.set(newUserDoc);

    logger.info(`Novo usuário criado: ${sanitizedUsername}`, {
      userId: req.userId,
      newUserId: userRecord.uid,
      email
    });

    res.status(201).json({
      message: `Usuário criado com sucesso`,
      uid: userRecord.uid
    });

  } catch (error) {
    logger.error('Erro ao criar usuário', {
      userId: req.userId,
      email,
      error: error.message,
      type: 'SECURITY'
    });
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// ========================================================
// ROTA: Gerar CSRF token
// ========================================================
app.get('/csrf-token', (req, res) => {
  const token = securityUtils.generateCSRFToken();
  req.session.csrfToken = token;
  res.json({ csrfToken: token });
});

// ========================================================
// ROTA: Health check com logging
// ========================================================
app.get('/health', (req, res) => {
  logger.info('Health check');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ========================================================
// ROTA: Eliminar todos os dados de um utilizador do disco
// ========================================================
app.post('/delete-user-data', authenticateToken, requireAuth, userLimiter, (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  // ✅ SEGURANÇA: Verificar se é admin ou o próprio usuário
  if (req.userId !== userId) {
    // Aqui você precisaria verificar se o req.userId tem role 'admin' no Firestore
    // Para simplificar, vamos assumir que o frontend já faz essa verificação e o backend valida propriedade
    // Mas o ideal é consultar o Firestore aqui também para confirmar o role do req.userId.
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const userPath = path.join(uploadDir, userId);
  if (fs.existsSync(userPath)) {
    try {
      fs.rmSync(userPath, { recursive: true, force: true });
      logger.info(`Dados do usuário deletados: ${userId}`, {
        userId: req.userId
      });
      return res.json({ status: 'Dados removidos' });
    } catch (err) {
      logger.error('Erro ao deletar dados do usuário', {
        userId,
        error: err.message
      });
      return res.status(500).json({ error: 'Erro ao deletar dados' });
    }
  }

  logger.warn('Tentativa de deletar dados inexistentes', {
    userId,
    requester: req.userId
  });
  res.status(404).json({ error: 'Dados não encontrados' });
});

app.listen(PORT, () => {
  logger.info(`Servidor iniciado: http://localhost:${PORT}`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
  console.log('------------------------------------------');
  console.log(`🚀 SERVIDOR ATIVO: http://localhost:${PORT}`);
  console.log('------------------------------------------');
});
