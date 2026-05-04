-- Kundenimport aus AbaNinja-Export
-- Erst supabase_customers.sql ausführen, dann dieses Statement

INSERT INTO public.customers (customer_number, name, street, street_number, postal_code, city, country, phone, website) VALUES
  ('A0001', 'Herr Anton Weber',          'Quellenweg',          '1',   '5417', 'Untersiggenthal', 'Schweiz', NULL,               NULL),
  ('A0002', 'Visana',                    NULL,                  NULL,  '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0003', 'KPT Krankenkasse AG',       'Wankdorfallee',       '3',   '3014', 'Bern',             'Schweiz', '+41 58 310 91 11', 'www.kpt.ch'),
  ('A0004', 'Frau Barbara Graubner',     'Staldenstrasse',      '5',   '5417', 'Untersiggenthal', 'Schweiz', NULL,               NULL),
  ('A0005', 'Aquilana',                  NULL,                  NULL,  '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0006', 'Frau Agnes Frozza',         'Seminarsrasse',       '76',  '5430', 'Wettingen',        'Schweiz', NULL,               NULL),
  ('A0007', 'Concordia',                 NULL,                  NULL,  '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0008', 'Frau Eliane Schmid-Löhrli', 'Eichtalboden',        '3e',  '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0009', 'Frau Regula Benz',          'Husmatt',             '10',  '5405', 'Dättwil AG',       'Schweiz', NULL,               NULL),
  ('A0010', 'Frau Evelyne Martinetti',   'Hardstrasse',         '65',  '5430', 'Wettingen',        'Schweiz', NULL,               NULL),
  ('A0011', 'Frau Francine Nad',         'Rainstrasse',         '30',  '5415', 'Nussbaumen AG',    'Schweiz', NULL,               NULL),
  ('A0012', 'EGK',                       NULL,                  NULL,  '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0013', 'CSS',                       NULL,                  NULL,  '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0014', 'Frau Lilly Baraff',         'Bergstrasse',         '22',  '8113', 'Boppelsen',        'Schweiz', NULL,               NULL),
  ('A0015', 'Frau Priska Fries',         'St. Annaweg',         '4c',  '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0016', 'Frau Marga Gyger',          'Haselhalde',          '4',   '5436', 'Würenlos',         'Schweiz', NULL,               NULL),
  ('A0017', 'Frau Ursula Ebling',        'Allmendstrasse',      '9',   '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0018', 'Frau Pia Brandenberg',      'Martinsbergstrasse',  '36B', '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0019', 'Frau Katrina Matter',       'Ländliweg',           '20',  '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0020', 'Frau Martina Ruf',          'St. Ursusstrasse',    '5',   '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0021', 'Herr Ludwig Huser',         'Sonnenbergstrasse',   '18',  '5408', 'Ennetbaden',       'Schweiz', NULL,               NULL),
  ('A0022', 'Frau Regina Isler',         'Erlenweg',            '5',   '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0023', 'Frau Jasmin Benkö',         'Erlenweg',            '10',  '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0024', 'Herr Hansjörg Frei',        'Attenhoferstrasse',   '20',  '5430', 'Wettingen',        'Schweiz', NULL,               NULL),
  ('A0025', 'Herr Wolfgang Hoffelner',   'Buacherstrasse',      '10',  '5452', 'Oberrohrdorf',     'Schweiz', NULL,               NULL),
  ('A0026', 'Frau Roswitha Hoffelner',   'Buacherstrasse',      '10',  '5452', 'Oberrohrdorf',     'Schweiz', NULL,               NULL),
  ('A0027', 'Frau Deborah Fehlmann',     'Allmendstrasse',      '7',   '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0028', 'Helsana',                   NULL,                  NULL,  '5400', 'Baden',            'Schweiz', NULL,               NULL),
  ('A0029', 'Herr Reto Wattenhofer',     'Baldeggstrasse',      '27',  '5400', 'Baden',            'Schweiz', NULL,               NULL)
ON CONFLICT (customer_number) DO NOTHING;
