// ── Praxis-Konfiguration für Rechnungsdruck & QR-Rechnung ──
// Bitte diese Werte an die tatsächlichen Praxisdaten anpassen.

export const ORG = {
  name:         'Physio Allmend',
  addressLine1: 'Allmendstrasse 10',     // Strasse + Hausnummer
  addressLine2: '5400 Baden',           // PLZ + Ort
  country:      'CH',
  phone:        '',
  email:        '',
  website:      '',
  // CH-IBAN für QR-Einzahlungsschein (wird auf jeder Rechnung verwendet)
  iban:         'CH14 0840 1016 1326 9940 1',
} as const
