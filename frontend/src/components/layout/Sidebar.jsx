function Sidebar({ brand, subtitle, links, footer }) {
  return (
    <aside className="sidebar-pro">
      <div className="sidebar-brand-wrap">
        {brand}
        {subtitle ? <p className="sidebar-subtitle">{subtitle}</p> : null}
      </div>
      <nav className="sidebar-nav">{links}</nav>
      <div className="sidebar-footer">{footer}</div>
    </aside>
  );
}

export default Sidebar;
