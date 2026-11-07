import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { RevisaoModule } from "../revisao/revisao.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

/** O painel de operação da plataforma. Só para contas com `role = 'admin'`. */
@Module({
  imports: [AuthModule, RevisaoModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
