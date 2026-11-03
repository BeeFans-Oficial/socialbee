import { Module } from "@nestjs/common";

import { ProfilesModule } from "../profiles/profiles.module";

import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

/** O painel de operação da plataforma. Só para contas com `role = 'admin'`. */
@Module({
  imports: [ProfilesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
