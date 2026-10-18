import { useCallback, useEffect, useRef, useState } from "react";
import { mkdir, uploadFile } from "../../api/files";
import { toast } from "../../stores/toastStore";
import { joinRemotePath, relativeDirOf } from "./fileUtils";

/** 单个待上传的本地文件（relativePath 保留文件夹层级） */
export interface LocalUpload {
  file: File;
  relativePath: string;
}

export interface UploadProgress {
  destDir: string;
  total: number;
  done: number;
  failed: number;
  /** 当前文件名（相对路径） */
  current: string;
  /** 当前文件上传百分比 0~1 */
  filePercent: number;
}

/** 与后端 `ai.security.sftp.max-upload-bytes` 默认值保持一致（100 MB） */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_UPLOAD_FILES = 2000;

function isDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

/** webkitGetAsEntry 必须在 drop 事件同步阶段调用；这里先收集 entry 再异步遍历 */
function entriesFrom(dataTransfer: DataTransfer): FileSystemEntry[] {
  const entries: FileSystemEntry[] = [];
  const items = dataTransfer.items;
  if (!items) return entries;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  return entries;
}

function fileOfEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

/** readEntries 每次只返回一批，必须循环读到空数组 */
function readAllEntries(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = directory.createReader();
    const all: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function walkEntry(entry: FileSystemEntry, prefix: string, out: LocalUpload[]): Promise<void> {
  if (out.length >= MAX_UPLOAD_FILES) return;
  if (isFileEntry(entry)) {
    try {
      const file = await fileOfEntry(entry);
      out.push({ file, relativePath: `${prefix}${entry.name}` });
    } catch {
      // 个别文件不可读时跳过，避免整个拖拽任务失败
    }
    return;
  }
  if (isDirectoryEntry(entry)) {
    const children = await readAllEntries(entry);
    const nextPrefix = `${prefix}${entry.name}/`;
    await Promise.all(children.map((child) => walkEntry(child, nextPrefix, out)));
  }
}

async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<LocalUpload[]> {
  const entries = entriesFrom(dataTransfer);
  if (entries.length === 0) {
    return filesToUploads(Array.from(dataTransfer.files ?? []));
  }
  const out: LocalUpload[] = [];
  for (const entry of entries) {
    await walkEntry(entry, "", out);
  }
  return out;
}

/** File[]（含 webkitRelativePath）→ 上传任务；文件夹选择框也走这里 */
export function filesToUploads(files: File[]): LocalUpload[] {
  return files.map((file) => {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return { file, relativePath: relative && relative.length > 0 ? relative : file.name };
  });
}

/** 按层级从浅到深创建目录；已存在的目录会失败，忽略即可 */
async function ensureDirectories(connectionId: string, dirs: string[]): Promise<void> {
  const unique = [...new Set(dirs)].sort(
    (a, b) => a.split("/").filter(Boolean).length - b.split("/").filter(Boolean).length
  );
  for (const dir of unique) {
    try {
      await mkdir(connectionId, dir);
    } catch {
      // 目录已存在或没有创建权限：真正的问题会在上传阶段以更明确的错误暴露
    }
  }
}

interface Options {
  onUploaded?: (destDir: string, count: number) => void;
}

/**
 * 拖拽上传队列：本地文件/文件夹 → 远程目录。
 *
 * <p>文件夹会先在远端补齐同名目录结构，再逐个文件上传；上传串行，进度可观测。
 * 上传失败不会中断后续文件，最终汇总成一条 Toast。
 */
export function useDroppedUpload(connectionId: string | null | undefined, options?: Options) {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const busyRef = useRef(false);
  const clearTimerRef = useRef<number | null>(null);
  const onUploadedRef = useRef(options?.onUploaded);
  onUploadedRef.current = options?.onUploaded;

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const run = useCallback(
    async (uploads: LocalUpload[], destDir: string) => {
      if (!connectionId || uploads.length === 0 || busyRef.current) return;
      busyRef.current = true;
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      const failures: string[] = [];
      let done = 0;
      let failed = 0;
      let total = 0;
      const accepted: LocalUpload[] = [];

      for (const upload of uploads) {
        if (upload.file.size > MAX_UPLOAD_BYTES) {
          failed += 1;
          failures.push(`${upload.relativePath}: 超过 100 MB 上限`);
        } else {
          accepted.push(upload);
        }
      }
      if (accepted.length > MAX_UPLOAD_FILES) {
        const ignored = accepted.length - MAX_UPLOAD_FILES;
        accepted.length = MAX_UPLOAD_FILES;
        failed += ignored;
        failures.push(`一次最多上传 ${MAX_UPLOAD_FILES} 个文件，已忽略 ${ignored} 个`);
      }
      total = accepted.length + failed;

      setProgress({ destDir, total, done: 0, failed, current: "准备上传…", filePercent: 0 });

      try {
        const dirs: string[] = [];
        for (const upload of accepted) {
          const sub = relativeDirOf(upload.relativePath);
          if (!sub) continue;
          let acc = destDir;
          for (const segment of sub.split("/").filter(Boolean)) {
            acc = joinRemotePath(acc, segment);
            dirs.push(acc);
          }
        }
        await ensureDirectories(connectionId, dirs);

        for (const upload of accepted) {
          setProgress((prev) => (prev ? { ...prev, current: upload.relativePath, filePercent: 0 } : prev));
          try {
            const targetDir = joinRemotePath(destDir, relativeDirOf(upload.relativePath));
            const res = await uploadFile(connectionId, targetDir, upload.file, (percent) => {
              setProgress((prev) => (prev ? { ...prev, filePercent: percent } : prev));
            });
            if (res.code === "0000") {
              done += 1;
            } else {
              failed += 1;
              failures.push(`${upload.relativePath}: ${res.info}`);
            }
          } catch (err) {
            failed += 1;
            failures.push(`${upload.relativePath}: ${err instanceof Error ? err.message : String(err)}`);
          }
          setProgress((prev) => (prev ? { ...prev, done, failed, filePercent: 1 } : prev));
        }

        if (done > 0) {
          toast.success(`已上传 ${done} 个文件`, destDir);
          onUploadedRef.current?.(destDir, done);
        }
        if (failed > 0) {
          toast.error(`${failed} 个文件上传失败`, failures.slice(0, 2).join("\n"));
        }
      } catch (err) {
        toast.error("上传失败", err instanceof Error ? err.message : String(err));
      } finally {
        busyRef.current = false;
        setProgress((prev) => (prev ? { ...prev, current: "", filePercent: 1 } : prev));
        clearTimerRef.current = window.setTimeout(() => {
          setProgress(null);
          clearTimerRef.current = null;
        }, 2800);
      }
    },
    [connectionId]
  );

  /** 上传普通文件列表 / 文件夹选择框结果（FileList） */
  const startFiles = useCallback(
    (files: FileList | File[], destDir: string) => {
      const list = Array.isArray(files) ? files : Array.from(files);
      void run(filesToUploads(list), destDir);
    },
    [run]
  );

  /** 处理拖拽释放：文件夹会递归展开，保留相对目录结构 */
  const startDrop = useCallback(
    (dataTransfer: DataTransfer, destDir: string) => {
      if (busyRef.current) {
        toast.info("已有上传任务正在进行");
        return;
      }
      void collectDroppedFiles(dataTransfer)
        .then((uploads) => {
          if (uploads.length === 0) {
            toast.warning("没有可上传的文件");
            return;
          }
          return run(uploads, destDir);
        })
        .catch((err) => {
          toast.error("读取拖入文件失败", err instanceof Error ? err.message : String(err));
        });
    },
    [run]
  );

  return { progress, busy: progress !== null, startFiles, startDrop };
}
