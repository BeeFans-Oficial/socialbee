import React from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bee-bg">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="lg:ml-[240px] min-h-screen pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
