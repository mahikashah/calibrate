// A template re-mounts on every navigation (unlike a layout), so each page
// gets a soft entrance while the sidebar in AppShell stays put.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
