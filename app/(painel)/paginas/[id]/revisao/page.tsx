import { redirect } from "next/navigation";

/** O endereço antigo da saúde da página. Quem guardou o link cai na tela nova. */
export default async function RevisaoAntigaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/saude/${id}`);
}
