"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteTradeButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Удалить эту сделку?")) return;
    setLoading(true);
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    router.push("/trades");
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-50"
    >
      {loading ? "..." : "Удалить"}
    </button>
  );
}
