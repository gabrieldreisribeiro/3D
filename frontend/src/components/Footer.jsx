import { Link } from 'react-router-dom';

function Footer() {
  const sectionTitleClass = 'text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]';
  const listClass = 'mt-3 space-y-2 text-sm text-[#475467]';
  const itemClass = 'transition-colors hover:text-[#6D28D9]';

  return (
    <footer className="mt-10 border-t border-[#E6EAF0] bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-[#111827]">Luma3D</h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#667085]">
              Marketplace especializado em pecas impressas em 3D para organizacao, decoracao e personalizados.
            </p>
          </div>

          <div>
            <p className={sectionTitleClass}>Navegacao</p>
            <ul className={listClass}>
              <li><Link to="/" className={itemClass}>Inicio</Link></li>
              <li><a href="/#mais-pedidos" className={itemClass}>Mais pedidos</a></li>
              <li><a href="/#catalogo" className={itemClass}>Catalogo</a></li>
              <li><Link to="/cart" className={itemClass}>Carrinho</Link></li>
            </ul>
          </div>

          <div>
            <p className={sectionTitleClass}>Suporte</p>
            <ul className={listClass}>
              <li><span>Como comprar</span></li>
              <li><span>Prazo de producao</span></li>
              <li><span>Trocas e devolucao</span></li>
            </ul>
          </div>

          <div>
            <p className={sectionTitleClass}>Contato</p>
            <ul className={listClass}>
              <li><a className={itemClass} href="https://wa.me/" target="_blank" rel="noreferrer">WhatsApp</a></li>
              <li><a className={itemClass} href="https://instagram.com/" target="_blank" rel="noreferrer">Instagram</a></li>
              <li><a className={itemClass} href="mailto:contato@lumastudio.com">contato@lumastudio.com</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-[#E6EAF0] bg-[#F9FAFB]">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-xs text-[#667085]">© 2026 Luma3D - Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
