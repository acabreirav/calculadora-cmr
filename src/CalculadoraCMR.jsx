import React, { useMemo, useRef, useState } from "react";
import { track } from "@vercel/analytics";

/**
 * Calculadora CMR — ¿Comprar gift card hoy o esperar el cambio?
 * Motor "valor total": una tarjeta solo conviene si su $/punto supera tu ponderador.
 * Optimiza  valor gift cards + puntos guardados × ponderador.
 */

const CARDS = [
  { pts: 12000, clp: 20000 },
  { pts: 18000, clp: 35000 },
  { pts: 24000, clp: 60000 },
  { pts: 36000, clp: 120000 },
  { pts: 48000, clp: 180000 },
  { pts: 60000, clp: 250000 },
  { pts: 90000, clp: 450000 },
  { pts: 150000, clp: 750000 },
  { pts: 210000, clp: 1050000 },
];
const UNIT = 6000;

const clpFmt = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("es-CL");
const rateFmt = (v) => "$" + new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(v);
const signed = (v) => (v >= 0 ? "+" : "−") + clpFmt.format(Math.abs(Math.round(v)));

function comboPhrase(combo) {
  const parts = combo.map((c) => `${c.n} gift card${c.n > 1 ? "s" : ""} de ${clpFmt.format(c.clp)}`);
  if (parts.length <= 1) return parts[0] || "";
  return parts.slice(0, -1).join(", ") + " y " + parts[parts.length - 1];
}

// Unbounded knapsack: maximiza ganancia = clp − puntos × ponderador (nunca compra canjes malos).
function bestBuyNow(balance, pond) {
  const cap = Math.max(0, Math.floor(balance / UNIT));
  if (cap === 0) return { clp: 0, spentPts: 0, leftoverPts: balance, combo: [], gain: 0 };
  const cards = CARDS.map((c, i) => ({ u: c.pts / UNIT, clp: c.clp, i }));
  const dpGain = new Float64Array(cap + 1);
  const clpAt = new Float64Array(cap + 1);
  const spentAt = new Int32Array(cap + 1);
  const pick = new Int16Array(cap + 1).fill(-1);
  const pondU = pond * UNIT;
  for (let i = 1; i <= cap; i++) {
    dpGain[i] = dpGain[i - 1]; clpAt[i] = clpAt[i - 1]; spentAt[i] = spentAt[i - 1]; pick[i] = -1;
    for (const c of cards) {
      if (i >= c.u) {
        const cand = dpGain[i - c.u] + (c.clp - c.u * pondU);
        if (cand > dpGain[i] + 1e-6) {
          dpGain[i] = cand; clpAt[i] = clpAt[i - c.u] + c.clp; spentAt[i] = spentAt[i - c.u] + c.u; pick[i] = c.i;
        }
      }
    }
  }
  const counts = new Array(CARDS.length).fill(0);
  let i = cap;
  while (i > 0) { if (pick[i] === -1) i -= 1; else { counts[pick[i]] += 1; i -= CARDS[pick[i]].pts / UNIT; } }
  const combo = counts.map((n, idx) => ({ ...CARDS[idx], n })).filter((c) => c.n > 0).sort((a, b) => b.clp - a.clp);
  const spentPts = spentAt[cap] * UNIT;
  return { clp: clpAt[cap], spentPts, leftoverPts: balance - spentPts, combo, gain: Math.max(0, dpGain[cap]) };
}

function HelpTip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="help-wrap">
      <button type="button" className="help-btn" aria-label="Más información" onClick={() => setOpen((o) => !o)}>
        ?
      </button>
      {open && (
        <span className="help-pop" onClick={() => setOpen(false)}>
          {text}
        </span>
      )}
    </span>
  );
}

export default function CalculadoraCMR() {
  const [balance, setBalance] = useState(50000);
  const [pond, setPond] = useState(4.25);
  const [copiado, setCopiado] = useState(false);

  // Marca "sí usó la calculadora" una sola vez por sesión (mide interacción real).
  const interactuo = useRef(false);
  const marcarInteraccion = () => {
    if (interactuo.current) return;
    interactuo.current = true;
    track("interaccion");
  };

  const compartir = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const data = {
      title: "Calculadora CMR",
      text: "¿Comprar gift card hoy o esperar el cambio de puntos CMR? Calcúlalo aquí:",
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        track("compartir", { metodo: "nativo" });
        return;
      }
      await navigator.clipboard.writeText(url);
      track("compartir", { metodo: "copiar" });
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* usuario canceló o navegador sin permisos: no hacemos nada */
    }
  };

  const best = useMemo(() => bestBuyNow(balance, pond), [balance, pond]);
  const esperar = balance * pond;
  const buyTotal = best.clp + best.leftoverPts * pond;
  const gain = buyTotal - esperar;
  const actuar = gain > 1;
  const winner = gain > 1 ? "buy" : gain < -1 ? "wait" : "tie";

  const affordable = CARDS.filter((c) => c.pts <= balance);
  const breakeven = affordable.length ? Math.max(...affordable.map((c) => c.clp / c.pts)) : null;

  return (
    <div className="wrap">
      <style>{`
        .wrap{
          --paper:#FBFAF5; --surface:#ffffff; --ink:#182A22; --ink-soft:#5C6B63;
          --line:rgba(24,42,34,.14); --line-soft:rgba(24,42,34,.07);
          --buy:#1E8A4C; --buy-bg:#EAF5EE; --buy-head:#0f5c30;
          --wait:#6B4C9A; --wait-bg:#F0ECF6; --wait-head:#4a3170;
          --gold:#B67A22; --gold-bg:#FBF2E3; --gold-line:rgba(182,122,34,.32);
          --pop-bg:#182A22; --pop-fg:#F3F1EA; --shadow:rgba(24,42,34,.22);
          font-family:'Inter',system-ui,-apple-system,sans-serif; color:var(--ink);
          background:var(--paper); padding:30px 20px 40px; min-height:100%; -webkit-font-smoothing:antialiased;
        }
        @media (prefers-color-scheme: dark){
          .wrap{
            --paper:#12161A; --surface:#1B2026; --ink:#E7EDEA; --ink-soft:#94A39B;
            --line:rgba(255,255,255,.13); --line-soft:rgba(255,255,255,.06);
            --buy:#41B776; --buy-bg:rgba(65,183,118,.14); --buy-head:#7BE3A6;
            --wait:#AD8FDA; --wait-bg:rgba(173,143,218,.15); --wait-head:#CBB2F0;
            --gold:#D99C43; --gold-bg:rgba(217,156,67,.13); --gold-line:rgba(217,156,67,.34);
            --pop-bg:#2A3138; --pop-fg:#EDF1EE; --shadow:rgba(0,0,0,.5);
          }
        }
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .inner{max-width:560px;margin:0 auto;}
        .eyebrow{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.22em;
          text-transform:uppercase;color:var(--ink-soft);display:flex;gap:8px;align-items:center;}
        .eyebrow .dot{width:6px;height:6px;border-radius:50%;
          background:conic-gradient(#2E9E4F,#E0A138,#3B7FC4,#C7433B,#7A4C9C,#2E9E4F);}
        h1{font-family:'Fraunces',serif;font-weight:600;line-height:1.08;
          font-size:clamp(24px,5.4vw,32px);margin:11px 0 22px;letter-spacing:-.01em;}

        .card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px;}
        .field{display:flex;flex-direction:column;gap:8px;}
        .field + .field{margin-top:18px;}
        .field-label{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;}
        input[type=number]{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;
          border:1px solid var(--line);border-radius:9px;padding:11px 13px;background:var(--paper);
          color:var(--ink);width:100%;box-sizing:border-box;}
        input[type=number]:focus{outline:2px solid var(--buy);outline-offset:1px;border-color:transparent;}
        .slider-row{display:flex;align-items:center;gap:13px;}
        input[type=range]{flex:1;accent-color:var(--wait);height:22px;}
        .pond-input{display:flex;align-items:center;gap:3px;background:var(--wait-bg);
          border:1px solid var(--wait);border-radius:8px;padding:3px 8px 3px 10px;}
        .pond-input .pond-x{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:19px;color:var(--wait);}
        .pond-input input[type=number]{font-size:19px;font-weight:600;color:var(--wait);background:transparent;
          border:none;padding:4px 2px;width:62px;}
        .pond-input input[type=number]:focus{outline:none;}
        .pond-input:focus-within{outline:2px solid var(--wait);outline-offset:1px;}

        .help-wrap{position:relative;display:inline-flex;}
        .help-btn{width:16px;height:16px;border-radius:50%;border:1px solid var(--ink-soft);
          background:transparent;color:var(--ink-soft);font-size:10px;font-weight:700;line-height:1;
          cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;}
        .help-btn:hover{border-color:var(--ink);color:var(--ink);}
        .help-pop{position:absolute;top:22px;left:50%;transform:translateX(-50%);z-index:5;
          width:min(260px,72vw);background:var(--pop-bg);color:var(--pop-fg);font-size:12px;font-weight:400;
          line-height:1.5;border-radius:10px;padding:11px 13px;cursor:pointer;
          box-shadow:0 8px 24px var(--shadow);}

        .reco{border-radius:16px;padding:22px;border:1.5px solid;margin-top:16px;
          display:flex;flex-direction:column;}
        .reco.buy{background:var(--buy-bg);border-color:var(--buy);}
        .reco.wait{background:var(--wait-bg);border-color:var(--wait);}
        .reco-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.18em;
          text-transform:uppercase;color:var(--ink-soft);}
        .reco-head{font-family:'Fraunces',serif;font-weight:600;line-height:1;letter-spacing:-.01em;
          font-size:clamp(28px,6.4vw,40px);margin:4px 0 8px;}
        .reco.buy .reco-head{color:var(--buy-head);} .reco.wait .reco-head{color:var(--wait-head);}
        .reco-action{font-size:15px;line-height:1.5;color:var(--ink);}
        .reco-action b{font-weight:600;}
        .reco-metric{margin-top:14px;align-self:flex-start;font-family:'IBM Plex Mono',monospace;
          font-size:13px;font-weight:600;background:var(--surface);border:1px solid var(--line);
          border-radius:999px;padding:6px 13px;}
        .reco.buy .reco-metric{color:var(--buy);} .reco.wait .reco-metric{color:var(--wait);}

        .consejo{margin-top:14px;display:flex;gap:11px;align-items:flex-start;
          background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px;}
        .consejo .ico{flex:none;width:22px;height:22px;border-radius:50%;background:var(--gold);
          color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px;}
        .consejo p{margin:0;font-size:14px;line-height:1.55;color:var(--ink-soft);}
        .consejo b{color:var(--ink);}
        .consejo .be{font-family:'IBM Plex Mono',monospace;color:var(--gold);font-weight:600;}

        .desglose{margin-top:16px;}
        .desglose-head{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.18em;
          text-transform:uppercase;color:var(--ink-soft);}
        .opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
          gap:10px;margin-top:9px;}
        .opt{position:relative;background:var(--surface);border:1px solid var(--line);
          border-radius:14px;padding:15px 16px;display:flex;flex-direction:column;gap:4px;}
        .opt.buy.win{border-color:var(--buy);background:var(--buy-bg);}
        .opt.wait.win{border-color:var(--wait);background:var(--wait-bg);}
        .opt-label{font-size:12px;font-weight:600;color:var(--ink-soft);}
        .opt-val{font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:600;
          letter-spacing:-.01em;line-height:1.1;}
        .opt.buy.win .opt-val{color:var(--buy-head);}
        .opt.wait.win .opt-val{color:var(--wait-head);}
        .opt-sub{font-size:12px;line-height:1.45;color:var(--ink-soft);}
        .opt-tag{position:absolute;top:12px;right:12px;font-family:'IBM Plex Mono',monospace;
          font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
          border-radius:999px;padding:3px 8px;}
        .opt.buy .opt-tag{color:var(--buy);background:var(--surface);border:1px solid var(--buy);}
        .opt.wait .opt-tag{color:var(--wait);background:var(--surface);border:1px solid var(--wait);}

        .vigencia{display:inline-flex;align-items:center;gap:7px;margin:12px 0 0;
          font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.05em;
          color:var(--gold);background:var(--gold-bg);border:1px solid var(--gold-line);
          border-radius:999px;padding:5px 12px;}
        .vigencia .pulse{width:7px;height:7px;border-radius:50%;background:var(--gold);
          box-shadow:0 0 0 0 rgba(182,122,34,.5);animation:pulse 2.4s infinite;}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(182,122,34,.5);}
          70%{box-shadow:0 0 0 7px rgba(182,122,34,0);}100%{box-shadow:0 0 0 0 rgba(182,122,34,0);}}

        .share-btn{margin:22px auto 0;display:flex;align-items:center;justify-content:center;gap:8px;
          font-family:'Inter',sans-serif;font-size:14px;font-weight:600;color:var(--ink);
          background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:10px 20px;
          cursor:pointer;transition:border-color .15s,transform .05s;}
        .share-btn:hover{border-color:var(--ink-soft);}
        .share-btn:active{transform:scale(.98);}
        .share-btn.ok{color:var(--buy);border-color:var(--buy);background:var(--buy-bg);}
        .share-btn svg{width:15px;height:15px;}

        .fuente{margin:16px 0 0;text-align:center;font-size:12px;line-height:1.5;color:var(--ink-soft);}
        .fuente a{color:var(--gold);font-weight:600;text-decoration:none;border-bottom:1px solid var(--gold-line);}
        .fuente a:hover{border-bottom-color:var(--gold);}

        .footer{margin-top:14px;text-align:center;font-size:13px;color:var(--ink-soft);
          letter-spacing:.01em;}
        .footer .heart{color:var(--wait);}
      `}</style>

      <div className="inner">
        <div className="eyebrow"><span className="dot" /> CMR Falabella</div>
        <div className="vigencia">
          <span className="pulse" /> El cambio entra en vigencia en septiembre 2026
        </div>
        <h1>
          ¿Comprar gift card hoy o esperar el cambio?{" "}
          <HelpTip text="Tras el cambio, cada punto valdrá $1 multiplicado por tu ponderador personalizado. Esto compara ese valor con canjear una gift card hoy, donde las tarjetas grandes rinden hasta $5 por punto." />
        </h1>

        <div className="card">
          <div className="field">
            <span className="field-label">
              Saldo de puntos CMR
              <HelpTip text="Los puntos CMR que tienes disponibles hoy para canjear." />
            </span>
            <input
              type="number"
              min={0}
              step={1000}
              value={balance}
              onChange={(e) => {
                setBalance(Math.max(0, Number(e.target.value) || 0));
                marcarInteraccion();
              }}
            />
          </div>

          <div className="field">
            <span className="field-label">
              Ponderador
              <HelpTip text="El multiplicador que el banco aplicará a tus puntos acumulados el día del cambio (ej.: ×4,25). Aparece en tu correo «Novedades en tus CMR Puntos». Si aún no lo conoces, prueba distintos valores." />
            </span>
            <div className="slider-row">
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.25}
                value={pond}
                onChange={(e) => {
                  setPond(Number(e.target.value));
                  marcarInteraccion();
                }}
              />
              <div className="pond-input">
                <span className="pond-x">×</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.25}
                  value={pond}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(5, Number(e.target.value) || 0));
                    setPond(Math.round(v * 100) / 100);
                    marcarInteraccion();
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={`reco ${actuar ? "buy" : "wait"}`}>
          <span className="reco-eyebrow">Tu recomendación</span>
          {actuar ? (
            <>
              <span className="reco-head">Compra ahora</span>
              <span className="reco-action">
                Canjea <b>{comboPhrase(best.combo)}</b>
                {best.leftoverPts > 0 ? (
                  <> y guarda <b>{numFmt.format(best.leftoverPts)} puntos</b> para el cambio.</>
                ) : (
                  <> con todos tus puntos.</>
                )}
              </span>
              <span className="reco-metric">{signed(gain)} vs. esperar</span>
            </>
          ) : (
            <>
              <span className="reco-head">Espera el cambio</span>
              <span className="reco-action">
                No canjees ninguna gift card: ningún canje de hoy supera tu ponderador de{" "}
                <b>×{pond.toFixed(2)}</b>.
              </span>
              <span className="reco-metric">
                {numFmt.format(balance)} pts → {clpFmt.format(Math.round(esperar))}
              </span>
            </>
          )}
        </div>

        <div className="desglose">
          <span className="desglose-head">El desglose · valor total de tus puntos</span>
          <div className="opts">
            <div className={`opt buy ${winner === "buy" ? "win" : ""}`}>
              <span className="opt-label">Canjear hoy</span>
              <span className="opt-val">{clpFmt.format(Math.round(buyTotal))}</span>
              <span className="opt-sub">
                {best.clp > 0 ? (
                  <>{clpFmt.format(best.clp)} en gift cards</>
                ) : (
                  <>Sin canjes convenientes</>
                )}
                {best.leftoverPts > 0 && (
                  <> + {numFmt.format(best.leftoverPts)} pts guardados</>
                )}
              </span>
              {winner === "buy" && <span className="opt-tag">Conviene</span>}
            </div>
            <div className={`opt wait ${winner === "wait" ? "win" : ""}`}>
              <span className="opt-label">Esperar el cambio</span>
              <span className="opt-val">{clpFmt.format(Math.round(esperar))}</span>
              <span className="opt-sub">
                {numFmt.format(balance)} pts × ×{pond.toFixed(2)}
              </span>
              {winner === "wait" && <span className="opt-tag">Conviene</span>}
            </div>
          </div>
        </div>

        <div className="consejo">
          <span className="ico">✦</span>
          {breakeven ? (
            <p>
              Tu punto de equilibrio es <span className="be">×{breakeven.toFixed(2)}</span>. Con un
              ponderador menor conviene comprar; con uno mayor, esperar.{" "}
              <HelpTip text="Es el mejor rendimiento ($/punto) entre las gift cards que alcanzas a pagar. Las grandes ($450.000 o más) rinden $5 por punto; las chicas, tan poco como $1,67. Un canje solo suma si supera tu ponderador." />
            </p>
          ) : (
            <p>
              Con este saldo no alcanzas ninguna gift card, así que <b>esperar el cambio</b> es la
              única opción. La más barata cuesta 12.000 puntos.
            </p>
          )}
        </div>

        <button
          type="button"
          className={`share-btn ${copiado ? "ok" : ""}`}
          onClick={compartir}
        >
          {copiado ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              ¡Link copiado!
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
                <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
              </svg>
              Compartir calculadora
            </>
          )}
        </button>

        <p className="fuente">
          Datos de gift cards y ponderador supuestos según lo publicado por el banco.{" "}
          <a
            href="https://www.bancofalabella.cl/cmrpuntos"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("fuente_oficial")}
          >
            Ver fuente oficial ↗
          </a>
        </p>

        <footer className="footer">
          Done with <span className="heart">❤</span> by Álvaro Cabreira
        </footer>
      </div>
    </div>
  );
}
