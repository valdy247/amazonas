"use client";

import { useMemo, useState, useTransition } from "react";

type ProviderImportSource = "messenger" | "instagram" | "whatsapp" | "email";

type PreviewRow = {
  id: string;
  source: ProviderImportSource;
  value: string;
  preview: string;
  duplicateMessage: string | null;
  fileName: string;
};

const SOURCE_OPTIONS: Array<{ value: ProviderImportSource; label: string; helper: string }> = [
  {
    value: "messenger",
    label: "Messenger",
    helper: "GPT solo sacara usernames o handles de Messenger visibles en las capturas.",
  },
  {
    value: "instagram",
    label: "Instagram",
    helper: "GPT solo sacara usernames de Instagram visibles en las capturas.",
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    helper: "GPT solo sacara numeros de WhatsApp visibles en las capturas.",
  },
  {
    value: "email",
    label: "Email",
    helper: "GPT solo sacara correos visibles en las capturas.",
  },
];

async function compressImage(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
      img.src = imageUrl;
    });

    const maxWidth = 1400;
    const scale = Math.min(1, maxWidth / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("No se pudo preparar la compresion.");
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.78);
    });

    return new File([blob || file], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function AdminProviderImportStudio() {
  const [source, setSource] = useState<ProviderImportSource>("messenger");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [status, setStatus] = useState<string>("");
  const [isVerified, setIsVerified] = useState(false);
  const [isExtracting, startExtract] = useTransition();
  const [isImporting, startImport] = useTransition();

  const sourceCopy = useMemo(() => SOURCE_OPTIONS.find((option) => option.value === source) || SOURCE_OPTIONS[0], [source]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setStatus("");
    startExtract(async () => {
      try {
        const prepared = await Promise.all(Array.from(files).map((file) => compressImage(file)));
        const chunkSize = 8;
        const aggregated: PreviewRow[] = [];

        for (let index = 0; index < prepared.length; index += chunkSize) {
          const chunk = prepared.slice(index, index + chunkSize);
          const formData = new FormData();
          formData.set("source", source);
          chunk.forEach((file) => formData.append("files", file));

          const response = await fetch("/api/admin/provider-import/extract", {
            method: "POST",
            body: formData,
          });
          const data = (await response.json()) as { rows?: PreviewRow[]; error?: string };

          if (!response.ok) {
            throw new Error(data.error || "No se pudieron procesar las capturas.");
          }

          aggregated.push(...(data.rows || []));
          setStatus(`Procesadas ${Math.min(index + chunk.length, prepared.length)} de ${prepared.length} capturas...`);
        }

        const deduped = aggregated.filter(
          (row, index, current) => current.findIndex((candidate) => candidate.source === row.source && candidate.value === row.value) === index
        );
        setRows(deduped);
        setStatus(
          deduped.length
            ? `Listo. Detectamos ${deduped.length} proveedores potenciales. Revisa la lista antes de importar.`
            : "No se detectaron contactos utiles en esas capturas."
        );
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudieron procesar las capturas.");
      }
    });
  }

  function updateRow(id: string, nextValue: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              value: nextValue,
              preview: nextValue,
            }
          : row
      )
    );
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function importRows() {
    if (!rows.length) {
      return;
    }

    startImport(async () => {
      try {
        const response = await fetch("/api/admin/provider-import/commit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source,
            isVerified,
            rows: rows
              .filter((row) => !row.duplicateMessage && row.value.trim())
              .map((row) => ({ value: row.value.trim() })),
          }),
        });
        const data = (await response.json()) as {
          summary?: string;
          skipped?: Array<{ value: string; reason: string }>;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "No se pudo completar la importacion.");
        }

        const skippedText = (data.skipped || []).slice(0, 4).map((item) => `${item.value}: ${item.reason}`).join(" | ");
        setStatus([data.summary, skippedText].filter(Boolean).join(" "));
        setRows([]);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudo completar la importacion.");
      }
    });
  }

  return (
    <details>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Importar capturas con IA</h2>
          <p className="mt-1 text-sm text-[#62626d]">Sube varias imagenes a la vez, marca de donde vienen y revisa la previsualizacion antes de guardar.</p>
        </div>
        <span className="rounded-full bg-[#eef6ff] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#2864d8]">
          Lote
        </span>
      </summary>

      <div className="mt-4 grid gap-3">
        <div className="rounded-[1.3rem] border border-[#eadfd6] bg-[#fcfaf7] p-4">
          <p className="text-sm font-semibold text-[#131316]">1. De donde vienen las capturas</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {SOURCE_OPTIONS.map((option) => {
              const isActive = option.value === source;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSource(option.value)}
                  className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
                    isActive
                      ? "border-[#ff6b35] bg-[linear-gradient(180deg,#fff3ec_0%,#fffaf7_100%)] shadow-[0_16px_32px_rgba(255,107,53,0.12)]"
                      : "border-[#eadfd6] bg-white hover:border-[#d7c8bb]"
                  }`}
                >
                  <p className="font-semibold text-[#131316]">{option.label}</p>
                  <p className="mt-2 text-xs leading-5 text-[#62564a]">{option.helper}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.3rem] border border-dashed border-[#d8c8b8] bg-[#fffaf5] p-4">
          <p className="text-sm font-semibold text-[#131316]">2. Sube todas las capturas</p>
          <p className="mt-1 text-xs leading-5 text-[#62564a]">Puedes subir muchas a la vez. Las comprimimos y las enviamos por lotes para que el proceso sea mas estable.</p>
          <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-[1.2rem] border border-[#eadfd6] bg-white px-4 py-6 text-center">
            <span className="text-sm font-semibold text-[#131316]">Seleccionar imagenes</span>
            <span className="mt-1 text-xs text-[#62564a]">PNG, JPG o WEBP. Fuente actual: {sourceCopy.label}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => void handleFiles(event.target.files)}
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-[#62564a]">
            <input type="checkbox" checked={isVerified} onChange={(event) => setIsVerified(event.target.checked)} />
            <span>Marcar los importados como verificados</span>
          </label>
        </div>

        {status ? (
          <div className="rounded-[1.2rem] border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#62564a]">{status}</div>
        ) : null}

        {rows.length ? (
          <div className="rounded-[1.3rem] border border-[#eadfd6] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#131316]">3. Revisar antes de importar</p>
                <p className="mt-1 text-xs text-[#62564a]">Los alias se generaran solos. Si ves un duplicado, lo dejamos fuera del lote.</p>
              </div>
              <button className="btn-primary" type="button" onClick={importRows} disabled={isImporting || !rows.some((row) => !row.duplicateMessage)}>
                {isImporting ? "Importando..." : `Importar ${rows.filter((row) => !row.duplicateMessage).length} proveedores`}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="rounded-[1.2rem] border border-[#efe5db] bg-[#fffdfa] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.18em] text-[#8f857b]">
                        {row.source} · {row.fileName}
                      </p>
                      <input
                        className="input mt-2"
                        value={row.value}
                        onChange={(event) => updateRow(row.id, event.target.value)}
                        placeholder="Contacto extraido"
                      />
                      {row.duplicateMessage ? (
                        <p className="mt-2 text-xs font-semibold text-[#c64b1e]">{row.duplicateMessage}</p>
                      ) : (
                        <p className="mt-2 text-xs text-[#62564a]">Listo para crear un alias automatico.</p>
                      )}
                    </div>
                    <button type="button" className="rounded-full border border-[#eadfd6] px-3 py-2 text-xs font-semibold text-[#62564a]" onClick={() => removeRow(row.id)}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(isExtracting || isImporting) && (
          <div className="rounded-[1.2rem] border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#62564a]">
            {isExtracting ? "Procesando capturas con IA..." : "Importando proveedores..."}
          </div>
        )}
      </div>
    </details>
  );
}
