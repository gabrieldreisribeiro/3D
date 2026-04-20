function AppShell({ header, footer, children }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900">
      {header}
      <main className="pt-4 sm:pt-5">{children}</main>
      {footer}
    </div>
  );
}

export default AppShell;
