-- Fake bowlers for local testing. Apply with: pnpm wrangler d1 execute DB --local --file scripts/seed-dev.sql
-- Adds them to the most recent event as bowlers.
INSERT INTO people (name, nickname, birthdate) VALUES
  ('Test Grandma', 'Nana', '1951-07-04'),
  ('Test Aunt Kim', NULL, '1975-02-14'),
  ('Test Uncle Bob', NULL, '1972-09-30'),
  ('Test Dad', NULL, '1978-05-21'),
  ('Test Mom', NULL, '1980-11-02'),
  ('Test Cousin Sam', NULL, '2004-06-18'),
  ('Test Cousin Jo', NULL, '2007-01-09'),
  ('Test Kid Max', NULL, '2015-08-23'),
  ('Test Kid Lily', NULL, '2018-12-11'),
  ('Test Kid Theo', NULL, '2020-03-30'),
  ('Test Uncle Ray', NULL, '1969-10-10'),
  ('Test Aunt Pat', NULL, '1967-04-01'),
  ('Test Cousin Ana', NULL, '2001-11-27');
INSERT OR IGNORE INTO event_bowlers (event_id, person_id)
  SELECT (SELECT id FROM events ORDER BY year DESC, id DESC LIMIT 1), id FROM people;
