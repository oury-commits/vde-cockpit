-- VDE Cockpit — 0008 : numérotation atomique des documents (devis / factures).
-- Compteur persistant par entité + type. next_sequence() incrémente sous verrou
-- de ligne (UPDATE … RETURNING) : deux émissions simultanées obtiennent des
-- numéros distincts, et supprimer un document ne libère jamais son numéro.
-- Facture = séquence continue (obligation légale FR). À jouer après 0007.

create table if not exists sequences (
  entite   entite not null,
  type     text not null check (type in ('devis','facture')),
  next_val bigint not null default 0,
  primary key (entite, type)
);

-- Réserve et renvoie le prochain numéro (atomique).
create or replace function next_sequence(p_entite entite, p_type text)
returns bigint
language plpgsql
as $$
declare
  v bigint;
begin
  if p_type not in ('devis','facture') then
    raise exception 'type de séquence invalide : %', p_type;
  end if;
  insert into sequences (entite, type, next_val)
    values (p_entite, p_type, 0)
    on conflict (entite, type) do nothing;
  update sequences
    set next_val = next_val + 1
    where entite = p_entite and type = p_type
    returning next_val into v;
  return v;
end;
$$;

-- RLS : la table n'est pas lue directement par le client (seule la RPC l'écrit).
alter table sequences enable row level security;
drop policy if exists "sequences_authenticated_read" on sequences;
create policy "sequences_authenticated_read" on sequences
  for select to authenticated using (true);

-- La fonction s'exécute avec les droits du définisseur pour l'incrément atomique.
alter function next_sequence(entite, text) security definer;
grant execute on function next_sequence(entite, text) to authenticated;
