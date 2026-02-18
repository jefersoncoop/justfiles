# 🚀 GUIA RÁPIDO - COMEÇAR

Siga este guia para começar imediatamente.

---

## ⏱️ Tempo: ~5 minutos

---

## 1️⃣ Instalar Dependências

```bash
# Terminal 1 - Backend
cd /Users/jefersonrodrigues/Dev/justfiles
npm install

# Terminal 2 - Frontend
cd frontend
npm install
```

**Resultado esperado:**
```
added 25 packages in 2.5s
added 15 packages in 3.2s
```

---

## 2️⃣ Verificar Configuração

```bash
# Voltar para raiz
cd /Users/jefersonrodrigues/Dev/justfiles

# Verificar que os arquivos de config existem
ls -la .env .env.example frontend/.env.local frontend/.env.example
```

**Resultado esperado:**
```
.env                          (320 bytes)
.env.example                  (393 bytes)
frontend/.env.local           (372 bytes)
frontend/.env.example         (295 bytes)
```

---

## 3️⃣ Iniciar Servidores

### Terminal 1 - Backend
```bash
cd /Users/jefersonrodrigues/Dev/justfiles
node server.js
```

**Resultado esperado:**
```
🔒 Servidor rodando em http://localhost:3001
✓ CORS configurado
✓ Rate limiting ativo
✓ Autenticação Firebase ativa
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

**Resultado esperado:**
```
➜  Local:   http://localhost:5173/
➜  press h to show help
```

---

## 4️⃣ Testar Segurança

### Abrir Frontend
```
Ir para: http://localhost:5173
```

### Login
```
1. Clicar em "Login"
2. Usar credenciais de teste
3. Observar que não há erro 401
```

### Upload
```
1. Fazer login
2. Clicar em "Upload"
3. Escolher arquivo .pdf
4. Verificar se upload funciona
```

### Verificar Token
Abrir DevTools (F12) → Network → Observar que requisições têm:
```
Authorization: Bearer eyJhbGciOi...
```

---

## 5️⃣ Testar Proteções

### Teste 1: Sem Token (Não Funciona)
```bash
curl -X POST http://localhost:3001/upload
```
**Resposta esperada:**
```json
{"error": "Token não fornecido"}
```

### Teste 2: CORS Bloqueado (Origem Inválida)
```bash
curl -X GET \
  -H "Origin: http://attacker.com" \
  http://localhost:3001
```
**Resposta esperada:**
```
403 Forbidden
```

### Teste 3: Rate Limiting
```bash
# Fazer 105 requisições rapidamente
for i in {1..105}; do curl http://localhost:3001/ 2>/dev/null & done
```
**Resposta esperada (depois de 100):**
```json
{"error": "Muitas requisições"}
```

---

## 📊 Checklist de Funcionamento

- [ ] Backend rodando sem erros
- [ ] Frontend acessível em http://localhost:5173
- [ ] Login funciona
- [ ] Upload de arquivo funciona
- [ ] DevTools mostra Authorization header
- [ ] Teste sem token retorna 401
- [ ] CORS bloqueado para origem inválida

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| `Cannot find module 'dotenv'` | Rodar `npm install` |
| `Cannot find module 'express-rate-limit'` | Rodar `npm install` |
| `Port 3001 already in use` | Trocar em `.env`: `PORT=3002` |
| `Port 5173 already in use` | Mudar no Vite: `npm run dev -- --port 5174` |
| `CORS error no frontend` | Verificar `FRONTEND_URL` em `.env` |
| `401 Token error` | Fazer logout e login de novo |
| `Firebase config error` | Verificar `frontend/.env.local` |

---

## 📚 Próximas Leituras

Se tudo funcionar, leia em ordem:

1. **SECURITY_IMPLEMENTATION.md** - Detalhes técnicos
2. **SECURITY_CHECKLIST.md** - Testes avançados
3. **README-SECURITY.md** - Relatório completo

---

## ✅ Pronto!

Parabéns! 🎉 Você tem:

- ✅ Credenciais protegidas
- ✅ Autenticação no backend
- ✅ CORS seguro
- ✅ Rate limiting
- ✅ Validação de arquivo
- ✅ Path traversal bloqueado

**Sistema está seguro e pronto para desenvolvimento.**

---

## 🎯 Próximo Passo

Ler: `SECURITY_IMPLEMENTATION.md` para configurações avançadas.

---

Dúvidas? Consulte a documentação ou verifique os logs de erro.
