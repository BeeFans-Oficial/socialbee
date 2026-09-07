#!/bin/bash

# 🐝 BeeSocial — Quick Commands
# Comandos úteis para desenvolvimento

# Mostrar banner
show_banner() {
  cat BANNER.txt
}

# Status do projeto
status() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🐝 BeeSocial — Status do Projeto"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📦 Dependências instaladas:"
  npm list --depth=0 | head -n 20
  echo ""
  echo "📊 Estatísticas:"
  echo "   Arquivos .tsx/.ts: $(find . -name '*.tsx' -o -name '*.ts' | grep -v node_modules | grep -v .next | wc -l)"
  echo "   Componentes: $(find components -name '*.tsx' | wc -l)"
  echo "   Páginas: $(find app -name 'page.tsx' | wc -l)"
  echo ""
  echo "✅ Servidor: http://localhost:3000"
  echo ""
}

# Abrir documentação
docs() {
  case "$1" in
    "readme")
      cat README.md
      ;;
    "setup")
      cat SETUP_COMPLETO.md
      ;;
    "como")
      cat COMO_CONTINUAR.md
      ;;
    "resumo")
      cat RESUMO_FINAL.md
      ;;
    "arquivos")
      cat ARQUIVOS_CRIADOS.md
      ;;
    "indice")
      cat INDICE_DOCS.md
      ;;
    *)
      echo "Documentação disponível:"
      echo "  docs readme    - README.md"
      echo "  docs setup     - SETUP_COMPLETO.md"
      echo "  docs como      - COMO_CONTINUAR.md"
      echo "  docs resumo    - RESUMO_FINAL.md"
      echo "  docs arquivos  - ARQUIVOS_CRIADOS.md"
      echo "  docs indice    - INDICE_DOCS.md"
      ;;
  esac
}

# Limpar cache e rebuild
clean() {
  echo "🧹 Limpando cache..."
  rm -rf .next
  rm -rf node_modules/.cache
  echo "✅ Cache limpo!"
}

# Verificar erros
check() {
  echo "🔍 Verificando erros..."
  echo ""
  echo "TypeScript:"
  npx tsc --noEmit
  echo ""
  echo "ESLint:"
  npm run lint
  echo ""
  echo "✅ Verificação completa!"
}

# Listar componentes
components() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🧩 Componentes BeeSocial"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "UI Components:"
  ls -1 components/ui/*.tsx | sed 's|components/ui/||' | sed 's|\.tsx||'
  echo ""
  echo "Shared Components:"
  ls -1 components/shared/*.tsx | sed 's|components/shared/||' | sed 's|\.tsx||'
  echo ""
}

# Listar páginas
pages() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📄 Páginas BeeSocial"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  find app -name 'page.tsx' | sed 's|app/||' | sed 's|/page.tsx||' | while read page; do
    if [ -z "$page" ]; then
      echo "  / (Landing Page)"
    else
      echo "  /$page"
    fi
  done
  echo ""
}

# Estrutura do projeto
tree_project() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📁 Estrutura do Projeto"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  tree -I 'node_modules|.next|.git' -L 3
  echo ""
}

# Abrir no navegador
open_browser() {
  echo "🌐 Abrindo http://localhost:3000"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3000
  else
    echo "Abra manualmente: http://localhost:3000"
  fi
}

# Menu principal
menu() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🐝 BeeSocial — Comandos Disponíveis"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Desenvolvimento:"
  echo "  npm run dev         - Iniciar servidor"
  echo "  npm run build       - Build produção"
  echo "  npm run start       - Rodar produção"
  echo "  npm run lint        - Lint código"
  echo ""
  echo "Informações:"
  echo "  ./quick.sh status       - Status do projeto"
  echo "  ./quick.sh components   - Listar componentes"
  echo "  ./quick.sh pages        - Listar páginas"
  echo "  ./quick.sh tree         - Estrutura de pastas"
  echo ""
  echo "Documentação:"
  echo "  ./quick.sh docs readme    - README.md"
  echo "  ./quick.sh docs setup     - SETUP_COMPLETO.md"
  echo "  ./quick.sh docs como      - COMO_CONTINUAR.md"
  echo "  ./quick.sh docs resumo    - RESUMO_FINAL.md"
  echo ""
  echo "Utilitários:"
  echo "  ./quick.sh clean    - Limpar cache"
  echo "  ./quick.sh check    - Verificar erros"
  echo "  ./quick.sh banner   - Mostrar banner"
  echo "  ./quick.sh open     - Abrir no navegador"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# Processar comando
case "$1" in
  "banner")
    show_banner
    ;;
  "status")
    status
    ;;
  "docs")
    docs "$2"
    ;;
  "clean")
    clean
    ;;
  "check")
    check
    ;;
  "components")
    components
    ;;
  "pages")
    pages
    ;;
  "tree")
    tree_project
    ;;
  "open")
    open_browser
    ;;
  *)
    menu
    ;;
esac
