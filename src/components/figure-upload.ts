import {
  isFigureContentType,
  MAX_FIGURE_BYTES,
  type FigureDimensions,
} from "@/lib/figures/types";

/**
 * The browser half of a Figure upload: mint, POST the file to the presigned
 * bucket URL, then confirm. A failed step throws with a message the editor can
 * put in a toast; nothing is inserted unless every step succeeds.
 */

export type UploadedFigure = FigureDimensions & { id: string };

function imageDimensions(file: File): Promise<FigureDimensions> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      // The server will still verify the object; the preview just cannot
      // reserve an aspect ratio.
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

async function errorMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

export async function uploadFigure(
  file: File,
  problemId: string,
): Promise<UploadedFigure> {
  if (!isFigureContentType(file.type)) {
    throw new Error("A Figure can only be a PNG, JPEG or WebP image.");
  }
  if (file.size < 1 || file.size > MAX_FIGURE_BYTES) {
    throw new Error("A Figure can be at most 2MB.");
  }

  const dimensions = await imageDimensions(file);

  const mintResponse = await fetch("/api/figures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      problemId,
      contentType: file.type,
      bytes: file.size,
      width: dimensions.width,
      height: dimensions.height,
    }),
  });
  if (!mintResponse.ok) {
    throw new Error(
      await errorMessage(mintResponse, "The figure could not be uploaded."),
    );
  }

  const minted = (await mintResponse.json()) as {
    id: string;
    url: string;
    fields: Record<string, string>;
  };

  const form = new FormData();
  for (const [name, value] of Object.entries(minted.fields ?? {})) {
    form.append(name, value);
  }
  // The file must be the last field in a presigned POST.
  form.append("file", file);

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(minted.url, { method: "POST", body: form });
  } catch {
    throw new Error(
      "The upload could not reach storage. Check the connection and try again.",
    );
  }
  if (!uploadResponse.ok) {
    throw new Error("The upload failed. Try adding the figure again.");
  }

  const confirmResponse = await fetch(`/api/figures/${minted.id}/confirm`, {
    method: "POST",
  });
  if (!confirmResponse.ok) {
    throw new Error(
      await errorMessage(
        confirmResponse,
        "The upload could not be confirmed. Try again.",
      ),
    );
  }

  const confirmed = (await confirmResponse.json().catch(() => null)) as {
    width?: number | null;
    height?: number | null;
  } | null;

  return {
    id: minted.id,
    width: confirmed?.width ?? dimensions.width,
    height: confirmed?.height ?? dimensions.height,
  };
}
