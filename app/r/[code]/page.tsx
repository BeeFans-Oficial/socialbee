"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MOCK_LINKS } from "@/lib/mock-data";

export default function RedirectPage() {
  const params = useParams();
  const router = useRouter();
  const shortCode = params?.code as string;
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Encontrar link pelo shortCode
    const link = MOCK_LINKS.find((l) => l.shortCode === shortCode);

    if (!link) {
      router.push("/");
      return;
    }

    // Mock: simular redirect com countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Em produção, faria window.location.href = link.url
          alert(`Redirecionando para: ${link.title}\n(URL mockada)`);
          router.push("/bella");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [shortCode, router]);

  return (
    <div className="min-h-screen bg-bee-bg text-bee-text flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-bee-pink border-t-transparent animate-spin" />
        <h1 className="font-bebas text-4xl uppercase mb-2">
          Redirecionando...
        </h1>
        <p className="text-bee-muted">
          Você será redirecionado em {countdown} segundo{countdown !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-bee-dim mt-4">
          Código: {shortCode}
        </p>
      </div>
    </div>
  );
}
