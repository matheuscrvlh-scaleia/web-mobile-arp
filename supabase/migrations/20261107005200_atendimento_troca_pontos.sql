/*
 * Clube ARP: a troca de pontos agora é só no balcão (20261106000200), e quem
 * fica no balcão é o cargo Atendimento. Ele recebe club.redeem ("Trocar
 * pontos no balcão"): achar o visitante, trocar, entregar e desfazer a troca,
 * sem poder mexer na lojinha (isso continua em club.manage).
 *
 * Só o cargo padrão "Atendimento" (o do seed). Cargos criados pela ARP com
 * outro nome não mudam: quem quiser marca a permissão no painel.
 */

update identity.roles
set permissions = array(
  select distinct p from unnest(permissions || array['club.redeem']) p order by p)
where name = 'Atendimento' and not is_system and not ('club.redeem' = any (permissions));
