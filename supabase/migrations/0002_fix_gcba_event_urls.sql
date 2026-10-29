-- Linda BA (linda.buenosaires.gob.ar) retired the /descubrir/<slug> route; event pages now live at /eventos/<slug>.
update events
set
  url         = replace(url, 'linda.buenosaires.gob.ar/descubrir/', 'linda.buenosaires.gob.ar/eventos/'),
  tickets_url = replace(tickets_url, 'linda.buenosaires.gob.ar/descubrir/', 'linda.buenosaires.gob.ar/eventos/'),
  sources     = replace(sources::text, 'linda.buenosaires.gob.ar/descubrir/', 'linda.buenosaires.gob.ar/eventos/')::jsonb
where (
  url like '%linda.buenosaires.gob.ar/descubrir/%'
  or tickets_url like '%linda.buenosaires.gob.ar/descubrir/%'
  or sources::text like '%linda.buenosaires.gob.ar/descubrir/%'
);
