import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { RequestLogInterceptor } from "./common/interceptors/request-log.interceptor";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { LinksModule } from "./links/links.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { TrackingModule } from "./tracking/tracking.module";

/**
 * Montagem da aplicação.
 *
 * A ordem dos guards globais é a ordem em que o Nest os executa, e ela importa:
 *
 *   1. `ThrottlerGuard` — recusa excesso ANTES de qualquer consulta. Se viesse
 *      depois, um ataque de força bruta ainda pagaria um bcrypt por tentativa,
 *      que é justamente o custo que derruba o servidor.
 *   2. `JwtAuthGuard` — exige sessão em tudo que não estiver marcado com
 *      `@Public()`. Fechado por padrão.
 *
 * Os guards de recurso (`LinkOwnerGuard`) ficam na rota, não aqui: eles
 * dependem do parâmetro da URL.
 */
@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      // UM teto global, generoso: o dashboard salva campo por campo e a tela de
      // aparência dispara várias requisições em poucos segundos.
      //
      // Um segundo throttler nomeado aqui NÃO seria "um teto para as rotas de
      // auth": o `ThrottlerGuard` aplica todos os configurados a todas as
      // rotas, e o teto apertado passaria a valer para o dashboard inteiro
      // (foi o que aconteceu na primeira versão — cinco requisições de
      // qualquer tipo e o painel respondia 429). O aperto das rotas de
      // autenticação é declarado nelas, com `@Throttle`, sobrescrevendo este.
      throttlers: [{ name: "default", limit: 240, ttl: 60_000 }],
    }),
    AuthModule,
    ProfilesModule,
    LinksModule,
    TrackingModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
