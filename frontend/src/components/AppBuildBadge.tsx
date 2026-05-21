/** Small label so we can confirm which bundle is loaded (cache / wrong URL). */
export function AppBuildBadge() {
  const build =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-build")
      : null;

  if (!build) return null;

  const short = build.replace("T", " ").slice(0, 16);

  return (
    <span className="app-build-badge" title={`Build: ${build}`}>
      v {short}
    </span>
  );
}
