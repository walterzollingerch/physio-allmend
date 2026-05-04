-- Kontenplan Import für Physio Allmend
-- Schritt 1: Schema erweitern
-- Schritt 2: Kontenplan importieren
-- Im Supabase SQL Editor ausführen

-- 1) account_groups um Hierarchie-Felder erweitern
ALTER TABLE public.account_groups
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS level text CHECK (level IN ('klasse', 'gruppe')) DEFAULT 'gruppe',
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.account_groups(id) ON DELETE SET NULL;

-- Unique index auf account_number für spätere Lookups
CREATE UNIQUE INDEX IF NOT EXISTS account_groups_number_idx ON public.account_groups(account_number);

-- 2) Klassen einfügen
INSERT INTO public.account_groups (account_number, name, type, level, sort_order) VALUES
  ('1', 'Aktiven',                                                                           'aktiv',   'klasse', 10),
  ('2', 'Passiven',                                                                          'passiv',  'klasse', 20),
  ('3', 'Betrieblicher Ertrag aus Lieferungen und Leistungen',                               'ertrag',  'klasse', 30),
  ('4', 'Aufwand für Material, Handelswaren, Dienstleistungen und Energie',                  'aufwand', 'klasse', 40),
  ('5', 'Personalaufwand',                                                                   'aufwand', 'klasse', 50),
  ('6', 'Übriger betrieblicher Aufwand, Abschreibungen und Finanzergebnis',                  'aufwand', 'klasse', 60),
  ('7', 'Betrieblicher Nebenerfolg',                                                         'ertrag',  'klasse', 70),
  ('8', 'Betriebsfremder, ausserordentlicher, einmaliger oder periodenfremder Aufwand/Ertrag','ertrag',  'klasse', 80),
  ('9', 'Abschluss',                                                                         'aufwand', 'klasse', 90)
ON CONFLICT (account_number) DO NOTHING;

-- 3) 2-stellige Gruppen (direkt unter Klasse)
INSERT INTO public.account_groups (account_number, name, type, level, parent_id, sort_order) VALUES
  -- Klasse 1
  ('10',  'Umlaufvermögen',                   'aktiv',   'gruppe', (SELECT id FROM public.account_groups WHERE account_number='1'), 100),
  ('14',  'Anlagevermögen',                   'aktiv',   'gruppe', (SELECT id FROM public.account_groups WHERE account_number='1'), 140),
  -- Klasse 2
  ('20',  'Kurzfristiges Fremdkapital',        'passiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='2'), 200),
  ('24',  'Langfristiges Fremdkapital',        'passiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='2'), 240),
  ('28',  'Eigenkapital (Einzelunternehmen)',  'passiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='2'), 280),
  -- Klasse 3
  ('30',  'Produktionserlöse',                'ertrag',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='3'), 300),
  ('32',  'Handelserlöse',                    'ertrag',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='3'), 320),
  ('34',  'Dienstleistungserlöse',            'ertrag',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='3'), 340),
  ('36',  'Übrige Erlöse aus L+L',            'ertrag',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='3'), 360),
  ('38',  'Erlösminderungen',                 'ertrag',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='3'), 380),
  -- Klasse 4
  ('40',  'Materialaufwand',                  'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='4'), 400),
  ('42',  'Handelswarenaufwand',              'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='4'), 420),
  ('44',  'Aufwand für bezogene Dienstleistungen','aufwand','gruppe',(SELECT id FROM public.account_groups WHERE account_number='4'), 440),
  ('46',  'Übriger Aufwand für Material/Waren','aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='4'), 460),
  ('47',  'Direkte Einkaufsspesen',           'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='4'), 470),
  ('48',  'Bestandesänderungen und Verluste', 'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='4'), 480),
  ('49',  'Einkaufspreisminderungen',         'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='4'), 490),
  -- Klasse 5
  ('50',  'Personalaufwand Produktion',       'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='5'), 500),
  ('52',  'Personalaufwand Handel',           'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='5'), 520),
  ('54',  'Personalaufwand Dienstleistungen', 'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='5'), 540),
  ('56',  'Personalaufwand Verwaltung',       'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='5'), 560),
  ('57',  'Sozialversicherungsaufwand',       'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='5'), 570),
  ('58',  'Übriger Personalaufwand',          'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='5'), 580),
  ('59',  'Leistungen Dritter',               'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='5'), 590),
  -- Klasse 6
  ('60',  'Raumaufwand',                      'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='6'), 600),
  ('61',  'Unterhalt, Reparaturen, Ersatz',   'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='6'), 610),
  ('62',  'Fahrzeug- und Transportaufwand',   'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='6'), 620),
  ('63',  'Sachversicherungen, Abgaben',      'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='6'), 630),
  ('64',  'Energie- und Entsorgungsaufwand',  'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='6'), 640),
  ('65',  'Verwaltungs- und Informatikaufwand','aufwand','gruppe', (SELECT id FROM public.account_groups WHERE account_number='6'), 650),
  ('66',  'Werbeaufwand',                     'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='6'), 660),
  ('67',  'Sonstiger betrieblicher Aufwand',  'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='6'), 670),
  ('68',  'Abschreibungen und Wertberichtigungen','aufwand','gruppe',(SELECT id FROM public.account_groups WHERE account_number='6'), 680),
  ('69',  'Finanzaufwand und Finanzertrag',   'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='6'), 690),
  -- Klasse 7
  ('750', 'Erfolg betriebliche Liegenschaft', 'ertrag',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='7'), 750),
  ('751', 'Aufwand betriebliche Liegenschaft','aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='7'), 751),
  -- Klasse 8
  ('800', 'Betriebsfremder Aufwand',          'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='8'), 800),
  ('810', 'Betriebsfremder Ertrag',           'ertrag',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='8'), 810),
  -- Klasse 9
  ('920', 'Hilfskonten Gewinnverwendung',     'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='9'), 920),
  ('990', 'Hilfskonten Debitoren',            'aufwand', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='9'), 990)
ON CONFLICT (account_number) DO NOTHING;

-- 4) 3-stellige Untergruppen
INSERT INTO public.account_groups (account_number, name, type, level, parent_id, sort_order) VALUES
  -- unter 10
  ('100', 'Flüssige Mittel',                                          'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1000),
  ('102', 'Bankguthaben',                                             'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1020),
  ('104', 'Checks, Besitzwechsel',                                    'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1040),
  ('109', 'Transferkonto',                                            'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1090),
  ('110', 'Forderungen aus Lieferungen und Leistungen',               'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1100),
  ('112', 'Forderungen gegenüber Beteiligten und Organen',            'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1120),
  ('114', 'Übrige kurzfristige Forderungen gegenüber Dritten',        'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1140),
  ('117', 'Kurzfristige Forderungen gegenüber staatlichen Stellen',   'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1170),
  ('119', 'Sonstige kurzfristige Forderungen',                        'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1190),
  ('120', 'Vorräte und nicht fakturierte Dienstleistungen',           'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1200),
  ('121', 'Rohstoffe',                                                'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1210),
  ('130', 'Aktive Rechnungsabgrenzungen',                             'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='10'), 1300),
  -- unter 14
  ('140', 'Finanzanlagen',                                            'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1400),
  ('144', 'Langfristige Forderungen gegenüber Dritten',               'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1440),
  ('150', 'Mobile Sachanlagen',                                       'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1500),
  ('151', 'Mobiliar und Einrichtungen',                               'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1510),
  ('152', 'Büromaschinen, Informatik und Kommunikationstechnologie',  'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1520),
  ('153', 'Fahrzeuge',                                                'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1530),
  ('154', 'Werkzeuge und Geräte',                                     'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1540),
  ('170', 'Immaterielle Werte',                                       'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1700),
  ('171', 'Marken, Muster, Modelle, Pläne',                           'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1710),
  ('172', 'Lizenzen, Konzessionen, Nutzungsrechte, Firmenrechte',     'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1720),
  ('174', 'Software',                                                 'aktiv',  'gruppe', (SELECT id FROM public.account_groups WHERE account_number='14'), 1740),
  -- unter 20
  ('200', 'Verbindlichkeiten aus Lieferungen und Leistungen',         'passiv', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='20'), 2000),
  ('203', 'Erhaltene Anzahlungen von Dritten',                        'passiv', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='20'), 2030),
  ('210', 'Bankverbindlichkeiten kurzfristig',                        'passiv', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='20'), 2100),
  ('220', 'Übrige kurzfristige Verbindlichkeiten',                    'passiv', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='20'), 2200),
  ('227', 'Verbindlichkeiten gegenüber Sozialversicherungen',         'passiv', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='20'), 2270),
  ('230', 'Passive Rechnungsabgrenzungen',                            'passiv', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='20'), 2300),
  -- unter 24
  ('240', 'Bankverbindlichkeiten langfristig',                        'passiv', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='24'), 2400),
  -- unter 28
  ('280', 'Grundkapital',                                             'passiv', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='28'), 2800),
  ('282', 'Kapitaleinlagen und Kapitalrückzüge',                      'passiv', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='28'), 2820),
  ('290', 'Reserven und Jahresgewinn oder Jahresverlust',             'passiv', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='28'), 2900),
  -- unter 30
  ('300', 'Produktionserlöse Bereich A',                              'ertrag', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='30'), 3000),
  -- unter 32
  ('320', 'Handelserlöse Bereich A',                                  'ertrag', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='32'), 3200),
  ('329', 'Handelserlösminderungen',                                  'ertrag', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='32'), 3290),
  -- unter 34
  ('340', 'Dienstleistungserlöse Bereich A',                          'ertrag', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='34'), 3400),
  -- unter 36
  ('360', 'Nebenerlöse aus Lieferungen und Leistungen',               'ertrag', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='36'), 3600),
  -- unter 69
  ('695', 'Finanzertrag',                                             'ertrag', 'gruppe', (SELECT id FROM public.account_groups WHERE account_number='69'), 6950)
ON CONFLICT (account_number) DO NOTHING;

-- 5) Konten importieren
INSERT INTO public.accounts (number, name, type, group_id, is_active) VALUES
  -- 100 Flüssige Mittel
  ('1000', 'Kasse A',                              'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='100'), true),
  -- 102 Bankguthaben
  ('1010', 'Postkonto',                            'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='102'), true),
  ('1020', 'Migrosbank',                           'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='102'), true),
  -- 104 Checks
  ('1040', 'Checks',                               'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='104'), true),
  -- 109 Transferkonto
  ('1090', 'Transferkonto',                        'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='109'), true),
  ('1099', 'Unklare Beträge',                      'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='109'), true),
  -- 110 Forderungen L+L
  ('1100', 'Forderungen Schweiz',                  'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='110'), true),
  ('1101', 'Forderungen Ausland',                  'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='110'), true),
  ('1108', 'Fremde Gutscheine',                    'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='110'), true),
  -- 112 Forderungen Beteiligte
  ('1130', 'Eingelöste Gutscheine',                'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='112'), true),
  ('1136', 'Forderungen aus Paypal',               'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='112'), true),
  -- 114 Übrige Forderungen
  ('1140', 'Darlehen',                             'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='114'), true),
  -- 117 Forderungen staatlich
  ('1175', 'Abrechnungskonto MWST',                'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='117'), true),
  -- 119 Sonstige Forderungen
  ('1191', 'Kautionen',                            'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='119'), true),
  ('1192', 'Geleistete Anzahlungen',               'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='119'), true),
  ('1193', 'Mietzinsdepot',                        'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='119'), true),
  -- 120 Vorräte
  ('1200', 'Handelsware A',                        'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='120'), true),
  -- 121 Rohstoffe
  ('1210', 'Rohstoff A',                           'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='121'), true),
  -- 130 Aktive Rechnungsabgrenzung
  ('1300', 'Bezahlter Aufwand des Folgejahrs',     'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='130'), true),
  -- 144 Langfristige Forderungen
  ('1440', 'Darlehen',                             'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='144'), true),
  -- 150 Mobile Sachanlagen
  ('1500', 'Maschinen und Apparate',               'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='150'), true),
  -- 151 Mobiliar
  ('1510', 'Mobiliar und Einrichtungen',           'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='151'), true),
  -- 152 Büromaschinen
  ('1520', 'Büromaschinen',                        'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='152'), true),
  -- 153 Fahrzeuge
  ('1530', 'Fahrzeug A',                           'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='153'), true),
  -- 154 Werkzeuge
  ('1540', 'Werkzeuge und Geräte',                 'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='154'), true),
  -- 170 Immaterielle Werte
  ('1700', 'Patente',                              'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='170'), true),
  -- 171 Marken
  ('1710', 'Marken',                               'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='171'), true),
  -- 172 Lizenzen
  ('1720', 'Lizenzen',                             'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='172'), true),
  -- 174 Software
  ('1740', 'Selber entwickelte Software',          'aktiv',   (SELECT id FROM public.account_groups WHERE account_number='174'), true),
  -- 200 Verbindlichkeiten L+L
  ('2000', 'Verbindlichkeiten CHF',                'passiv',  (SELECT id FROM public.account_groups WHERE account_number='200'), true),
  ('2008', 'Eigene Gutscheine',                    'passiv',  (SELECT id FROM public.account_groups WHERE account_number='200'), true),
  -- 203 Anzahlungen
  ('2030', 'Erhaltene Anzahlungen von Dritten',    'passiv',  (SELECT id FROM public.account_groups WHERE account_number='203'), true),
  -- 210 Bankverbindlichkeiten
  ('2100', 'Kontokorrent A',                       'passiv',  (SELECT id FROM public.account_groups WHERE account_number='210'), true),
  -- 220 Übrige Verbindlichkeiten
  ('2201', 'Abrechnungskonto MWST',                'passiv',  (SELECT id FROM public.account_groups WHERE account_number='220'), true),
  ('2208', 'Direkte Steuern',                      'passiv',  (SELECT id FROM public.account_groups WHERE account_number='220'), true),
  -- 227 Sozialversicherungen
  ('2270', 'Kontokorrent Vorsorgeeinrichtung',     'passiv',  (SELECT id FROM public.account_groups WHERE account_number='227'), true),
  ('2271', 'Kontokorrent AHV, IV, EO, ALV',        'passiv',  (SELECT id FROM public.account_groups WHERE account_number='227'), true),
  ('2272', 'Kontokorrent FAK',                     'passiv',  (SELECT id FROM public.account_groups WHERE account_number='227'), true),
  ('2273', 'Kontokorrent Unfallversicherung',      'passiv',  (SELECT id FROM public.account_groups WHERE account_number='227'), true),
  ('2274', 'Kontokorrent Krankentaggeldversicherung','passiv',(SELECT id FROM public.account_groups WHERE account_number='227'), true),
  ('2279', 'Kontokorrent Quellensteuer',           'passiv',  (SELECT id FROM public.account_groups WHERE account_number='227'), true),
  -- 230 Passive Rechnungsabgrenzung
  ('2300', 'Noch nicht bezahlter Aufwand',         'passiv',  (SELECT id FROM public.account_groups WHERE account_number='230'), true),
  -- 240 Bankverbindlichkeiten langfristig
  ('2400', 'Darlehen A',                           'passiv',  (SELECT id FROM public.account_groups WHERE account_number='240'), true),
  -- 280 Grundkapital
  ('2800', 'Darlehen Privat',                      'passiv',  (SELECT id FROM public.account_groups WHERE account_number='280'), true),
  -- 282 Kapitaleinlagen
  ('2820', 'Private Bezüge',                       'passiv',  (SELECT id FROM public.account_groups WHERE account_number='282'), true),
  ('2825', 'Private Vorsorgebeiträge',             'passiv',  (SELECT id FROM public.account_groups WHERE account_number='282'), true),
  ('2826', 'Private Steuern',                      'passiv',  (SELECT id FROM public.account_groups WHERE account_number='282'), true),
  -- 290 Reserven
  ('2970', 'Gewinnvortrag oder Verlustvortrag',    'passiv',  (SELECT id FROM public.account_groups WHERE account_number='290'), true),
  ('2979', 'Jahresgewinn oder Jahresverlust',      'passiv',  (SELECT id FROM public.account_groups WHERE account_number='290'), true),
  -- 300 Produktionserlöse
  ('3000', 'Bruttoerlöse Erzeugnis A',             'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='300'), true),
  -- 320 Handelserlöse
  ('3200', 'Pilates',                              'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='320'), true),
  -- 329 Handelserlösminderungen
  ('3298', 'Kommissionen Kreditkarten',            'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='329'), true),
  ('3299', 'Kommissionen PayPal',                  'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='329'), true),
  -- 340 Dienstleistungserlöse
  ('3400', 'Physiotherapie',                       'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='340'), true),
  -- 360 Nebenerlöse
  ('3600', 'Erlös aus Rohmaterial',                'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='360'), true),
  -- 38 Erlösminderungen (direkt unter 2-stelliger Gruppe)
  ('3801', 'Rabatte und Preisnachlässe',           'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='38'), true),
  ('3803', 'Provisionen an Dritte',                'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='38'), true),
  ('3806', 'Kursdifferenzen',                      'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='38'), true),
  ('3807', 'Versandspesen',                        'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='38'), true),
  ('3808', 'Kreditkartenkommissionen',             'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='38'), true),
  ('3809', 'MWST Saldosteuersatz',                 'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='38'), true),
  -- 40 Materialaufwand
  ('4000', 'Materialeinkauf Erzeugnis A',          'aufwand', (SELECT id FROM public.account_groups WHERE account_number='40'), true),
  -- 42 Handelswarenaufwand
  ('4200', 'Einkauf Handelsware A',                'aufwand', (SELECT id FROM public.account_groups WHERE account_number='42'), true),
  -- 44 Dienstleistungsaufwand
  ('4400', 'Einkauf Dienstleistung A',             'aufwand', (SELECT id FROM public.account_groups WHERE account_number='44'), true),
  -- 46 Übriger Aufwand
  ('4600', 'Übriger Materialaufwand Produktion',   'aufwand', (SELECT id FROM public.account_groups WHERE account_number='46'), true),
  -- 47 Einkaufsspesen
  ('4700', 'Eingangsfrachten',                     'aufwand', (SELECT id FROM public.account_groups WHERE account_number='47'), true),
  -- 48 Bestandesänderungen
  ('4800', 'Bestandesänderungen Handelswaren',     'aufwand', (SELECT id FROM public.account_groups WHERE account_number='48'), true),
  -- 49 Einkaufspreisminderungen
  ('4900', 'Skonti',                               'aufwand', (SELECT id FROM public.account_groups WHERE account_number='49'), true),
  ('4901', 'Rabatte und Preisnachlässe',           'aufwand', (SELECT id FROM public.account_groups WHERE account_number='49'), true),
  ('4903', 'Einkaufsprovisionen',                  'aufwand', (SELECT id FROM public.account_groups WHERE account_number='49'), true),
  ('4906', 'Kursdifferenzen',                      'aufwand', (SELECT id FROM public.account_groups WHERE account_number='49'), true),
  -- 50 Löhne Produktion
  ('5000', 'Löhne Produktion',                     'aufwand', (SELECT id FROM public.account_groups WHERE account_number='50'), true),
  -- 52 Löhne Handel
  ('5200', 'Löhne Handel',                         'aufwand', (SELECT id FROM public.account_groups WHERE account_number='52'), true),
  -- 54 Löhne Dienstleistungen
  ('5400', 'Löhne Dienstleistungen',               'aufwand', (SELECT id FROM public.account_groups WHERE account_number='54'), true),
  -- 56 Löhne Verwaltung
  ('5600', 'Löhne Verwaltung',                     'aufwand', (SELECT id FROM public.account_groups WHERE account_number='56'), true),
  -- 57 Sozialversicherungen
  ('5700', 'AHV, IV, EO, ALV',                     'aufwand', (SELECT id FROM public.account_groups WHERE account_number='57'), true),
  ('5720', 'Vorsorgeeinrichtungen',                'aufwand', (SELECT id FROM public.account_groups WHERE account_number='57'), true),
  ('5730', 'Unfallversicherung',                   'aufwand', (SELECT id FROM public.account_groups WHERE account_number='57'), true),
  ('5740', 'Krankentaggeldversicherung',           'aufwand', (SELECT id FROM public.account_groups WHERE account_number='57'), true),
  -- 58 Übriger Personalaufwand
  ('5800', 'Personalinserate',                     'aufwand', (SELECT id FROM public.account_groups WHERE account_number='58'), true),
  ('5810', 'Betriebsnotwendige Ausbildung',        'aufwand', (SELECT id FROM public.account_groups WHERE account_number='58'), true),
  ('5820', 'Reisespesen',                          'aufwand', (SELECT id FROM public.account_groups WHERE account_number='58'), true),
  ('5830', 'Pauschalspesen',                       'aufwand', (SELECT id FROM public.account_groups WHERE account_number='58'), true),
  ('5880', 'Personalanlässe',                      'aufwand', (SELECT id FROM public.account_groups WHERE account_number='58'), true),
  -- 59 Leistungen Dritter
  ('5900', 'Leistungen Dritter',                   'aufwand', (SELECT id FROM public.account_groups WHERE account_number='59'), true),
  -- 60 Raumaufwand
  ('6000', 'Raumaufwand / Miete',                  'aufwand', (SELECT id FROM public.account_groups WHERE account_number='60'), true),
  ('6040', 'Reinigung Fabriklokalitäten',          'aufwand', (SELECT id FROM public.account_groups WHERE account_number='60'), true),
  ('6050', 'Unterhalt Fabriklokalitäten',          'aufwand', (SELECT id FROM public.account_groups WHERE account_number='60'), true),
  -- 61 Unterhalt
  ('6100', 'URE Maschinen und Apparate',           'aufwand', (SELECT id FROM public.account_groups WHERE account_number='61'), true),
  ('6110', 'URE Ladeneinrichtungen',               'aufwand', (SELECT id FROM public.account_groups WHERE account_number='61'), true),
  ('6120', 'URE Zentrallager',                     'aufwand', (SELECT id FROM public.account_groups WHERE account_number='61'), true),
  ('6130', 'URE Büromobiliar',                     'aufwand', (SELECT id FROM public.account_groups WHERE account_number='61'), true),
  -- 62 Fahrzeug
  ('6200', 'Reparaturen',                          'aufwand', (SELECT id FROM public.account_groups WHERE account_number='62'), true),
  ('6260', 'Fahrzeugleasing',                      'aufwand', (SELECT id FROM public.account_groups WHERE account_number='62'), true),
  -- 63 Versicherungen
  ('6300', 'Elementarversicherung',                'aufwand', (SELECT id FROM public.account_groups WHERE account_number='63'), true),
  ('6360', 'Abgaben',                              'aufwand', (SELECT id FROM public.account_groups WHERE account_number='63'), true),
  -- 64 Energie
  ('6400', 'Kraftstrom',                           'aufwand', (SELECT id FROM public.account_groups WHERE account_number='64'), true),
  ('6460', 'Kehrichtabfuhr',                       'aufwand', (SELECT id FROM public.account_groups WHERE account_number='64'), true),
  -- 65 Verwaltung
  ('6500', 'Büromaterial',                         'aufwand', (SELECT id FROM public.account_groups WHERE account_number='65'), true),
  ('6503', 'Fachliteratur, Zeitungen, Zeitschriften','aufwand',(SELECT id FROM public.account_groups WHERE account_number='65'), true),
  ('6510', 'Telefon',                              'aufwand', (SELECT id FROM public.account_groups WHERE account_number='65'), true),
  ('6520', 'Beiträge',                             'aufwand', (SELECT id FROM public.account_groups WHERE account_number='65'), true),
  ('6530', 'Buchführung',                          'aufwand', (SELECT id FROM public.account_groups WHERE account_number='65'), true),
  ('6532', 'Rechtsberatung',                       'aufwand', (SELECT id FROM public.account_groups WHERE account_number='65'), true),
  ('6550', 'Gründungs-, Kapitalerhöhungs- und Organisationsaufwand','aufwand',(SELECT id FROM public.account_groups WHERE account_number='65'), true),
  ('6570', 'Leasing Hardware',                     'aufwand', (SELECT id FROM public.account_groups WHERE account_number='65'), true),
  ('6580', 'Lizenzen, Updates',                    'aufwand', (SELECT id FROM public.account_groups WHERE account_number='65'), true),
  ('6590', 'Konzeptberatung',                      'aufwand', (SELECT id FROM public.account_groups WHERE account_number='65'), true),
  -- 66 Werbung
  ('6600', 'Werbeinserate',                        'aufwand', (SELECT id FROM public.account_groups WHERE account_number='66'), true),
  ('6610', 'Werbedrucksachen, Werbematerial',      'aufwand', (SELECT id FROM public.account_groups WHERE account_number='66'), true),
  ('6620', 'Schaufenster, Dekoration',             'aufwand', (SELECT id FROM public.account_groups WHERE account_number='66'), true),
  ('6640', 'Spesen',                               'aufwand', (SELECT id FROM public.account_groups WHERE account_number='66'), true),
  ('6660', 'Werbebeiträge',                        'aufwand', (SELECT id FROM public.account_groups WHERE account_number='66'), true),
  -- 67 Sonstiger Aufwand
  ('6790', 'Sonstiger betrieblicher Aufwand',      'aufwand', (SELECT id FROM public.account_groups WHERE account_number='67'), true),
  -- 68 Abschreibungen
  ('6820', 'Abschreibungen Maschinen und Apparate','aufwand', (SELECT id FROM public.account_groups WHERE account_number='68'), true),
  ('6821', 'Abschreibungen Mobiliar und Einrichtungen','aufwand',(SELECT id FROM public.account_groups WHERE account_number='68'), true),
  ('6822', 'Abschreibungen Büromaschinen, Informatik','aufwand',(SELECT id FROM public.account_groups WHERE account_number='68'), true),
  ('6823', 'Abschreibungen Fahrzeuge',             'aufwand', (SELECT id FROM public.account_groups WHERE account_number='68'), true),
  ('6824', 'Abschreibungen Werkzeuge und Geräte',  'aufwand', (SELECT id FROM public.account_groups WHERE account_number='68'), true),
  ('6825', 'Abschreibungen Lagereinrichtungen',    'aufwand', (SELECT id FROM public.account_groups WHERE account_number='68'), true),
  ('6830', 'Abschreibungen Geschäftsliegenschaften','aufwand',(SELECT id FROM public.account_groups WHERE account_number='68'), true),
  ('6831', 'Abschreibungen Fabrikgebäude',         'aufwand', (SELECT id FROM public.account_groups WHERE account_number='68'), true),
  ('6835', 'Abschreibungen Büro- und Verwaltungsgebäude','aufwand',(SELECT id FROM public.account_groups WHERE account_number='68'), true),
  -- 69 Finanzaufwand
  ('6900', 'Bankkreditzinsaufwand',                'aufwand', (SELECT id FROM public.account_groups WHERE account_number='69'), true),
  -- 695 Finanzertrag
  ('6950', 'Erträge aus Bankguthaben',             'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='695'), true),
  -- 750/751 Nebenerfolg
  ('7518', 'Rundungsdifferenzen',                  'aufwand', (SELECT id FROM public.account_groups WHERE account_number='751'), true),
  -- 800 Betriebsfremder Aufwand
  ('8000', 'Betriebsfremder Aufwand',              'aufwand', (SELECT id FROM public.account_groups WHERE account_number='800'), true),
  -- 810 Betriebsfremder Ertrag
  ('8100', 'Betriebsfremder Ertrag',               'ertrag',  (SELECT id FROM public.account_groups WHERE account_number='810'), true),
  -- 920 Hilfskonten Gewinn
  ('9200', 'Jahresgewinn oder Jahresverlust',      'aufwand', (SELECT id FROM public.account_groups WHERE account_number='920'), true),
  -- 990 Hilfskonten Debitoren
  ('9942', 'Debi Verrechnung Gutschriften',        'aufwand', (SELECT id FROM public.account_groups WHERE account_number='990'), true)
ON CONFLICT (number) DO NOTHING;
