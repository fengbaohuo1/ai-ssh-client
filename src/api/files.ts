import { apiGet, apiPost, apiUpload, apiUploadWithProgress, apiDownload } from "./client";

export type SftpFileType = "file" | "dir" | "link" | "other";

export interface SftpFile {
  name: string;
  path: string;
  type: SftpFileType;
  size: number;
  modifiedAt: number;
  permissions: number;
  permissionsText: string;
  hidden: boolean;
  linkTarget?: string | null;
  owner?: string | null;
}

export interface SftpList {
  path: string;
  parent: string | null;
  files: SftpFile[];
  total: number;
  truncated: boolean;
}

export interface SftpPreview {
  path: string;
  content: string;
  size: number;
  truncated: boolean;
  binary: boolean;
  encoding: string;
}

const base = (connectionId: string) => `/api/v1/sftp/${encodeURIComponent(connectionId)}`;
const q = (path: string) => `path=${encodeURIComponent(path)}`;

export async function listFiles(connectionId: string, path: string) {
  return apiGet<SftpList>(`${base(connectionId)}/list?${q(path)}`);
}

export async function statFile(connectionId: string, path: string) {
  return apiGet<SftpFile>(`${base(connectionId)}/stat?${q(path)}`);
}

export async function previewFile(connectionId: string, path: string) {
  return apiGet<SftpPreview>(`${base(connectionId)}/preview?${q(path)}`);
}

export async function mkdir(connectionId: string, path: string) {
  return apiPost<void>(`${base(connectionId)}/mkdir`, { path });
}

export async function renamePath(connectionId: string, path: string, newPath: string) {
  return apiPost<void>(`${base(connectionId)}/rename`, { path, newPath });
}

export async function deletePath(connectionId: string, path: string, recursive = false) {
  return apiPost<void>(`${base(connectionId)}/delete`, { path, recursive });
}

export async function writeFile(connectionId: string, path: string, content: string) {
  return apiPost<void>(`${base(connectionId)}/write`, { path, content });
}

export async function uploadFile(
  connectionId: string,
  directory: string,
  file: File,
  onProgress?: (percent: number) => void
) {
  const path = `${base(connectionId)}/upload?${q(directory)}`;
  return onProgress
    ? apiUploadWithProgress<SftpFile>(path, file, onProgress)
    : apiUpload<SftpFile>(path, file);
}

export async function downloadFile(connectionId: string, path: string) {
  return apiDownload(`${base(connectionId)}/download?${q(path)}`);
}
