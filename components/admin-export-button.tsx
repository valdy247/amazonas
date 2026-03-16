"use client";

type AdminExportButtonProps = {
  filename: string;
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
  label: string;
};

function escapeCsvValue(value: string | number | boolean | null | undefined) {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function toCsv(rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  if (!rows.length) {
    return "";
  }

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ];
  return lines.join("\n");
}

export function AdminExportButton({ filename, rows, label }: AdminExportButtonProps) {
  function handleDownload() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className="btn-secondary" type="button" onClick={handleDownload} disabled={!rows.length}>
      {label}
    </button>
  );
}
