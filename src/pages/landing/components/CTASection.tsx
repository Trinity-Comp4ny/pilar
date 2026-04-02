import { Link } from "react-router-dom";

export function CTASection() {
  return (
    <section className="py-24 bg-white relative overflow-hidden border-t border-slate-100">
      <div className="container mx-auto px-6 md:px-10 text-center relative z-10">
        <div className="reveal-up">
          <h2 className="text-3xl md:text-5xl font-medium text-[#2E2E2E] mb-6">
            Pronto para transformar sua gestão?
          </h2>
          <p className="text-slate-600 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-light">
            Junte-se aos escritórios que já modernizaram seus processos com a Pilar. Comece hoje mesmo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto px-10 py-4 bg-accent-orange text-white rounded-full font-medium text-sm hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-500/25 hover:-translate-y-1"
            >
              Acessar Sistema
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
