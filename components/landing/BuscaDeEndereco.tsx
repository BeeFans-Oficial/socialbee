"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";

import { api } from "@/lib/api/client";
import { slugify, validateSlug } from "@/lib/utils";

type Estado =
  | { tipo: "parado" }
  | { tipo: "buscando" }
  | { tipo: "livre"; slug: string }
  | { tipo: "ocupado"; slug: string }
  | { tipo: "invalido" }
  | { tipo: "erro" };

/**
 * "Esse endereço está livre?" — na tela inicial, antes do cadastro.
 *
 * Usa a mesma consulta pública do cadastro (`/public/slug-available`), então a
 * resposta aqui é a que o cadastro vai dar. Livre, o botão leva ao cadastro já
 * com o endereço preenchido.
 *
 * Sem domínio na frente da barra, de propósito: a página nova recebe um
 * domínio sorteado do pool, e mostrar um endereço que pode não ser o dela seria
 * prometer o que não vai acontecer.
 */
export function BuscaDeEndereco() {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });
  // A resposta de uma busca antiga não pode sobrescrever a da busca atual.
  const ultima = useRef(0);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = slugify(texto);
    if (!validateSlug(slug)) {
      setEstado({ tipo: "invalido" });
      return;
    }
    const esta = ++ultima.current;
    setEstado({ tipo: "buscando" });
    try {
      const { available } = await api.slugAvailable(slug);
      if (esta !== ultima.current) return;
      setEstado(available ? { tipo: "livre", slug } : { tipo: "ocupado", slug });
    } catch {
      if (esta === ultima.current) setEstado({ tipo: "erro" });
    }
  };

  return (
    <div>
      <form onSubmit={buscar} className="flex flex-col sm:flex-row gap-3">
        <label className="flex-1 flex items-center gap-1 h-12 px-4 rounded-md border border-white/15 bg-white/[0.03] focus-within:border-bee-pink/50 transition-colors">
          <span className="text-white/35 text-base">/</span>
          <input
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              if (estado.tipo !== "parado") setEstado({ tipo: "parado" });
            }}
            placeholder="seu-nome"
            aria-label="Endereço da sua página"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent text-base text-white placeholder:text-white/35 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={estado.tipo === "buscando"}
          className="h-12 px-6 rounded-md bg-bee-pink text-white text-[15px] font-semibold hover:bg-bee-pink-hot transition-colors glow-pink-sm disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {estado.tipo === "buscando" && <Loader2 className="w-4 h-4 animate-spin" />}
          Ver se está livre
        </button>
      </form>

      <div className="min-h-[28px] mt-3 text-sm" aria-live="polite">
        {estado.tipo === "livre" && (
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-emerald-300/90">
            <Check className="w-4 h-4" />/{estado.slug} está livre.
            <Link
              href={`/cadastro?slug=${encodeURIComponent(estado.slug)}`}
              className="text-white underline underline-offset-4 decoration-white/40 hover:decoration-white"
            >
              Criar minha página
            </Link>
          </p>
        )}
        {estado.tipo === "ocupado" && (
          <p className="flex items-center justify-center gap-2 text-white/55">
            <X className="w-4 h-4" />/{estado.slug} já tem dona. Tente outra variação.
          </p>
        )}
        {estado.tipo === "invalido" && (
          <p className="text-white/55">Use de 3 a 30 letras, números ou hífen.</p>
        )}
        {estado.tipo === "erro" && (
          <p className="text-white/55">Não deu para consultar agora. Tente de novo.</p>
        )}
      </div>
    </div>
  );
}
