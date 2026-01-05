# 🧪 Test Suite

> Vedi [README principale](../README.md) per documentazione completa del progetto.

## Quick Start

```bash
# Tutti i test (67 totali)
npm test

# Solo unit test (~1s)
npm run test:unit

# Solo integration test (~10s, richiede OpenAI key + PostgreSQL)
npm run test:integration
```

## Struttura

```
test/
├── unit/                    # Test puri, nessuna dipendenza esterna
│   ├── engine.test.ts      # 42 test - Logica di gioco
│   └── cards.test.ts       # 14 test - Caricamento carte
├── integration/             # Test con LLM reale + Database
│   └── gameFlow.test.ts    # 11 test - Flusso completo partita
├── setup.ts                # Setup globale (Prisma disconnect)
└── README.md
```

## Requisiti per Integration Test

1. **PostgreSQL** in esecuzione: `docker compose up -d db`
2. **OPENAI_API_KEY** nel `.env`
3. **Migrazioni** applicate: `npx prisma migrate dev`

⚠️ Se manca la chiave OpenAI, i test vengono **saltati automaticamente**.

## Cosa Testano

### Unit Tests (56 test)

| Area       | Test                                                           |
| ---------- | -------------------------------------------------------------- |
| **Engine** | createGameState, addPlayer, startRound, playCards, judgeWinner |
| **Cards**  | Caricamento JSON, ID univoci, validazione contenuto            |
| **Query**  | getCzar, getNonCzarPlayers, getWinner                          |

### Integration Tests (11 test)

| Test            | Descrizione                       |
| --------------- | --------------------------------- |
| Game Creation   | Crea partita con umano + 2 AI     |
| Game Start      | AI giocano carte automaticamente  |
| Human Actions   | Gioca carte, recupera mano        |
| Judging         | Umano/AI seleziona vincitore      |
| Multiple Rounds | Partita completa fino a GAME_OVER |
| LLM Quality     | Validità risposte AI              |
| Error Handling  | Fallback su chiave invalida       |

## Performance Tipica

```
Test Suites: 3 passed
Tests:       67 passed
Time:        ~10s

AI Response Times:
- pickCard:   ~500-1000ms
- judgeCards: ~500-600ms
```

## Costi

- ~5-10 chiamate a `gpt-4o-mini` per run
- Costo stimato: **< $0.01**
