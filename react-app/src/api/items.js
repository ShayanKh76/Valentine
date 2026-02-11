const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace(
  /\/$/,
  ""
);

async function parseResponse(response) {
  if (response.ok) {
    if (response.status === 204) {
      return null;
    }
    return response.json();
  }

  let message = "Request failed";
  try {
    const data = await response.json();
    if (data?.error) {
      message = data.error;
    }
  } catch {
    // Keep generic message on parse failure.
  }
  throw new Error(message);
}

export async function getPages() {
  const response = await fetch(`${API_BASE}/pages`);
  return parseResponse(response);
}

export async function createPage(title) {
  const response = await fetch(`${API_BASE}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return parseResponse(response);
}

export async function updatePage(pageId, payload) {
  const response = await fetch(`${API_BASE}/pages/${encodeURIComponent(pageId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function deletePage(pageId) {
  const response = await fetch(`${API_BASE}/pages/${encodeURIComponent(pageId)}`, {
    method: "DELETE",
  });
  return parseResponse(response);
}

export async function getBlocks(pageId) {
  const response = await fetch(`${API_BASE}/pages/${encodeURIComponent(pageId)}/blocks`);
  return parseResponse(response);
}

export async function createBlock(pageId, payload) {
  const response = await fetch(`${API_BASE}/pages/${encodeURIComponent(pageId)}/blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function updateBlock(pageId, blockId, payload) {
  const response = await fetch(
    `${API_BASE}/pages/${encodeURIComponent(pageId)}/blocks/${encodeURIComponent(blockId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  return parseResponse(response);
}

export async function deleteBlock(pageId, blockId) {
  const response = await fetch(
    `${API_BASE}/pages/${encodeURIComponent(pageId)}/blocks/${encodeURIComponent(blockId)}`,
    {
      method: "DELETE",
    }
  );
  return parseResponse(response);
}

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API_BASE}/uploads`, {
    method: "POST",
    body: formData,
  });

  return parseResponse(response);
}
