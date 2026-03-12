# Deploy no EasyPanel

Este projeto tem dois serviços que precisam rodar no **mesmo projeto** no EasyPanel para se comunicarem pela rede interna.

## 1. Criar o projeto

No EasyPanel, crie um novo projeto (ex: **browseless**).

## 2. Serviço 1: Browserless (Chrome headless)

- **Adicionar** → **App**
- **Source**: Docker image  
- **Image**: `ghcr.io/browserless/chromium:latest`
- **Portas**: Target `3000`, publicar na porta que quiser (ex: 3000) ou usar **Domains & Proxy** se for acessar por domínio
- **Variáveis de ambiente**:
  - `CONCURRENT` = `10`
  - `TOKEN` = um token que você definir (ex: `seu-token-secreto`)
  - `MAX_QUEUE_LENGTH` = `50`
  - `CONNECTION_TIMEOUT` = `60000`
- **Nome do serviço**: **browseless** (o capture-service conecta em `browseless:3000`)

Salve e faça o deploy.

## 3. Serviço 2: Capture service (abrir URL)

- **Adicionar** → **App**
- **Source**: GitHub (ou seu git) → este repositório
- **Build**: o EasyPanel usa o **Dockerfile na raiz** do repo (já configurado para buildar o `capture-service`)
- **Porta**: Target `4000`; use **Domains & Proxy** e defina o proxy para a porta **4000** (ou publique a porta 4000)
- **Variáveis de ambiente** (obrigatórias):
  - `BROWSERLESS_WS_URL` = `ws://browseless:3000?token=seu-token-secreto`  
    (troque `seu-token-secreto` pelo mesmo valor de `TOKEN` do passo 2)
  - `PORT` = `4000`
- **Nome do serviço**: ex. **capture-service**

Salve e faça o deploy (após o browseless estar rodando).

## 4. Conferir

- Serviço **browseless**: deve estar “Running”.
- Serviço **capture-service**: deve estar “Running” e conseguir conectar em `BROWSERLESS_WS_URL`.

Teste o endpoint (troque pelo seu domínio ou IP:porta do capture-service):

```bash
curl -X POST https://seu-dominio-capture-service.com/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://sua-pagina.com/animacao", "waitMs": 30000}'
```

## Resumo das variáveis

| Serviço           | Variável             | Exemplo / Observação                          |
|-------------------|----------------------|-----------------------------------------------|
| browseless       | `TOKEN`              | `seu-token-secreto`                           |
| capture-service   | `BROWSERLESS_WS_URL` | `ws://browseless:3000?token=seu-token-secreto` |
| capture-service   | `PORT`               | `4000`                                        |

O hostname `browseless` funciona porque os dois serviços estão no mesmo projeto; no Docker Swarm o nome do serviço vira hostname na rede interna.
