#!/bin/bash

# 🔐 Script de Configuração de Segurança
# Instala dependências e verifica configuração

echo "=========================================="
echo "🔐 CONFIGURAÇÃO DE SEGURANÇA"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está na pasta correta
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ Erro: Execute o script a partir da raiz do projeto${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Passo 1: Instalar dependências backend${NC}"
npm install dotenv express-rate-limit

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependências backend instaladas${NC}"
else
    echo -e "${RED}❌ Erro ao instalar dependências backend${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📦 Passo 2: Instalar dependências frontend${NC}"
cd frontend
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependências frontend instaladas${NC}"
else
    echo -e "${RED}❌ Erro ao instalar dependências frontend${NC}"
    exit 1
fi
cd ..

echo ""
echo -e "${YELLOW}📋 Passo 3: Verificar arquivos de configuração${NC}"

# Verificar .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado${NC}"
    echo "   Criando a partir de .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ .env criado (edite os valores reais)${NC}"
    else
        echo -e "${RED}❌ .env.example não encontrado${NC}"
    fi
else
    echo -e "${GREEN}✅ .env encontrado${NC}"
fi

# Verificar frontend/.env.local
if [ ! -f "frontend/.env.local" ]; then
    echo -e "${YELLOW}⚠️  Arquivo frontend/.env.local não encontrado${NC}"
    echo "   Criando a partir de frontend/.env.example..."
    if [ -f "frontend/.env.example" ]; then
        cp frontend/.env.example frontend/.env.local
        echo -e "${YELLOW}⚠️  Adicione suas credenciais Firebase em frontend/.env.local${NC}"
    else
        echo -e "${RED}❌ frontend/.env.example não encontrado${NC}"
    fi
else
    echo -e "${GREEN}✅ frontend/.env.local encontrado${NC}"
fi

echo ""
echo -e "${YELLOW}🔒 Passo 4: Verificar segurança${NC}"

# Verificar se Firebase credentials está em .gitignore
if grep -q "firebase-adminsdk" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✅ Firebase credentials protegidos em .gitignore${NC}"
else
    echo -e "${RED}❌ Firebase credentials NÃO estão em .gitignore${NC}"
fi

# Verificar se .env está em .gitignore
if grep -q "^\.env$" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✅ .env protegido em .gitignore${NC}"
else
    echo -e "${RED}❌ .env NÃO está em .gitignore${NC}"
fi

# Verificar .env.local em gitignore
if grep -q "\.env\.local" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✅ .env.local protegido em .gitignore${NC}"
else
    echo -e "${RED}❌ .env.local NÃO está em .gitignore${NC}"
fi

echo ""
echo -e "${YELLOW}✨ Passo 5: Resumo${NC}"
echo ""
echo "Próximos passos:"
echo "1. Editar .env com valores reais de configuração"
echo "2. Editar frontend/.env.local com credenciais Firebase"
echo "3. Rodar backend: node server.js"
echo "4. Rodar frontend: cd frontend && npm run dev"
echo ""
echo -e "${GREEN}=========================================="
echo "✅ CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!"
echo "==========================================${NC}"
