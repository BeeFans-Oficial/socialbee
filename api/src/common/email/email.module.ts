import { Global, Module } from "@nestjs/common";

import { EmailService } from "./email.service";

/** Global, como o armazenamento: quem precisa mandar e-mail injeta
 *  `EmailService` sem importar módulo. */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
