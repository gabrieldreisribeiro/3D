function AppShell({ header, footer, children }) {
  return (
    <div className="app-shell-pro">
      {header}
      <main className="app-content-pro">{children}</main>
      {footer}
    </div>
  );
}

export default AppShell;
