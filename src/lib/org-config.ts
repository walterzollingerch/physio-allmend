// ── Praxis-Konfiguration für Rechnungsdruck & QR-Rechnung ──
// Bitte diese Werte an die tatsächlichen Praxisdaten anpassen.

export const ORG = {
  name:         'Physio Allmend',
  addressLine1: 'Cordulaplatz 1',       // Strasse + Hausnummer
  addressLine2: '5400 Baden',           // PLZ + Ort
  country:      'CH',
  phone:        '',
  email:        '',
  website:      '',
  // CH-IBAN für QR-Einzahlungsschein (wird auf jeder Rechnung verwendet)
  iban:         'CH56 0840 1016 0519 5200 5',  // ← hier eure IBAN eintragen
} as const
