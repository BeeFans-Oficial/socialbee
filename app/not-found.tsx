import Link from "next/link";

import { CeuEstrelado } from "@/components/landing/CeuEstrelado";

/**
 * Página de "não encontrado" do app inteiro.
 *
 * Também é o que uma conta comum vê ao tentar `/admin`: o proxy reescreve a
 * rota para um caminho inexistente, e esta tela não diz nada sobre o que
 * existe por trás — para quem não é admin, o painel admin não existe.
 */
export default function NaoEncontrado() {
  return (
    <div className="relative min-h-dvh bg-bee-bg flex items-center justify-center px-4 overflow-hidden">
      <CeuEstrelado />
      <div className="relative z-10 text-center max-w-md">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/40">Erro 404</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Essa página não existe</h1>
        <p className="mt-2 text-sm text-bee-muted">O endereço pode ter mudado ou nunca ter existido.</p>
        <Link
          href="/"
          className="inline-flex mt-8 h-11 px-6 items-center rounded-lg bg-white text-bee-bg text-sm font-semibold hover:bg-white/90 transition-colors"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
