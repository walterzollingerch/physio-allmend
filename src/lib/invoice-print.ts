/**
 * Erzeugt vollständiges Print-HTML für eine Rechnung inkl. Swiss QR-Rechnung
 */
import { ORG } from './org-config'
import { buildSwissQrString, extractIban, formatIban, generateQrDataUrl } from './swiss-qr'

interface InvoiceItem {
  id: string
  service_name: string
  description: string | null
  unit_price: number
  quantity: number
  unit: string
}

interface Invoice {
  id: string
  number: string
  customer_name: string
  customer_address: string
  invoice_date: string
  due_date: string | null
  delivery_date: string | null
  reference: string | null
  bank_info: string | null
  conditions: string | null
  notes: string | null
  footer: string | null
  discount_type: 'percent' | 'amount'
  discount_value: number
  status: string
  // Strukturierte Adressfelder (optional, bevorzugt gegenüber customer_address)
  debtor_street?: string | null
  debtor_street_number?: string | null
  debtor_postal_code?: string | null
  debtor_city?: string | null
  debtor_country?: string | null
}

function fmt(n: number) {
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(s: string) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${d}.${m}.${y}`
}

export async function openInvoicePrint(inv: Invoice, items: InvoiceItem[]) {
  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)
  const discountAmt = inv.discount_type === 'percent'
    ? subtotal * Number(inv.discount_value) / 100
    : Number(inv.discount_value)
  const total = subtotal - discountAmt

  // ── Strukturierte Adresse aufbauen ──────────────────────────
  const hasStructured = !!(inv.debtor_street || inv.debtor_postal_code || inv.debtor_city)
  const streetLine    = hasStructured
    ? [inv.debtor_street, inv.debtor_street_number].filter(Boolean).join(' ')
    : ((inv.customer_address ?? '').split('\n').map(l => l.trim()).filter(Boolean)[0] ?? '')
  const cityLine      = hasStructured
    ? [inv.debtor_postal_code, inv.debtor_city].filter(Boolean).join(' ')
    : ((inv.customer_address ?? '').split('\n').map(l => l.trim()).filter(Boolean)[1] ?? '')
  const countryLine   = hasStructured
    ? (inv.debtor_country && inv.debtor_country !== 'Schweiz' && inv.debtor_country !== 'CH' ? inv.debtor_country : null)
    : ((inv.customer_address ?? '').split('\n').map(l => l.trim()).filter(Boolean)[2] ?? null)
  const countryCode   = hasStructured
    ? (inv.debtor_country === 'Schweiz' || !inv.debtor_country ? 'CH' : inv.debtor_country)
    : 'CH'

  // ── QR-Rechnung ──────────────────────────────────────────────
  // IBAN: zuerst aus org-config, Fallback auf bank_info-Feld der Rechnung
  const iban = extractIban(ORG.iban) ?? extractIban(inv.bank_info ?? '')
  let qrDataUrl = ''
  if (iban) {
    const qrStr = buildSwissQrString({
      iban,
      creditorName:     ORG.name,
      creditorAddress1: ORG.addressLine1,
      creditorAddress2: ORG.addressLine2,
      creditorCountry:  ORG.country,
      debtorName:       inv.customer_name || undefined,
      debtorAddress1:   streetLine || undefined,
      debtorAddress2:   cityLine   || undefined,
      debtorCountry:    countryCode,
      amount:           total,
      currency:         'CHF',
      referenceType:    'NON',
      message:          inv.number,
    })
    qrDataUrl = await generateQrDataUrl(qrStr)
  }

  // ── Rechnungspositionen ──────────────────────────────────────
  const itemRows = items.map(item => {
    const amount = Number(item.unit_price) * Number(item.quantity)
    return `
      <tr>
        <td>${item.service_name}</td>
        <td class="desc">${item.description ?? ''}</td>
        <td class="num">${fmt(item.unit_price)}</td>
        <td class="num">${item.quantity} ${item.unit}</td>
        <td class="num right">${fmt(amount)}</td>
      </tr>`
  }).join('')

  // ── Debitor-Adressblock (Briefkopf der Rechnung) ─────────────
  const addrHtml = [streetLine, cityLine, countryLine]
    .filter(Boolean)
    .map(l => `<div>${l}</div>`).join('')

  // ── QR-Rechnung HTML ─────────────────────────────────────────
  const ibanFmt = iban ? formatIban(iban) : ''

  // Debtor-Block für QR-Schein: Name + Adresszeilen
  const debHtml = [inv.customer_name, streetLine, cityLine, countryLine]
    .filter(Boolean).map(l => `<div>${l}</div>`).join('')
  const credHtml = `<div>${ORG.name}</div><div>${ORG.addressLine1}</div><div>${ORG.addressLine2}</div>`

  const qrBillHtml = iban ? `
    <div class="qr-bill">
      <div class="scissors">
        <div class="scissors-line"></div>
        <span class="scissors-icon">✂</span>
      </div>
      <div class="qr-bill-body">

        <!-- Empfangsschein -->
        <div class="receipt">
          <div class="receipt-title">Empfangsschein</div>

          <div class="qr-field">
            <div class="qr-label">Konto / Zahlbar an</div>
            <div>${ibanFmt}</div>
            ${credHtml}
          </div>

          ${inv.reference ? `
          <div class="qr-field">
            <div class="qr-label">Referenz</div>
            <div>${inv.reference}</div>
          </div>` : ''}

          <div class="qr-field">
            <div class="qr-label">Zahlbar durch</div>
            ${inv.customer_name ? debHtml : '<div class="blank-box" style="width:52mm;height:20mm;border:0.75pt solid #000;"></div>'}
          </div>

          <div class="receipt-footer">
            <div>
              <div class="qr-label">Währung</div>
              <div class="currency">CHF</div>
            </div>
            <div>
              <div class="qr-label">Betrag</div>
              <div class="amount-sm">${fmt(total)}</div>
            </div>
            <div class="annahmestelle">Annahmestelle</div>
          </div>
        </div>

        <!-- Zahlteil -->
        <div class="payment">
          <div class="payment-title">Zahlteil</div>

          <div class="payment-inner">
            <!-- Links: QR + Betrag -->
            <div class="payment-left">
              <div class="qr-wrap">
                <img src="${qrDataUrl}" class="qr-img" alt="QR Code" />
                <div class="swiss-cross">
                  <div class="cross-h"></div>
                  <div class="cross-v"></div>
                </div>
              </div>
              <div class="payment-amount">
                <div>
                  <div class="qr-label">Währung</div>
                  <div class="currency">CHF</div>
                </div>
                <div>
                  <div class="qr-label">Betrag</div>
                  <div class="amount-lg">${fmt(total)}</div>
                </div>
              </div>
            </div>

            <!-- Rechts: Konto, Referenz, Zahlbar durch -->
            <div class="payment-right">
              <div class="qr-field">
                <div class="qr-label">Konto / Zahlbar an</div>
                <div>${ibanFmt}</div>
                ${credHtml}
              </div>

              ${inv.reference ? `
              <div class="qr-field">
                <div class="qr-label">Referenz</div>
                <div>${inv.reference}</div>
              </div>` : ''}

              ${inv.number ? `
              <div class="qr-field">
                <div class="qr-label">Zusätzliche Informationen</div>
                <div>${inv.number}</div>
              </div>` : ''}

              <div class="qr-field">
                <div class="qr-label">Zahlbar durch</div>
                ${inv.customer_name ? debHtml : '<div class="blank-box" style="width:65mm;height:25mm;border:0.75pt solid #000;"></div>'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>` : ''

  // ── Komplettes HTML ──────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Rechnung ${inv.number} – ${inv.customer_name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 9pt;
    color: #1a1a1a;
    background: white;
  }

  /* ── Seite ── */
  @page {
    size: A4 portrait;
    margin: 0;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 20mm 8mm 20mm;
    position: relative;
  }

  /* ── Kopfzeile ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10mm;
    padding-bottom: 4mm;
    border-bottom: 0.5pt solid #ccc;
  }
  .org-name {
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: #1a1a1a;
  }
  .org-sub {
    font-size: 8pt;
    color: #666;
    margin-top: 1mm;
  }
  .org-address {
    text-align: right;
    font-size: 8pt;
    color: #444;
    line-height: 1.5;
  }

  /* ── Adresse + Rechnungsinfo ── */
  .meta-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8mm;
  }
  .customer-address {
    font-size: 9pt;
    line-height: 1.7;
  }
  .customer-address .addr-label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #999;
    margin-bottom: 1.5mm;
  }
  .customer-address .name { font-weight: 600; }
  .inv-meta {
    text-align: right;
    font-size: 8.5pt;
  }
  .inv-number {
    font-size: 14pt;
    font-weight: 700;
    margin-bottom: 2mm;
  }
  .inv-meta table {
    margin-left: auto;
    border-collapse: collapse;
  }
  .inv-meta td { padding: 0.5mm 0 0.5mm 3mm; }
  .inv-meta td:first-child { color: #666; }

  /* ── Titel ── */
  .invoice-title {
    font-size: 12pt;
    font-weight: 700;
    margin-bottom: 5mm;
    letter-spacing: -0.3px;
  }

  /* ── Positionen ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-bottom: 4mm;
  }
  .items-table thead tr {
    border-bottom: 0.5pt solid #aaa;
    background: #f5f5f5;
  }
  .items-table th {
    padding: 2mm 2mm;
    font-weight: 600;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #555;
    text-align: left;
  }
  .items-table th.num { text-align: right; }
  .items-table tbody tr {
    border-bottom: 0.25pt solid #e8e8e8;
  }
  .items-table td {
    padding: 2mm 2mm;
    vertical-align: top;
  }
  .items-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .items-table td.desc { color: #666; font-size: 8pt; }
  .items-table td.right { font-weight: 600; }

  /* ── Totals ── */
  .totals {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 6mm;
  }
  .totals-table {
    border-collapse: collapse;
    font-size: 8.5pt;
    min-width: 60mm;
  }
  .totals-table td {
    padding: 1mm 2mm;
  }
  .totals-table td:first-child { color: #555; }
  .totals-table td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .total-row td {
    border-top: 0.5pt solid #aaa;
    padding-top: 2mm;
    font-weight: 700;
    font-size: 10pt;
  }

  /* ── Notizen / Bedingungen ── */
  .notes-row {
    display: flex;
    gap: 6mm;
    margin-bottom: 5mm;
  }
  .note-block {
    flex: 1;
    font-size: 8pt;
    color: #444;
    line-height: 1.55;
  }
  .note-label {
    font-weight: 600;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #888;
    margin-bottom: 1mm;
  }

  /* ── QR-Rechnung ── */
  .qr-bill {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 210mm;
    background: white;
  }
  @media print {
    .qr-bill {
      position: fixed;
      bottom: 0;
      left: 0;
    }
  }

  .scissors {
    display: flex;
    align-items: center;
    width: 100%;
    margin-bottom: 0;
  }
  .scissors-line {
    flex: 1;
    border-top: 0.5pt dashed #888;
  }
  .scissors-icon {
    padding: 0 2mm;
    color: #888;
    font-size: 10pt;
    user-select: none;
  }

  .qr-bill-body {
    display: flex;
    width: 210mm;
    height: 105mm;
    border-top: 0.5pt solid #000;
  }

  /* Empfangsschein: 62mm */
  .receipt {
    width: 62mm;
    padding: 5mm 5mm 5mm 5mm;
    border-right: 0.5pt solid #000;
    display: flex;
    flex-direction: column;
    font-size: 6pt;
    overflow: hidden;
  }
  .receipt-title {
    font-size: 11pt;
    font-weight: 700;
    margin-bottom: 3mm;
  }
  .receipt .qr-field { margin-bottom: 2mm; }
  .receipt-footer {
    margin-top: auto;
    display: flex;
    align-items: flex-end;
    gap: 2mm;
  }
  .annahmestelle {
    margin-left: auto;
    font-size: 6pt;
    color: #555;
    writing-mode: horizontal-tb;
    text-align: right;
  }
  .currency { font-size: 8pt; font-weight: 600; }
  .amount-sm { font-size: 10pt; font-weight: 700; }

  /* Zahlteil: 148mm */
  .payment {
    width: 148mm;
    padding: 5mm 5mm 5mm 5mm;
    display: flex;
    flex-direction: column;
    font-size: 7pt;
  }
  .payment-title {
    font-size: 11pt;
    font-weight: 700;
    margin-bottom: 3mm;
  }
  .payment-inner {
    display: flex;
    gap: 5mm;
    flex: 1;
  }
  .payment-left {
    width: 51mm;
    display: flex;
    flex-direction: column;
    gap: 3mm;
    flex-shrink: 0;
  }
  .payment-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2.5mm;
    font-size: 8pt;
  }

  /* QR Code + Schweizer Kreuz */
  .qr-wrap {
    position: relative;
    width: 46mm;
    height: 46mm;
    flex-shrink: 0;
  }
  .qr-img {
    width: 46mm;
    height: 46mm;
    display: block;
  }
  .swiss-cross {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 7mm;
    height: 7mm;
    background: #fff;
    border: 0.7mm solid #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cross-h {
    position: absolute;
    width: 5.4mm;
    height: 1.6mm;
    background: #000;
  }
  .cross-v {
    position: absolute;
    width: 1.6mm;
    height: 5.4mm;
    background: #000;
  }

  .payment-amount {
    display: flex;
    gap: 4mm;
  }
  .amount-lg { font-size: 11pt; font-weight: 700; }

  /* Gemeinsame QR-Felder */
  .qr-field { margin-bottom: 2mm; }
  .qr-label {
    font-size: 6pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 0.5mm;
    color: #000;
  }
  .receipt .qr-label { font-size: 5.5pt; }

  /* Blank box für unbekannte Zahlungspflichtige */
  .blank-box { display: block; }

  /* Screen preview */
  @media screen {
    body { background: #eee; }
    .page { margin: 10mm auto; box-shadow: 0 2px 16px rgba(0,0,0,0.15); }
    .qr-bill { position: static; margin-top: 0; }
  }
  @media print {
    .page { padding-bottom: 115mm; } /* Platz für QR-Rechnung */
  }
</style>
</head>
<body>
<div class="page">

  <!-- Kopfzeile -->
  <div class="header">
    <div>
      <div class="org-name">${ORG.name}</div>
      <div class="org-sub">Physiotherapie &amp; Pilates</div>
    </div>
    <div class="org-address">
      <div>${ORG.addressLine1}</div>
      <div>${ORG.addressLine2}</div>
      ${ORG.phone ? `<div>${ORG.phone}</div>` : ''}
      ${ORG.email ? `<div>${ORG.email}</div>` : ''}
    </div>
  </div>

  <!-- Adresse + Rechnungs-Meta -->
  <div class="meta-row">
    <div class="customer-address">
      <div class="addr-label">An</div>
      <div class="name">${inv.customer_name}</div>
      ${streetLine ? `<div>${streetLine}</div>` : ''}
      ${cityLine   ? `<div>${cityLine}</div>`   : ''}
      ${countryLine ? `<div>${countryLine}</div>` : ''}
    </div>
    <div class="inv-meta">
      <div class="inv-number">Rechnung ${inv.number}</div>
      <table>
        <tr><td>Datum</td><td>${fmtDate(inv.invoice_date)}</td></tr>
        ${inv.due_date ? `<tr><td>Fällig am</td><td>${fmtDate(inv.due_date)}</td></tr>` : ''}
        ${inv.delivery_date ? `<tr><td>Leistungsdatum</td><td>${fmtDate(inv.delivery_date)}</td></tr>` : ''}
        ${inv.reference ? `<tr><td>Referenz</td><td>${inv.reference}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <!-- Positionen -->
  <div class="invoice-title">Rechnung</div>
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:28%">Leistung</th>
        <th style="width:30%">Beschreibung</th>
        <th class="num" style="width:15%">Einzelpreis</th>
        <th class="num" style="width:12%">Menge</th>
        <th class="num right" style="width:15%">Betrag (CHF)</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <table class="totals-table">
      <tr>
        <td>Zwischensumme</td>
        <td>CHF ${fmt(subtotal)}</td>
      </tr>
      ${Number(inv.discount_value) > 0 ? `
      <tr>
        <td>Rabatt${inv.discount_type === 'percent' ? ` (${inv.discount_value}%)` : ''}</td>
        <td>– CHF ${fmt(discountAmt)}</td>
      </tr>` : ''}
      <tr class="total-row">
        <td>Total CHF</td>
        <td>${fmt(total)}</td>
      </tr>
    </table>
  </div>

  <!-- Notizen / Bedingungen -->
  ${inv.notes || inv.conditions || inv.footer ? `
  <div class="notes-row">
    ${inv.notes ? `
    <div class="note-block">
      <div class="note-label">Notizen</div>
      <div>${inv.notes.replace(/\n/g, '<br>')}</div>
    </div>` : ''}
    ${inv.conditions ? `
    <div class="note-block">
      <div class="note-label">Bedingungen</div>
      <div>${inv.conditions.replace(/\n/g, '<br>')}</div>
    </div>` : ''}
    ${inv.footer ? `
    <div class="note-block">
      <div class="note-label">Bankverbindung</div>
      <div>${inv.footer.replace(/\n/g, '<br>')}</div>
    </div>` : ''}
  </div>` : ''}

  ${inv.bank_info && !inv.footer ? `
  <div class="notes-row">
    <div class="note-block">
      <div class="note-label">Bankverbindung</div>
      <div>${inv.bank_info.replace(/\n/g, '<br>')}</div>
    </div>
  </div>` : ''}

</div><!-- /page -->

${qrBillHtml}

<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 400);
  };
</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=1200')
  if (!win) {
    alert('Bitte Pop-ups für diese Seite erlauben.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}
