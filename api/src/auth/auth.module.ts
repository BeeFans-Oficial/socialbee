import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";

import { loadEnv } from "../config/env";
import { ProfilesModule } from "../profiles/profiles.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { Session } from "./entities/session.entity";
import { User } from "./entities/user.entity";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session]),
    ProfilesModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const env = loadEnv();
        return {
          secret: env.jwtSecret,
          signOptions: { algorithm: "HS256" },
          // Aceita apenas HS256 na verificação. Sem isto, um token com
          // `alg: none` ou assinado por outro algoritmo pode ser aceito —
          // é a falha clássica de biblioteca de JWT.
          verifyOptions: { algorithms: ["HS256"] },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
