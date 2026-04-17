function AppShell({ header, footer, children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {header}
      <main>{children}</main>
      {footer}
    </div>
  );
}

export default AppShell;
