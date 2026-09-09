import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { buildDataSourceOptions } from "./data-source";

/**
 * Conexão da aplicação.
 *
 * Usa exatamente as mesmas opções do CLI de migration (`buildDataSourceOptions`),
 * num arquivo só: quando as duas configurações vivem separadas, uma roda contra
 * um schema e a outra contra outro, e o sintoma é "a tabela existe mas a API
 * diz que não".
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...buildDataSourceOptions(),
        autoLoadEntities: false,
        // A aplicação não roda migration na subida: quem migra é o entrypoint,
        // uma vez, antes de a porta abrir. Duas instâncias subindo juntas e
        // migrando ao mesmo tempo é como se ganha um deadlock em produção.
        migrationsRun: false,
        retryAttempts: 10,
        retryDelay: 1500,
      }),
    }),
  ],
})
export class DatabaseModule {}
