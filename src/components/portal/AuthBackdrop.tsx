/** Fundo animado das telas de acesso do portal. Anima só transform. */
export function AuthBackdrop() {
  return (
    <div aria-hidden className="auth-backdrop pointer-events-none absolute inset-0 overflow-hidden">
      <span className="auth-blob auth-blob-a" />
      <span className="auth-blob auth-blob-b" />
      <span className="auth-blob auth-blob-c" />
      <span className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(14,14,14,0.55)]" />
      <style>{`
        .auth-blob { position:absolute; border-radius:9999px; filter:blur(70px); will-change:transform; }
        .auth-blob-a { width:360px; height:360px; top:-80px; left:-80px;
          background:radial-gradient(circle, rgba(200,40,42,.55), transparent 70%);
          animation:authBlobA 26s ease-in-out infinite; }
        .auth-blob-b { width:420px; height:420px; bottom:-100px; right:-100px;
          background:radial-gradient(circle, rgba(140,20,24,.50), transparent 70%);
          animation:authBlobB 32s ease-in-out infinite; }
        .auth-blob-c { width:300px; height:300px; top:50%; left:50%; margin:-150px 0 0 -150px;
          background:radial-gradient(circle, rgba(177,179,179,.20), transparent 70%);
          animation:authBlobC 38s ease-in-out infinite; }
        @keyframes authBlobA {
          0%,100% { transform:translate3d(-12%,-8%,0) scale(1); }
          50% { transform:translate3d(18%,14%,0) scale(1.25); }
        }
        @keyframes authBlobB {
          0%,100% { transform:translate3d(12%,8%,0) scale(1.1); }
          50% { transform:translate3d(-18%,-14%,0) scale(0.9); }
        }
        @keyframes authBlobC {
          0%,100% { transform:translate3d(-10%,6%,0) scale(1); }
          50% { transform:translate3d(10%,-6%,0) scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-blob { animation:none; }
        }
      `}</style>
    </div>
  );
}
