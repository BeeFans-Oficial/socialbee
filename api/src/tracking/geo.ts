import ip3country from "ip3country";

/**
 * País a partir do IP, sem serviço externo.
 *
 * O relatório lia o país só de cabeçalho de borda (`cf-ipcountry` e parentes).
 * Em produção não há borda: os domínios apontam direto para a VPS, o cabeçalho
 * nunca chega, e o filtro "País" ficava vazio para todo mundo.
 *
 * `ip3country` embute uma base compacta (menos de 500 KB, da IP2Location LITE)
 * e resolve na memória — nenhum IP de visitante sai do servidor. Cobre IPv4,
 * que é por onde as visitas chegam (os domínios não têm registro AAAA). IPv6 e
 * endereço privado ficam sem país, como antes.
 *
 * A base envelhece com a versão do pacote: atualizar a dependência de tempos em
 * tempos é o que mantém a precisão.
 *
 * Este produto inclui dados IP2Location LITE, disponíveis em
 * https://lite.ip2location.com.
 */

let pronto = false;

export function countryOfIp(ip?: string | null): string | undefined {
  const valor = ip?.trim();
  if (!valor || !/^\d{1,3}(\.\d{1,3}){3}$/.test(valor)) return undefined;
  try {
    if (!pronto) {
      ip3country.init();
      pronto = true;
    }
    const pais = ip3country.lookupStr(valor);
    return typeof pais === "string" && /^[A-Z]{2}$/.test(pais) ? pais : undefined;
  } catch {
    // País é campo de análise: nunca derruba o registro de um clique.
    return undefined;
  }
}
