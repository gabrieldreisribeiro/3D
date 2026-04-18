import { Link } from 'react-router-dom';

function Footer() {
  const sectionTitleClass = 'text-xs font-semibold uppercase tracking-[0.12em] text-slate-300';
  const listClass = 'mt-3 space-y-2 text-sm text-slate-300';
  const itemClass = 'transition-colors hover:text-violet-300';

  return (
    <footer className="border-t border-slate-700/60 bg-slate-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-50">Luma3</h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              Pecas impressas em 3D para organizacao, decoracao e presentes personalizados.
            </p>
          </div>

          <div>
            <p className={sectionTitleClass}>Navegacao</p>
            <ul className={listClass}>
              <li><Link to="/" className={itemClass}>Inicio</Link></li>
              <li><Link to="/#produtos" className={itemClass}>Produtos</Link></li>
              <li><Link to="/#produtos" className={itemClass}>Categorias</Link></li>
              <li><Link to="/cart" className={itemClass}>Carrinho</Link></li>
            </ul>
          </div>

          <div>
            <p className={sectionTitleClass}>Suporte</p>
            <ul className={listClass}>
              <li><span className="text-slate-300">Como comprar</span></li>
              <li><span className="text-slate-300">Prazo de producao</span></li>
              <li><span className="text-slate-300">Trocas e devolucao</span></li>
            </ul>
          </div>

          <div>
            <p className={sectionTitleClass}>Contato</p>
            <ul className={listClass}>
              <li><a className={itemClass} href="https://wa.me/" target="_blank" rel="noreferrer">WhatsApp</a></li>
              <li><a className={itemClass} href="https://instagram.com/" target="_blank" rel="noreferrer">Instagram</a></li>
              <li><a className={itemClass} href="mailto:contato@lumastudio.com">Email</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700/70">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-xs text-slate-400">© 2026 Luma3D — Todos os direitos reservados</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
