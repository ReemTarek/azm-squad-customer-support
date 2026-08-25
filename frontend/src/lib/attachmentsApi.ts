import { apiClient } from "./apiClient";

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export async function listCustomerAttachments(customerId: string) {
  const { data } = await apiClient.get<{ attachments: Attachment[] }>(`/customers/${customerId}/attachments`);
  return data.attachments;
}

export async function uploadCustomerAttachment(customerId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<{ attachment: Attachment }>(
    `/customers/${customerId}/attachments`,
    form
  );
  return data.attachment;
}

// A plain `<a href>` to a download URL would NOT send the app's
// Authorization header, and every download must be authenticated —
// so this fetches the file as a blob (with the token already attached
// by apiClient's interceptor) and triggers the save via a throwaway
// object URL, shared by both the ticket message thread and the
// customer profile attachments section.
export async function downloadAttachment(attachmentId: string, fileName: string) {
  const response = await apiClient.get(`/attachments/${attachmentId}`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
