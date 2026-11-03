-- Fase 2 (29/10/2026): andares viram 1º, 2º e 3º (sem "Térreo") e cupons
-- passam a usar só dois tons: verde e off-white ("sand"). Sem laranja.

-- Andares: só renomeia os rótulos padrão do seed; nomes já editados pela ARP ficam.
update directory.floors
   set label = case level when 0 then '1º andar' when 1 then '2º andar' else '3º andar' end,
       short_label = case level when 0 then '1º' when 1 then '2º' else '3º' end
 where (level = 0 and label = 'Térreo')
    or (level = 1 and label = '1º andar')
    or (level = 2 and label = '2º andar');

comment on column directory.floors.level is
  '0 = 1º andar, 1 = 2º andar…, negativo = subsolo. Ordena os botões de andar do app. O app nunca usa "Térreo".';

-- Cupons: tons escuros/coloridos viram verde; tinta e areia viram off-white.
alter table promotions.coupons drop constraint coupons_tone_check;
update promotions.coupons
   set tone = case when tone in ('ink', 'sand') then 'sand' else 'green' end
 where tone not in ('green', 'sand');
alter table promotions.coupons
  add constraint coupons_tone_check check (tone in ('green', 'sand'));
