/**
 * Swiss QR-Rechnung (QR-Bill) — Swiss Payment Standards 2022
 * QR-Code Datenformat und Hilfsfunktionen
 */
import QRCode from 'qrcode'

export interface SwissQrData {
  iban: string
  creditorName: string
  creditorAddress1: string  // Strasse + Hausnummer (K-Typ: kombiniert)
  creditorAddress2: string  // PLZ + Ort (K-Typ: kombiniert)
  creditorCountry?: string
  debtorName?: string
  debtorAddress1?: string   // Strasse + Hausnummer
  debtorAddress2?: string   // PLZ + Ort
  debtorCountry?: string
  amount?: number
  currency?: 'CHF' | 'EUR'
  referenceType?: 'NON' | 'SCOR' | 'QRR'
  reference?: string
  message?: string
}

/** Baut den exakten QR-Code-Inhalt gemäss SPS 2022 (32 Zeilen) */
export function buildSwissQrString(d: SwissQrData): string {
  const hasDebtor = !!(d.debtorName?.trim())
  const lines = [
    'SPC',                                      // 1  Header
    '0200',                                     // 2  Version
    '1',                                        // 3  Kodierung (UTF-8)
    d.iban.replace(/\s/g, '').toUpperCase(),    // 4  IBAN
    'K',                                        // 5  Gläubiger-Adresstyp (K=kombiniert)
    d.creditorName,                             // 6  Name Gläubiger
    d.creditorAddress1,                         // 7  Adresszeile 1
    d.creditorAddress2,                         // 8  Adresszeile 2
    '',                                         // 9  PLZ (leer bei K)
    '',                                         // 10 Ort (leer bei K)
    d.creditorCountry ?? 'CH',                  // 11 Land
    // Endgültiger Gläubiger (gesperrt, immer leer) – 7 Felder: 12–18
    '', '', '', '', '', '', '',                 // 12 Adresstyp, 13 Name, 14 Adr1, 15 Adr2, 16 PLZ, 17 Ort, 18 Land
    // Betrag
    d.amount != null ? d.amount.toFixed(2) : '', // 19 Betrag
    d.currency ?? 'CHF',                        // 20 Währung
    // Zahlungspflichtiger
    hasDebtor ? 'K' : '',                       // 21 Adresstyp
    d.debtorName ?? '',                         // 22 Name
    d.debtorAddress1 ?? '',                     // 23 Adresszeile 1
    d.debtorAddress2 ?? '',                     // 24 Adresszeile 2
    '',                                         // 25 PLZ (leer bei K)
    '',                                         // 26 Ort (leer bei K)
    hasDebtor ? (d.debtorCountry ?? 'CH') : '', // 27 Land
    // Zahlungsreferenz
    d.referenceType ?? 'NON',                   // 28 Referenztyp
    d.reference ?? '',                          // 29 Referenz
    d.message ?? '',                            // 30 Unstrukturierte Mitteilung
    'EPD',                                      // 31 Ende Zahlungsdaten
    '',                                         // 32 Rechnungsinformation (leer)
  ]
  return lines.join('\n')
}

/** Erzeugt einen Base64-PNG-DataURL für den QR-Code (hohe Auflösung für Druck) */
export async function generateQrDataUrl(qrString: string): Promise<string> {
  return QRCode.toDataURL(qrString, {
    errorCorrectionLevel: 'M',
    width: 512,
    margin: 0,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

/** Extrahiert eine CH-IBAN aus einem Freitext (z.B. Bankinformation) */
export function extractIban(text: string): string | null {
  const m = text.match(/CH\d{2}[\s\d]{15,26}/i)
  if (!m) return null
  const raw = m[0].replace(/\s/g, '').toUpperCase()
  return raw.length === 21 ? raw : null
}

/** Formatiert eine IBAN mit Leerzeichen (CH56 0483 5012 3456 7800 9) */
export function formatIban(iban: string): string {
  const clean = iban.replace(/\s/g, '')
  return clean.match(/.{1,4}/g)?.join(' ') ?? iban
}
