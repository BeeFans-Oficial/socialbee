import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";

import type {
  DateRange,
  LinkCounters,
  TrackingEvent,
  TrackingStore,
} from "./types";

/**
 * Armazenamento em arquivo.
 *
 * O projeto não tem banco (ver README). Esta implementação existe para o
 * rastreamento ser REAL — clique gravado, relatório calculado do que foi
 * gravado — sem fingir uma infraestrutura que não está aqui. A forma segue o
 * bee-api-2 de propósito, porque é ela que a troca por Mongo/Postgres vai
 * reproduzir:
 *
 *   evento cru → append-only, com TTL, é volume
 *   contador   → atualizado no lugar, sem TTL, é histórico
 *
 * O que ela NÃO é: não serve para múltiplas instâncias. `append` é atômico o
 * bastante em POSIX para linhas curtas, mas o contador faz ler-modificar-gravar
 * e só está seguro porque o mutex abaixo serializa dentro de UM processo. Em
 * produção, isto vira `UPDATE ... SET clicks = clicks + 1`.
 */

const DATA_DIR = process.env.TRACKING_DATA_DIR
  ? path.resolve(process.env.TRACKING_DATA_DIR)
  : path.join(process.cwd(), ".data", "tracking");

const EVENTS_FILE = path.join(DATA_DIR, "events.ndjson");
const COUNTERS_FILE = path.join(DATA_DIR, "counters.json");

/** Janela de retenção do evento cru. 90 dias é a mesma escolha do projeto de
 *  referência e cobre a janela de atribuição das redes com folga. Passado isso,
 *  o número continua nos contadores. */
export const EVENT_TTL_DAYS = 90;

/** Serializa as escritas do processo. Sem isto, dois cliques simultâneos leem o
 *  mesmo contador e um dos incrementos é perdido. */
let writeQueue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  // A fila não pode morrer por causa de uma falha: absorve a rejeição aqui e
  // deixa o erro propagar só para quem chamou.
  writeQueue = result.catch(() => undefined);
  return result;
}

let dirReady: Promise<void> | null = null;

function ensureDir(): Promise<void> {
  if (!dirReady) {
    dirReady = mkdir(DATA_DIR, { recursive: true }).then(() => undefined);
  }
  return dirReady;
}

type CountersFile = Record<string, Record<string, LinkCounters>>;

async function readCounters(): Promise<CountersFile> {
  try {
    return JSON.parse(await readFile(COUNTERS_FILE, "utf8")) as CountersFile;
  } catch {
    // Arquivo ausente na primeira execução, ou corrompido por uma escrita
    // interrompida. Nos dois casos começar vazio é melhor do que derrubar o
    // redirecionador — o contador é derivável dos eventos crus.
    return {};
  }
}

async function writeCounters(data: CountersFile): Promise<void> {
  // Grava em temporário e renomeia: `rename` é atômico no mesmo sistema de
  // arquivos, então nunca existe um counters.json meio escrito.
  const tmp = `${COUNTERS_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, COUNTERS_FILE);
}

export function createFileTrackingStore(): TrackingStore {
  return {
    async append(event: TrackingEvent): Promise<void> {
      await ensureDir();
      await appendFile(EVENTS_FILE, `${JSON.stringify(event)}\n`, "utf8");
    },

    async bumpCounters(profileId, linkId, patch): Promise<void> {
      await ensureDir();
      await serialize(async () => {
        const data = await readCounters();
        const profile = (data[profileId] ??= {});
        const current: LinkCounters = profile[linkId] ?? { clicks: 0, botHits: 0 };

        profile[linkId] = {
          clicks: current.clicks + (patch.clicks ?? 0),
          botHits: current.botHits + (patch.botHits ?? 0),
          lastClickAt: patch.lastClickAt ?? current.lastClickAt,
        };

        await writeCounters(data);
      });
    },

    async counters(profileId: string): Promise<Record<string, LinkCounters>> {
      const data = await readCounters();
      return data[profileId] ?? {};
    },

    async query(profileId: string, range: DateRange): Promise<TrackingEvent[]> {
      const from = range.from.getTime();
      const to = range.to.getTime();
      const out: TrackingEvent[] = [];

      // Lê linha a linha em vez de carregar o arquivo: o log cresce sem limite
      // dentro da janela de TTL, e `readFile` num arquivo grande estoura a
      // memória do processo.
      let stream;
      try {
        stream = createReadStream(EVENTS_FILE, { encoding: "utf8" });
      } catch {
        return out;
      }

      const lines = createInterface({ input: stream, crlfDelay: Infinity });
      try {
        for await (const line of lines) {
          if (!line) continue;
          let event: TrackingEvent;
          try {
            event = JSON.parse(line) as TrackingEvent;
          } catch {
            continue; // linha truncada por um append interrompido: ignora
          }
          if (event.profileId !== profileId) continue;
          const at = Date.parse(event.occurredAt);
          if (Number.isNaN(at) || at < from || at > to) continue;
          out.push(event);
        }
      } catch {
        // Arquivo ainda não existe: relatório vazio é a resposta correta.
        return out;
      } finally {
        lines.close();
      }

      return out;
    },
  };
}
