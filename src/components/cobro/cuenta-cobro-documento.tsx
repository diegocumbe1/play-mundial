import { MARCA, MARCA_SIMBOLO_PATH } from "@/lib/marca";
import {
  ETIQUETA_ESTADO,
  fechaHoraLarga,
  fechaLarga,
  lineasDe,
  numeroCuenta,
  totalLinea,
  totalLineas,
  valorEnLetras,
} from "@/lib/cuenta-cobro";
import { formatCOP } from "@/lib/torneos";
import type { CuentaCobro } from "@/types";

/**
 * La cuenta de cobro como documento (A4): la ve el cliente en `/cobro/<clave>` y
 * el superadmin en su vista previa. Es la plantilla de Lynko · Play Mundial; lo
 * que cambia de una cuenta a otra viene de los datos. Pensada para imprimir o
 * guardar como PDF desde el navegador.
 */
export function CuentaCobroDocumento({ cuenta: c }: { cuenta: CuentaCobro }) {
  const lineas = lineasDe(c);
  const total = totalLineas(lineas);
  const varias = lineas.length > 1;
  const puntos = c.items.length > 0 && (
    <ul>
      {c.items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
  const pendiente = (v: string | null) =>
    v ? <span>{v}</span> : <span className="cc-pend">pendiente</span>;

  return (
    <div className="cc-wrap">
      <style>{CSS}</style>
      <article className="cc-hoja">
        {c.estado === "anulada" && <div className="cc-sello cc-anulada">ANULADA</div>}
        {c.estado === "pagada" && <div className="cc-sello cc-pagada">PAGADA</div>}

        <header className="cc-head">
          <div className="cc-marca">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lynko-lince.png" alt="Lynko" width={54} height={54} />
            <div>
              <div className="cc-n1">LYNKO</div>
              <div className="cc-n2">Software para negocios y eventos</div>
            </div>
          </div>
          <div className="cc-via">
            <div>
              <div className="cc-t">Servicio prestado con</div>
              <div className="cc-pm">{MARCA.nombre}</div>
            </div>
            <svg viewBox="0 0 64 64" aria-label={MARCA.nombre}>
              <path fill="#f5c518" fillRule="evenodd" d={MARCA_SIMBOLO_PATH} />
            </svg>
          </div>
        </header>

        <main className="cc-cuerpo">
          <div className="cc-titulo">
            <h1>
              Cuenta de <span>cobro</span>
            </h1>
            <div className="cc-meta">
              <div>
                N.º <b>{numeroCuenta(c.numero)}</b>
              </div>
              <div>
                Fecha: <b>{fechaLarga(c.fecha)}</b>
              </div>
            </div>
          </div>

          <section className="cc-partes">
            <div className="cc-caja">
              <h2>Cliente (debe a)</h2>
              <p className="cc-nom">{c.cliente_nombre}</p>
              {c.cliente_ciudad && <p className="cc-sub">{c.cliente_ciudad}</p>}
              <p className="cc-sub">
                NIT / C.C.: {pendiente(c.cliente_documento)}
              </p>
              <p className="cc-sub">
                Contacto: {pendiente(c.contacto_nombre)}
                {c.contacto_whatsapp ? ` · ${c.contacto_whatsapp}` : ""}
              </p>
            </div>
            <div className="cc-caja">
              <h2>Prestador del servicio</h2>
              <p className="cc-nom">{c.emisor_nombre}</p>
              <p className="cc-sub">{c.emisor_marca}</p>
              {c.emisor_documento && <p className="cc-sub">C.C. {c.emisor_documento}</p>}
              {c.emisor_whatsapp && <p className="cc-sub">WhatsApp: {c.emisor_whatsapp}</p>}
            </div>
          </section>

          <table className="cc-tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i}>
                  <td>
                    <div className="cc-c1">{l.descripcion}</div>
                    {l.detalle && <div className="cc-det">{l.detalle}</div>}
                    {l.cantidad > 1 && (
                      <div className="cc-det">
                        {l.cantidad} × {formatCOP(l.valor_unitario)}
                      </div>
                    )}
                    {/* Con un solo concepto, lo que incluye va dentro; con varios, aparte. */}
                    {!varias && puntos}
                  </td>
                  <td>{formatCOP(totalLinea(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {varias && c.items.length > 0 && (
            <div className="cc-incluye">
              <b>Incluye</b>
              {puntos}
            </div>
          )}

          <div className="cc-total">
            <div className="cc-monto">
              <small>Total a pagar (COP)</small>
              <strong>{formatCOP(total)}</strong>
            </div>
          </div>
          <div className="cc-letras">{valorEnLetras(total)}</div>

          {(c.pago_llave || c.pago_banco) && (
            <section className="cc-pago">
              <div className="cc-ico">Bre-B</div>
              <div>
                <h2>Forma de pago · Transferencia con llave Bre-B</h2>
                {c.pago_llave && <div className="cc-llave">{c.pago_llave}</div>}
                <div className="cc-pdet">
                  {c.pago_banco && (
                    <>
                      Banco: <b>{c.pago_banco}</b>
                    </>
                  )}
                  {c.pago_banco && c.pago_titular ? " · " : ""}
                  {c.pago_titular && (
                    <>
                      Titular: <b>{c.pago_titular}</b>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          <div className="cc-notas">
            {c.fecha_limite && (
              <p>
                <b>Fecha límite de pago:</b> {fechaLarga(c.fecha_limite)}
              </p>
            )}
            {c.emisor_whatsapp && (
              <p>
                Al pagar, envía el comprobante por WhatsApp al {c.emisor_whatsapp} indicando «Cuenta de cobro N.º{" "}
                {numeroCuenta(c.numero)}».
              </p>
            )}
            {c.nota && <p>{c.nota}</p>}
          </div>

          <div className="cc-firma">
            <div className="cc-lin">
              <b>{c.emisor_nombre}</b>
              {c.emisor_marca}
            </div>
            <div className="cc-lin">
              <b>{c.recibe_nombre ?? "—"}</b>
              {c.cliente_nombre}
              {c.aceptada_at && (
                <span className="cc-acepta">
                  Aceptada el {fechaHoraLarga(c.aceptada_at)}
                </span>
              )}
            </div>
          </div>
        </main>

        <footer className="cc-pie">
          <span>
            <b>Lynko</b> · {MARCA.nombre} — {MARCA.tagline}
          </span>
          <span className="cc-estado">{ETIQUETA_ESTADO[c.estado]}</span>
        </footer>
      </article>
    </div>
  );
}

const CSS = `
.cc-wrap{--ink-950:#04060c;--ink-900:#070a14;--signal-400:#3dd9ec;--signal-deep:#0e7c8c;--gold:#f5c518;--text:#0f1524;--muted:#5a6578;--line:#dfe5ee;--soft:#f4f7fb;
  font-family:var(--font-inter),system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--text);font-size:13px;line-height:1.5;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;padding:16px 8px}
.cc-wrap *{box-sizing:border-box}
.cc-hoja{position:relative;width:100%;max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;box-shadow:0 10px 40px rgba(4,6,12,.25);display:flex;flex-direction:column;overflow:hidden}
.cc-head{background:var(--ink-950);color:#f5f8ff;padding:22px 30px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;border-bottom:3px solid var(--signal-400);
  background-image:radial-gradient(40% 120% at 12% 0%,rgba(61,217,236,.16),transparent 60%),radial-gradient(40% 120% at 100% 100%,rgba(245,197,24,.10),transparent 60%)}
.cc-marca{display:flex;align-items:center;gap:12px}
.cc-marca img{width:54px;height:54px;border-radius:12px;display:block}
.cc-n1{font-family:var(--font-bebas),Impact,sans-serif;font-size:30px;letter-spacing:.22em;line-height:1;color:var(--signal-400)}
.cc-n2{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,248,255,.55);margin-top:3px}
.cc-via{display:flex;align-items:center;gap:10px;text-align:right}
.cc-t{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,248,255,.55)}
.cc-pm{font-family:var(--font-bebas),Impact,sans-serif;font-size:24px;letter-spacing:.08em;color:#fff;line-height:1}
.cc-via svg{width:38px;height:38px;border-radius:9px;background:#0a0a0f;padding:4px;flex:none}
.cc-cuerpo{padding:26px 30px 10px;flex:1}
.cc-titulo{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:18px;flex-wrap:wrap}
.cc-titulo h1{font-family:var(--font-bebas),Impact,sans-serif;font-weight:400;font-size:40px;letter-spacing:.06em;line-height:1;margin:0;color:var(--ink-900)}
.cc-titulo h1 span{color:var(--signal-deep)}
.cc-meta{text-align:right;font-size:12px;color:var(--muted)}
.cc-meta b{color:var(--text)}
.cc-partes{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
@media (max-width:560px){.cc-partes{grid-template-columns:1fr}.cc-cuerpo{padding:20px 16px 10px}.cc-head{padding:18px 16px}}
.cc-caja{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--soft)}
.cc-caja h2{margin:0 0 6px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--signal-deep);font-weight:700}
.cc-caja p{margin:0}
.cc-nom{font-weight:700;font-size:15px}
.cc-sub{color:var(--muted);font-size:12px}
.cc-pend{color:#b45309;font-style:italic}
.cc-tabla{width:100%;border-collapse:collapse;margin-bottom:6px}
.cc-tabla th{text-align:left;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:var(--ink-900);padding:9px 12px}
.cc-tabla th:last-child,.cc-tabla td:last-child{text-align:right;white-space:nowrap}
.cc-tabla td{padding:12px;border-bottom:1px solid var(--line);vertical-align:top}
.cc-c1{font-weight:700;font-size:14px}
.cc-det{color:var(--muted);font-size:12px}
.cc-tabla ul{margin:6px 0 0;padding-left:16px;color:var(--muted);font-size:12px;text-align:left}
.cc-incluye{font-size:12px;color:var(--muted);margin:8px 0 4px}.cc-incluye ul{margin:4px 0 0;padding-left:16px}
.cc-total{display:flex;justify-content:flex-end;margin:10px 0 4px}
.cc-monto{background:var(--ink-950);color:#fff;border-radius:12px;padding:12px 18px;min-width:260px;border-left:4px solid var(--gold)}
.cc-monto small{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(245,248,255,.6)}
.cc-monto strong{font-family:var(--font-bebas),Impact,sans-serif;font-weight:400;font-size:34px;letter-spacing:.04em;color:var(--gold);line-height:1.1}
.cc-letras{text-align:right;font-size:11px;color:var(--muted);margin-bottom:18px;text-transform:uppercase;letter-spacing:.04em}
.cc-pago{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;border:1.5px solid var(--signal-400);border-radius:14px;padding:14px 16px;margin-bottom:16px;background:linear-gradient(135deg,rgba(34,211,238,.08),rgba(34,211,238,0) 60%)}
.cc-ico{min-width:68px;height:46px;padding:0 12px;white-space:nowrap;border-radius:12px;background:var(--ink-950);color:var(--signal-400);display:grid;place-items:center;font-family:var(--font-bebas),Impact,sans-serif;font-size:22px;letter-spacing:.04em}
.cc-pago h2{margin:0 0 4px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--signal-deep);font-weight:700}
.cc-llave{font-size:22px;font-weight:700;word-break:break-all}
.cc-pdet{color:var(--muted);font-size:12px}
.cc-notas{font-size:11.5px;color:var(--muted);margin:0 0 18px}
.cc-notas p{margin:2px 0}
.cc-firma{display:flex;justify-content:space-between;align-items:flex-end;gap:30px;margin-top:26px}
.cc-lin{flex:1;border-top:1px solid var(--text);padding-top:6px;font-size:12px}
.cc-lin b{display:block;font-size:13px}
.cc-pie{margin-top:auto;padding:12px 30px;font-size:10.5px;color:rgba(245,248,255,.6);background:var(--ink-950);display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;border-top:3px solid var(--gold)}
.cc-pie b{color:var(--signal-400);font-weight:600}
.cc-sello{position:absolute;top:44%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);font-family:var(--font-bebas),Impact,sans-serif;font-size:96px;letter-spacing:.12em;border:6px solid;border-radius:16px;padding:0 22px;opacity:.18;pointer-events:none;z-index:2}
.cc-acepta{display:block;margin-top:2px;font-size:11px;color:#059669}
.cc-pagada{color:#059669}.cc-anulada{color:#dc2626}
@page{size:A4;margin:0}
@media print{
  html,body{background:#fff!important;padding:0!important}
  .cc-wrap{padding:0}
  .cc-hoja{max-width:none;box-shadow:none;min-height:297mm;height:297mm}
  .cc-noprint,[data-sonner-toaster]{display:none!important}
  .cc-estado{display:none}
  .cc-pend{color:inherit;font-style:normal}
  .cc-partes{grid-template-columns:1fr 1fr!important}
}
`;
