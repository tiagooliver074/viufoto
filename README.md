# VIUFOTO Premium

Crie uma plataforma web completa chamada VIUFOTO (marca principal), uma evolução premium da plataforma Fotop/VIUFOTO atual.

REFERÊNCIA VISUAL E FUNCIONAL (OBRIGATÓRIO):
Baseie-se EXATAMENTE nas telas enviadas nos 2 PDFs anexados:

“PÁGINA INICIAL DE REFERECIA .pdf” → página inicial atual do Fotop

“PÁGINAS INTERNAS DE REFERECIA .pdf” → 8 páginas internas (comparação de modelos, caixa, criar evento, fotos do evento, pedidos, configurações, dashboard, financeiro, etc.)

Mantenha a estrutura de fluxo e as seções existentes, mas eleve o design e as funcionalidades para o nível premium 2026/2027.

OBJETIVO GERAL:
Transformar o VIUFOTO na plataforma nº1 de fotos e vídeos de eventos esportivos no Brasil (corridas, ciclismo, triathlon, etc.). Deve transmitir energia, velocidade, emoção e premium.

1. DESIGN & LAYOUT (obrigatório aplicar em TODAS as telas)

Paleta de cores nova:

Laranja neon (#FF4D00) como cor principal

Preto profundo (#0A0A0A) e cinza escuro

Accents em ciano (#00F0FF) e verde limão (#A3FF00)

Fundo dark mode como padrão (com opção de light mode)

Estilo visual: Glassmorphism + neumorphism suave, cards com hover 3D e scale, micro-animações (confetti ao vender foto, skeleton loading elegante)

Tipografia: Satoshi ou Inter (headings em variable font, peso bold para títulos)

Hero Section (página inicial): vídeo de fundo ou loop de fotos reais + busca gigante com filtro por “Número de Peito” ou “Reconhecimento Facial”

Mobile-first + PWA (instalável no celular)

Modo Dark obrigatório e bonito

Cards de eventos: badge “AO VIVO”, “+12.450 fotos”, contagem em tempo real

Lightbox de fotos: zoom infinito, comparação antes/depois, modo cinema, download em 1 clique

Wizard “Criar novo evento”: progress bar bonito + preview em tempo real do evento enquanto preenche

Dashboard (Meu Estúdio / Financeiro): estilo Notion + Figma (widgets arrastáveis e personalizáveis)

2. FUNCIONALIDADES NOVAS (obrigatórias – são o diferencial para ser #1)

IA de Reconhecimento Facial + Selfie Atleta faz upload de selfie uma única vez → todas as suas fotos (de todos os eventos) aparecem automaticamente

Busca instantânea por Bib number + Face ID

Álbum automático por atleta (gerado com QR code entregue no kit da prova)

Vídeos e Reels curtos (5-15 segundos) além de fotos

Live Gallery durante o evento (fotos sobem em tempo real)

Programa de Fidelidade para atletas “VIU Pass” – assinatura mensal R$ 19,90 (10 fotos grátis + prioridade)

Photographer Studio 2.0

Edição em lote com IA (auto color, remoção de objetos)

Contrato digital automático

Heatmap de vendas por ponto da prova

Integração com Strava, Garmin Connect e sistemas de cronometragem

3 modelos de comissão mantidos (Standard, HighVolume, Pay as you go) com visual melhorado e comparação clara

White-label para grandes organizadores de eventos

3. TELAS QUE PRECISO (todas com o novo design)

Página inicial (hero + eventos em destaque + busca)

Página de evento (Fotos VERÃO RUN etc.)

Lightbox de compra de foto/vídeo

Carrinho e checkout

Dashboard do Fotógrafo (Meu Estúdio)

Financeiro / Caixa

Criar novo evento (wizard completo com preview)

Configurações do evento (modelos, disponibilidade, etc.)

Fotos vendidas / Pedidos

Perfil do atleta e álbum pessoal

Página de “VIU Pass” (fidelidade)

Tecnologia:
Next.js 15 + Tailwind + shadcn/ui + Supabase (ou Firebase) + IA (Google Vision ou similar para facial).
Deve ser totalmente responsivo, rápido e com animações suaves.

Tom e linguagem: Brasileiro, descontraído, motivador e profissional ao mesmo tempo. Use textos como “Viu sua foto? Agora é só levar pra casa!” e “Preparamos uma oportunidade especial pra você viver dos próprios cliques.”

Quero que o Lovable gere o projeto completo com todas as telas, navegação, fluxo de fotógrafo e fluxo de atleta já funcionais.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://viufoto-premium.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4bd04771-0a5c-420a-8ea6-7f8a86216edf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
