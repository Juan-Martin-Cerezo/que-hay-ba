-- Linda (GCBA) still advertises /descubrir/<slug> in its API, but the public
-- event page lives at /eventos/<slug>. Rewrite links captured by earlier ingests.
update events
set url = replace(url, '/descubrir/', '/eventos/')
where source = 'gcba' and url like '%/descubrir/%';

update events
set tickets_url = replace(tickets_url, '/descubrir/', '/eventos/')
where tickets_url like '%/descubrir/%';
