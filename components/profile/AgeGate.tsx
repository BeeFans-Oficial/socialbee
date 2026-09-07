"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HexBackground } from "@/components/shared/HexBackground";
import { Button } from "@/components/ui/button";

interface AgeGateProps {
  slug: string;
  displayName: string;
  onVerified: () => void;
}

interface AgeVerification {
  verified: boolean;
  expiresAt: number;
}

export function AgeGate({ slug, displayName, onVerified }: AgeGateProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Checar localStorage no mount
    const storageKey = `bs_age_${slug}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const data: AgeVerification = JSON.parse(stored);
        
        // Se verificado e não expirado
        if (data.verified && data.expiresAt > Date.now()) {
          onVerified();
          return;
        }
      } catch (error) {
        // JSON inválido, remover
        localStorage.removeItem(storageKey);
      }
    }

    // Se não verificado, mostrar modal
    setVisible(true);
  }, [slug, onVerified]);

  const handleConfirm = () => {
    const storageKey = `bs_age_${slug}`;
    const data: AgeVerification = {
      verified: true,
      expiresAt: Date.now() + 86400000, // 24 horas
    };

    localStorage.setItem(storageKey, JSON.stringify(data));
    onVerified();
  };

  const handleExit = () => {
    window.location.href = "/";
  };

  // Se não visível, não renderizar
  if (!visible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.95)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Background hexágonos */}
        <div className="absolute inset-0">
          <HexBackground density="low" />
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative z-10 w-full max-w-sm mx-auto px-4 mt-[20vh] mb-8"
        >
          <div
            className="bg-bee-surface rounded-[20px] p-8 shadow-2xl"
            style={{
              border: "1px solid rgba(255, 60, 110, 0.3)",
              boxShadow: "0 0 60px rgba(255, 60, 110, 0.1)",
            }}
          >
            {/* Ícone 18+ */}
            <div className="flex justify-center mb-6">
              <div
                className="relative flex items-center justify-center"
                style={{ width: "80px", height: "80px" }}
              >
                {/* Hexágono SVG */}
                <svg
                  viewBox="0 0 100 100"
                  className="absolute w-full h-full"
                  style={{
                    filter: "drop-shadow(0 0 12px rgba(255, 60, 110, 0.4))",
                  }}
                >
                  <polygon
                    points="50,5 85,27.5 85,72.5 50,95 15,72.5 15,27.5"
                    stroke="#FF3C6E"
                    strokeWidth="2"
                    fill="rgba(255, 60, 110, 0.1)"
                  />
                </svg>
                {/* Emoji/Badge */}
                <span className="relative text-4xl">🔞</span>
              </div>
            </div>

            {/* Título */}
            <h2 className="font-bebas text-[28px] uppercase text-center text-bee-text mb-3 tracking-wide">
              CONTEÚDO ADULTO
            </h2>

            {/* Subtítulo */}
            <p className="text-sm text-bee-muted text-center mb-6 leading-relaxed">
              A página de <span className="text-bee-pink font-semibold">{displayName}</span> é
              destinada exclusivamente a adultos.
            </p>

            {/* Divisor */}
            <div
              className="h-px mb-6"
              style={{ backgroundColor: "rgba(255, 60, 110, 0.2)" }}
            />

            {/* Texto de confirmação */}
            <p className="text-[13px] text-bee-dim text-center mb-6 leading-relaxed">
              Ao continuar, você confirma ter 18 anos ou mais e estar ciente do
              tipo de conteúdo.
            </p>

            {/* Botões */}
            <div className="flex flex-col gap-3">
              {/* Botão Primário */}
              <button
                onClick={handleConfirm}
                className="w-full px-6 py-3.5 bg-bee-pink text-white font-bold rounded-full transition-all hover:opacity-90 glow-pink uppercase tracking-wide"
              >
                TENHO 18+ ANOS — ENTRAR
              </button>

              {/* Botão Secundário */}
              <button
                onClick={handleExit}
                className="w-full px-6 py-2.5 text-bee-muted hover:text-white transition-colors text-sm"
              >
                Sair
              </button>
            </div>

            {/* Nota rodapé */}
            <p className="text-[11px] text-bee-dim text-center mt-6">
              🔒 Nenhum dado pessoal é coletado
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
