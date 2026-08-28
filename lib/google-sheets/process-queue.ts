import { refreshAccessToken, updateValues, appendValues } from "./sheets-api";
import { HEADERS, ENTITY_SHEETS, type SheetName } from "./layout";
import { SHAPERS } from "./rows";
import { writeStats } from "./stats";

const BATCH_LIMIT = 25;

function columnLetter(index: number) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseRowNumber(updatedRange: string) {
  const m = updatedRange.match(/![A-Z]+(\d+)/);
  return m ? Number(m[1]) : null;
}

async function getRowNumber(admin: any, organizationId: string, sheet: SheetName, entityId: string) {
  const { data } = await admin
    .from("google_sheets_row_map")
    .select("row_number")
    .eq("organization_id", organizationId)
    .eq("sheet_name", sheet)
    .eq("entity_id", entityId)
    .maybeSingle();
  return data?.row_number ?? null;
}

async function rememberRow(admin: any, organizationId: string, sheet: SheetName, entityId: string, rowNumber: number) {
  await admin
    .from("google_sheets_row_map")
    .upsert({ organization_id: organizationId, sheet_name: sheet, entity_id: entityId, row_number: rowNumber }, { onConflict: "organization_id,sheet_name,entity_id" });
}

// Processa até BATCH_LIMIT itens pendentes da fila de UMA empresa. Chamado
// tanto pelo webhook (quase-tempo-real) como pela varredura periódica
// (fallback de resiliência). Nunca lê/escreve dados de outra organização —
// todas as leituras em rows.ts filtram sempre por organization_id.
export async function processOrgQueue(admin: any, organizationId: string) {
  const { data: integration } = await admin
    .from("google_sheets_integrations")
    .select("status, spreadsheet_id, refresh_token")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!integration || integration.status !== "ativo" || !integration.spreadsheet_id || !integration.refresh_token) {
    return { processed: 0, skipped: true };
  }

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(integration.refresh_token);
  } catch (err: any) {
    await admin
      .from("google_sheets_integrations")
      .update({ status: "erro", last_error: "Falha ao renovar autorização Google — pode ser necessário voltar a ligar." })
      .eq("organization_id", organizationId);
    return { processed: 0, error: err.message };
  }

  const { data: items } = await admin
    .from("google_sheets_sync_queue")
    .select("id, entity_type, entity_id, action, attempts")
    .eq("organization_id", organizationId)
    .or("status.eq.pending,and(status.eq.failed,attempts.lt.5)")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  let processed = 0;
  let lastError: string | null = null;

  for (const item of items ?? []) {
    try {
      if (item.action === "delete") {
        const sheets = ENTITY_SHEETS[item.entity_type] ?? [];
        for (const sheet of sheets) {
          const rowNumber = await getRowNumber(admin, organizationId, sheet, item.entity_id);
          if (!rowNumber) continue;
          const headers = HEADERS[sheet];
          const col = headers.indexOf("Eliminado");
          if (col < 0) continue;
          await updateValues(accessToken, integration.spreadsheet_id, `${sheet}!${columnLetter(col)}${rowNumber}`, [["Sim"]]);
        }
      } else {
        const shaper = SHAPERS[item.entity_type];
        const rows = shaper ? await shaper(admin, organizationId, item.entity_id) : null;
        if (rows) {
          for (const { sheet, values } of rows) {
            const rowNumber = await getRowNumber(admin, organizationId, sheet, item.entity_id);
            if (rowNumber) {
              await updateValues(accessToken, integration.spreadsheet_id, `${sheet}!A${rowNumber}`, [values]);
            } else {
              const appended = await appendValues(accessToken, integration.spreadsheet_id, `${sheet}!A1`, [values]);
              const newRow = parseRowNumber(appended.updatedRange);
              if (newRow) await rememberRow(admin, organizationId, sheet, item.entity_id, newRow);
            }
          }
        }
      }

      await admin
        .from("google_sheets_sync_queue")
        .update({ status: "done", processed_at: new Date().toISOString() })
        .eq("id", item.id);
      processed++;
    } catch (err: any) {
      lastError = err.message ?? String(err);
      await admin
        .from("google_sheets_sync_queue")
        .update({ status: "failed", attempts: (item.attempts ?? 0) + 1, last_error: lastError })
        .eq("id", item.id);
    }
  }

  if (processed > 0) {
    try {
      await writeStats(admin, accessToken, integration.spreadsheet_id, organizationId);
    } catch (err: any) {
      lastError = lastError ?? `Estatísticas: ${err.message ?? err}`;
    }
  }

  await admin
    .from("google_sheets_integrations")
    .update({ last_synced_at: new Date().toISOString(), last_error: lastError, status: "ativo" })
    .eq("organization_id", organizationId);

  return { processed, error: lastError };
}
