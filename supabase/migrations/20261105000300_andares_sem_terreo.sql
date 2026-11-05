-- O seed do catálogo do site (04/11) voltou a gravar "Térreo". O app nunca diz
-- "Térreo" (fase 2): o nível 0 é o 1º andar, e a ARP tem 1º, 2º e 3º andar.
-- Só renomeia o rótulo padrão; nomes editados pela ARP ficam.
update directory.floors
   set label = '1º andar', short_label = '1º'
 where level = 0 and label = 'Térreo';

-- Andares que faltam (sem desenho: a ARP desenha no Mapa do painel).
insert into directory.floors (level, label, short_label)
values (0, '1º andar', '1º'), (1, '2º andar', '2º'), (2, '3º andar', '3º')
on conflict (level) do nothing;
