import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="bg-[#2E2E2E] text-white py-12 border-t border-white/5">
      <div className="container mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img
                src="/pilar-logo.svg"
                alt="Pilar"
                className="h-8 w-8 brightness-0 invert hover:rotate-12 transition-transform duration-300"
              />
              <span className="text-xl font-medium tracking-tight">Pilar</span>
            </div>
            <p className="text-slate-400 max-w-sm mb-6 font-light leading-relaxed">
              O sistema de gestão definitivo para escritórios de engenharia e arquitetura. Simples, bonito e eficiente.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/trinitycomp4ny/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer text-white/60 hover:text-white hover:scale-110 duration-300"
              >
                <span className="sr-only">Instagram</span>
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.linkedin.com/company/trnty-company"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer text-white/60 hover:text-white hover:scale-110 duration-300"
              >
                <span className="sr-only">LinkedIn</span>
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-6 tracking-wider text-white">Produto</h4>
            <ul className="space-y-4 text-slate-400 font-light text-sm">
              <li>
                <a href="#funcionalidades" className="hover:text-accent-orange transition-colors">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="#sobre" className="hover:text-accent-orange transition-colors">
                  Sobre Nós
                </a>
              </li>
              <li>
                <Link to="/login" className="hover:text-accent-orange transition-colors">
                  Entrar
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-6 tracking-wider text-white">Legal</h4>
            <ul className="space-y-4 text-slate-400 font-light text-sm">
              <li>
                <a href="#" className="hover:text-accent-orange transition-colors">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-accent-orange transition-colors">
                  Privacidade
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-light">
          <p>&copy; {new Date().getFullYear()} Pilar. Todos os direitos reservados.</p>
          <div className="flex items-center gap-1">
            <span>Impulsionado por</span>
            <a
              href="https://trnty.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-accent-orange transition-colors font-medium"
            >
              Trinity Company
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
