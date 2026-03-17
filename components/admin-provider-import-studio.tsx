"use client";

import { useMemo, useState, useTransition } from "react";
import { CompactSelect } from "@/components/compact-select";

type ProviderImportSource = "messenger" | "facebook" | "instagram" | "whatsapp" | "email";

type PreviewRow = {
  id: string;
  source: ProviderImportSource;
  value: string;
  preview: string;
  duplicateMessage: string | null;
  fileName: string;
  avatarBox?: { x: number; y: number; w: number; h: number } | null;
  avatarDataUrl?: string | null;
};

const SOURCE_OPTIONS: Array<{ value: ProviderImportSource; label: string }> = [
  { value: "messenger", label: "Messenger" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
];

async function compressImage(file: File, index: number) {
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

    return new File([blob || file], `${file.name.replace(/\.[^.]+$/, "")}-${index}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function loadImageElement(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
      img.src = imageUrl;
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function detectStructuredAvatarBoxes(file: File, source: ProviderImportSource, expectedCount: number) {
  if (!expectedCount || (source !== "messenger" && source !== "facebook")) {
    return [];
  }

  const image = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return [];
  }

  context.drawImage(image, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const avatarSize = Math.max(34, Math.min(88, Math.round(width * 0.14)));
  const half = Math.round(avatarSize / 2);
  const centerX = Math.round(width * 0.12);
  const startY = Math.max(half, Math.round(height * 0.08));
  const endY = Math.max(startY + avatarSize, height - half);
  const scores: Array<{ y: number; score: number }> = [];

  for (let centerY = startY; centerY < endY; centerY += 3) {
    let total = 0;
    let samples = 0;

    for (let y = centerY - half; y < centerY + half; y += 2) {
      if (y < 0 || y >= height) {
        continue;
      }

      for (let x = centerX - half; x < centerX + half; x += 2) {
        if (x < 0 || x >= width) {
          continue;
        }

        const index = (y * width + x) * 4;
        const r = data[index] || 0;
        const g = data[index + 1] || 0;
        const b = data[index + 2] || 0;
        const brightness = (r + g + b) / 3;
        const variance = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
        total += variance + Math.abs(brightness - 128) * 0.35;
        samples += 1;
      }
    }

    scores.push({ y: centerY, score: samples ? total / samples : 0 });
  }

  const maxScore = Math.max(...scores.map((item) => item.score), 0);
  const minGap = Math.max(avatarSize, Math.round(height / Math.max(expectedCount + 2, 6)));
  const peaks: Array<{ y: number; score: number }> = [];

  for (let index = 1; index < scores.length - 1; index += 1) {
    const current = scores[index];

    if (current.score < maxScore * 0.55) {
      continue;
    }

    if (current.score >= scores[index - 1].score && current.score >= scores[index + 1].score) {
      const previousPeak = peaks[peaks.length - 1];

      if (!previousPeak || current.y - previousPeak.y >= minGap) {
        peaks.push(current);
      } else if (current.score > previousPeak.score) {
        peaks[peaks.length - 1] = current;
      }
    }
  }

  const selected = peaks
    .sort((left, right) => left.y - right.y)
    .slice(0, expectedCount)
    .map((peak) => ({
      x: Math.max(0, Math.min(1, (centerX - half) / width)),
      y: Math.max(0, Math.min(1, (peak.y - half) / height)),
      w: Math.max(0, Math.min(1, avatarSize / width)),
      h: Math.max(0, Math.min(1, avatarSize / height)),
    }));

  return selected;
}

async function cropAvatarDataUrl(
  file: File,
  source: ProviderImportSource,
  box?: { x: number; y: number; w: number; h: number } | null
) {
  if (!box) {
    return null;
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
      img.src = imageUrl;
    });

    const rawX = box.x * image.width;
    const rawY = box.y * image.height;
    const rawW = Math.max(24, box.w * image.width);
    const rawH = Math.max(24, box.h * image.height);
    const socialCrop = source === "messenger" || source === "facebook";
    const baseSquare = socialCrop ? Math.min(rawW, rawH) : Math.max(rawW, rawH);
    const centerX = socialCrop ? rawX + baseSquare / 2 : rawX + rawW / 2;
    const centerY = socialCrop ? rawY + baseSquare / 2 : rawY + rawH / 2;
    const squareSize = Math.max(24, baseSquare * (socialCrop ? 0.98 : 1.45));
    const sourceX = Math.round(Math.max(0, Math.min(centerX - squareSize / 2, image.width - squareSize)));
    const sourceY = Math.round(Math.max(0, Math.min(centerY - squareSize / 2, image.height - squareSize)));
    const sourceSize = Math.round(Math.max(24, Math.min(squareSize, image.width - sourceX, image.height - sourceY)));
    const size = 96;
    const socialWidth = 188;
    const socialHeight = 64;
    const canvas = document.createElement("canvas");
    canvas.width = socialCrop ? socialWidth : size;
    canvas.height = socialCrop ? socialHeight : size;
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    if (socialCrop) {
      const stripX = Math.max(0, Math.min(sourceX - sourceSize * 0.14, image.width - sourceSize * 4.34));
      const stripY = Math.max(0, Math.min(sourceY - sourceSize * 0.02, image.height - sourceSize * 1.04));
      const stripW = Math.max(sourceSize * 3.94, Math.min(image.width - stripX, sourceSize * 4.34));
      const stripH = Math.max(sourceSize * 0.98, Math.min(image.height - stripY, sourceSize * 1.04));

      context.drawImage(image, stripX, stripY, stripW, stripH, 0, 0, socialWidth, socialHeight);
    } else {
      context.beginPath();
      context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      context.closePath();
      context.clip();
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
    }

    return canvas.toDataURL("image/jpeg", 0.82);
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
        const prepared = await Promise.all(Array.from(files).map((file, index) => compressImage(file, index)));
        const preparedByName = new Map(prepared.map((file) => [file.name, file]));
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

          const groupedRows = new Map<string, PreviewRow[]>();

          for (const row of data.rows || []) {
            const current = groupedRows.get(row.fileName) || [];
            current.push(row);
            groupedRows.set(row.fileName, current);
          }

          const enrichedRows = await Promise.all(
            Array.from(groupedRows.entries()).flatMap(([fileName, fileRows]) => {
              const preparedFile = preparedByName.get(fileName) || chunk[0];

              return (async () => {
                const scriptBoxes = await detectStructuredAvatarBoxes(preparedFile, fileRows[0]?.source || source, fileRows.length);

                return Promise.all(
                  fileRows.map(async (row, rowIndex) => {
                    const effectiveBox = scriptBoxes[rowIndex] || row.avatarBox || null;

                    return {
                      ...row,
                      avatarDataUrl: effectiveBox ? await cropAvatarDataUrl(preparedFile, row.source, effectiveBox) : null,
                    };
                  })
                );
              })();
            })
          );
          const flattenedRows = enrichedRows.flat();

          aggregated.push(...flattenedRows);
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
              .map((row) => ({ value: row.value.trim(), avatarDataUrl: row.avatarDataUrl || null })),
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
          <div className="mt-3">
            <CompactSelect
              value={source}
              options={SOURCE_OPTIONS}
              onChange={(value) => setSource(value as ProviderImportSource)}
              placeholder="Selecciona una fuente"
            />
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
                      {row.avatarDataUrl ? (
                        <div className="mb-2 flex items-center gap-3">
                          <img
                            src={row.avatarDataUrl}
                            alt={row.preview}
                            className={`shrink-0 bg-[#f5eee6] object-cover object-center ring-1 ring-[#eadfd6] ${
                              row.source === "messenger" || row.source === "facebook"
                                ? "h-[3.2rem] w-[8.4rem] rounded-[1rem]"
                                : "h-12 w-12 rounded-full"
                            }`}
                          />
                          <span className="text-xs text-[#8f857b]">Referencia visual</span>
                        </div>
                      ) : null}
                      <p className="text-xs uppercase tracking-[0.18em] text-[#8f857b]">
                        {SOURCE_OPTIONS.find((option) => option.value === row.source)?.label || row.source}
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
