#!/bin/bash

echo "🚀 Setup da API Darcaltech"
echo "=========================="

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale o Node.js primeiro."
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado. Instale o npm primeiro."
    exit 1
fi

echo "✅ npm encontrado: $(npm --version)"

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp env.example .env
    echo "⚠️  Configure as variáveis de ambiente no arquivo .env"
    echo "   - AWS_ACCESS_KEY_ID"
    echo "   - AWS_SECRET_ACCESS_KEY"
    echo "   - FROM_EMAIL"
    echo "   - TO_EMAIL"
else
    echo "✅ Arquivo .env já existe"
fi

# Verificar configuração AWS
echo "🔍 Verificando configuração AWS..."
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "⚠️  Variáveis AWS não configuradas"
    echo "   Configure AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY"
else
    echo "✅ Variáveis AWS configuradas"
fi

echo ""
echo "🎉 Setup concluído!"
echo ""
echo "Para iniciar o servidor:"
echo "  npm run dev"
echo ""
echo "Para testar a API:"
echo "  curl http://localhost:3001/api/health"
echo ""
echo "Para mais informações, consulte docs/AWS_SES_SETUP.md" 