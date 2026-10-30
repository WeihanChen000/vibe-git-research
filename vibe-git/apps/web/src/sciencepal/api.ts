export async function sciencepalApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/sciencepal${path}`, {
    cache: "no-store", signal: AbortSignal.timeout(body !== undefined ? 60000 : path === "/agents" ? 50000 : 8000),
    ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-Vibe-SciencePAL": "1" }, body: JSON.stringify(body) }),
  });
  let data: any;
  try { data = await response.json(); } catch { throw new Error("服务未返回有效数据，请确认本机 Host 正常运行。"); }
  if (!response.ok) throw new Error(data.error || "服务请求失败，请刷新查看当前状态。");
  return data as T;
}
