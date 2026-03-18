"use client";

import { useEffect, useMemo, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { CompactSelect } from "@/components/compact-select";

type ProviderImportSource = "messenger" | "facebook" | "instagram" | "whatsapp" | "email" | "bulk_text";

type PreviewRow = {
  id: string;
  source: ProviderImportSource;
  value: string;
  preview: string;
  duplicateMessage: string | null;
  fileName: string;
  email?: string | null;
  whatsapp?: string | null;
  facebook?: string | null;
  avatarBox?: { x: number; y: number; w: number; h: number } | null;
  avatarDataUrl?: string | null;
};

type ManualCropBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type ManualImage = {
  id: string;
  file: File;
  dataUrl: string;
  crops: ManualCropBox[];
};

type DragState = {
  imageId: string;
  cropId: string;
  pointerId: number;
  startClientY: number;
  startY: number;
} | null;

type ProgressState = {
  phase: "extract" | "import";
  completed: number;
  total: number;
  startedAt: number;
  label: string;
} | null;

const SOURCE_OPTIONS: Array<{ value: ProviderImportSource; label: string }> = [
  { value: "messenger", label: "Messenger" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "bulk_text", label: "Texto masivo" },
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

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function cropImageRegion(
  file: File,
  box: { x: number; y: number; w: number; h: number },
  outputName: string
) {
  const image = await loadImageElement(file);
  const sourceX = Math.max(0, Math.round(box.x * image.width));
  const sourceY = Math.max(0, Math.round(box.y * image.height));
  const sourceW = Math.max(24, Math.round(box.w * image.width));
  const sourceH = Math.max(24, Math.round(box.h * image.height));
  const canvas = document.createElement("canvas");
  canvas.width = sourceW;
  canvas.height = sourceH;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo preparar el recorte.");
  }

  context.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.84);
  });

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.84),
    file: new File([blob || file], outputName, { type: "image/jpeg" }),
  };
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
      const stripX = Math.max(0, Math.round(rawX));
      const stripY = Math.max(0, Math.round(rawY));
      const stripW = Math.max(24, Math.min(image.width - stripX, Math.round(rawW)));
      const stripH = Math.max(24, Math.min(image.height - stripY, Math.round(rawH)));

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

function createManualCrop(id: string, clickRatioY: number, left: number, width: number, height: number): ManualCropBox {
  const normalizedHeight = height / 100;
  return {
    id,
    x: left / 100,
    y: Math.max(0, Math.min(1 - normalizedHeight, clickRatioY - normalizedHeight / 2)),
    w: width / 100,
    h: normalizedHeight,
  };
}

export function AdminProviderImportStudio() {
  const [source, setSource] = useState<ProviderImportSource>("messenger");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [status, setStatus] = useState<string>("");
  const [isVerified, setIsVerified] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [manualImages, setManualImages] = useState<ManualImage[]>([]);
  const [manualIndex, setManualIndex] = useState(0);
  const [manualCropLeft, setManualCropLeft] = useState(0);
  const [manualCropWidth, setManualCropWidth] = useState(100);
  const [manualCropHeight, setManualCropHeight] = useState(9);
  const [dragState, setDragState] = useState<DragState>(null);
  const [progress, setProgress] = useState<ProgressState>(null);
  const [visualProgressPercent, setVisualProgressPercent] = useState<number | null>(null);
  const [displayProgressPercent, setDisplayProgressPercent] = useState<number>(0);
  const [isExtracting, startExtract] = useTransition();
  const [isImporting, startImport] = useTransition();

  const sourceCopy = useMemo(() => SOURCE_OPTIONS.find((option) => option.value === source) || SOURCE_OPTIONS[0], [source]);
  const socialManualMode = source === "messenger" || source === "facebook";
  const bulkTextMode = source === "bulk_text";
  const currentManualImage = manualImages[manualIndex] || null;
  const manualCropWidthMax = Math.max(25, 100 - manualCropLeft);
  const progressPercent = progress
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(visualProgressPercent ?? (progress.completed / Math.max(progress.total, 1)) * 100)
        )
      )
    : 0;
  const progressEtaSeconds = useMemo(() => {
    if (!progress || progress.completed <= 0 || progress.completed >= progress.total) {
      return null;
    }

    const elapsedSeconds = Math.max(1, (Date.now() - progress.startedAt) / 1000);
    const rate = progress.completed / elapsedSeconds;
    if (!Number.isFinite(rate) || rate <= 0) {
      return null;
    }

    return Math.max(1, Math.round((progress.total - progress.completed) / rate));
  }, [progress]);

  function formatEta(seconds: number | null) {
    if (!seconds) {
      return "Calculating time remaining...";
    }

    if (seconds < 60) {
      return `About ${seconds}s remaining`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `About ${minutes} min remaining`;
  }

  useEffect(() => {
    setManualCropWidth((current) => Math.min(current, manualCropWidthMax));
  }, [manualCropWidthMax]);

  useEffect(() => {
    setManualImages((current) =>
      current.map((image) => ({
        ...image,
        crops: image.crops.map((crop) => ({
          ...crop,
          x: manualCropLeft / 100,
          w: manualCropWidth / 100,
          h: manualCropHeight / 100,
          y: Math.max(0, Math.min(1 - manualCropHeight / 100, crop.y)),
        })),
      }))
    );
  }, [manualCropHeight, manualCropLeft, manualCropWidth]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const activeDrag = dragState;

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activeDrag.pointerId) {
        return;
      }

      const deltaRatio = (event.clientY - activeDrag.startClientY) / window.innerHeight;
      const normalizedHeight = manualCropHeight / 100;
      const nextY = Math.max(0, Math.min(1 - normalizedHeight, activeDrag.startY + deltaRatio));

      setManualImages((current) =>
        current.map((image) =>
          image.id === activeDrag.imageId
            ? {
                ...image,
                crops: image.crops
                  .map((crop) => (crop.id === activeDrag.cropId ? { ...crop, y: nextY } : crop))
                  .sort((left, right) => left.y - right.y),
              }
            : image
        )
      );
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId === activeDrag.pointerId) {
        setDragState(null);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragState, manualCropHeight, manualCropLeft, manualCropWidth]);

  useEffect(() => {
    if (!progress) {
      setVisualProgressPercent(null);
      setDisplayProgressPercent(0);
      return;
    }

    const actualPercent = (progress.completed / Math.max(progress.total, 1)) * 100;

    if (progress.completed >= progress.total) {
      setVisualProgressPercent(100);
      return;
    }

    setVisualProgressPercent((current) => {
      if (current == null) {
        return Math.max(4, actualPercent);
      }

      return Math.max(current, actualPercent);
    });

    const interval = window.setInterval(() => {
      setVisualProgressPercent((current) => {
        const base = current ?? actualPercent;
        const nextConfirmedPercent = ((progress.completed + 1) / Math.max(progress.total, 1)) * 100;
        const visualCap = Math.max(actualPercent, nextConfirmedPercent - 2);

        if (base >= visualCap) {
          return visualCap;
        }

        return Math.min(visualCap, base + Math.max(0.8, (visualCap - base) * 0.28));
      });
    }, 180);

    return () => window.clearInterval(interval);
  }, [progress]);

  useEffect(() => {
    if (!progress) {
      setDisplayProgressPercent(0);
      return;
    }

    const target = Math.max(0, Math.min(100, Math.round(progressPercent)));

    if (target === displayProgressPercent) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDisplayProgressPercent((current) => {
        if (current === target) {
          return current;
        }

        return current < target ? current + 1 : current - 1;
      });
    }, 55);

    return () => window.clearTimeout(timeout);
  }, [displayProgressPercent, progress, progressPercent]);

  async function runExtractionFromPreparedFiles(
    prepared: File[],
    previewMap?: Map<string, string>
  ) {
    const preparedByName = new Map(prepared.map((file) => [file.name, file]));
    const chunkSize = 1;
    const aggregated: PreviewRow[] = [];
    const startedAt = Date.now();

    setProgress({
      phase: "extract",
      completed: 0,
      total: prepared.length,
      startedAt,
      label: "Preparing AI extraction",
    });
    setVisualProgressPercent(4);

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

      const flattenedRows =
        socialManualMode
          ? (data.rows || []).map((row) => ({
              ...row,
              avatarDataUrl: previewMap?.get(row.fileName) || null,
            }))
          : await Promise.all(
              (data.rows || []).map(async (row) => {
                const preparedFile = preparedByName.get(row.fileName) || chunk[0];
                return {
                  ...row,
                  avatarDataUrl: row.avatarBox ? await cropAvatarDataUrl(preparedFile, row.source, row.avatarBox) : null,
                };
              })
            );

      aggregated.push(...flattenedRows);
      setProgress({
        phase: "extract",
        completed: Math.min(index + chunk.length, prepared.length),
        total: prepared.length,
        startedAt,
        label: "Processing captures with AI",
      });
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
    setProgress(null);
    setVisualProgressPercent(null);
  }

  async function handleFiles(files: FileList | null) {
    if (bulkTextMode) {
      return;
    }

    if (!files?.length) {
      return;
    }

    setStatus("");
    startExtract(async () => {
      try {
        const prepared = await Promise.all(Array.from(files).map((file, index) => compressImage(file, index)));
        if (socialManualMode) {
          const images = await Promise.all(
            prepared.map(async (file, index) => ({
              id: `${file.name}-${index}`,
              file,
              dataUrl: await fileToDataUrl(file),
              crops: [],
            }))
          );
          setManualImages(images);
          setManualIndex(0);
          setRows([]);
          setProgress(null);
          setVisualProgressPercent(null);
          setStatus("Haz clic en cada fila que quieras recortar. Puedes avanzar imagen por imagen.");
          return;
        }

        await runExtractionFromPreparedFiles(prepared);
      } catch (error) {
        setProgress(null);
        setVisualProgressPercent(null);
        setStatus(error instanceof Error ? error.message : "No se pudieron procesar las capturas.");
      }
    });
  }

  function extractFromText() {
    if (!bulkText.trim()) {
      setStatus("Pega el texto grande antes de procesarlo.");
      return;
    }

    setStatus("");
    startExtract(async () => {
      try {
        const startedAt = Date.now();
        setProgress({
          phase: "extract",
          completed: 0,
          total: Math.max(1, bulkText.length),
          startedAt,
          label: "Processing text with AI",
        });
        setVisualProgressPercent(12);
        const formData = new FormData();
        formData.set("source", "bulk_text");
        formData.set("text", bulkText);

        const response = await fetch("/api/admin/provider-import/extract", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as { rows?: PreviewRow[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error || "No se pudo procesar el texto.");
        }

        setProgress({
          phase: "extract",
          completed: Math.max(1, bulkText.length),
          total: Math.max(1, bulkText.length),
          startedAt,
          label: "Processing text with AI",
        });
        setRows(data.rows || []);
        setStatus(
          (data.rows || []).length
            ? `Listo. Detectamos ${(data.rows || []).length} proveedores potenciales desde el texto.`
            : "No se detectaron contactos utiles en ese texto."
        );
        setProgress(null);
        setVisualProgressPercent(null);
      } catch (error) {
        setProgress(null);
        setVisualProgressPercent(null);
        setStatus(error instanceof Error ? error.message : "No se pudo procesar el texto.");
      }
    });
  }

  function addManualCrop(clickRatioY: number) {
    if (!currentManualImage) {
      return;
    }

    const nextCrop = createManualCrop(`${currentManualImage.id}-crop-${Date.now()}`, clickRatioY, manualCropLeft, manualCropWidth, manualCropHeight);

    setManualImages((current) =>
      current.map((image) =>
        image.id === currentManualImage.id
          ? {
              ...image,
              crops: [...image.crops, nextCrop].sort((left, right) => left.y - right.y),
            }
          : image
      )
    );
  }

  function removeManualCrop(cropId: string) {
    setManualImages((current) =>
      current.map((image) =>
        image.id === currentManualImage?.id
          ? {
              ...image,
              crops: image.crops.filter((crop) => crop.id !== cropId),
            }
          : image
      )
    );
  }

  function startDraggingCrop(crop: ManualCropBox, event: ReactPointerEvent<HTMLButtonElement>) {
    if (!currentManualImage) {
      return;
    }

    event.preventDefault();
    setDragState({
      imageId: currentManualImage.id,
      cropId: crop.id,
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startY: crop.y,
    });
  }

  function processManualCrops() {
    if (!manualImages.some((image) => image.crops.length)) {
      setStatus("Marca al menos una fila antes de procesar.");
      return;
    }

    startExtract(async () => {
      try {
        const totalCrops = manualImages.reduce((sum, image) => sum + image.crops.length, 0);
        setProgress({
          phase: "extract",
          completed: 0,
          total: Math.max(1, totalCrops),
          startedAt: Date.now(),
          label: "Preparing manual crops",
        });
        setVisualProgressPercent(4);
        const cropPreviewByFileName = new Map<string, string>();
        const croppedFiles = (
          await Promise.all(
            manualImages.map(async (image) =>
              Promise.all(
                image.crops.map(async (crop, cropIndex) => {
                  const outputName = `${image.file.name.replace(/\.jpg$/i, "")}-manual-${cropIndex + 1}.jpg`;
                  const cropped = await cropImageRegion(image.file, crop, outputName);
                  cropPreviewByFileName.set(cropped.file.name, cropped.dataUrl);
                  return cropped.file;
                })
              )
            )
          )
        ).flat();

        await runExtractionFromPreparedFiles(croppedFiles, cropPreviewByFileName);
      } catch (error) {
        setProgress(null);
        setVisualProgressPercent(null);
        setStatus(error instanceof Error ? error.message : "No se pudieron procesar los recortes manuales.");
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
        const importableCount = rows.filter((row) => !row.duplicateMessage && row.value.trim()).length;
        const startedAt = Date.now();
        setProgress({
          phase: "import",
          completed: 0,
          total: Math.max(1, importableCount),
          startedAt,
          label: "Importing providers",
        });
        setVisualProgressPercent(14);
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
              .map((row) => ({
                value: row.value.trim(),
                avatarDataUrl: row.avatarDataUrl || null,
                email: row.email || null,
                whatsapp: row.whatsapp || null,
                facebook: row.facebook || null,
              })),
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

        setProgress({
          phase: "import",
          completed: Math.max(1, importableCount),
          total: Math.max(1, importableCount),
          startedAt,
          label: "Importing providers",
        });
        const skippedText = (data.skipped || []).slice(0, 4).map((item) => `${item.value}: ${item.reason}`).join(" | ");
        setStatus([data.summary, skippedText].filter(Boolean).join(" "));
        setRows([]);
        setManualImages([]);
        setManualIndex(0);
        setBulkText("");
        setProgress(null);
        setVisualProgressPercent(null);
      } catch (error) {
        setProgress(null);
        setVisualProgressPercent(null);
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
          <p className="text-sm font-semibold text-[#131316]">2. {bulkTextMode ? "Pega el texto masivo" : "Sube todas las capturas"}</p>
          <p className="mt-1 text-xs leading-5 text-[#62564a]">
            {bulkTextMode
              ? "GPT extraera Facebook, correos y telefonos del bloque grande de texto y los convertira en proveedores."
              : "Puedes subir muchas a la vez. Las comprimimos y las enviamos por lotes para que el proceso sea mas estable."}
          </p>
          {bulkTextMode ? (
            <>
              <textarea
                className="input mt-3 min-h-48"
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                placeholder="Pega aqui el texto enorme con enlaces de Facebook, correos y numeros..."
              />
              <div className="mt-2 text-right text-xs text-[#8f857b]">
                {bulkText.length.toLocaleString("en-US")} caracteres
              </div>
              <button className="btn-primary mt-3" type="button" onClick={extractFromText} disabled={isExtracting}>
                {isExtracting ? "Procesando..." : "Extraer desde texto"}
              </button>
            </>
          ) : (
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
          )}
          <label className="mt-3 flex items-center gap-2 text-sm text-[#62564a]">
            <input type="checkbox" checked={isVerified} onChange={(event) => setIsVerified(event.target.checked)} />
            <span>Marcar los importados como verificados</span>
          </label>
        </div>

        {socialManualMode && !bulkTextMode && manualImages.length ? (
          <div className="rounded-[1.3rem] border border-[#eadfd6] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#131316]">3. Recorte manual por filas</p>
                <p className="mt-1 text-xs text-[#62564a]">Agrega recortes uno por uno donde quieras. Si hace falta, arrastra cada uno para ajustarlo.</p>
              </div>
              <span className="rounded-full bg-[#f6f1ea] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7c7064]">
                {manualIndex + 1}/{manualImages.length}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs text-[#62564a]">
                <span>Margen izquierdo</span>
                <input type="range" min="0" max="25" value={manualCropLeft} onChange={(event) => setManualCropLeft(Number(event.target.value))} />
              </label>
              <label className="grid gap-1 text-xs text-[#62564a]">
                <span>Ancho del recorte</span>
                <input
                  type="range"
                  min="25"
                  max={manualCropWidthMax}
                  value={manualCropWidth}
                  onChange={(event) => setManualCropWidth(Number(event.target.value))}
                />
              </label>
              <label className="grid gap-1 text-xs text-[#62564a]">
                <span>Altura de fila</span>
                <input type="range" min="6" max="20" value={manualCropHeight} onChange={(event) => setManualCropHeight(Number(event.target.value))} />
              </label>
            </div>

            {currentManualImage ? (
              <div className="mt-4">
                <div className="relative overflow-hidden rounded-[1.2rem] border border-[#eadfd6] bg-[#f9f4ee]">
                  <img
                    src={currentManualImage.dataUrl}
                    alt="Captura para recorte manual"
                    className="w-full"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const clickRatioY = (event.clientY - rect.top) / rect.height;
                      addManualCrop(clickRatioY);
                    }}
                  />
                  {currentManualImage.crops.map((crop) => (
                    <button
                      key={crop.id}
                      type="button"
                      onClick={() => removeManualCrop(crop.id)}
                      onPointerDown={(event) => startDraggingCrop(crop, event)}
                      className="absolute cursor-grab rounded-[1rem] border-2 border-[#ff6b35] bg-[rgba(255,107,53,0.12)] active:cursor-grabbing"
                      style={{
                        left: `${crop.x * 100}%`,
                        top: `${crop.y * 100}%`,
                        width: `${crop.w * 100}%`,
                        height: `${crop.h * 100}%`,
                      }}
                      title="Arrastra para ajustar este recorte"
                    />
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-[#62564a]">
                    {currentManualImage.crops.length} recortes en esta imagen
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-[#eadfd6] px-3 py-2 text-xs font-semibold text-[#62564a]"
                      onClick={() => setManualIndex((current) => Math.max(0, current - 1))}
                      disabled={manualIndex === 0}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[#eadfd6] px-3 py-2 text-xs font-semibold text-[#62564a]"
                      onClick={() => setManualIndex((current) => Math.min(manualImages.length - 1, current + 1))}
                      disabled={manualIndex === manualImages.length - 1}
                    >
                      Siguiente
                    </button>
                    <button type="button" className="btn-primary" onClick={processManualCrops} disabled={isExtracting}>
                      {isExtracting ? "Procesando..." : "Procesar recortes"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {status ? (
          <div className="rounded-[1.2rem] border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#62564a]">{status}</div>
        ) : null}

        {rows.length ? (
          <div className="rounded-[1.3rem] border border-[#eadfd6] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#131316]">{socialManualMode && !bulkTextMode ? "4. Revisar antes de importar" : "3. Revisar antes de importar"}</p>
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
                            className={`shrink-0 bg-[#f5eee6] object-contain object-left ring-1 ring-[#eadfd6] ${
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
                        value={bulkTextMode ? row.preview : row.value}
                        onChange={(event) => updateRow(row.id, event.target.value)}
                        placeholder="Contacto extraido"
                        readOnly={bulkTextMode}
                      />
                      {bulkTextMode ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {row.facebook ? <div className="rounded-[1rem] bg-[#fcfaf7] px-3 py-2 text-xs text-[#62564a]">Facebook: {row.facebook}</div> : null}
                          {row.email ? <div className="rounded-[1rem] bg-[#fcfaf7] px-3 py-2 text-xs text-[#62564a]">Email: {row.email}</div> : null}
                          {row.whatsapp ? <div className="rounded-[1rem] bg-[#fcfaf7] px-3 py-2 text-xs text-[#62564a]">Telefono: {row.whatsapp}</div> : null}
                        </div>
                      ) : null}
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

        {(isExtracting || isImporting || progress) && (
          <div className="rounded-[1.2rem] border border-[#eadfd6] bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="font-semibold text-[#131316]">
                {progress?.label || (isExtracting ? (bulkTextMode ? "Processing text with AI" : "Processing captures with AI") : "Importing providers")}
              </p>
              <span className="text-[#62564a]">{displayProgressPercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f2e6db]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#ff6c38_0%,#ff895f_100%)] transition-[width] duration-300"
                style={{ width: `${Math.max(displayProgressPercent, 8)}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#62564a]">
              <span>
                {progress
                  ? `${Math.min(progress.completed, progress.total)} of ${progress.total} completed`
                  : isImporting
                    ? "Finishing import..."
                    : "Starting..."}
              </span>
              <span>{formatEta(progressEtaSeconds)}</span>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
