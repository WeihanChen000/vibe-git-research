/** The local research proxy does not expose the original software APIs. */
export function OriginalWorkspaceAccess({localPanel = false}: {localPanel?: boolean}) {
  return <section className="rt-detail-section"><h4>原版软件协作</h4>{localPanel
    ? <p>当前是科研本机面板。请打开原房间域名的 <code>/?view=software</code>，打开原版的软件提案、任务与变更审核；仍需原房间的登录身份。</p>
    : <a href="/?view=software">打开原版软件协作</a>}</section>;
}
