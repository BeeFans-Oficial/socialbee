/**
 * Fundo da tela inicial: céu escuro com estrelas que cintilam.
 *
 * As posições saem de um gerador com semente fixa, e não de `Math.random()`:
 * o componente é renderizado no servidor, e posições sorteadas a cada render
 * fariam o HTML do servidor diferir do da hidratação. Com a semente, todo
 * render desenha o mesmo céu.
 */

const TOTAL = 140;

function gerador(semente: number) {
  // mulberry32: pequeno, rápido e bom o bastante para espalhar pontos.
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ESTRELAS = (() => {
  const aleatorio = gerador(20261006);
  return Array.from({ length: TOTAL }, () => ({
    x: aleatorio() * 100,
    y: aleatorio() * 100,
    tamanho: aleatorio() < 0.85 ? 1 : 2,
    brilho: 0.25 + aleatorio() * 0.65,
    duracao: 3 + aleatorio() * 5,
    atraso: aleatorio() * 6,
  }));
})();

/**
 * `brilho`: a luz difusa rosa atrás do conteúdo. Ligada nas telas da marca
 * (tela inicial, login, editores); desligada na página pública da criadora,
 * onde a cor é a do tema dela e um halo rosa por cima seria neon de novo.
 */
export function CeuEstrelado({ brilho = true }: { brilho?: boolean } = {}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Luz difusa atrás do título: é o que tira o fundo do preto chapado. */}
      {brilho && <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 60% 45% at 50% 42%, rgba(255,60,110,0.13), transparent 70%)",
            "radial-gradient(ellipse 50% 40% at 60% 70%, rgba(255,31,87,0.06), transparent 70%)",
            "radial-gradient(ellipse 70% 60% at 40% 40%, rgba(255,255,255,0.03), transparent 75%)",
          ].join(", "),
        }}
      />}
      {ESTRELAS.map((e, i) => (
        <span
          key={i}
          className="estrela absolute rounded-full bg-white"
          style={
            {
              left: `${e.x}%`,
              top: `${e.y}%`,
              width: e.tamanho,
              height: e.tamanho,
              opacity: e.brilho,
              "--brilho": e.brilho,
              animation: `cintilar ${e.duracao}s ease-in-out ${e.atraso}s infinite`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
